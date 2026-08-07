/**
 * Service Builder — turn a picked set of songs and psalms into the portable
 * "cantica-service" JSON envelope that Cantica imports via Sessions ▸ Import
 * service.
 *
 * The slides carry `lines` only, never a positioned layout, so Cantica auto-fits
 * them with its own theme exactly as if the song had been added inside Cantica.
 * The splitting rules below are a deliberate mirror of lumen-presenter's
 * src/renderer/src/control/slides.ts — keep them in step or the same song
 * paginates differently in each app.
 */
import type { Song } from './songs'
import { usableLinks, type ServiceLink } from './links'

export type ServiceLang = 'both' | 'telugu' | 'english'

/**
 * A slide's backdrop, in the shape Cantica already renders.
 *
 * `value` is a URL for image/video/audio and the bare 11-character id for
 * youtube — that is what lumen's own mediaSlide and youtubeId produce, and a
 * deck edited here has to be indistinguishable from one built there.
 */
export interface SlideBackground {
  type: 'image' | 'video' | 'audio' | 'youtube'
  value: string
  fit?: 'cover' | 'contain'
}

export interface ServiceSlide {
  id: string
  /** 'media' is a backdrop with no words — a clip, a photo, a YouTube link. */
  kind: 'text' | 'scripture' | 'media'
  label: string
  lines: string[]
  singleLine?: boolean
  caption?: string
  background?: SlideBackground
}

/**
 * `kind` is deliberately widened past what this app BUILDS.
 *
 * A deck published from the presenter carries kinds this builder never
 * produces — countdown, blank, ppt, pdf — and once such a deck can be edited
 * here, those items pass through the same code paths as the ones we made. They
 * are typed rather than cast away so that anything reading `kind` has to
 * account for them.
 */
export type ItemKind = 'song' | 'scripture' | 'text' | 'media' | 'video' | 'countdown' | 'blank' | 'ppt' | 'pdf'

export interface ServiceItem {
  id: string
  title: string
  kind: ItemKind
  slides: ServiceSlide[]
  /** where Cantica drops this on import (see SLOT_*) */
  slot?: string
}
export interface ServiceEnvelope {
  format: 'cantica-service'
  version: 1
  exportedAt: string
  service: {
    name: string
    items: ServiceItem[]
    background: unknown
    theme: unknown
    /**
     * Where this particular service can be watched or joined — the stream for
     * this Sunday, a link to the week's notes. Cantica ignores the field (it
     * reads `items` and nothing else), so it rides along harmlessly in a deck
     * the desktop imports; it is for the people reading the service, on the
     * sheet and in this app.
     */
    links?: ServiceLink[]
  }
}

/**
 * Where an imported item belongs in a Sunday order. Cantica reads this to drop
 * worship into the gap between Sunday School and the Sermon, and to put an
 * offering song against the Offerings slot, rather than appending everything to
 * the end. An item with no slot appends, which is what older exports do.
 */
export const SLOT_WORSHIP = 'worship'
export const SLOT_OFFERING = 'offering'
/**
 * Communion, served on the month's first Sunday. Cantica's importer currently
 * routes only 'offering' to a slot of its own and files everything else into
 * the worship set, so a communion item lands there until lumen-presenter's
 * mergeImport learns this slot. The deck still carries the right answer.
 */
export const SLOT_COMMUNION = 'communion'

let _uid = 0
const uid = (): string =>
  `wr-${Date.now().toString(36)}-${(++_uid).toString(36)}-${Math.random().toString(36).slice(2, 6)}`

/** Any character from the Telugu Unicode block. */
const TELUGU_CHAR = /[ఀ-౿]/
const isTelugu = (line: string): boolean => TELUGU_CHAR.test(line)

/** Song-book text carries ragged runs of spaces; collapse 2+ to a pair and trim.
 *  `||…||` repeat markers are left as authored. */
export function formatLyricLine(line: string): string {
  return String(line).replace(/[ \t]{2,}/g, '  ').replace(/^[ \t]+|[ \t]+$/g, '')
}

/**
 * A section's lines in the chosen language. "both" lays each block out as up to
 * 2 Telugu lines followed by THEIR up to 2 English lines, cut on even index
 * boundaries — english[i] is the transliteration of telugu[i], so the pairing
 * has to survive the slide split below.
 */
function pickLines(telugu: string[] = [], english: string[] = [], lang: ServiceLang): string[] {
  if (lang === 'telugu') return telugu.filter((l) => l && l.trim())
  if (lang === 'english') return english.filter((l) => l && l.trim())
  const out: string[] = []
  const n = Math.max(telugu.length, english.length)
  const has = (l?: string): boolean => !!l && String(l).trim().length > 0
  for (let i = 0; i < n; i += 2) {
    const te = [telugu[i], telugu[i + 1]].filter(has) as string[]
    const en = [english[i], english[i + 1]].filter(has) as string[]
    if (!te.length && !en.length) continue
    out.push(...te, ...en)
  }
  return out
}

/** A lyric line ending in a repeat count, e.g. `…Kaadayaa (2)`. */
const REPEAT_LINE = /\(\s*\d+\s*\)\s*(?:\|\|[^|]*\|\|)?\s*$/

/** Single-language split: ~lpp lines/slide, repeats kept with their lead-in,
 *  never a one-line slide, hard cap 2·lpp. */
export function chunkLyricLines(lines: string[], lpp: number, groupRepeats = true): string[][] {
  const cap = lpp * 2
  const slides: string[][] = []
  let cur: string[] = []
  for (const line of lines) {
    const keepWithAbove = groupRepeats && REPEAT_LINE.test(line) && cur.length > 0 && cur.length < cap
    if (cur.length >= lpp && !keepWithAbove) {
      slides.push(cur)
      cur = []
    }
    cur.push(line)
    if (cur.length >= cap) {
      slides.push(cur)
      cur = []
    }
  }
  if (cur.length) slides.push(cur)
  const n = slides.length
  if (n > 1 && slides[n - 1].length < 2) {
    const prev = slides[n - 2]
    if (prev.length > 2) slides[n - 1].unshift(prev.pop() as string)
    else {
      prev.push(...slides[n - 1])
      slides.pop()
    }
  }
  return slides
}

/**
 * Bilingual split that NEVER separates a Telugu line from its transliteration.
 * Rebuilds the [Telugu run][English run] blocks the lines were laid out in and
 * only cuts on a pair boundary; surplus lines with no counterpart get their own
 * single-language slides.
 */
export function chunkBilingualLines(lines: string[], pairsPerSlide: number): string[][] {
  const per = Math.max(1, pairsPerSlide)
  const src = lines.filter((l) => l.trim().length > 0)
  const blocks: { te: string[]; en: string[] }[] = []
  let cur: { te: string[]; en: string[] } | null = null
  for (const line of src) {
    const te = isTelugu(line)
    if (!cur || (te && cur.en.length > 0)) {
      cur = { te: [], en: [] }
      blocks.push(cur)
    }
    ;(te ? cur.te : cur.en).push(line)
  }
  const slides: string[][] = []
  for (const b of blocks) {
    const paired = Math.min(b.te.length, b.en.length)
    for (let i = 0; i < paired; i += per) {
      const n = Math.min(per, paired - i)
      slides.push([...b.te.slice(i, i + n), ...b.en.slice(i, i + n)])
    }
    const leftover = b.te.length > paired ? b.te.slice(paired) : b.en.slice(paired)
    for (let i = 0; i < leftover.length; i += per) slides.push(leftover.slice(i, i + per))
  }
  return slides
}

/**
 * One groupable unit: a lyric line, or — in a bilingual stanza — a Telugu line
 * WITH its transliteration. Keeping the two sides in separate fields is what
 * preserves the Telugu-block-then-English-block layout when several units share
 * a slide, and what makes a unit indivisible when the operator regroups.
 */
export interface SlideUnit {
  lines: string[]
  translit: string[]
}

export function sectionUnits(lines: string[], bilingual: boolean): SlideUnit[] {
  const src = lines.filter((l) => l && l.trim().length > 0)
  if (!bilingual) return src.map((l) => ({ lines: [l], translit: [] }))
  return chunkBilingualLines(src, 1).map((pair) => ({
    lines: pair.filter(isTelugu),
    translit: pair.filter((l) => !isTelugu(l))
  }))
}

/** A unit's lines in render order. */
export const unitLines = (u: SlideUnit): string[] => [...u.lines, ...u.translit]

/** Slice units into slides, stacking every unit's lyric lines then every unit's
 *  transliterations — the block layout the automatic split produces. */
export function applyGroups(units: SlideUnit[], groups: number[]): string[][] {
  const slide = (us: SlideUnit[]): string[] => [...us.flatMap((u) => u.lines), ...us.flatMap((u) => u.translit)]
  const out: string[][] = []
  let i = 0
  for (const g of groups) {
    const n = Math.max(1, Math.floor(g))
    const s = units.slice(i, i + n)
    i += n
    if (s.length) out.push(slide(s))
  }
  if (i < units.length) out.push(slide(units.slice(i)))
  return out
}

/** The unit grouping the automatic split would produce. */
export function autoGroups(lines: string[], bilingual: boolean, lpp: number): number[] {
  const units = sectionUnits(lines, bilingual)
  const src = lines.filter((l) => l && l.trim().length > 0)
  const chunks = bilingual
    ? chunkBilingualLines(src, Math.max(1, Math.round(lpp / 2)))
    : chunkLyricLines(src, lpp, true)
  const out: number[] = []
  let u = 0
  for (const c of chunks) {
    let taken = 0
    let n = 0
    while (u < units.length && taken < c.length) {
      taken += unitLines(units[u]).length
      u++
      n++
    }
    if (n > 0) out.push(n)
  }
  if (u < units.length) out.push(units.length - u)
  return out
}

/** A grouping describes its section only while it accounts for every unit. */
export const groupsFit = (groups: number[] | undefined, unitCount: number): boolean =>
  !!groups?.length && groups.reduce((a, b) => a + b, 0) === unitCount

/** A reordering describes its section only while it is a permutation of every
 *  unit — one that dropped or repeated a line would lose or duplicate lyrics. */
export const orderFits = (order: number[] | undefined, unitCount: number): boolean =>
  !!order &&
  order.length === unitCount &&
  new Set(order).size === unitCount &&
  order.every((i) => Number.isInteger(i) && i >= 0 && i < unitCount)

/** Units in the operator's order. A stale or malformed order is ignored rather
 *  than applied partly. */
export function applyOrder<T>(units: T[], order?: number[]): T[] {
  if (!orderFits(order, units.length)) return units
  return (order as number[]).map((i) => units[i])
}

/** Strict check: every Telugu line on a slide keeps its transliteration. */
export function isSlidePaired(lines: string[]): boolean {
  const te = lines.filter((l) => l.trim() && isTelugu(l)).length
  const en = lines.filter((l) => l.trim() && !isTelugu(l) && /[A-Za-z]/.test(l)).length
  return te === 0 || en === 0 || te === en
}

export interface SongSection {
  id: string
  kind: 'chorus' | 'verse'
  label: string
  lines: string[]
}

/** A song → its sections in written order, in the chosen language. Ids are
 *  stable for a given song+language. (Pallavi is the main_stanza.) */
export function songSections(song: Song, lang: ServiceLang = 'both'): SongSection[] {
  const out: SongSection[] = []
  const ms = song.main_stanza
  if (ms && (ms.telugu?.length || ms.english?.length)) {
    out.push({ id: 'pallavi', kind: 'chorus', label: 'Pallavi', lines: pickLines(ms.telugu, ms.english, lang) })
  }
  ;(song.stanzas ?? []).forEach((st, i) => {
    const n = st.stanza_number ?? i + 1
    out.push({
      id: `stanza-${n}-${i}`,
      kind: 'verse',
      label: `Stanza ${n}`,
      lines: pickLines(st.telugu, st.english, lang)
    })
  })
  return out.filter((s) => s.lines.some((l) => l && l.trim()))
}

const blockKey = (s: SongSection): string => s.lines.map((l) => l.trim()).filter(Boolean).join('\n')
const hasContent = (s: SongSection): boolean => s.lines.some((l) => l.trim().length > 0)

/** Guess which section recurs after each stanza (the Pallavi / chorus). */
export function detectRecurringSection(sections: SongSection[]): string | null {
  const secs = sections.filter(hasContent)
  if (secs.length < 2) return null
  const chorus = secs.find((s) => s.kind === 'chorus')
  if (chorus) return chorus.id
  const labelled = secs.find((s) => /pallavi|chorus|refrain|పల్లవి/i.test(s.label))
  if (labelled) return labelled.id
  const firstId = new Map<string, string>()
  const seen = new Map<string, number>()
  for (const s of secs) {
    const k = blockKey(s)
    if (!k) continue
    seen.set(k, (seen.get(k) ?? 0) + 1)
    if (!firstId.has(k)) firstId.set(k, s.id)
  }
  for (const [k, n] of seen) if (n > 1) return firstId.get(k) ?? null
  return null
}

/** Play order: a recurring section plays after every other included section —
 *  the worship-standard Pallavi, V1, Pallavi, V2, Pallavi. */
export function buildSongArrangement(
  sections: SongSection[],
  includedIds: string[],
  recurringId: string | null,
  opts: { closeWithRefrain?: boolean } = {}
): string[] {
  const byId = new Map(sections.map((s) => [s.id, s]))
  const included = includedIds.map((id) => byId.get(id)).filter(Boolean) as SongSection[]
  if (!included.length) return []
  const rec = recurringId ? byId.get(recurringId) : undefined
  if (rec && includedIds.includes(rec.id) && hasContent(rec)) {
    const recKey = blockKey(rec)
    const isRefrain = (s: SongSection): boolean => blockKey(s) === recKey
    const others = included.filter((s) => !isRefrain(s))
    if (!others.length) return [rec.id]
    const arr = isRefrain(included[0]) ? [rec.id] : []
    others.forEach((s, i) => {
      arr.push(s.id)
      // The refrain comes after the SECTION, not after each go at it. A stanza
      // placed twice is sung through twice and then the refrain — wedging one
      // between the two halves of a doubled stanza is not what doubling it
      // meant.
      if (others[i + 1]?.id !== s.id) arr.push(rec.id)
    })
    // The song closes on the refrain ENTIRE, after the trimmed reprise that
    // follows the last stanza — the hook, and then the whole thing sung out.
    // That is one extra time round, not a different last one, which is why it
    // is added here rather than rendered differently below.
    if (opts.closeWithRefrain && arr[arr.length - 1] === rec.id) arr.push(rec.id)
    return arr
  }
  return included.map((s) => s.id)
}

export interface SongStructure {
  includedIds?: string[]
  recurringId?: string | null
  /** section id -> how many units sit on each slide, when the operator chose */
  groups?: Record<string, number[]>
  /** section id -> the units' order, when the operator moved a line */
  order?: Record<string, number[]>
  /**
   * What comes BACK between the stanzas, as a sequence.
   *
   * A refrain is very often sung whole the first time and differently after
   * each stanza — the last two lines, the hook, the hook twice. So this is an
   * ordered LIST of unit indices, not a set: its order is the order they are
   * sung in, and the same unit may appear more than once. Absent or empty means
   * the whole section comes back as written, which is what every arrangement
   * made before this did.
   *
   * It used to be sorted and de-duplicated on the way through, which threw away
   * both of those. An older arrangement is unaffected — it only ever held an
   * ascending list of distinct units, which is exactly what it still means.
   *
   * Units, not lines: in a bilingual song a Telugu line and its transliteration
   * are one unit, and choosing half of a pair would put a line on the screen
   * with nothing under it.
   */
  repeatUnits?: number[]
  /**
   * The recurring section's WHOLE appearances — the first time through and the
   * close — as a sequence, on the same terms as repeatUnits.
   *
   * Separate from `order` because that is a strict permutation, and has to be:
   * it is what notices a saved order no longer matching a song whose lyrics
   * changed, and ignores it rather than mangling the words. A refrain that sings
   * a line twice is not a permutation, so it cannot live there without giving
   * that guard up.
   *
   * Absent or empty means the section as written, which is what it always was.
   */
  wholeUnits?: number[]
  /**
   * Whether the song closes on the whole refrain, after the trimmed reprise.
   *
   * The ending a song usually wants is the hook once more and then the refrain
   * sung out entire — so this ADDS a time round rather than changing the last
   * one: … S2 · P(hook) · P(whole). Defaults to true, and only means anything
   * when `repeatUnits` names a part; a refrain that comes back whole every time
   * is unaffected either way.
   */
  repeatFullAtEnd?: boolean
}

/** A song → one Cantica item. Omit `structure` and the whole song plays in
 *  written order. */
export function songToItem(
  song: Song,
  lang: ServiceLang = 'both',
  structure: SongStructure | null = null
): ServiceItem | null {
  const both = lang === 'both'
  const lpp = both ? 4 : 2
  const all = songSections(song, lang)
  /**
   * Is part of the refrain actually being held back?
   *
   * A NON-EMPTY repeatUnits is not the same question. The sheet ticks every
   * line of a refrain the moment one is chosen, so it arrives naming the whole
   * thing — and a whole refrain held back is not held back at all. Reading that
   * as trimmed closed the song with a full refrain after a reprise identical to
   * it: Parama Jeevamu ended on the same two slides twice over.
   *
   * So it has to be a PROPER part: at least one unit, and not all of them.
   */
  const recurring = structure?.recurringId ? all.find((s) => s.id === structure.recurringId) : undefined
  const recurringUnits = recurring
    ? sectionUnits(recurring.lines.filter((l) => l && l.trim()).map(formatLyricLine), both).length
    : 0
  const reprise = (structure?.repeatUnits ?? []).filter((i) => i >= 0 && i < recurringUnits)
  const whole = (structure?.wholeUnits ?? []).filter((i) => i >= 0 && i < recurringUnits)
  const wholeAsWritten = whole.length === recurringUnits && whole.every((v, i) => v === i)
  const wholeCustom = whole.length > 0 && !wholeAsWritten
  // "Part of it comes back" has widened to "what comes back is not the section
  // as written": a reordering or a repeated line differs from the full refrain
  // just as a shorter list does, and each wants the same closing statement.
  const asWritten = reprise.length === recurringUnits && reprise.every((v, i) => v === i)
  const trimmed = reprise.length > 0 && !asWritten
  const order = structure?.includedIds?.length
    ? buildSongArrangement(all, structure.includedIds, structure.recurringId ?? null, {
        closeWithRefrain: trimmed && structure.repeatFullAtEnd !== false
      })
    : all.map((s) => s.id)
  const byId = new Map(all.map((s) => [s.id, s]))
  const sections = order.map((id) => byId.get(id)).filter(Boolean) as SongSection[]

  const slides: ServiceSlide[] = []
  /**
   * Where the refrain falls in the running order.
   *
   * The first time is the refrain in full, and so — unless told otherwise — is
   * the last, because that is how a song ends. Only the times in between are the
   * trimmed reprise.
   */
  const recurringAt = structure?.recurringId
    ? sections.reduce<number[]>((acc, s, i) => (s.id === structure.recurringId ? [...acc, i] : acc), [])
    : []
  const lastRecurring = structure?.repeatFullAtEnd === false ? -1 : recurringAt[recurringAt.length - 1] ?? -1
  let sectionIndex = -1
  for (const sec of sections) {
    const lines = sec.lines.filter((l) => l && l.trim()).map(formatLyricLine)
    if (!lines.length) {
      sectionIndex++
      continue
    }
    sectionIndex++
    const isRecurring = !!structure?.recurringId && sec.id === structure.recurringId
    const isReprise =
      isRecurring && sectionIndex !== recurringAt[0] && sectionIndex !== lastRecurring
    const natural = sectionUnits(lines, both)
    const moved = structure?.order?.[sec.id]
    const full = applyOrder(natural, moved)
    // A reprise is the chosen units in the CHOSEN order, a unit as many times
    // as it was chosen — sorting or de-duplicating here is what used to make
    // "the hook, then the hook again" impossible to ask for. When the sequence
    // is the section as written, `full` is passed through by identity, so the
    // section groups and slices exactly as it does anywhere else it appears.
    // Three shapes the recurring section can take: the reprise between the
    // stanzas, the whole thing at the top and the close, and — for every other
    // section — itself.
    const units = isRecurring && wholeCustom && !isReprise
      ? whole.map((i) => full[i])
      : isReprise && trimmed
        ? reprise.map((i) => full[i])
        : full
    const reordered = units !== natural
    // A grouping describes the WHOLE section, so it cannot describe a sequence
    // that is a few of its units, or one of them twice — that falls through to
    // the automatic split, whichever of the shapes above produced it.
    const chosen = units !== full ? undefined : structure?.groups?.[sec.id]
    // An operator grouping wins while it still accounts for every unit; a stale
    // one falls back to the automatic split rather than mis-slicing. Once lines
    // have been moved the fallback has to slice the moved order, not the written
    // one — otherwise the split would silently undo the move.
    /**
     * A reprise is grouped by UNIT COUNT, not by re-splitting its lines.
     *
     * The line-level chunkers read a section's block layout — every Telugu line,
     * then every English one — and a handful of units flattened back out reads
     * as te,en,te,en instead. Splitting that put each pair on a slide of its
     * own. The units are already the right shape, so they are simply dealt out
     * as many per slide as the chunker would have.
     */
    const per = both ? Math.max(1, Math.round(lpp / 2)) : lpp
    const evenly = Array.from({ length: Math.ceil(units.length / per) }, (_, k) =>
      Math.min(per, units.length - k * per)
    )
    const chunks = groupsFit(chosen, units.length)
      ? applyGroups(units, chosen as number[])
      : units !== full
        ? applyGroups(units, evenly)
        : reordered
          ? applyGroups(units, autoGroups(lines, both, lpp))
          : both
            ? chunkBilingualLines(lines, Math.max(1, Math.round(lpp / 2)))
            : chunkLyricLines(lines, lpp, true)
    chunks.forEach((chunk, i) => {
      slides.push({
        id: uid(),
        kind: 'text',
        label: chunks.length > 1 ? `${sec.label} (${i + 1})` : sec.label,
        lines: chunk,
        // Each lyric line stays on one line; Cantica shrinks to fit the widest.
        singleLine: true
      })
    })
  }
  if (!slides.length) return null
  return { id: uid(), title: String(song.song_name ?? 'Song'), kind: 'song', slides }
}

export interface PsalmVerse {
  verse: number
  telugu: string
  english: string
}

/**
 * A psalm becomes the same two items Cantica's own add-psalm makes: a Responsive
 * Reading heading, then one scripture slide per verse captioned with its
 * reference. Mirrors responsiveReadingHeading + bilingualScriptureSlides.
 */
export function psalmToItems(
  chapter: number,
  verses: PsalmVerse[] = [],
  lang: ServiceLang = 'both'
): ServiceItem[] {
  const list = (verses ?? []).filter((v) => v && (v.telugu || v.english))
  if (!list.length) return []

  const nums = list.map((v) => Number(v.verse)).filter((n) => Number.isFinite(n))
  const lo = nums.length ? Math.min(...nums) : null
  const hi = nums.length ? Math.max(...nums) : null
  const reference = lo == null ? String(chapter) : lo === hi ? `${chapter}:${lo}` : `${chapter}:${lo}-${hi}`

  const heading: ServiceItem = {
    id: uid(),
    title: 'Responsive Reading',
    kind: 'scripture',
    slides: [
      {
        id: uid(),
        kind: 'text',
        label: 'Responsive Reading',
        lines: ['ఉత్తర ప్రత్యుత్తర వాక్య పఠనం', 'Responsive Reading', `కీర్తనలు ${reference}`, `Psalm ${reference}`]
      }
    ]
  }

  const slides: ServiceSlide[] = list
    .map((v) => {
      const ref = `Psalm ${chapter}:${v.verse}`
      const te = String(v.telugu ?? '').trim()
      const en = String(v.english ?? '').trim()
      const lines = (lang === 'telugu' ? [te] : lang === 'english' ? [en] : [te, en]).filter(Boolean)
      return { id: uid(), kind: 'scripture' as const, label: ref, lines, caption: ref }
    })
    .filter((s) => s.lines.length > 0)
  if (!slides.length) return []

  return [heading, { id: uid(), title: `Psalm ${reference}`, kind: 'scripture', slides }]
}

/** Cantica's DEFAULT_THEME / DEFAULT_BACKGROUND (mirror of shared/types.ts). */
const CANTICA_THEME = {
  fontFamily: "'Anek Telugu', 'Inter', 'Helvetica Neue', Arial, sans-serif",
  textColor: '#ffffff',
  captionColor: '#ffd27f',
  fontScale: 1,
  textAlign: 'center',
  shadow: true,
  uppercase: false,
  scrim: 0.35
}
const CANTICA_BACKGROUND = {
  type: 'gradient',
  value: 'radial-gradient(circle at 50% 28%, #3a2b6b 0%, #1c1440 55%, #0a0720 100%)',
  fit: 'cover'
}

/**
 * What part a song plays, beyond simply being in the worship set.
 *
 *  - undefined            worship set only (the default)
 *  - 'offering'           sung at the offering and nowhere else
 *  - 'offering+general'   sung in the worship set AND again at the offering
 *  - 'communion'          sung at communion and nowhere else
 *  - 'communion+general'  sung in the worship set AND again at communion
 *
 * A '+general' role is two items in the deck, not one, each carrying its own
 * slot — that is the whole difference between it and the '-only' forms.
 */
export type SongRole = 'offering' | 'offering+general' | 'communion' | 'communion+general'

/** The slot a role sends the song to, or null for the worship set alone. */
export function roleSlot(role?: SongRole): string | null {
  if (!role) return null
  return role.startsWith('communion') ? SLOT_COMMUNION : SLOT_OFFERING
}
/** Whether the song is ALSO sung in the ordinary worship set. */
export function roleAlsoGeneral(role?: SongRole): boolean {
  return !role || role.endsWith('+general')
}

export type Pick =
  | {
      key: string
      type: 'song'
      song: Song
      lang: ServiceLang
      role?: SongRole
      structure?: SongStructure | null
    }
  | { key: string; type: 'psalm'; chapter: number; verses: PsalmVerse[]; lang: ServiceLang }

/** Build the `cantica-service` envelope from an ordered selection. */
export function buildService(
  name: string,
  picks: Pick[] = [],
  links: ServiceLink[] = []
): ServiceEnvelope {
  const items: ServiceItem[] = []
  for (const p of picks) {
    if (p.type === 'song') {
      // A '+general' role emits the song twice — once into the worship set,
      // once into its slot. songToItem is called per copy so each carries its
      // own item and slide ids; sharing them would give Cantica two items
      // claiming one id.
      if (roleAlsoGeneral(p.role)) {
        const worship = songToItem(p.song, p.lang ?? 'both', p.structure ?? null)
        if (worship) items.push({ ...worship, slot: SLOT_WORSHIP })
      }
      const special = roleSlot(p.role)
      if (special) {
        const extra = songToItem(p.song, p.lang ?? 'both', p.structure ?? null)
        if (extra) items.push({ ...extra, slot: special })
      }
    } else {
      // A psalm is a reading, never the offering song.
      items.push(...psalmToItems(p.chapter, p.verses, p.lang ?? 'both').map((it) => ({ ...it, slot: SLOT_WORSHIP })))
    }
  }
  const usable = usableLinks(links)
  return {
    format: 'cantica-service',
    version: 1,
    exportedAt: new Date().toISOString(),
    service: {
      name: name || 'Sunday Service',
      items,
      background: CANTICA_BACKGROUND,
      theme: CANTICA_THEME,
      // Omitted entirely when there are none, so a service without links
      // produces byte-for-byte what it produced before the field existed.
      ...(usable.length ? { links: usable } : {})
    }
  }
}

/** Total slides across the built items — for the UI's summary line. */
export function countSlides(envelope: ServiceEnvelope | null): number {
  return (envelope?.service.items ?? []).reduce((n, it) => n + (it.slides?.length ?? 0), 0)
}
