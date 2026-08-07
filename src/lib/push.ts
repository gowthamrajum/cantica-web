import { RELAY_BASE } from './relay'

/**
 * Turning notifications on, from the phone's side.
 *
 * Web push needs no Apple or Google account and no fee — the relay signs with
 * its own VAPID key pair — so the same code reaches an iPhone and an Android
 * phone alike. What differs is where it is allowed to run: see `installFirst`.
 */

export interface PushState {
  /** This browser can do push at all. */
  supported: boolean
  /**
   * iPhone, in a Safari tab. iOS delivers push only to an app that has been
   * added to the Home Screen — not to a tab, whatever the permission says. So
   * there is nothing to ask for until the app is installed, and asking anyway
   * spends the one prompt the user will ever see on a request that cannot work.
   */
  installFirst: boolean
  /** The relay has its keys set. Without them there is nothing to subscribe to. */
  configured: boolean
  permission: NotificationPermission
  subscribed: boolean
}

const hasApi = (): boolean =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

/** Installed to the Home Screen, rather than running in a browser tab. */
export const isInstalled = (): boolean =>
  typeof window !== 'undefined' &&
  (window.matchMedia?.('(display-mode: standalone)').matches ||
    // Safari's own flag, which predates display-mode and is still the only one
    // that answers on older iOS.
    (navigator as unknown as { standalone?: boolean }).standalone === true)

const isIos = (): boolean =>
  typeof navigator !== 'undefined' &&
  (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
    // iPadOS reports itself as a Mac; the touch points give it away.
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1))

/**
 * The public half of the relay's VAPID pair, as the bytes subscribe() wants.
 *
 * It arrives base64url, and PushManager takes a Uint8Array — atob does not read
 * the URL alphabet, so the two swapped characters are put back first.
 */
function keyBytes(base64url: string): Uint8Array<ArrayBuffer> {
  const padded = base64url.padEnd(base64url.length + ((4 - (base64url.length % 4)) % 4), '=')
  const raw = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  // Built on an ArrayBuffer of its own rather than with Uint8Array.from: only
  // that spells a plain (never shared) buffer, which is what applicationServerKey
  // will take.
  const out = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function serverKey(): Promise<string | null> {
  try {
    const r = await fetch(`${RELAY_BASE}/push/key`, { cache: 'no-store' })
    if (!r.ok) return null
    const j = (await r.json()) as { enabled?: boolean; key?: string | null }
    return j.enabled && j.key ? j.key : null
  } catch {
    return null
  }
}

export async function pushState(): Promise<PushState> {
  const supported = hasApi()
  const installFirst = isIos() && !isInstalled()
  if (!supported) {
    return { supported: false, installFirst, configured: false, permission: 'default', subscribed: false }
  }
  const key = await serverKey()
  let subscribed = false
  try {
    const reg = await navigator.serviceWorker.ready
    subscribed = !!(await reg.pushManager.getSubscription())
  } catch {
    subscribed = false
  }
  return {
    supported: true,
    installFirst,
    configured: !!key,
    permission: Notification.permission,
    subscribed
  }
}

export type EnableResult =
  | { ok: true }
  | { ok: false; reason: 'unsupported' | 'install-first' | 'not-configured' | 'denied' | 'failed' }

/**
 * Ask, subscribe, and tell the relay. Must be called from a tap: both Safari
 * and Chrome refuse a permission prompt that no gesture asked for, and Chrome
 * holds it against the site afterwards.
 */
export async function enablePush(): Promise<EnableResult> {
  if (!hasApi()) return { ok: false, reason: 'unsupported' }
  if (isIos() && !isInstalled()) return { ok: false, reason: 'install-first' }

  const key = await serverKey()
  if (!key) return { ok: false, reason: 'not-configured' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, reason: 'denied' }

  try {
    const reg = await navigator.serviceWorker.ready
    // An existing subscription is reused rather than replaced: subscribing
    // again with the same key returns the same endpoint anyway, and the relay
    // keys on the endpoint, so this stays one row per phone.
    const sub =
      (await reg.pushManager.getSubscription()) ??
      (await reg.pushManager.subscribe({
        // Required by every browser that implements push, and the reason the
        // worker above always shows something.
        userVisibleOnly: true,
        applicationServerKey: keyBytes(key)
      }))

    const r = await fetch(`${RELAY_BASE}/push/subscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...sub.toJSON(), platform: isIos() ? 'ios' : 'other' })
    })
    if (!r.ok) return { ok: false, reason: 'failed' }
    return { ok: true }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}

/** Off on this phone. The relay's row goes too, so it stops being sent to. */
export async function disablePush(): Promise<boolean> {
  if (!hasApi()) return false
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return true
    const endpoint = sub.endpoint
    await sub.unsubscribe()
    await fetch(`${RELAY_BASE}/push/unsubscribe`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ endpoint })
    })
    return true
  } catch {
    return false
  }
}

/* ----------------------------- sending ------------------------------ */

export interface SendReport {
  sent: number
  failed: number
  removed: number
  subscribers: number
}

/** Whether this pin can send, and how many phones would hear it. */
export async function checkPin(pin: string): Promise<{ ok: boolean; subscribers: number; enabled: boolean }> {
  try {
    const r = await fetch(`${RELAY_BASE}/push/status`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    if (!r.ok) return { ok: false, subscribers: 0, enabled: false }
    const j = (await r.json()) as { subscribers?: number; enabled?: boolean }
    return { ok: true, subscribers: Number(j.subscribers ?? 0), enabled: !!j.enabled }
  } catch {
    return { ok: false, subscribers: 0, enabled: false }
  }
}

export async function sendPush(
  pin: string,
  note: { title: string; body: string; url?: string }
): Promise<{ ok: true; report: SendReport } | { ok: false; error: string }> {
  try {
    const r = await fetch(`${RELAY_BASE}/push/send`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin, ...note })
    })
    const j = (await r.json().catch(() => ({}))) as Record<string, unknown>
    if (!r.ok) return { ok: false, error: String(j.error ?? r.status) }
    return {
      ok: true,
      report: {
        sent: Number(j.sent ?? 0),
        failed: Number(j.failed ?? 0),
        removed: Number(j.removed ?? 0),
        subscribers: Number(j.subscribers ?? 0)
      }
    }
  } catch {
    return { ok: false, error: 'unreachable' }
  }
}
