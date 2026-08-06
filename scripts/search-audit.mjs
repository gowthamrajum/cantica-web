#!/usr/bin/env node
/**
 * How well does the songbook search survive a misspelling?
 *
 *   npm run search-audit                  the whole library (~10 min)
 *   npm run search-audit -- --limit 200   a quick pass while iterating
 *   npm run search-audit -- --top 10      report the placed-well rate at 10
 *   npm run search-audit -- --phrases 0   every line, not a sample of them
 *
 * Two numbers per row. FOUND is whether the song came back at all, and it is
 * what the audit passes or fails on. PLACED is whether it came back near the
 * top, and it is reported but not enforced — misspell a word eight hundred
 * songs share and no ranking can put your particular one first, so holding that
 * to 100% would only ever be satisfied by making the search find less.
 *
 * Telugu romanisation is not standardised, so a song has to be findable however
 * the person at the keyboard spells it. This takes every song TWICE — once by a
 * word from its title, once by a word from its lyrics that the title does not
 * contain — misspells each fourteen ways, and checks the song still comes back.
 * Both, because that is how the search gets used: by name for a song you can
 * name, by a remembered line for one you cannot. Run it whenever songs are
 * added or the
 * matching in src/lib/songSearch.ts is touched: a new batch of songs can crowd a
 * spelling that used to be unambiguous, and that shows up here as a category
 * slipping rather than as a complaint on a Sunday.
 *
 * It exercises the REAL module — bundled from source, not a copy of the rules —
 * so it cannot drift from what the app does. Exits non-zero if any category
 * falls below the threshold, which is what makes it usable in CI.
 */
// Vite's own bundler, so the audit needs no dependency the app doesn't have.
import { build } from 'vite'
import { readFile, rm, mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join, dirname } from 'path'
import { fileURLToPath, pathToFileURL } from 'url'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')

const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i !== -1 && process.argv[i + 1] ? process.argv[i + 1] : fallback
}
/** "Placed" means the song came back within this many results. Reported only. */
const WITHIN = Number(arg('top', 25))
/** Every category must FIND this share of its songs, or the audit fails. */
const THRESHOLD = Number(arg('threshold', 100))
const LIMIT = Number(arg('limit', 0))
/**
 * How many remembered lines to try. Capped by default because a three-word
 * query carrying a word the song never had is the most expensive search there
 * is — it runs every pass over every song before giving up — and a few hundred
 * lines already settle the question. `--phrases 0` does the lot.
 */
const PHRASES = Number(arg('phrases', 400))

/**
 * The ways a Telugu song title actually gets misspelled.
 *
 * The first twelve are transliteration: two people writing the same sound
 * differently, neither of them wrong. The last two are plain slips. Each
 * returns the word unchanged when it does not apply, and those are skipped
 * rather than counted as passes.
 */
const MISTAKES = [
  ['drops the h from an aspirate', (w) => w.replace(/(kh|gh|ch|jh|th|dh|ph|bh)/i, (m) => m[0])],
  ['adds an h to a plain consonant', (w) => w.replace(/([kgcjtdpb])(?![h])/i, '$1h')],
  ['halves a long vowel', (w) => w.replace(/(aa|ee|oo|ii|uu)/i, (m) => m[0])],
  ['lengthens a short vowel', (w) => w.replace(/([aeiou])/i, '$1$1')],
  ['halves a doubled consonant', (w) => w.replace(/([bcdfgjklmnprstvyz])\1/i, '$1')],
  ['doubles a single consonant', (w) => w.replace(/([lnmry])/i, '$1$1')],
  ['writes w for v', (w) => w.replace(/v/i, 'w')],
  ['writes v for w', (w) => w.replace(/w/i, 'v')],
  ['writes sh for s', (w) => w.replace(/s(?![h])/i, 'sh')],
  ['writes s for sh', (w) => w.replace(/sh/i, 's')],
  ['writes ai for e', (w) => w.replace(/e(?![e])/i, 'ai')],
  ['writes y for i', (w) => w.replace(/i(?![i])/i, 'y')],
  ['one letter mistyped', (w) => (w.length > 4 ? w.slice(0, 3) + (w[3] === 'r' ? 'l' : 'r') + w.slice(4) : w)],
  ['one letter dropped', (w) => (w.length > 4 ? w.slice(0, 3) + w.slice(4) : w)]
]

/**
 * The ways a remembered PHRASE comes out wrong.
 *
 * Nobody recalls a line exactly. They get the words in the wrong order, skip
 * one, or carry in a word from the verse before. Each takes the words of a real
 * line and returns a query, or null when the line is too short to mangle that
 * way.
 */
const PHRASE_MISTAKES = [
  ['as it is', (ws) => ws.join(' ')],
  ['words reversed', (ws) => [...ws].reverse().join(' ')],
  ['first and last swapped', (ws) => (ws.length < 3 ? null : [ws.at(-1), ...ws.slice(1, -1), ws[0]].join(' '))],
  ['a middle word skipped', (ws) => (ws.length < 3 ? null : [ws[0], ...ws.slice(2)].join(' '))],
  ['a word that is not in the song', (ws) => [...ws, 'zzqq'].join(' ')],
  ['one word misspelled', (ws) => ws.map((w, i) => (i === 1 ? w.replace(/(th|dh|bh|ph|ch)/i, (m) => m[0]) : w)).join(' ')]
]

const dir = await mkdtemp(join(tmpdir(), 'search-audit-'))
try {
  // Bundle the module the app actually uses, songbook and all.
  await build({
    configFile: false,
    logLevel: 'error',
    build: {
      lib: { entry: join(ROOT, 'src/lib/songSearch.ts'), formats: ['es'], fileName: 'songs' },
      outDir: dir,
      emptyOutDir: false,
      minify: false,
      reportCompressedSize: false
    }
  })
  const { listSongs } = await import(pathToFileURL(join(dir, 'songs.js')).href)
  const songs = JSON.parse(await readFile(join(ROOT, 'src/data/songsData.json'), 'utf8'))

  const longest = (text) => {
    const words = String(text).split(/[^A-Za-z]+/).filter((w) => w.length >= 4)
    return words.length ? words.reduce((a, b) => (b.length > a.length ? b : a)) : null
  }

  /**
   * Two ways in per song, because that is how the search is used: by the title
   * for a song you can name, and by a remembered line for one you cannot.
   *
   * The lyric word is deliberately one the title does NOT contain, or the case
   * would quietly be testing the title again.
   */
  const cases = []
  const phrases = []
  let untypable = 0
  for (const s of songs) {
    const title = longest(s.song_name)
    if (title) cases.push({ id: s.song_id, name: s.song_name, word: title, from: 'title' })
    else untypable++

    const inTitle = s.song_name.toLowerCase()
    let lyric = null
    for (const block of [s.main_stanza, ...(s.stanzas ?? [])]) {
      for (const line of block?.english ?? []) {
        const w = longest(line)
        if (w && !inTitle.includes(w.toLowerCase()) && (!lyric || w.length > lyric.length)) lyric = w
      }
    }
    if (lyric) cases.push({ id: s.song_id, name: s.song_name, word: lyric, from: 'lyric' })

    // Three consecutive words of a real line, to be remembered wrongly below.
    for (const block of [s.main_stanza, ...(s.stanzas ?? [])]) {
      for (const line of block?.english ?? []) {
        const ws = String(line).split(/[^A-Za-z]+/).filter((w) => w.length >= 4)
        if (ws.length >= 3) {
          phrases.push({ id: s.song_id, name: s.song_name, words: ws.slice(0, 3) })
          break
        }
      }
    }
  }
  const use = LIMIT ? cases.slice(0, LIMIT * 2) : cases
  const titles = use.filter((c) => c.from === 'title').length

  console.log(
    `${use.length} words (${titles} from titles, ${use.length - titles} from lyrics) × ${MISTAKES.length} misspellings`
  )
  if (untypable) console.log(`(${untypable} songs have no Latin title word to type)`)

  const blank = () => MISTAKES.map(([label]) => ({ label, tried: 0, found: 0, placed: 0, misses: [] }))
  const stats = { title: blank(), lyric: blank() }
  const started = Date.now()

  // Progress goes to stderr so the tables on stdout stay pipeable.
  const tick = (done, of, what) => {
    if (done % 200) return
    const rate = done / ((Date.now() - started) / 1000 || 1)
    process.stderr.write(`\r  ${what} ${done}/${of} — ${Math.round((of - done) / rate)}s left      `)
  }

  for (const [i, s] of use.entries()) {
    tick(i, use.length, 'words')
    for (let m = 0; m < MISTAKES.length; m++) {
      const typo = MISTAKES[m][1](s.word)
      if (typo.toLowerCase() === s.word.toLowerCase()) continue // does not apply
      const st = stats[s.from][m]
      st.tried++
      const at = (await listSongs(typo)).findIndex((r) => r.song_id === s.id)
      if (at >= 0) st.found++
      if (at >= 0 && at < WITHIN) st.placed++
      if (at < 0) st.misses.push(`${s.word} → ${typo} — ${s.name}`)
    }
  }

  let failed = 0
  const total = { tried: 0, found: 0, placed: 0 }
  for (const from of ['title', 'lyric']) {
    const sub = { tried: 0, found: 0, placed: 0 }
    console.log(`\nmisspelling a word from the ${from.toUpperCase()}`)
    console.log(`${''.padEnd(34)} found  top-${WITHIN}   of`)
    for (const s of stats[from]) {
      for (const k of ['tried', 'found', 'placed']) {
        sub[k] += s[k]
        total[k] += s[k]
      }
      const pct = (n) => `${(s.tried ? (n / s.tried) * 100 : 100).toFixed(1).padStart(5)}%`
      const ok = !s.tried || (s.found / s.tried) * 100 >= THRESHOLD
      if (!ok) failed++
      console.log(`${ok ? ' ' : '✗'} ${s.label.padEnd(32)} ${pct(s.found)} ${pct(s.placed)}  ${s.tried}`)
    }
    const pct = (n) => `${(sub.tried ? (n / sub.tried) * 100 : 100).toFixed(1).padStart(5)}%`
    console.log(`  ${''.padEnd(32)} ${pct(sub.found)} ${pct(sub.placed)}  ${sub.tried}`)
  }
  // ---- remembered phrases: word order, a word skipped, a word invented ----
  // Spread across the songbook rather than taken off the front, so the sample
  // is not just the songs whose titles start with A.
  const step = PHRASES > 0 ? Math.max(1, Math.floor(phrases.length / PHRASES)) : 1
  const usePhrases = (PHRASES > 0 ? phrases.filter((_, i) => i % step === 0) : phrases).slice(
    0,
    LIMIT || undefined
  )
  const pstats = PHRASE_MISTAKES.map(([label]) => ({ label, tried: 0, found: 0, placed: 0, misses: [] }))
  for (const [i, p] of usePhrases.entries()) {
    tick(i, usePhrases.length, 'lines')
    for (let m = 0; m < PHRASE_MISTAKES.length; m++) {
      const q = PHRASE_MISTAKES[m][1](p.words)
      if (!q) continue
      const st = pstats[m]
      st.tried++
      const at = (await listSongs(q)).findIndex((r) => r.song_id === p.id)
      if (at >= 0) st.found++
      if (at >= 0 && at < WITHIN) st.placed++
      if (at < 0) st.misses.push(`"${q}" — ${p.name}`)
    }
  }
  process.stderr.write('\r'.padEnd(60) + '\r')
  console.log(
    `\nremembering a LINE wrongly (${usePhrases.length}` +
      `${PHRASES > 0 && usePhrases.length < phrases.length ? ` of ${phrases.length}, sampled` : ''} lines)`
  )
  console.log(`${''.padEnd(34)} found  top-${WITHIN}   of`)
  for (const s of pstats) {
    for (const k of ['tried', 'found', 'placed']) total[k] += s[k]
    const p = (n) => `${(s.tried ? (n / s.tried) * 100 : 100).toFixed(1).padStart(5)}%`
    const ok = !s.tried || (s.found / s.tried) * 100 >= THRESHOLD
    if (!ok) failed++
    console.log(`${ok ? ' ' : '✗'} ${s.label.padEnd(32)} ${p(s.found)} ${p(s.placed)}  ${s.tried}`)
  }
  for (const s of pstats) {
    if (!s.misses.length) continue
    console.log(`\nnot found — phrase, ${s.label} (${s.misses.length})`)
    s.misses.slice(0, 10).forEach((m) => console.log(`   ${m}`))
    if (s.misses.length > 10) console.log(`   …and ${s.misses.length - 10} more`)
  }

  const pct = (n) => `${((n / total.tried) * 100).toFixed(1)}%`
  console.log(`\nALL  found ${pct(total.found)}   top-${WITHIN} ${pct(total.placed)}   of ${total.tried} searches`)

  for (const from of ['title', 'lyric']) {
    for (const s of stats[from]) {
      if (!s.misses.length) continue
      console.log(`\nnot found — ${from}, ${s.label} (${s.misses.length})`)
      s.misses.slice(0, 10).forEach((m) => console.log(`   ${m}`))
      if (s.misses.length > 10) console.log(`   …and ${s.misses.length - 10} more`)
    }
  }

  console.log(`\n${Math.round((Date.now() - started) / 1000)}s`)
  if (failed) {
    console.error(`\n${failed} categor${failed === 1 ? 'y' : 'ies'} found under ${THRESHOLD}% of their songs.`)
    process.exit(1)
  }
  console.log(`every misspelling still finds its song.`)
} finally {
  await rm(dir, { recursive: true, force: true })
}
