// Songs are vendored as a single static file (public/data/songs.json) and served
// by the app — no API. Loaded once, cached, filtered client-side.
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
}

let all: Promise<Song[]> | null = null

// Loaded via dynamic import → a lazy, hashed JS chunk (no .json network request).
function loadAll(): Promise<Song[]> {
  if (!all) {
    all = import('../data/songsData.json').then((m) => m.default as Song[])
  }
  return all
}

/** Name-only list for the index, filtered by an optional search term. */
export async function listSongs(search = ''): Promise<SongMeta[]> {
  const songs = await loadAll()
  const q = search.trim().toLowerCase()
  const metas = songs.map((s) => ({ song_id: s.song_id, song_name: s.song_name }))
  const filtered = q ? metas.filter((s) => s.song_name.toLowerCase().includes(q)) : metas
  return filtered.sort((a, b) => a.song_name.localeCompare(b.song_name))
}

export async function getSong(id: number): Promise<Song | undefined> {
  const songs = await loadAll()
  return songs.find((s) => s.song_id === id)
}
