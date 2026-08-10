/**
 * A song's address, made out of its name.
 *
 * `/songs/1697` says nothing — not to a person reading a link before they tap
 * it, not to whoever they sent it to, and not to a search engine deciding what
 * the page is about. `/songs/priyudaa-nee-prema-paadamul-cherithi` says all
 * three at once, and it is the same page.
 *
 * Pure and environment-free, like songSearch: the search worker owns the only
 * copy of the library and resolves slugs there, the main thread runs the same
 * code when it has no worker, and scripts/ builds the sitemap from it under
 * node. One definition, or the URLs in the sitemap are not the URLs the app
 * serves.
 */

/** Anything that has the two fields a slug is made from. */
export interface Named {
  song_id: number
  song_name: string
}

/**
 * Long enough for the double-titled songs ("A – B", the longest is 75), short
 * enough that a URL stays quotable. Truncation happens on a word boundary, so
 * a cut title still reads as words rather than as a severed one.
 */
const MAX = 80

/**
 * The name, as a URL can carry it.
 *
 * Titles are already romanised in the library — of 4,517, only ten hold a
 * non-ASCII character and every one of those is an en-dash or a curly quote, so
 * there is no transliteration to do here. NFKD then dropping combining marks
 * handles the accented Latin that a future import might bring in, turning é
 * into e rather than deleting the letter.
 */
export function slugify(name: string): string {
  const base = (name || '')
    .normalize('NFKD')
    // Combining marks left behind by the decomposition.
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  if (base.length <= MAX) return base
  const cut = base.slice(0, MAX)
  // Back off to the last complete word, unless that would leave almost nothing.
  const lastDash = cut.lastIndexOf('-')
  return (lastDash > MAX * 0.6 ? cut.slice(0, lastDash) : cut).replace(/-+$/, '')
}

export interface SlugIndex {
  /** song_id → its one canonical slug. */
  byId: Map<number, string>
  /** slug → song_id, including the disambiguated forms. */
  bySlug: Map<string, number>
}

/**
 * Give every song exactly one slug, and every slug exactly one song.
 *
 * Fifteen names in the library are shared by two songs each. The collision is
 * broken by suffixing -2, -3 … in song_id order, and the ORDER IS THE POINT: a
 * song keeps whatever slug it was given for as long as it keeps its id, because
 * the songbook only ever grows and a new arrival always sorts after the songs
 * already holding a name. A slug that changed under an import would break every
 * link anyone had shared.
 *
 * A song whose name slugs to nothing at all falls back to its id, so the map is
 * total — there is no song the app cannot address.
 */
export function buildSlugIndex(songs: Named[]): SlugIndex {
  const byId = new Map<number, string>()
  const bySlug = new Map<string, number>()

  for (const song of [...songs].sort((a, b) => a.song_id - b.song_id)) {
    const base = slugify(song.song_name) || String(song.song_id)
    let slug = base
    for (let n = 2; bySlug.has(slug); n++) slug = `${base}-${n}`
    byId.set(song.song_id, slug)
    bySlug.set(slug, song.song_id)
  }

  return { byId, bySlug }
}

/** True for the old numeric form, which stays addressable forever. */
export function isLegacyRef(ref: string): boolean {
  return /^\d+$/.test(ref)
}
