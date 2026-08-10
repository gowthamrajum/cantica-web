/**
 * The songbook and the search over it — the algorithm, with nothing around it.
 *
 * Deliberately free of any browser: no DOM, no worker, no globals beyond the
 * module's own caches. That is what lets the same code run in three places that
 * cannot share an environment — inside the search worker, on the main thread
 * when a worker cannot be had, and under node in scripts/search-audit.mjs,
 * which is the only reason the accuracy figures mean anything.
 *
 * The library is vendored rather than fetched: the builder has to work in a
 * church hall with no signal. See scripts/refresh-songs.mjs.
 */
import { buildSlugIndex, isLegacyRef, type SlugIndex } from './songSlug'

export interface Stanza {
  stanza_number?: number
  telugu?: string[]
  english?: string[]
}
export interface Song {
  song_id: number
  song_name: string
  main_stanza?: Stanza
  stanzas?: Stanza[]
}
export interface SongMeta {
  song_id: number
  song_name: string
  /** The song's URL segment. See songSlug — required so a list cannot link by id. */
  slug: string
  /** The lyric line a search matched on, when the title wasn't what matched. */
  snippet?: string
}

let all: Promise<Song[]> | null = null

// Loaded via dynamic import → a lazy, hashed JS chunk (no .json network request).
function loadAll(): Promise<Song[]> {
  if (!all) {
    all = import('../data/songsData.json').then((m) => m.default as Song[])
  }
  return all
}

/** How many songs the bundled library holds — the songbook grows, so nothing
 *  that shows the number should carry its own copy of it. */
export async function countSongs(): Promise<number> {
  return (await loadAll()).length
}

// ----------------------------------------------------------------- slugs ---
/** Built once per environment, off the same library everything else reads. */
let slugIndex: Promise<SlugIndex> | null = null
function loadSlugs(): Promise<SlugIndex> {
  if (!slugIndex) slugIndex = loadAll().then(buildSlugIndex)
  return slugIndex
}

/** Every song's slug, for anything that needs the whole map (the sitemap). */
export async function allSlugs(): Promise<{ song_id: number; slug: string; song_name: string }[]> {
  const [songs, ix] = await Promise.all([loadAll(), loadSlugs()])
  return songs.map((s) => ({ song_id: s.song_id, song_name: s.song_name, slug: ix.byId.get(s.song_id)! }))
}

/**
 * Turn whatever is in the URL into a song, and say what that song's URL should
 * have been.
 *
 * Takes the slug or the old numeric id, because every `/songs/1697` ever shared
 * or bookmarked has to keep working. The caller compares the returned slug with
 * what it was given and redirects when they differ, so a song is reachable by
 * two addresses but only ever settles on one.
 */
export async function resolveSong(ref: string): Promise<{ song: Song; slug: string } | undefined> {
  const [songs, ix] = await Promise.all([loadAll(), loadSlugs()])
  const id = isLegacyRef(ref) ? Number(ref) : ix.bySlug.get(ref)
  if (id === undefined) return undefined
  const song = songs.find((s) => s.song_id === id)
  if (!song) return undefined
  return { song, slug: ix.byId.get(id) ?? String(id) }
}

// ---------------------------------------------------------------- searching
/**
 * Searching the songbook.
 *
 * People do not look a song up by its title. They remember a phrase from the
 * middle of the second stanza, or three words in the wrong order, or a
 * transliteration spelled the way they would spell it rather than the way the
 * book does. So the search reads the whole song, not the name, and asks only
 * that every word the user typed appears SOMEWHERE in it — in any order, on any
 * line, across stanzas.
 *
 * Because a match can then come from deep inside a song, a result carries the
 * line it matched on. A title that plainly doesn't contain what was typed,
 * offered with no explanation, reads as a broken search.
 */

/** Combining marks, dropped so "Yesayyā" and "Yesayya" are the same word. */
const MARKS = /[\u0300-\u036f]/g
/** ||repeat|| markers and the (2) counts are notation in the songbook, not words. */
const NOTATION = /\|\|[^|]*\|\||\(\s*\d+\s*\)/g

/**
 * Lowercased, unaccented, punctuation-free — and Telugu intact.
 *
 * \p{M} has to be kept alongside letters and digits: Telugu writes its vowels
 * as combining signs and joins consonants with a virama, all of which are marks
 * rather than letters. Dropping them does not tidy a Telugu word, it dismantles
 * it into bare consonants that then match almost anything.
 */
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(MARKS, '')
    .toLowerCase()
    .replace(NOTATION, ' ')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .trim()
}

/**
 * How a transliterated word SOUNDS, with every spelling choice folded away.
 *
 * Telugu romanisation is not standardised and never has been. The same word is
 * written Prabhu and Prabu, Aaraadhana and Aradhana, Sthuthi and Stuti,
 * Yesayya and Yesaiyya, vaari and waari — none of these are mistakes, they are
 * different people writing the same sound. Matching them by spelling means the
 * search finds a song only for whoever happens to spell it the book's way.
 *
 * So a word is reduced to a phonetic skeleton and words are compared on that.
 * Every rule below folds a distinction Telugu does not make in Latin script:
 *
 *   aspirates      kh gh ch jh th dh ph bh  →  their plain consonant
 *   sibilants      sh ss z                  →  s, j
 *   nasals         ng gn jn                 →  n
 *   vowel length   aa ee ii oo uu           →  a i u
 *   diphthongs     ai ay ei / au ou ow      →  e / o
 *   v and w, q and k, f and p
 *   a silent h anywhere but the start
 *   any doubled letter
 *
 * Applied to both sides of a comparison, so it can only ever make two spellings
 * of one word agree — it never invents a match between different words.
 */
function phonetic(w: string): string {
  return w
    .replace(/chh/g, 'c')
    .replace(/ch/g, 'c')
    .replace(/sh|ss/g, 's')
    .replace(/kh/g, 'k')
    .replace(/gh/g, 'g')
    .replace(/jh/g, 'j')
    .replace(/th/g, 't')
    .replace(/dh/g, 'd')
    .replace(/ph/g, 'p')
    .replace(/bh/g, 'b')
    // ng, gn and jn only. NOT ny: y is far more often standing in for a vowel
    // ("Nynnu" for "Ninnu") than forming ñ, and folding those into a bare n
    // deleted the vowel with it.
    .replace(/ng|gn|jn/g, 'n')
    // Whatever h is left is not part of an aspirate. At the start of a word it
    // is a real sound (Hallelujah); anywhere else it is decoration.
    .replace(/(?!^)h/g, '')
    .replace(/aa/g, 'a')
    // No ea here: that is an English spelling, and in Telugu the sequence only
    // turns up once a silent h has been dropped ("snehamu" → "sneamu"), where
    // folding it to i moved the word away from the "snaihamu" it should match.
    .replace(/ee|ii/g, 'i')
    .replace(/oo|uu/g, 'u')
    .replace(/ai|ay|ei/g, 'e')
    .replace(/au|ou|ow/g, 'o')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/q/g, 'k')
    .replace(/x/g, 'ks')
    .replace(/f/g, 'p')
    .replace(/y/g, 'i')
    .replace(/(.)\1+/g, '$1')
}

/**
 * Is `a` within `max` edits of `b` — letters added, dropped or mistyped?
 *
 * A banded Levenshtein: only the diagonal within `max` is worth computing,
 * because anything outside it is already too far. That keeps the work
 * proportional to the word rather than to its square, which matters when this
 * runs against every word in the songbook.
 */
function near(a: string, b: string, max: number): boolean {
  const la = a.length
  const lb = b.length
  if (Math.abs(la - lb) > max) return false
  let prev = new Array<number>(lb + 1)
  let curr = new Array<number>(lb + 1)
  for (let j = 0; j <= lb; j++) prev[j] = j
  for (let i = 1; i <= la; i++) {
    curr[0] = i
    const from = Math.max(1, i - max)
    const to = Math.min(lb, i + max)
    if (from > 1) curr[from - 1] = max + 1
    let best = max + 1
    for (let j = from; j <= to; j++) {
      curr[j] = Math.min(
        prev[j] + 1,
        curr[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)
      )
      if (curr[j] < best) best = curr[j]
    }
    if (best > max) return false
    for (let j = to + 1; j <= lb; j++) curr[j] = max + 1
    const swap = prev
    prev = curr
    curr = swap
  }
  return prev[lb] <= max
}

/** A title word's "line", so one map can hold both title and lyric words. */
const TITLE = -1

interface Indexed {
  song_id: number
  song_name: string
  /** normalized title */
  name: string
  /** the same title as it sounds, so a misspelled query can still be ranked */
  nameSound: string
  /** every lyric line, as written — the source of a snippet */
  lines: string[]
  /** the same lines normalized, one for one */
  norm: string[]
  /**
   * Every transliterated word → where it was first seen, held BOTH as written
   * and as it sounds.
   *
   * Both, because the two catch different mistakes. The sound catches a
   * different spelling of the same word; the spelling catches a slip of the
   * finger, which the fold would otherwise amplify beyond recognition — drop
   * the b from "Prabhuni" and the now-orphaned h disappears too and the au
   * becomes o, leaving "proni" three edits from "prabuni" but only one from
   * "prahuni".
   */
  keys: Map<string, number>
}

/** Every key in the songbook, so a word can be ruled out before any song is
 *  searched for it. */
interface Library {
  entries: Indexed[]
  vocabulary: Set<string>
}

let index: Promise<Library> | null = null

/** Built once, lazily: the whole songbook normalized for matching. */
function loadIndex(): Promise<Library> {
  if (!index) {
    index = loadAll().then((songs) => {
      const vocabulary = new Set<string>()
      const entries = songs.map((s) => {
        const lines: string[] = []
        for (const block of [s.main_stanza, ...(s.stanzas ?? [])]) {
          if (!block) continue
          for (const l of [...(block.telugu ?? []), ...(block.english ?? [])]) {
            if (l && l.trim()) lines.push(l.trim())
          }
        }
        const name = normalize(s.song_name)
        const norm = lines.map(normalize)

        // Each transliterated word as written and as it sounds, remembering
        // where it was first seen so a fuzzy match can still show the line it
        // came from. Telugu script is left out: it spells one sound one way, so
        // it has nothing to fold and matches exactly already.
        const keys = new Map<string, number>()
        const add = (text: string, at: number): void => {
          for (const w of text.split(' ')) {
            if (w.length < 2 || !/^[a-z]+$/.test(w)) continue
            if (!keys.has(w)) keys.set(w, at)
            const k = phonetic(w)
            if (k && !keys.has(k)) keys.set(k, at)
            vocabulary.add(w)
            if (k) vocabulary.add(k)
          }
        }
        add(name, TITLE)
        norm.forEach((l, i) => add(l, i))

        const nameSound = name
          .split(' ')
          .map((w) => (/^[a-z]+$/.test(w) ? phonetic(w) : w))
          .join(' ')

        return { song_id: s.song_id, song_name: s.song_name, name, nameSound, lines, norm, keys }
      })
      return { entries, vocabulary }
    })
  }
  return index
}

/**
 * Best first. WHERE a song matched decides the order; how exactly it matched
 * only breaks ties.
 *
 * That ordering is the whole point. Search "prabu" and one song has a stray
 * "Prabuvaa" inside the third stanza while a dozen are titled "Prabhu …" — the
 * titles are what was meant, even though the stray is the one spelled exactly
 * as typed. Ranking exactness first put that stray at the top of 602 results.
 *
 * A title is therefore checked against its sound as well as its spelling, which
 * is also what gives a misspelled query any ordering at all: compared only
 * against spellings it is already known not to match, every fuzzy result scores
 * the same and lands in alphabetical order.
 */
function rankOf(
  e: Indexed,
  query: string,
  sound: string,
  terms: string[],
  matched: number,
  inTitle: number,
  sounded: boolean,
  missed: number
): number {
  // A song found only by ignoring a word the user typed sits below every song
  // that accounted for all of them, whatever else it has going for it.
  const short = missed > 0 ? 20 : 0
  if (e.name.startsWith(query)) return short
  if (e.nameSound.startsWith(sound)) return short + 1
  if (e.name.includes(query)) return short + 2
  if (e.nameSound.includes(sound)) return short + 3
  // Every word is in the title, just not as one phrase.
  if (inTitle === matched) return short + (sounded ? 5 : 4)
  if (matched > 1) {
    // In the lyrics, and in the order they were typed — the strongest thing a
    // multi-word search can find outside the title, because a remembered line
    // is remembered as a line.
    if (e.norm.some((l) => l.includes(query))) return short + 6
    // On one line, in some other order. Still one phrase of one song, unlike
    // words gathered from three different stanzas.
    //
    // Counted against what MATCHED, not against everything typed: a word the
    // song never had would otherwise disqualify the very line that carries all
    // the words it does have.
    if (e.norm.some((l) => terms.filter((t) => l.includes(t)).length >= matched)) return short + 7
  }
  // Some in the title, the rest in the lyrics.
  if (inTitle > 0) return short + 8
  return short + (sounded ? 10 : 9)
}

/**
 * The line worth showing as the reason this song matched.
 *
 * Not simply the first line that hits: a query usually mixes a common word with
 * a telling one, and the common word matches line 1 of everything. Scoring a
 * line by the total length of the terms on it picks the line carrying the most,
 * and the most specific, of what was actually typed.
 */
function bestLine(e: Indexed, terms: string[], sounds: string[]): string | undefined {
  let best = -1
  let score = 0
  for (let i = 0; i < e.norm.length; i++) {
    let s = 0
    for (const t of terms) if (e.norm[i].includes(t)) s += t.length
    if (s > score) {
      score = s
      best = i
    }
  }
  if (best >= 0) return e.lines[best]
  // Nothing was spelled the way it was typed, so fall back to wherever the
  // sound was found — otherwise a fuzzy match shows no reason for itself.
  for (const k of sounds) {
    const at = e.keys.get(k)
    if (at !== undefined && at !== TITLE) return e.lines[at]
  }
  return undefined
}

/** Name-only list for the index, filtered by an optional search term. */
export async function listSongs(search = ''): Promise<SongMeta[]> {
  const { entries, vocabulary } = await loadIndex()
  const slugs = await loadSlugs()
  const slugOf = (id: number): string => slugs.byId.get(id) ?? String(id)
  const query = normalize(search)
  const byName = (a: SongMeta, b: SongMeta): number => a.song_name.localeCompare(b.song_name)
  if (!query) {
    return entries
      .map((e) => ({ song_id: e.song_id, song_name: e.song_name, slug: slugOf(e.song_id) }))
      .sort(byName)
  }

  const terms = query.split(' ').filter(Boolean)
  const sounds = terms.map(phonetic)
  const phrase = sounds.join(' ')

  /**
   * Is this word anywhere in the songbook at all, however loosely?
   *
   * Asked once against the whole vocabulary rather than song by song. A word
   * that nothing answers to — the invented one in a half-remembered line — used
   * to be re-checked against every song's words in turn, seventeen hundred
   * times over, which is most of a second spent proving the same nothing again
   * and again. The answer cannot differ per song, so it is settled here.
   */
  const absent = terms.map((t, i) => {
    const k = sounds[i]
    if (vocabulary.has(t) || (k && vocabulary.has(k))) return false
    const slack = Math.max(t.length, k.length) >= 7 ? 2 : 1
    for (const word of vocabulary) {
      if (
        (k.length >= 3 && word.startsWith(k)) ||
        (Math.max(k.length, word.length) >= 4 && near(word, k, slack)) ||
        (t.length >= 4 && near(word, t, slack))
      ) {
        return false
      }
    }
    return true
  })

  /**
   * Does this song satisfy the words, and how?
   *
   * `budget` is the edit tolerance per word; `allowMissed` how many words may
   * go unaccounted for altogether.
   */
  const match = (
    e: Indexed,
    budget: number,
    allowMissed: number
  ): { inTitle: number; lyric: boolean; sounded: boolean; missed: number } | null => {
    let inTitle = 0
    let lyric = false
    let sounded = false
    let missed = 0

    for (let i = 0; i < terms.length; i++) {
      const t = terms[i]
      // As spelled — the precise answer, and the common one.
      if (e.name.includes(t)) {
        inTitle++
        continue
      }
      if (e.norm.some((l) => l.includes(t))) {
        lyric = true
        continue
      }

      // As it sounds. A word only reaches here when nothing in the song is
      // spelled that way, so this cannot displace an exact match, only rescue a
      // search that would otherwise have come back empty.
      const k = sounds[i]
      let at = k ? e.keys.get(k) : undefined
      // Still typing, or a letter out: a key this is the beginning of, or one
      // close enough to it. Both need a word long enough that the fold hasn't
      // reduced it to something too small to mean anything.
      // Either form being long enough is reason to look — unless the whole
      // songbook has already said it has no such word. Gating on the sound
      // alone shut the door on words the fold shrinks to nothing: a letter
      // dropped from "Raaja" leaves "Raaa", which sounds like "ra" and so never
      // reached the spelling comparison it was one edit away from passing.
      if (at === undefined && !absent[i] && (k.length >= 3 || t.length >= 4)) {
        // Both forms of the typed word are tried against both forms of every
        // word in the song: the sound, which finds a different spelling, and
        // the spelling, which finds a slip of the finger the fold would have
        // amplified. A word only needs to answer to one of them.
        const raw = t.length >= 4
        // Two edits is a lot of a short word. On "zzqq" it is half of it, which
        // was enough to marry pure noise to a real song — and one spurious hit
        // is all it takes to convince the search it succeeded, so the pass that
        // would have forgiven the nonsense never ran. Long words can afford the
        // second edit; short ones cannot.
        const slack = budget > 1 && Math.max(t.length, k.length) >= 7 ? 2 : 1
        for (const [key, line] of e.keys) {
          // The length bar is on the typed word while the search is being paid
          // for on every keystroke, and on the longer of the two once it is
          // not. Folding can leave a short key for an ordinary word — "Yeesu"
          // comes out as "isu" — and measuring only the typed side refuses to
          // compare it with the four-letter key it is one edit from. Measuring
          // both sides finds it, and costs five times as much, because every
          // short word then has to be checked against every key in the book.
          const bar = budget > 1 ? Math.max(k.length, key.length) : k.length
          if (
            // Each test carries its own length bar. The prefix needs its OWN,
            // because folding can leave a word one letter long — "zzzz" comes
            // out as "j" — and "every word starting with j" is not a search
            // result, it is the songbook.
            (k.length >= 3 && key.startsWith(k)) ||
            (bar >= 4 && near(key, k, slack)) ||
            (raw && near(key, t, slack))
          ) {
            at = line
            break
          }
        }
      }
      if (at === undefined) {
        // Nothing in this song answers to that word. Let it go, if there is
        // room to: half-remembered phrases carry a word the song never had.
        if (++missed > allowMissed) return null
        continue
      }
      sounded = true
      if (at === TITLE) inTitle++
      else lyric = true
    }
    return { inTitle, lyric, sounded, missed }
  }

  const collect = (budget: number, allowMissed: number): { meta: SongMeta; rank: number }[] => {
    const out: { meta: SongMeta; rank: number }[] = []
    for (const e of entries) {
      const m = match(e, budget, allowMissed)
      if (!m) continue
      out.push({
        meta: {
          song_id: e.song_id,
          song_name: e.song_name,
          slug: slugOf(e.song_id),
          // Only worth showing when the title alone doesn't explain the match.
          snippet: m.lyric ? bestLine(e, terms, sounds) : undefined
        },
        rank: rankOf(e, query, phrase, terms, terms.length - m.missed, m.inTitle, m.sounded, m.missed)
      })
    }
    return out
  }

  // Each step down is reached only by finding nothing at all, so a search that
  // was going to succeed never pays for the ones below it — and the page is
  // only ever empty once every one of them has come back empty too.
  //
  //   1. every word, spelled or sounded, one edit of slack
  //   2. the same, with two — a typo the fold amplified past recognition
  //   3. every word but one, for a phrase remembered with a word that
  //      isn't in the song, or one word too many
  let hits = collect(1, 0)
  if (!hits.length) hits = collect(2, 0)
  if (!hits.length && terms.length > 1) hits = collect(2, 1)

  return hits.sort((a, b) => a.rank - b.rank || byName(a.meta, b.meta)).map((h) => h.meta)
}

/**
 * One page of results, and how many there are in all.
 *
 * The ranking is unchanged and still considers every song — that is what makes
 * the best match the first result rather than the first result of the first
 * page. Only the slice handed back is bounded: a search for a common word
 * matches most of the library, and shipping four thousand of them across a
 * worker boundary to render fifty is work nobody asked for.
 */
export async function searchPage(
  search: string,
  offset = 0,
  limit = 50
): Promise<{ songs: SongMeta[]; total: number }> {
  const all = await listSongs(search)
  const from = Math.max(0, offset)
  return { songs: all.slice(from, from + Math.max(1, limit)), total: all.length }
}

export async function getSong(id: number): Promise<Song | undefined> {
  const songs = await loadAll()
  return songs.find((s) => s.song_id === id)
}
