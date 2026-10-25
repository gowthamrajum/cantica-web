import type { ServiceItem, ServiceSlide } from './buildService'

/**
 * The sermon outline — the preacher's points on one slide.
 *
 * It belongs INSIDE the sermon, straight after the card, the way a verse quoted
 * during it does. One per sermon. The points are the slide's lines, so it
 * auto-fits like any text slide, and the sermon's title rides as the caption.
 *
 * A deliberate mirror of lumen-presenter's control/outline.ts: the presenter
 * reads the same `outline` flag to send a finished verse back here, and to tell
 * the phone operator where "Back to outline" goes. Keep the two in step.
 */
export interface Outline {
  title: string
  points: string[]
}

const OUTLINE_LABEL = 'Sermon outline'
/** The item an outline travels in when the service has no sermon card of its own. */
export const OUTLINE_ITEM_TITLE = 'Sermon Outline'
/** The church's own sermon card, matched in both languages. */
export const SERMON = /sermon|వాక్యోపదేశం/i

let _uid = 0
const uid = (): string =>
  `wo-${Date.now().toString(36)}-${(++_uid).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

export const isOutline = (sl: ServiceSlide): boolean => sl.outline === true

/** Points typed one per line, blank lines dropped. */
export const pointsOf = (text: string): string[] =>
  text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

/** Nothing worth a slide: no points. */
export const isEmptyOutline = (o: Outline | null | undefined): boolean => !o || !o.points.length

/** Whatever was stored, as an outline or null. */
export function readOutlineValue(v: unknown): Outline | null {
  if (!v || typeof v !== 'object') return null
  const o = v as { title?: unknown; points?: unknown }
  const points = Array.isArray(o.points) ? o.points.map(String).map((p) => p.trim()).filter(Boolean) : []
  return points.length ? { title: String(o.title ?? '').trim(), points } : null
}

/** The outline in an item's slides, read back for editing. */
export function readOutline(slides: ServiceSlide[]): Outline | null {
  const sl = slides.find(isOutline)
  return sl ? { title: sl.caption ?? '', points: sl.lines } : null
}

/** The outline anywhere in a deck — in the sermon card, or standing on its own. */
export const outlineInDeck = (items: ServiceItem[]): Outline | null => {
  for (const it of items) {
    const o = readOutline(it.slides ?? [])
    if (o) return o
  }
  return null
}

export function outlineSlide(o: Outline, id: string = uid()): ServiceSlide {
  const title = o.title.trim()
  return {
    id,
    kind: 'text',
    label: title || OUTLINE_LABEL,
    lines: o.points,
    ...(title ? { caption: title } : {}),
    outline: true,
    // The phones can follow along; the stream keeps whatever the sermon says,
    // since a block of points over the camera hides the preacher.
    broadcastUsers: true
  }
}

/**
 * The slides with this outline in them — replacing the one already there
 * (keeping its id), or going in straight after the card. An empty outline
 * takes it out.
 */
export function withOutline(slides: ServiceSlide[], o: Outline | null): ServiceSlide[] {
  const at = slides.findIndex(isOutline)
  if (isEmptyOutline(o)) return at < 0 ? slides : slides.filter((_, i) => i !== at)
  const out = slides.slice()
  if (at >= 0) out[at] = outlineSlide(o!, slides[at].id)
  else out.splice(Math.min(1, out.length), 0, outlineSlide(o!))
  return out
}
