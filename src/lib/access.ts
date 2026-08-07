import { RELAY_BASE } from './relay'
import { operatorId } from './operatorId'

/**
 * Who may open the Service Builder, and who is holding a service open.
 *
 * The identity is the same one the operator seat uses — one id per device, kept
 * in localStorage — because it answers the same question: is this the person
 * already holding it, or somebody else?
 */

const PIN_KEY = 'tcc-builder-unlocked'

/* ------------------------------- the gate ------------------------------- */

/** Is the builder gated at all? An unset pin on the relay leaves it open. */
export async function builderPinRequired(): Promise<boolean> {
  try {
    const r = await fetch(`${RELAY_BASE}/builder/pin`, { cache: 'no-store' })
    if (!r.ok) return false
    return !!((await r.json()) as { required?: boolean }).required
  } catch {
    // The relay is unreachable, so nothing can be saved anyway. A gate that
    // locks the screen when it cannot check would be a worse answer than the
    // empty builder they will get regardless.
    return false
  }
}

export async function unlockBuilder(pin: string): Promise<boolean> {
  try {
    const r = await fetch(`${RELAY_BASE}/builder/pin`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin })
    })
    if (!r.ok) return false
    // Remembered for the session only. A shared phone in the sound booth
    // shouldn't stay unlocked for whoever picks it up next week.
    try {
      sessionStorage.setItem(PIN_KEY, '1')
    } catch {
      /* private mode: unlocked for as long as this page lives, which is enough */
    }
    return true
  } catch {
    return false
  }
}

export const builderUnlocked = (): boolean => {
  try {
    return sessionStorage.getItem(PIN_KEY) === '1'
  } catch {
    return false
  }
}

/* ------------------------------- the hold ------------------------------- */

export interface LockState {
  held: boolean
  /** Someone else's name, when it is someone else. */
  by?: string
  /** Milliseconds until an untouched hold frees itself. */
  freeInMs?: number
}

/** Claim a service, or refresh a claim already held. */
export async function holdService(id: number, name: string): Promise<{ ok: true } | { ok: false; lock: LockState }> {
  try {
    const r = await fetch(`${RELAY_BASE}/services/${id}/lock`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ holder: operatorId(), name })
    })
    if (r.ok) return { ok: true }
    const j = (await r.json().catch(() => ({}))) as { by?: string; freeInMs?: number }
    return { ok: false, lock: { held: true, by: j.by, freeInMs: j.freeInMs } }
  } catch {
    // Can't reach the relay: don't invent a lock. Saving will fail on its own
    // and say so, which is a truer error than "someone else is editing".
    return { ok: true }
  }
}

export async function releaseService(id: number): Promise<void> {
  try {
    await fetch(`${RELAY_BASE}/services/${id}/lock?holder=${encodeURIComponent(operatorId())}`, {
      method: 'DELETE',
      // Fires from an unload handler, where a normal fetch is cancelled.
      keepalive: true
    })
  } catch {
    /* the hold frees itself on idle; this only makes it immediate */
  }
}

/** Who holds a service, if anyone — asked before offering to open it. */
export async function serviceLock(id: number): Promise<LockState> {
  try {
    const r = await fetch(`${RELAY_BASE}/services/${id}/lock`, { cache: 'no-store' })
    if (!r.ok) return { held: false }
    return (await r.json()) as LockState
  } catch {
    return { held: false }
  }
}

/** "about 12 minutes" — for telling someone how long until it frees itself. */
export function freeIn(ms?: number): string {
  const m = Math.ceil((ms ?? 0) / 60000)
  if (m <= 1) return 'about a minute'
  return `about ${m} minutes`
}
