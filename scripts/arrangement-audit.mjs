/**
 * Play every song in the library through the arrangement builder and check the
 * two things about an ending that are easy to get wrong and invisible in code
 * review — you only see them by looking at the slides.
 *
 *   1. Choosing a section as Repeats must not make the song end by saying that
 *      section twice. The sheet ticks every line of a refrain by default, and
 *      reading a fully-ticked refrain as "part of it comes back" once closed
 *      3,787 of 3,798 song/refrain pairs on the same slides twice over.
 *
 *   2. Holding back a real part of the refrain must still close on the whole
 *      thing — the hook, then the refrain sung out. That ending is the reason
 *      the first check cannot simply forbid a doubled tail.
 *
 *   npm run arrangement-audit
 */
import { songSections, songToItem } from '../src/lib/buildService.ts'
import songs from '../src/data/songsData.json' with { type: 'json' }

const base = (sl) => sl.label.replace(/ \(\d+\)$/, '')
const body = (sl) => sl.lines.join('¶')

/** Consecutive slides sharing a base label, as one run. */
const runs = (slides) => {
  const out = []
  for (const sl of slides) {
    if (out.length && out[out.length - 1].label === base(sl)) out[out.length - 1].slides.push(sl)
    else out.push({ label: base(sl), slides: [sl] })
  }
  return out
}

/**
 * Two goes at the same section, back to back, read as one run twice as long as
 * the section is — and holding the section's slides twice over.
 *
 * Measured against the section's FIRST run, not against itself. Plenty of
 * refrains repeat their own lines: "Naa praanamentho" is eight lines that are
 * one couplet said twice, so its single block is already two identical slides
 * and a self-comparison called every one of those songs a bug. What the section
 * says is the song's business; how many times the arrangement says it is ours.
 */
const saysItTwice = (last, first) => {
  if (!first || last.slides.length !== first.slides.length * 2) return false
  const once = first.slides.map(body).join('|')
  return last.slides.map(body).join('|') === once + '|' + once
}

let doubled = 0, checked = 0, lostEnding = 0
const examples = []
for (const song of songs) {
  const secs = songSections(song, 'both')
  if (secs.length < 3) continue
  for (const rec of secs) {
    const struct = { includedIds: secs.map((s) => s.id), recurringId: rec.id }
    checked++
    const a = songToItem(song, 'both', { ...struct, repeatUnits: Array.from({ length: 12 }, (_, i) => i) })
    if (a) {
      const r = runs(a.slides)
      const last = r[r.length - 1]
      const first = r.find((x) => x.label === rec.label)
      if (last && last.label === rec.label && first !== last && saysItTwice(last, first)) {
        doubled++
        if (examples.length < 3) examples.push(`${song.song_id} ${song.song_name.slice(0, 30)} · ${rec.label}`)
      }
    }
    const b = songToItem(song, 'both', { ...struct, repeatUnits: [0] })
    if (b && !runs(b.slides).pop().label.startsWith(rec.label)) lostEnding++
  }
}
console.log(`checked ${checked} song/refrain pairs across ${songs.length} songs`)
console.log(`  ends by saying the refrain twice : ${doubled}${examples.length ? '   e.g. ' + examples.join(' | ') : ''}`)
console.log(`  a real subset lost its full-refrain ending : ${lostEnding}`)
if (doubled || lostEnding) process.exit(1)
