import { createElement } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { Stage } from '../components/Stage'
import type { ServiceEnvelope } from './buildService'
import { buildPptx, type PptxImage } from './pptxWrite'

/**
 * The service as a PowerPoint deck — one slide per projected slide, looking
 * exactly like the wall.
 *
 * Every slide is a picture rather than text, for the same reason the printed
 * sheet is (see servicePdf): Telugu needs OpenType shaping, and a .pptx full of
 * text runs would only render correctly on a machine that has the font and
 * shapes it the same way. A picture looks right everywhere, including in Google
 * Slides on somebody's phone.
 *
 * Rendered through the real <Stage>, not a lookalike, so the deck cannot drift
 * from what the congregation sees.
 */

/**
 * Capture size.
 *
 * 1280×720 rather than full HD: a projector upscales either way, and this text
 * is large, high-contrast and flat — the kind of image that survives it. Doubling
 * to 1920 roughly doubles the file for detail nobody sees from a pew, and the
 * whole point of this export is a file that can be sent.
 */
const W = 1280
const H = 720

/** JPEG quality. High enough that the ringing around glyph edges is invisible
 *  at projection distance; low enough to keep a long service sendable. */
const JPEG_Q = 0.82

/** Encode a canvas both ways and keep whichever is smaller.
 *
 *  Neither wins outright. A lyric slide is a handful of flat colours and PNG
 *  crushes it; the moment a photograph or a video poster is the background,
 *  PNG balloons and JPEG is a fraction of the size. Asking costs one extra
 *  encode per slide and takes the guesswork out. */
async function encode(canvas: HTMLCanvasElement): Promise<PptxImage> {
  const blob = (type: string, q?: number): Promise<Blob | null> =>
    new Promise((res) => canvas.toBlob(res, type, q))
  const [png, jpg] = await Promise.all([blob('image/png'), blob('image/jpeg', JPEG_Q)])
  const pick =
    png && jpg ? (png.size <= jpg.size ? { b: png, ext: 'png' } : { b: jpg, ext: 'jpg' })
    : png ? { b: png, ext: 'png' }
    : jpg ? { b: jpg, ext: 'jpg' }
    : null
  if (!pick) throw new Error('The browser could not encode a slide.')
  return { bytes: new Uint8Array(await pick.b.arrayBuffer()), ext: pick.ext as 'png' | 'jpg' }
}

/**
 * Build the deck.
 *
 * `onProgress` is called with (done, total) — a hundred-slide service takes long
 * enough that a silent button reads as a hung one.
 */
/**
 * Paint `over` onto `base`, keeping whichever is lighter per pixel.
 *
 * html2canvas draws a dark slab the size of the text's ink behind every lyric.
 * The browser draws nothing there and no style accounts for it — not the scrim,
 * the frame background, or the text-shadow; a capture with the text hidden comes
 * out perfectly clean, which is what makes this fixable. So the background is
 * captured once without text, the text pass is captured over it, and the two are
 * merged by taking the lighter pixel: the slab loses to the real background it
 * was covering, and the lyrics — which are lighter than anything behind them —
 * win.
 *
 * This holds because these slides are light text on darker ground, which is what
 * the stage themes are. Dark text on a pale background would be eaten, so the
 * caller checks before choosing this path.
 */
function lighten(base: HTMLCanvasElement, over: HTMLCanvasElement): HTMLCanvasElement {
  const out = document.createElement('canvas')
  out.width = base.width
  out.height = base.height
  const ctx = out.getContext('2d')
  if (!ctx) return over
  ctx.drawImage(base, 0, 0)
  ctx.globalCompositeOperation = 'lighten'
  ctx.drawImage(over, 0, 0)
  return out
}

/** Is the slide's text light enough for the lighten merge to keep it? */
function lightText(color: string): boolean {
  const m = color.match(/\d+/g)
  if (!m || m.length < 3) return true
  const [r, g, b] = m.map(Number)
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5
}

export async function buildServicePptx(
  envelope: ServiceEnvelope,
  onProgress?: (done: number, total: number) => void
): Promise<Blob> {
  // Straight off the items, NOT flattenDeck: that flattening is for the
  // broadcast, where it drops every slide with no words and rewrites `media`
  // into `text`. Here a photograph IS the slide, and its background is the only
  // thing on it — flattening would hand back a deck of blanks.
  const deck = (envelope.service.items ?? []).flatMap((it) =>
    (it.slides ?? []).filter((sl) => (sl.lines ?? []).some((l) => l && l.trim()) || !!sl.background)
  )
  if (!deck.length) throw new Error('Nothing to put in the deck.')

  const { default: html2canvas } = await import('html2canvas')

  // Offscreen but genuinely laid out: html2canvas cannot capture display:none,
  // and Stage sizes its text from the container (container-type: size), so the
  // box has to be the real 16:9 it will be projected at.
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-20000px;top:0;width:${W}px;height:${H}px;z-index:-1;`
  document.body.appendChild(host)
  const frame = document.createElement('div')
  frame.className = 'stage-frame pptx-capture'
  frame.style.cssText = `width:${W}px;height:${H}px;position:relative;`
  host.appendChild(frame)
  const root = createRoot(frame)

  try {
    // The Telugu face must be resident before anything is captured, or the
    // capture uses the fallback font's metrics and the lines come out wrong.
    if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined)

    const frames: PptxImage[] = []
    const bgCache = new Map<string, HTMLCanvasElement>()
    for (let i = 0; i < deck.length; i++) {
      const sl = deck[i]
      // MemoryRouter because Stage links to /give; nothing here is navigable.
      root.render(
        createElement(
          MemoryRouter,
          null,
          createElement(Stage, {
            state: {
              slide: {
                kind: sl.kind,
                lines: sl.lines ?? [],
                caption: sl.caption,
                singleLine: sl.singleLine,
                background: sl.background
              },
              theme: envelope.service.theme,
              background: envelope.service.background,
              blackout: false,
              clearText: false,
              showLogo: false
            }
          } as never)
        )
      )
      // Two frames: one for React to commit, one for layout and the
      // container-query text sizing to settle before the pixels are read.
      await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))

      // Stage writes the scrim as `rgba(0,0,0,var(--scrim))`. html2canvas reads
      // the declaration rather than the computed value and cannot resolve the
      // var(), and what it painted instead was a dark block the width of the
      // text — a grey box across every exported slide. The browser resolves it
      // for us; hand html2canvas the literal.
      // Background first, with the text hidden — that capture is clean, and it
      // is the reference the merge below leans on. Cached per background: a
      // service usually has one, so this costs a single extra capture, not one
      // per slide.
      const content = frame.querySelector<HTMLElement>('.stage-content')
      const bgKey = JSON.stringify(sl.background ?? envelope.service.background ?? null)
      let base = bgCache.get(bgKey)
      if (!base) {
        if (content) content.style.visibility = 'hidden'
        base = await html2canvas(frame, { width: W, height: H, scale: 1, backgroundColor: '#000', logging: false, useCORS: true })
        if (content) content.style.visibility = ''
        bgCache.set(bgKey, base)
      }

      const shot = await html2canvas(frame, {
        width: W,
        height: H,
        scale: 1,
        backgroundColor: '#000',
        logging: false,
        useCORS: true
      })
      const lyrics = frame.querySelector<HTMLElement>('.stage-lyrics, .stage-composed')
      const canvas =
        lyrics && lightText(getComputedStyle(lyrics).color) ? lighten(base, shot) : shot
      frames.push(await encode(canvas))
      onProgress?.(i + 1, deck.length)
    }

    return new Blob([buildPptx(frames).slice().buffer as ArrayBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    })
  } finally {
    root.unmount()
    host.remove()
  }
}
