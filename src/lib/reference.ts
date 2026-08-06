import { TE_BOOKS, teBook, type IndexedBible } from './bible'
import { romanizeTelugu, romanMatches, romanPrefix } from './teluguRoman'
import { bilingualScriptureSlides } from './scriptureSlides'

/** Every book's Telugu name romanised once — "యోహాను సువార్త" -> "yohanu suvartha",
 *  which is what someone without a Telugu keyboard actually types. */
const ROMAN: Record<string, string> = Object.fromEntries(
  Object.entries(TE_BOOKS).map(([en, te]) => [en, romanizeTelugu(te)])
)

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
  /** The verses named, expanded and sorted; null means the whole chapter. */
  verses: number[] | null
}

/**
 * Expand a verse spec ("13", "13-16", "13,16", "13-16,20") into a sorted, unique
 * list. Reversed ranges ("16-13") are tolerated. Non-numeric junk is ignored.
 *
 * Ported verbatim from lumen's shared/bible — as this whole file should have
 * been. A comma list is exactly the thing a preacher says ("verses 13 and 16")
 * and the hand-rolled from/to this replaced could not express it.
 */
export function parseVerseSpec(spec: string): number[] {
  const out = new Set<number>()
  for (const part of spec.split(',')) {
    const p = part.trim()
    if (!p) continue
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/)
    if (range) {
      let a = parseInt(range[1], 10)
      let b = parseInt(range[2], 10)
      if (a > b) [a, b] = [b, a]
      for (let n = a; n <= b; n++) out.add(n)
    } else if (/^\d+$/.test(p)) {
      out.add(parseInt(p, 10))
    }
  }
  return [...out].sort((a, b) => a - b)
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

  const hits = suggestBooks(input, order)
  return hits.length === 1 ? hits[0] : null
}

/**
 * Books worth offering for what has been typed — English, Telugu script, or the
 * Telugu name romanised.
 *
 * Real prefixes come first and alone: the near-miss arm exists to rescue a
 * search that found nothing, not to pad one that found the right book with
 * three that merely rhyme with it. It matters because a book's everyday name
 * and the one this translation prints often differ by an inflection — Psalms is
 * printed "కీర్తనల గ్రంథము" (keerthanala granthamu) but spoken of as Keerthanalu
 * — so on a strict prefix the entry would vanish exactly as it is finished.
 */
export function suggestBooks(input: string, order: string[]): string[] {
  const q = norm(input)
  if (!q || !/[a-zఀ-౿]/.test(q)) return []

  /**
   * A leading number is part of the name, and the roman fold throws it away —
   * it strips everything that isn't a letter, so "1 J" folds to "j" and then
   * prefix-matches Zephaniah, Zechariah and everything else beginning with one.
   * So the number is honoured here instead: typed, only that numbered book can
   * match; not typed, the plain book wins over its numbered namesakes, which is
   * what "Yohanu" has to mean if it is to mean anything.
   */
  const num = /^\s*([123])\s*[^0-9]/.exec(input.trim())?.[1] ?? ''
  const numbered = (b: string): string => (/^[123]\s/.test(b) ? b[0] : '')
  const rank = (list: string[]): string[] => {
    const fit = list.filter((b) => numbered(b) === num)
    return fit.length ? fit : num ? [] : list
  }

  const exact = order.filter(
    (b) => norm(b) === q || norm(TE_BOOKS[b] ?? '') === q || ALIASES[q] === b
  )
  if (exact.length) return exact

  const starts = order.filter(
    (b) =>
      norm(b).startsWith(q) ||
      norm(TE_BOOKS[b] ?? '').startsWith(q) ||
      romanPrefix(ROMAN[b] ?? '', input)
  )
  if (starts.length) return rank(starts)
  return rank(order.filter((b) => romanMatches(ROMAN[b] ?? '', input)))
}

/**
 * Parse a reference against a bible's book list. Returns null rather than a
 * guess — the caller says what was wrong with it.
 */
export function parseReference(input: string, order: string[]): Reference | null {
  const s = String(input ?? '').trim()
  if (!s) return null
  // lumen's own shape: book, chapter, then a verse SPEC — a single verse, a
  // range, a comma list, or any mix. An en dash is normalised first, because a
  // phone keyboard produces one and the spec grammar only knows the hyphen.
  const m = /^(.+?)\s*(\d{1,3})?\s*(?::\s*([\d\s,-]+))?$/.exec(
    s
      // An en dash is what a phone keyboard offers for a range, and a full stop
      // is what a lot of people type for the colon ("Rom 8.28"). Both are
      // normalised into the grammar rather than added to it, so the spec stays
      // the one lumen parses.
      .replace(/[–—]/g, '-')
      .replace(/(\d)\s*\.\s*(\d)/g, '$1:$2')
  )
  if (!m) return null
  const book = matchBook(m[1], order)
  if (!book) return null
  const chapter = m[2] ? Number(m[2]) : 0
  if (!chapter) return null
  const verses = m[3] ? parseVerseSpec(m[3]) : null
  // An empty or garbled spec (a lone "-") means the whole chapter, rather than
  // nothing — which is the more useful reading of a half-typed reference.
  return { book, chapter, verses: verses && verses.length ? verses : null }
}

export type VerseLang = 'both' | 'telugu' | 'english'

/**
 * A parsed reference → ONE SLIDE PER VERSE, as the desktop builds them.
 *
 * A passage all on one slide is unreadable from the back of a room and is not
 * what Add verse does on the projection machine — mirrors bilingualScriptureSlides,
 * down to each slide carrying its own reference as label and caption.
 *
 * `lines` is the whole passage flattened, kept only so a presenter too old to
 * know about `slides` still shows the words rather than nothing.
 */
export function versesFor(
  ref: Reference,
  te: IndexedBible | null,
  en: IndexedBible | null,
  lang: VerseLang
): { label: string; lines: string[]; slides: { label: string; lines: string[] }[] } | null {
  const want = ref.verses ? new Set(ref.verses) : null

  const inRange = (b: IndexedBible | null): { verse: number; text: string }[] =>
    (b?.byBook[ref.book]?.[ref.chapter] ?? []).filter((v) => !want || want.has(v.verse))

  const teV = inRange(te)
  const enV = inRange(en)
  if (!teV.length && !enV.length) return null
  // Consecutive runs become ranges and gaps become commas, so a label says what
  // is actually on screen: [13,14,15,16] -> "13-16", [13,16] -> "13,16".
  const nums = [...new Set([...teV, ...enV].map((v) => v.verse))].sort((a, b) => a - b)

  const parts: string[] = []
  for (let i = 0; i < nums.length; ) {
    let j = i
    while (j + 1 < nums.length && nums[j + 1] === nums[j] + 1) j++
    parts.push(j > i ? `${nums[i]}-${nums[j]}` : `${nums[i]}`)
    i = j + 1
  }
  const span = parts.join(',')

  // lumen's own builder, given this app's accessors. The verse numbers are the
  // union of both translations, so a verse present in one and missing from the
  // other still gets its slide.
  const teByVerse = new Map(teV.map((v) => [v.verse, v.text]))
  const enByVerse = new Map(enV.map((v) => [v.verse, v.text]))
  const slides = bilingualScriptureSlides(
    nums,
    lang,
    (n) => teByVerse.get(n) ?? '',
    (n) => enByVerse.get(n) ?? '',
    (n) => `${lang === 'telugu' ? teBook(ref.book) : ref.book} ${ref.chapter}:${n}`
  )
  if (!slides.length) return null
  const lines = slides.flatMap((sl) => sl.lines)

  const label =
    lang === 'telugu'
      ? `${teBook(ref.book)} ${ref.chapter}:${span}`
      : `${ref.book} ${ref.chapter}:${span}`
  return { label, lines, slides }
}
