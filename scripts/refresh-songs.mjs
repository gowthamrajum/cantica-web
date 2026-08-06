/**
 * Refresh the bundled songbook from the live library.
 *
 * The songs are vendored rather than fetched: the builder has to work in a
 * church hall with no signal, and a service being assembled is not the moment
 * to discover the library is a network away. So the whole library ships inside
 * the app, and this is how it gets there.
 *
 * It keeps only what the app reads — song_id, song_name, main_stanza, stanzas —
 * and drops the rest of each row (timestamps, who touched it, the source slug).
 * Those are real fields the library needs and this app never looks at, and at
 * four and a half thousand songs they are pure weight in everybody's browser.
 *
 *   node scripts/refresh-songs.mjs                          report what would change
 *   node scripts/refresh-songs.mjs --apply                   write src/data/songsData.json
 *   node scripts/refresh-songs.mjs --apply --allow-shrink    …when songs were removed on purpose
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'src', 'data', 'songsData.json')
const BASE = process.env.RELAY_BASE || 'https://grey-gratis-ice.onrender.com'
const APPLY = process.argv.includes('--apply')
/** Songs really were removed from the library — see the refusal below. */
const ALLOW_SHRINK = process.argv.includes('--allow-shrink')

const mb = (n) => `${(n / 1048576).toFixed(1)} MB`

/** Only the lines. A stanza with neither side is not a stanza. */
function block(b) {
  if (!b || typeof b !== 'object') return undefined
  const telugu = (b.telugu ?? []).map(String).filter((l) => l.trim())
  const english = (b.english ?? []).map(String).filter((l) => l.trim())
  if (!telugu.length && !english.length) return undefined
  const out = {}
  if (b.stanza_number != null) out.stanza_number = Number(b.stanza_number)
  if (telugu.length) out.telugu = telugu
  if (english.length) out.english = english
  return out
}

const trim = (s) => {
  const out = { song_id: Number(s.song_id), song_name: String(s.song_name ?? '').trim() }
  const main = block(s.main_stanza)
  if (main) out.main_stanza = main
  const stanzas = (s.stanzas ?? []).map(block).filter(Boolean)
  if (stanzas.length) out.stanzas = stanzas
  return out
}

console.log(`reading ${BASE}/songs …`)
const res = await fetch(`${BASE}/songs`, { signal: AbortSignal.timeout(180_000) })
if (!res.ok) throw new Error(`the library answered HTTP ${res.status}`)
const raw = await res.json()
const rows = Array.isArray(raw) ? raw : raw.songs
if (!Array.isArray(rows)) throw new Error('the library did not return a list of songs')

// Sorted by id so a refresh produces a readable diff rather than a reshuffle.
const songs = rows
  .map(trim)
  .filter((s) => Number.isFinite(s.song_id) && s.song_name)
  .sort((a, b) => a.song_id - b.song_id)

const before = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : []
const had = new Set(before.map((s) => s.song_id))
const has = new Set(songs.map((s) => s.song_id))
const added = songs.filter((s) => !had.has(s.song_id))
const gone = before.filter((s) => !has.has(s.song_id))

const text = JSON.stringify(songs)
console.log(`\n  library      ${rows.length} songs`)
console.log(`  bundled now  ${before.length}`)
console.log(`  after this   ${songs.length}   (+${added.length} new, -${gone.length} gone)`)
console.log(`  file         ${mb(fs.existsSync(OUT) ? fs.statSync(OUT).size : 0)} -> ${mb(Buffer.byteLength(text))}`)

// A song with no words is a row somebody started and never finished; it can be
// searched for by name but has nothing to project.
const empty = songs.filter((s) => !s.main_stanza && !s.stanzas?.length)
if (empty.length) {
  console.log(`\n  ${empty.length} songs have no lyrics at all — they will be findable but blank:`)
  empty.slice(0, 5).forEach((s) => console.log(`     ${s.song_id}  ${s.song_name}`))
}
if (gone.length) {
  console.log(`\n  ${gone.length} songs are in the bundle but no longer in the library:`)
  gone.slice(0, 5).forEach((s) => console.log(`     ${s.song_id}  ${s.song_name}`))
}
if (added.length) {
  console.log(`\n  first few new ones:`)
  added.slice(0, 5).forEach((s) => console.log(`     ${s.song_id}  ${s.song_name}`))
}

if (!APPLY) {
  console.log('\n(dry run — pass --apply to write it)')
  process.exit(0)
}
// Refuse to shrink the library by accident: a truncated answer from the relay
// would otherwise quietly delete songs from everybody's phone. A deliberate
// removal says so on the command line — deleting the file to get past this
// would throw away the very diff that shows what is going.
if (songs.length < before.length && !ALLOW_SHRINK) {
  console.error(`\nREFUSING: this would drop the bundle from ${before.length} to ${songs.length} songs.`)
  console.error('If songs really were removed from the library, pass --allow-shrink.')
  process.exit(1)
}
fs.writeFileSync(OUT, text)
console.log(`\nwrote ${songs.length} songs to src/data/songsData.json (${mb(Buffer.byteLength(text))})`)
