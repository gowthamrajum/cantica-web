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

export const stateUrl = (room: string): string => `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/state?view=users`
export const streamUrl = (room: string): string => `${RELAY_BASE}/broadcast/${encodeURIComponent(room)}/stream?view=users`
