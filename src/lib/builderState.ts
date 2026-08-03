import { getSong } from './songs'
import { loadBible } from './bible'
import type { OfferingUse, Pick, PsalmVerse, ServiceLang, SongStructure } from './buildService'

/**
 * A compact record of *how* a service was assembled, saved alongside the deck so
 * the builder can be reopened on it.
 *
 * The envelope alone can't do this: `buildService` renders a song down to
 * finished slides, and the arrangement that produced them — which stanzas play,
 * which repeats, how lines were grouped — isn't recoverable from the output. So
 * the picks are recorded separately, by reference rather than by value: a song
 * is its id (the songbook is bundled in the app), a psalm is its chapter and
 * verse range. That keeps the sidecar small and lets it survive a songbook
 * update.
 *
 * The relay stores serviceData verbatim and never inspects its shape, so this
 * rides along under a `builder` key on the envelope.
 */
export const BUILDER_STATE_VERSION = 1

export type SavedPick =
  | {
      type: 'song'
      songId: number
      lang: ServiceLang
      /**
       * Sidecars written before the offering role became a choice stored `true`
       * for what is now 'only', so the stored shape has to admit both and be
       * normalised on the way in. See readOffering.
       */
      offering?: OfferingUse | boolean
      structure?: SongStructure | null
    }
  | {
      type: 'psalm'
      chapter: number
      /** inclusive verse range; omitted means the whole psalm */
      from?: number
      to?: number
      lang: ServiceLang
    }

export interface BuilderState {
  version: number
  day: string
  date: string
  picks: SavedPick[]
}

/** Distil the live picks into something small enough to store and reload. */
export function toBuilderState(day: string, date: string, picks: Pick[]): BuilderState {
  return {
    version: BUILDER_STATE_VERSION,
    day,
    date,
    picks: picks.map((p): SavedPick =>
      p.type === 'song'
        ? {
            type: 'song',
            songId: p.song.song_id,
            lang: p.lang,
            offering: p.offering,
            structure: p.structure ?? null
          }
        : {
            type: 'psalm',
            chapter: p.chapter,
            // The Pick keeps resolved verses, not the range that produced them —
            // the ends of the list are that range.
            from: p.verses[0]?.verse,
            to: p.verses[p.verses.length - 1]?.verse,
            lang: p.lang
          }
    )
  }
}

/** Legacy `true` meant offering-only; `false`/absent means the worship set. */
function readOffering(v: OfferingUse | boolean | undefined): OfferingUse | undefined {
  if (v === true) return 'only'
  if (v === 'only' || v === 'both') return v
  return undefined
}

/** Pull a builder sidecar out of a stored service, if it carries one. */
export function readBuilderState(serviceData: unknown): BuilderState | null {
  if (!serviceData || typeof serviceData !== 'object') return null
  const b = (serviceData as { builder?: unknown }).builder
  if (!b || typeof b !== 'object') return null
  const s = b as Partial<BuilderState>
  if (!Array.isArray(s.picks)) return null
  return { version: Number(s.version ?? 1), day: String(s.day ?? ''), date: String(s.date ?? ''), picks: s.picks }
}

/**
 * Rebuild live picks from a sidecar. Anything that no longer resolves — a song
 * dropped from the songbook, a psalm range that doesn't exist — is skipped
 * rather than failing the whole load, and reported so the caller can say what
 * went missing.
 */
export async function fromBuilderState(
  state: BuilderState
): Promise<{ picks: Pick[]; skipped: number }> {
  const picks: Pick[] = []
  let skipped = 0

  // Psalms need both bibles; only pay for them if the service actually has one.
  const needsBible = state.picks.some((p) => p.type === 'psalm')
  const [te, en] = needsBible
    ? await Promise.all([loadBible('telugu'), loadBible('web')])
    : [null, null]

  for (const [i, p] of state.picks.entries()) {
    if (p.type === 'song') {
      const song = await getSong(p.songId)
      if (!song) {
        skipped++
        continue
      }
      picks.push({
        key: `s-${p.songId}-${i}`,
        type: 'song',
        song,
        lang: p.lang,
        offering: readOffering(p.offering),
        structure: p.structure ?? null
      })
    } else {
      const teV = te?.byBook['Psalms']?.[p.chapter] ?? []
      const enByVerse = new Map((en?.byBook['Psalms']?.[p.chapter] ?? []).map((v) => [v.verse, v.text]))
      let verses: PsalmVerse[] = teV.map((v) => ({
        verse: v.verse,
        telugu: v.text,
        english: enByVerse.get(v.verse) ?? ''
      }))
      if (p.from != null && p.to != null) {
        verses = verses.filter((v) => v.verse >= p.from! && v.verse <= p.to!)
      }
      if (!verses.length) {
        skipped++
        continue
      }
      picks.push({ key: `p-${p.chapter}-${i}`, type: 'psalm', chapter: p.chapter, verses, lang: p.lang })
    }
  }

  return { picks, skipped }
}
