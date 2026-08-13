// Client for the Cantica broadcast relay (grey-gratis-ice). This UI is meant to
// eventually replace the relay's own /broadcasts page — it consumes the same
// public contract the desktop presenter already publishes.
export const RELAY_BASE = import.meta.env.VITE_RELAY_BASE || 'https://grey-gratis-ice.onrender.com'

export interface SessionSummary {
  room: string
  label?: string
  waiting?: boolean
  updatedAt: number
  viewers?: number
}

export interface ComposedLine {
  text: string
  x: number
  y: number
  fontSize: number
  color?: string
  align?: string
}
export interface Background {
  type: 'color' | 'gradient' | 'image' | 'video' | string
  value: string
}
export interface Slide {
  kind?: string
  lines?: string[]
  composed?: ComposedLine[]
  background?: Background
  caption?: string
  qr?: string
  singleLine?: boolean
  countdownTo?: number
  message?: string
}
export interface Theme {
  textColor?: string
  captionColor?: string
  scrim?: number
  textAlign?: string
  uppercase?: boolean
  shadow?: boolean
  fontScale?: number
}
export interface OrderItem {
  title: string
  kind?: string
  live?: boolean
}
export interface LiveState {
  slide?: Slide | null
  next?: Slide | null
  order?: OrderItem[]
  theme?: Theme
  background?: Background
  blackout?: boolean
  clearText?: boolean
  showLogo?: boolean
  name?: string
}

/** Services currently on air. */
export async function getSessions(): Promise<{ sessions: SessionSummary[]; now: number }> {
  const r = await fetch(`${RELAY_BASE}/sessions.json?view=users`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as { sessions: SessionSummary[]; now: number }
}

// Audience 'users' inherits per-item broadcast restrictions; 'operator' is the
// unsuppressed slice (the phone operator sees every slide like the desktop).
export type LiveView = 'users' | 'operator'
export const stateUrl = (room: string, view: LiveView = 'users'): string =>
  `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/state?view=${view}`
export const streamUrl = (room: string, view: LiveView = 'users'): string =>
  `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/stream?view=${view}`

// ---- phone remote control ----
// The remote drives the same live deck the desktop presenter owns: it POSTs a
// command with the room's control PIN; the relay forwards it to the presenter,
// which runs it and republishes state (which the remote sees on the normal feed).
// `end` takes the room off air: the presenter stops publishing and blacks it
// out. The relay only carries it, so a presenter too old to know the command
// simply ignores it and the broadcast stays up.
// `verse` puts a passage on the screen mid-sermon. It carries the finished
// lines rather than a reference: the operator's phone has both bibles bundled,
// so it resolves the reference there and neither the relay nor the presenter
// needs to know anything about scripture.
export type ControlCmd = 'next' | 'prev' | 'goto' | 'blackout' | 'clear' | 'logo' | 'end' | 'verse'

/**
 * What a `verse` command carries.
 *
 * `slides` is the real payload — one per verse, as the desktop builds them, each
 * labelled with its own reference. `lines` is the whole passage flattened and
 * exists only for a presenter too old to know about `slides`: it shows the words
 * on one slide rather than showing nothing.
 */
export interface VersePayload {
  label: string
  lines: string[]
  slides?: { label: string; lines: string[] }[]
}

export interface ControlStatus {
  /** a presenter is currently listening for commands */
  online: boolean
  /** the room has a control PIN set */
  hasPin: boolean
  /** the supplied PIN matches */
  pinOk: boolean
  /** somebody is already operating this service */
  operatorHeld?: boolean
  /** …and it is this device */
  operatorMine?: boolean
  /** who has it: the device that started the broadcast, or a phone that joined */
  operatorRole?: OperatorRole | null
}

/** 'presenter' is the device the broadcast was started from. */
export type OperatorRole = 'presenter' | 'remote'

/**
 * Check whether a room is controllable, whether the given PIN is valid, and
 * whether its single operator seat is free. Pass `operatorId` to be told that
 * the seat is already yours rather than merely taken.
 */
export async function getControlStatus(room: string, pin: string, operatorId = ''): Promise<ControlStatus> {
  const q = new URLSearchParams()
  if (pin) q.set('pin', pin)
  if (operatorId) q.set('operatorId', operatorId)
  const r = await fetch(
    `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/status${q.size ? `?${q}` : ''}`,
    { cache: 'no-store' }
  )
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as ControlStatus
}

/**
 * Take the room's operator seat, or renew a lease already held.
 *
 * One phone drives at a time — two fight over the same deck — so this answers
 * 409 `operator-taken` when somebody else has it. The lease lapses on its own if
 * a phone stops asking, which is what a flat battery looks like from here.
 */
export async function claimOperator(
  room: string,
  pin: string,
  operatorId: string,
  opts: { role?: OperatorRole; force?: boolean } = {}
): Promise<{ ok: boolean; status: number; error?: string; role?: OperatorRole; freeInMs?: number }> {
  try {
    const r = await fetch(`${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/claim`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin, operatorId, role: opts.role ?? 'remote', force: !!opts.force })
    })
    const j = (await r.json().catch(() => ({}))) as { error?: string; role?: OperatorRole; freeInMs?: number }
    return { ok: r.ok, status: r.status, error: j.error, role: j.role, freeInMs: j.freeInMs }
  } catch {
    return { ok: false, status: 0, error: 'offline' }
  }
}

/** Give the seat back, so the next phone doesn't have to wait out the lease. */
export function releaseOperator(room: string, operatorId: string): void {
  const url = `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/release`
  const body = JSON.stringify({ operatorId })
  // This usually runs as the page is going away, where a normal fetch is
  // cancelled — keepalive (and sendBeacon on pagehide) is what survives it.
  try {
    void fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
      keepalive: true
    }).catch(() => {})
  } catch {
    /* best effort — the lease expires on its own anyway */
  }
}

/** The same release, for `pagehide`, where only a beacon is guaranteed to go. */
export function beaconRelease(room: string, operatorId: string): void {
  try {
    navigator.sendBeacon?.(
      `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/release`,
      new Blob([JSON.stringify({ operatorId })], { type: 'application/json' })
    )
  } catch {
    /* best effort */
  }
}

/** Send one command. Returns ok + the HTTP status so callers can react to
 *  401 (bad PIN) / 409 (presenter offline, or another phone is operating). */
export async function sendControl(
  room: string,
  pin: string,
  cmd: ControlCmd,
  arg?: number | VersePayload,
  operatorId?: string
): Promise<{ ok: boolean; status: number; error?: string }> {
  const r = await fetch(`${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, cmd, arg, operatorId })
  })
  const j = (await r.json().catch(() => ({}))) as { error?: string }
  return { ok: r.ok, status: r.status, error: j.error }
}

// ---- saved services ----
// A service is one gathering: its weekday, its calendar date, and the whole deck
// stored verbatim. `(serviceDate, serviceDay)` is UNIQUE on the relay, so
// creating the same slot twice answers 409 carrying the existing row and the
// exact call to edit it — see CreateResult below. Services are purged once
// their date is more than a week past.
export interface ServiceSummary {
  id: number
  serviceDay: string
  serviceDate: string
  active: boolean
  createdDateTime: string
  updatedDateTime: string
  /** characters of stored deck — only present on the list endpoint */
  serviceDataLength?: number
}

export interface ServiceConflict {
  error: 'conflict'
  message: string
  existing: ServiceSummary
  editWith: { method: 'PUT'; url: string }
}

/**
 * Three outcomes worth distinguishing at the call site: it saved; the slot is
 * taken (and we know exactly how to overwrite it); or it failed.
 */
export type SaveServiceResult =
  | { ok: true; service: ServiceSummary }
  | { ok: false; conflict: ServiceConflict }
  | { ok: false; message: string }

/** The relay answers 400/500 as plain text but 409 as JSON — read either. */
async function readError(r: Response): Promise<string> {
  const body = await r.text().catch(() => '')
  if (!body) return `Request failed (HTTP ${r.status}).`
  try {
    const j = JSON.parse(body) as { message?: string; error?: string }
    return j.message || j.error || body
  } catch {
    return body
  }
}

/**
 * Every service the store is holding between two dates, newest first.
 *
 * Not all of them were built here: the presenter can publish its own order to
 * the same table, and one of those is still a service the church may want to
 * read, share or put on air from a phone. The list says nothing about which is
 * which — only the stored deck knows, and that costs a second request — so the
 * caller decides how much it needs to know before showing a row.
 */
export async function listServices(from: string, to: string): Promise<ServiceSummary[]> {
  try {
    const r = await fetch(
      `${RELAY_BASE}/services?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`,
      { cache: 'no-store' }
    )
    if (!r.ok) return []
    const j = (await r.json()) as { services?: ServiceSummary[] }
    return Array.isArray(j.services) ? j.services : []
  } catch {
    return []
  }
}

/**
 * The service already filed under this slot, if any. Lets a caller know it is
 * about to update rather than create — the list endpoint is narrow (`from`/`to`
 * bracket a single date) and omits the deck, so this is cheap.
 */
export async function findService(
  serviceDay: string,
  serviceDate: string
): Promise<ServiceSummary | null> {
  try {
    const r = await fetch(
      `${RELAY_BASE}/services?from=${encodeURIComponent(serviceDate)}&to=${encodeURIComponent(serviceDate)}`,
      { cache: 'no-store' }
    )
    if (!r.ok) return null
    const j = (await r.json()) as { services: ServiceSummary[] }
    return j.services.find((s) => s.serviceDay === serviceDay) ?? null
  } catch {
    return null
  }
}

/** One stored service, deck included — what the builder reopens itself on. */
export async function getService(
  id: number
): Promise<(ServiceSummary & { serviceData: unknown }) | null> {
  try {
    const r = await fetch(`${RELAY_BASE}/services/${id}`, { cache: 'no-store' })
    if (!r.ok) return null
    return (await r.json()) as ServiceSummary & { serviceData: unknown }
  } catch {
    return null
  }
}

export async function createService(
  serviceDay: string,
  serviceDate: string,
  serviceData: unknown
): Promise<SaveServiceResult> {
  try {
    const r = await fetch(`${RELAY_BASE}/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceDay, serviceDate, serviceData })
    })
    if (r.status === 409) {
      return { ok: false, conflict: (await r.json()) as ServiceConflict }
    }
    if (!r.ok) return { ok: false, message: await readError(r) }
    return { ok: true, service: (await r.json()) as ServiceSummary }
  } catch {
    return { ok: false, message: 'Could not reach the service store. Check your connection.' }
  }
}

/** Replace an existing service's deck (and optionally move its slot). */
export async function updateService(
  id: number,
  serviceData: unknown,
  slot?: { serviceDay: string; serviceDate: string }
): Promise<SaveServiceResult> {
  try {
    const r = await fetch(`${RELAY_BASE}/services/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceData, ...slot })
    })
    if (r.status === 409) {
      return { ok: false, conflict: (await r.json()) as ServiceConflict }
    }
    if (!r.ok) return { ok: false, message: await readError(r) }
    return { ok: true, service: (await r.json()) as ServiceSummary }
  } catch {
    return { ok: false, message: 'Could not reach the service store. Check your connection.' }
  }
}
