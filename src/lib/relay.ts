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
export type ControlCmd = 'next' | 'prev' | 'goto' | 'blackout' | 'clear' | 'logo'

export interface ControlStatus {
  /** a desktop presenter is currently listening for commands */
  online: boolean
  /** the room has a control PIN set */
  hasPin: boolean
  /** the supplied PIN matches */
  pinOk: boolean
}

/** Check whether a room is controllable and whether the given PIN is valid. */
export async function getControlStatus(room: string, pin: string): Promise<ControlStatus> {
  const q = pin ? `?pin=${encodeURIComponent(pin)}` : ''
  const r = await fetch(`${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control/status${q}`, { cache: 'no-store' })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return (await r.json()) as ControlStatus
}

/** Send one command. Returns ok + the HTTP status so callers can react to
 *  401 (bad PIN) / 409 (presenter offline). */
export async function sendControl(
  room: string,
  pin: string,
  cmd: ControlCmd,
  arg?: number
): Promise<{ ok: boolean; status: number; error?: string }> {
  const r = await fetch(`${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ pin, cmd, arg })
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
