import { useCallback, useEffect, useState } from 'react'
import type { Reference, VerseLang } from './reference'

/**
 * Every passage put up during today's sermon, on this phone.
 *
 * A preacher comes back to a verse — "as we read in Romans 8" — and retyping it
 * is the slow way to say yes. The operator screen lists what has been sent so
 * any of it is one tap from going up again.
 *
 * Kept per room AND per day. A room is the presenter install's slug and is the
 * same every Sunday, so keyed on the room alone this would still be showing
 * last week's sermon. Local to the phone on purpose: it is a convenience for
 * whoever is operating, and it must not cost the relay anything.
 */
export interface SentVerse {
  /** book|chapter|verses — one entry per passage, however often it is sent. */
  key: string
  ref: Reference
  lang: VerseLang
  /** As the passage labelled itself, e.g. "రోమా 8:28-30". */
  label: string
  /** First time it went up today — the order books are listed in. */
  firstAt: number
  /** Last time it went up — which entry is "the one on screen". */
  lastAt: number
}

const PREFIX = 'tcc-sermon-history:'

const today = (): string => {
  const d = new Date()
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

export const refKey = (ref: Reference): string =>
  `${ref.book}|${ref.chapter}|${ref.verses?.join(',') ?? ''}`

function load(room: string): SentVerse[] {
  try {
    const raw = localStorage.getItem(PREFIX + room)
    if (!raw) return []
    const saved = JSON.parse(raw) as { day: string; items: SentVerse[] }
    return saved.day === today() && Array.isArray(saved.items) ? saved.items : []
  } catch {
    return []
  }
}

function save(room: string, items: SentVerse[]): void {
  try {
    localStorage.setItem(PREFIX + room, JSON.stringify({ day: today(), items }))
  } catch {
    /* private mode or storage full — the list still works for this visit */
  }
}

export function useSermonHistory(room: string): {
  items: SentVerse[]
  add: (ref: Reference, lang: VerseLang, label: string) => void
  clear: () => void
} {
  const [items, setItems] = useState<SentVerse[]>(() => load(room))

  useEffect(() => setItems(load(room)), [room])

  const add = useCallback(
    (ref: Reference, lang: VerseLang, label: string) => {
      setItems((prev) => {
        const key = refKey(ref)
        const now = Date.now()
        const had = prev.find((v) => v.key === key)
        // Sent again: same row, so the list doesn't grow a duplicate or move
        // under the operator's thumb. It just becomes the one marked as up.
        const next = had
          ? prev.map((v) => (v.key === key ? { ...v, lang, label, lastAt: now } : v))
          : [...prev, { key, ref, lang, label, firstAt: now, lastAt: now }]
        save(room, next)
        return next
      })
    },
    [room]
  )

  const clear = useCallback(() => {
    setItems([])
    save(room, [])
  }, [room])

  return { items, add, clear }
}

/**
 * The history as books, each with its passages in reading order.
 *
 * Books stay where they first appeared and new ones go to the bottom: a list
 * that re-sorts itself every time a verse goes up is a list where the next tap
 * lands on the wrong row. Inside a book, chapter then verse — the way somebody
 * looks for "the one from chapter 8".
 */
export function groupByBook(items: SentVerse[]): { book: string; verses: SentVerse[] }[] {
  const books: { book: string; first: number; verses: SentVerse[] }[] = []
  for (const v of items) {
    let g = books.find((b) => b.book === v.ref.book)
    if (!g) books.push((g = { book: v.ref.book, first: v.firstAt, verses: [] }))
    g.first = Math.min(g.first, v.firstAt)
    g.verses.push(v)
  }
  books.sort((a, b) => a.first - b.first)
  for (const g of books)
    g.verses.sort(
      (a, b) => a.ref.chapter - b.ref.chapter || (a.ref.verses?.[0] ?? 0) - (b.ref.verses?.[0] ?? 0)
    )
  return books.map(({ book, verses }) => ({ book, verses }))
}

/** One book's passages split by chapter, chapters in order — already sorted by groupByBook. */
export function chaptersOf(verses: SentVerse[]): { chapter: number; verses: SentVerse[] }[] {
  const out: { chapter: number; verses: SentVerse[] }[] = []
  for (const v of verses) {
    const last = out[out.length - 1]
    if (last && last.chapter === v.ref.chapter) last.verses.push(v)
    else out.push({ chapter: v.ref.chapter, verses: [v] })
  }
  return out
}
