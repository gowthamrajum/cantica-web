import { listSongs, getSong } from './songs'
import { loadBible } from './bible'
import type { Pick, PsalmVerse, ServiceEnvelope, ServiceItem, ServiceLang } from './buildService'

/**
 * Recover editable picks from a finished deck.
 *
 * A service published from the presenter is slides, not choices: the songs were
 * arranged there and the deck records the result, never the decisions. So this
 * works backwards from what a deck still says out loud — an item's title — and
 * finds that song in the songbook again.
 *
 * What comes back is therefore the SONG, not the arrangement. Which stanzas
 * played, which repeated, how lines were grouped onto slides: none of that is in
 * the deck and none of it is guessed at here. A recovered song plays in written
 * order, and the caller has to say so, because saving over the original replaces
 * a considered arrangement with a default one.
 *
 * Everything that is not a song or a psalm — welcome cards, the countdown, the
 * sermon, media — has no pick to become. Those are reported rather than dropped
 * quietly: they are most of what makes the presenter's order a service, and
 * whoever is about to overwrite it should be told what leaves.
 */

export interface Recovered {
  picks: Pick[]
  /** Items with no equivalent in the builder, and why. */
  dropped: { title: string; reason: string }[]
}

/** Any character from the Telugu Unicode block. */
const TELUGU = /[ఀ-౿]/

/** Titles compare on letters and digits alone — spacing, case and punctuation
 *  drift between the two apps and none of it distinguishes two songs. */
const norm = (s: string): string =>
  String(s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()

/** "Psalm 23:1-6", "Psalm 23" — the titles psalmToItems writes. */
const PSALM = /^psalm\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3})\s*[-–—]\s*(\d{1,3}))?/i

/** Which languages an item's slides are actually in. */
function langOf(item: ServiceItem): ServiceLang {
  let te = false
  let en = false
  for (const s of item.slides ?? []) {
    for (const l of s.lines ?? []) {
      if (!l || !l.trim()) continue
      if (TELUGU.test(l)) te = true
      else if (/[A-Za-z]/.test(l)) en = true
    }
  }
  if (te && en) return 'both'
  return te ? 'telugu' : 'english'
}

export async function picksFromDeck(envelope: ServiceEnvelope): Promise<Recovered> {
  const items = envelope.service.items ?? []
  const picks: Pick[] = []
  const dropped: { title: string; reason: string }[] = []

  const metas = await listSongs()
  const byName = new Map<string, number>()
  // First writer wins: two songs sharing a name are indistinguishable from a
  // title alone, and picking the later one would be arbitrary rather than right.
  for (const m of metas) {
    const k = norm(m.song_name)
    if (k && !byName.has(k)) byName.set(k, m.song_id)
  }

  // Only pay for the bibles if the deck actually has a reading in it.
  const wantsPsalm = items.some((it) => PSALM.test(String(it.title ?? '')))
  const [te, en] = wantsPsalm
    ? await Promise.all([loadBible('telugu'), loadBible('web')])
    : [null, null]

  for (const [i, it] of items.entries()) {
    const title = String(it.title ?? '').trim()
    const hasWords = (it.slides ?? []).some((s) => (s.lines ?? []).some((l) => l && l.trim()))
    if (!hasWords) {
      dropped.push({ title: title || 'Untitled', reason: 'no words on it — a countdown, media or a blank card' })
      continue
    }

    const psalm = PSALM.exec(title)
    if (psalm) {
      const chapter = Number(psalm[1])
      const teV = te?.byBook['Psalms']?.[chapter] ?? []
      const enByVerse = new Map((en?.byBook['Psalms']?.[chapter] ?? []).map((v) => [v.verse, v.text]))
      let verses: PsalmVerse[] = teV.map((v) => ({
        verse: v.verse,
        telugu: v.text,
        english: enByVerse.get(v.verse) ?? ''
      }))
      const from = psalm[2] ? Number(psalm[2]) : null
      const to = psalm[3] ? Number(psalm[3]) : null
      if (from != null && to != null) verses = verses.filter((v) => v.verse >= from && v.verse <= to)
      if (!verses.length) {
        dropped.push({ title, reason: 'that psalm reference could not be read' })
        continue
      }
      picks.push({ key: `p-${chapter}-${i}`, type: 'psalm', chapter, verses, lang: langOf(it) })
      continue
    }

    // The heading half of a responsive reading: its verses are the next item,
    // which becomes the psalm pick, so the heading is not lost — it is rebuilt.
    if (/^responsive reading$/i.test(title)) continue

    const id = byName.get(norm(title))
    if (id === undefined) {
      dropped.push({ title: title || 'Untitled', reason: 'not a song in this songbook' })
      continue
    }
    const song = await getSong(id)
    if (!song) {
      dropped.push({ title, reason: 'not a song in this songbook' })
      continue
    }
    // No `structure`: the arrangement is not in the deck, so the song comes back
    // whole and in written order rather than pretending to remember.
    picks.push({ key: `s-${id}-${i}`, type: 'song', song, lang: langOf(it), structure: null })
  }

  return { picks, dropped }
}
