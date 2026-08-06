/**
 * Ported verbatim from lumen-presenter's control/slides.ts.
 *
 * Its signature is deliberately data-shape-agnostic — the verses and three
 * accessors — precisely so it can be driven from a different bible
 * representation, which is what this app has. There was never a reason to write
 * a second one.
 */
export type ScriptureLang = 'both' | 'telugu' | 'english'

export interface ScriptureSlide {
  label: string
  lines: string[]
  caption: string
}

/**
 * One scripture slide per verse in the chosen language(s) — Telugu, English, or
 * both (Telugu first, English next). `teluguOf`/`englishOf` resolve each verse's
 * text in that language (empty string if the translation lacks it); `refOf`
 * builds the caption/label. Verses with no text in the chosen language(s) are
 * dropped (no blank slides). Mirrors psalmSlides for the general Bible source.
 */
export function bilingualScriptureSlides<V>(
  verses: V[],
  lang: ScriptureLang,
  teluguOf: (v: V) => string,
  englishOf: (v: V) => string,
  refOf: (v: V) => string
): ScriptureSlide[] {
  return verses
    .map((v) => {
      const te = (teluguOf(v) || '').trim()
      const en = (englishOf(v) || '').trim()
      const lines = (lang === 'telugu' ? [te] : lang === 'english' ? [en] : [te, en]).filter((l) => l)
      const ref = refOf(v)
      return { label: ref, lines, caption: ref }
    })
    .filter((s) => s.lines.length > 0)
}
