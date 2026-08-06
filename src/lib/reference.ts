import { TE_BOOKS, teBook, type IndexedBible } from './bible'

/**
 * "John 3:16" typed by someone standing at the back of a church.
 *
 * The preacher says a reference and the operator has a few seconds to put it on
 * the screen, so this is forgiving on purpose: abbreviations, no space after
 * the number of a numbered book, a full stop instead of a colon, an en dash
 * instead of a hyphen, and Telugu book names as readily as English ones. What
 * it will not do is guess between two books that both match — "J" is John,
 * Jonah, Joel, Job, James, Jude and more, and putting the wrong one up is worse
 * than saying it was ambiguous.
 */

export interface Reference {
  book: string
  chapter: number
  /** inclusive; `to` equals `from` for a single verse */
  from: number
  to: number
}

/** Common short forms people actually type, where a prefix match would be wrong
 *  or ambiguous. */
const ALIASES: Record<string, string> = {
  jn: 'John', joh: 'John', jhn: 'John',
  mt: 'Matthew', matt: 'Matthew', mk: 'Mark', mrk: 'Mark', lk: 'Luke', luk: 'Luke',
  ac: 'Acts', rom: 'Romans', ro: 'Romans',
  co: '1 Corinthians', eph: 'Ephesians', phil: 'Philippians', php: 'Philippians',
  col: 'Colossians', heb: 'Hebrews', jas: 'James', jam: 'James',
  rev: 'Revelation', re: 'Revelation', ps: 'Psalms', psa: 'Psalms', psalm: 'Psalms',
  pro: 'Proverbs', prov: 'Proverbs', isa: 'Isaiah', is: 'Isaiah',
  gen: 'Genesis', ge: 'Genesis', ex: 'Exodus', exo: 'Exodus', deut: 'Deuteronomy',
  jer: 'Jeremiah', eze: 'Ezekiel', dan: 'Daniel', gal: 'Galatians'
}

const norm = (s: string): string => s.toLowerCase().replace(/[^a-z0-9ఀ-౿]+/g, '')

/**
 * Which book a name means, or null when it is ambiguous or unknown.
 *
 * Exact first, then alias, then a unique prefix. The numbered books keep their
 * number: "1 john" must not also match "john", which is why the number is part
 * of the normalised name rather than stripped.
 */
export function matchBook(input: string, order: string[]): string | null {
  const q = norm(input)
  if (!q) return null
  // A book name has letters in it. Without this, "3:16" — which is what someone
  // types when the preacher has already said the book — parses as chapter 16 of
  // the only book whose name starts with 3, and 3 John 16 goes on the screen.
  if (!/[a-zఀ-౿]/.test(q)) return null

  for (const b of order) if (norm(b) === q) return b
  // Telugu names, exactly as the bundled table spells them.
  for (const [en, te] of Object.entries(TE_BOOKS)) if (norm(te) === q) return en

  const alias = ALIASES[q]
  if (alias && order.includes(alias)) return alias

  const starts = order.filter((b) => norm(b).startsWith(q))
  if (starts.length === 1) return starts[0]
  const teStarts = Object.entries(TE_BOOKS).filter(([, te]) => norm(te).startsWith(q))
  if (!starts.length && teStarts.length === 1 && order.includes(teStarts[0][0])) return teStarts[0][0]
  return null
}

/**
 * Parse a reference against a bible's book list. Returns null rather than a
 * guess — the caller says what was wrong with it.
 */
export function parseReference(input: string, order: string[]): Reference | null {
  const s = String(input ?? '').trim()
  if (!s) return null
  // Book name, then chapter, then an optional verse or verse range. The book
  // group is lazy so "1 John 3" splits after "1 John" rather than swallowing
  // the 3.
  const m = /^(.+?)\s*(\d{1,3})(?:\s*[:.\s]\s*(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?)?\s*$/.exec(s)
  if (!m) return null
  const book = matchBook(m[1], order)
  if (!book) return null
  const chapter = Number(m[2])
  const from = m[3] ? Number(m[3]) : 1
  const to = m[4] ? Number(m[4]) : m[3] ? from : 999
  if (!chapter || from < 1 || to < from) return null
  return { book, chapter, from, to }
}

export type VerseLang = 'both' | 'telugu' | 'english'

/** A parsed reference → the lines to put on the screen, and what to call it. */
export function versesFor(
  ref: Reference,
  te: IndexedBible | null,
  en: IndexedBible | null,
  lang: VerseLang
): { label: string; lines: string[] } | null {
  const inRange = (b: IndexedBible | null): { verse: number; text: string }[] =>
    (b?.byBook[ref.book]?.[ref.chapter] ?? []).filter((v) => v.verse >= ref.from && v.verse <= ref.to)

  const teV = inRange(te)
  const enV = inRange(en)
  const n = Math.max(teV.length, enV.length)
  if (!n) return null

  const last = Math.max(teV[teV.length - 1]?.verse ?? 0, enV[enV.length - 1]?.verse ?? 0)
  const first = Math.min(teV[0]?.verse ?? 999, enV[0]?.verse ?? 999)
  const span = first === last ? `${first}` : `${first}-${last}`

  const lines: string[] = []
  for (let i = 0; i < n; i++) {
    // Telugu above its English, verse by verse — the same pairing the rest of
    // the app uses, so a verse thrown up mid-sermon looks like everything else.
    if (lang !== 'english' && teV[i]) lines.push(teV[i].text)
    if (lang !== 'telugu' && enV[i]) lines.push(enV[i].text)
  }
  if (!lines.length) return null

  const label =
    lang === 'telugu'
      ? `${teBook(ref.book)} ${ref.chapter}:${span}`
      : `${ref.book} ${ref.chapter}:${span}`
  return { label, lines }
}
