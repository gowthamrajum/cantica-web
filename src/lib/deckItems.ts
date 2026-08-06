import type { ServiceItem, SlideBackground } from './buildService'

/**
 * Items added to a finished deck from this app.
 *
 * These are written in Cantica's own shape, not a shape of our own that Cantica
 * would then have to be taught: a media item here is byte-for-byte what
 * lumen's `mediaSlide` produces, so an order edited on a phone and an order
 * built at the projection machine are the same thing, and neither app can tell
 * which made which.
 */

let _uid = 0
const uid = (): string =>
  `wa-${Date.now().toString(36)}-${(++_uid).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/**
 * The 11-character video id from any common YouTube URL — or null if it isn't
 * one. A deliberate mirror of lumen's shared/youtube.ts: both apps have to
 * agree on what counts as a YouTube link, or a deck edited here plays as a
 * broken <video> there.
 */
export function youtubeId(input: string): string | null {
  const s = (input ?? '').trim()
  if (!s) return null
  if (/^[a-zA-Z0-9_-]{11}$/.test(s)) return s
  let u: URL
  try {
    u = new URL(withScheme(s))
  } catch {
    return null
  }
  const host = u.hostname.replace(/^www\./, '').toLowerCase()
  const isYt =
    host === 'youtube.com' ||
    host === 'm.youtube.com' ||
    host === 'music.youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be'
  if (!isYt) return null

  let id = ''
  if (host === 'youtu.be') id = u.pathname.slice(1)
  else if (u.pathname === '/watch') id = u.searchParams.get('v') ?? ''
  else {
    const m = /^\/(?:embed|shorts|v|live)\/([^/?#]+)/.exec(u.pathname)
    if (m) id = m[1]
  }
  return /^[a-zA-Z0-9_-]{11}$/.test(id) ? id : null
}

/** A pasted address with no scheme means https, not a path on this app. */
export function withScheme(url: string): string {
  const s = String(url ?? '').trim()
  if (!s) return ''
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
}

const VIDEO = /\.(mp4|m4v|mov|webm|ogv|mkv)(\?|#|$)/i
const AUDIO = /\.(mp3|m4a|aac|wav|ogg|flac)(\?|#|$)/i
const IMAGE = /\.(jpe?g|png|gif|webp|avif|bmp|svg)(\?|#|$)/i

/**
 * What a URL points at, decided from its extension.
 *
 * A link with no recognisable extension is treated as a VIDEO rather than
 * refused: the overwhelming majority of what anyone pastes into a service is
 * something to play, and a wrong guess shows a black frame the operator can see
 * and fix, where a refusal just blocks them.
 */
export function backgroundForUrl(url: string): SlideBackground | null {
  const href = withScheme(url)
  if (!href) return null
  const yt = youtubeId(href)
  if (yt) return { type: 'youtube', value: yt, fit: 'cover' }
  try {
    // eslint-disable-next-line no-new
    new URL(href)
  } catch {
    return null
  }
  if (IMAGE.test(href)) return { type: 'image', value: href, fit: 'cover' }
  if (AUDIO.test(href)) return { type: 'audio', value: href, fit: 'cover' }
  if (VIDEO.test(href)) return { type: 'video', value: href, fit: 'cover' }
  return { type: 'video', value: href, fit: 'cover' }
}

/** A name for something the operator didn't name. */
export function defaultMediaName(url: string, background: SlideBackground): string {
  if (background.type === 'youtube') return 'YouTube video'
  try {
    const last = decodeURIComponent(new URL(withScheme(url)).pathname.split('/').filter(Boolean).pop() ?? '')
    if (last) return last.replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').trim() || 'Media'
  } catch {
    /* fall through */
  }
  return 'Media'
}

/**
 * A backdrop as one item in the order.
 *
 * `lines: []` is what makes it a backdrop rather than a slide with words on it,
 * and is also how the phone broadcast knows to skip it — the relay carries
 * words, not video.
 */
export function mediaItem(name: string, background: SlideBackground): ServiceItem {
  return {
    id: uid(),
    title: name,
    kind: background.type === 'image' ? 'media' : 'video',
    slides: [{ id: uid(), kind: 'media', label: name, lines: [], background }]
  }
}

/** Put items into a deck at `index`, or at the end when index is null. */
export function insertAt(items: ServiceItem[], index: number | null, added: ServiceItem[]): ServiceItem[] {
  if (!added.length) return items
  const at = index == null ? items.length : Math.max(0, Math.min(index, items.length))
  const out = items.slice()
  out.splice(at, 0, ...added)
  return out
}
