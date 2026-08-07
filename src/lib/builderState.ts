import { getSong } from './songs'
import { loadBible } from './bible'
import { usableLinks, type ServiceLink } from './links'
import type { Pick, PsalmVerse, ServiceLang, SlideBackground, SongRole, SongStructure } from './buildService'

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
      role?: SongRole
      /**
       * Legacy, read but never written. The field was called `offering` and
       * held `true`, then 'only' | 'both', before communion made it a role.
       * See readRole.
       */
      offering?: 'only' | 'both' | boolean
      structure?: SongStructure | null
    }
  | {
      /**
       * A clip or a picture. The background carries the URL, so reopening the
       * service finds the same file — nothing about it is re-derivable from the
       * deck the way a song is from its id.
       */
      type: 'media'
      title: string
      background: SlideBackground
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
  /** Where this service can be watched or joined. Also on the envelope, but
   *  read back from here — this is the record of what was typed. */
  links?: ServiceLink[]
}

/** Distil the live picks into something small enough to store and reload. */
export function toBuilderState(
  day: string,
  date: string,
  picks: Pick[],
  links: ServiceLink[] = []
): BuilderState {
  const usable = usableLinks(links)
  return {
    version: BUILDER_STATE_VERSION,
    day,
    date,
    ...(usable.length ? { links: usable } : {}),
    picks: picks.map((p): SavedPick =>
      p.type === 'song'
        ? {
            type: 'song',
            songId: p.song.song_id,
            lang: p.lang,
            role: p.role,
            structure: p.structure ?? null
          }
        : p.type === 'media'
        ? { type: 'media', title: p.title, background: p.background }
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

/** A stored pick's role, migrating the two older offering encodings. */
function readRole(p: { role?: SongRole; offering?: 'only' | 'both' | boolean }): SongRole | undefined {
  if (p.role) return p.role
  if (p.offering === true || p.offering === 'only') return 'offering'
  if (p.offering === 'both') return 'offering+general'
  return undefined
}

/** Pull a builder sidecar out of a stored service, if it carries one. */
export function readBuilderState(serviceData: unknown): BuilderState | null {
  if (!serviceData || typeof serviceData !== 'object') return null
  const b = (serviceData as { builder?: unknown }).builder
  if (!b || typeof b !== 'object') return null
  const s = b as Partial<BuilderState>
  if (!Array.isArray(s.picks)) return null
  return {
    version: Number(s.version ?? 1),
    day: String(s.day ?? ''),
    date: String(s.date ?? ''),
    picks: s.picks,
    links: usableLinks(Array.isArray(s.links) ? s.links : [])
  }
}

/**
 * Which app put a service in the store.
 *
 * Written by the presenter when it publishes its own order; absent on
 * everything this builder saves, and on anything saved before either app knew
 * to say. So "no origin" means "built here", which is the safe reading — a
 * service with a builder sidecar is reopenable whatever it claims, and one
 * without is not.
 */
export interface ServiceOrigin {
  app?: string
  publishedAt?: string
}

export function readOrigin(serviceData: unknown): ServiceOrigin | null {
  if (!serviceData || typeof serviceData !== 'object') return null
  const o = (serviceData as { origin?: unknown }).origin
  if (!o || typeof o !== 'object') return null
  const { app, publishedAt } = o as ServiceOrigin
  return { app: app ? String(app) : undefined, publishedAt: publishedAt ? String(publishedAt) : undefined }
}

/** Assembled on the projection machine and published from there. */
export const isFromPresenter = (serviceData: unknown): boolean =>
  readOrigin(serviceData)?.app === 'lumen-presenter'

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
        role: readRole(p),
        structure: p.structure ?? null
      })
    } else if (p.type === 'media') {
      // Nothing to look up: the file is wherever it was uploaded, and the
      // background carries that address. A clip whose file has since been
      // deleted still comes back as an item — better a broken picture the
      // operator can see and replace than a silently shorter service.
      picks.push({ key: `m-${i}`, type: 'media', title: p.title, background: p.background })
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
