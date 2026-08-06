/**
 * A place to go that isn't the building.
 *
 * Two things use this. The church's standing gatherings each have one — the
 * Sunday stream, the midweek Zoom room — and those live in church.ts because
 * they change about once a year. A service being built can carry its own, for
 * the Sunday somebody streams from a different account or hands out a link to
 * the week's notes; those are stored with the deck.
 *
 * `kind` only decides which icon and colour a link gets, so it is worked out
 * from the address rather than asked for.
 */
export type LinkKind = 'youtube' | 'zoom' | 'link'

export interface ServiceLink {
  label: string
  url: string
  kind: LinkKind
}

/** The links worth showing — the ones that actually lead somewhere. A link with
 *  no address renders as nothing, rather than as a button that goes nowhere. */
export const usableLinks = (links?: ServiceLink[]): ServiceLink[] =>
  (links ?? []).filter((l) => l && typeof l.url === 'string' && l.url.trim().length > 0)

/**
 * What a pasted address is. Matched on the host, not on the whole string —
 * "youtube" appearing in a path or a query is not what makes a YouTube link.
 */
export function linkKindOf(url: string): LinkKind {
  let host = ''
  try {
    host = new URL(withScheme(url)).hostname.replace(/^www\./, '').toLowerCase()
  } catch {
    return 'link'
  }
  if (host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be') return 'youtube'
  if (host === 'zoom.us' || host.endsWith('.zoom.us')) return 'zoom'
  return 'link'
}

/** Somebody pasting "zoom.us/j/123" means https. A bare host with no scheme is
 *  read as a relative path by both `new URL` and an <a href>, which would point
 *  the link at this app instead of at the meeting. */
export function withScheme(url: string): string {
  const s = url.trim()
  if (!s) return ''
  return /^[a-z][a-z0-9+.-]*:/i.test(s) ? s : `https://${s}`
}

/** A link ready to store: trimmed, given a scheme, and classified. Returns null
 *  when there is nothing usable to store. */
export function toLink(label: string, url: string): ServiceLink | null {
  const href = withScheme(url)
  if (!href) return null
  return { label: label.trim() || defaultLabel(href), url: href, kind: linkKindOf(href) }
}

/** What to call a link nobody named. */
export function defaultLabel(url: string): string {
  const kind = linkKindOf(url)
  if (kind === 'youtube') return 'Watch on YouTube'
  if (kind === 'zoom') return 'Join on Zoom'
  try {
    return new URL(withScheme(url)).hostname.replace(/^www\./, '')
  } catch {
    return 'Open link'
  }
}
