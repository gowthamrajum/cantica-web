import type { ServiceEnvelope, ServiceItem } from './buildService'
import { usableLinks, type ServiceLink } from './links'

/**
 * A printable service sheet, laid out to be read from a music stand.
 *
 * The pages are RENDERED BY THE BROWSER and rasterised, rather than written as
 * PDF text. Telugu is a complex script — conjuncts form, vowel signs reorder
 * around their consonant — and that requires OpenType shaping (GSUB/GPOS). No
 * JS PDF writer carries a shaping engine; jsPDF maps glyphs one-to-one, so
 * Telugu written as PDF text comes out reordered and broken. The browser
 * already shapes it correctly for the screen, so we let it do the typesetting
 * and capture the result.
 *
 * The cost is that the text is an image: not selectable or searchable, and the
 * file is larger. For a sheet that gets printed or read from a stand, that is
 * the right trade against Telugu that is simply wrong.
 */

// A4 at 96dpi, the unit html2canvas works in.
const PAGE_W = 794
const PAGE_H = 1123
/** Rasterise above 1:1 so the print stays sharp. */
const SCALE = 2

const MAX_BODY_PX = 30
/**
 * The smallest the lyrics are allowed to get. One song per page is the point of
 * this sheet, so the floor sits low enough that a long song with its repeats
 * still lands whole; only something beyond that continues onto a second page,
 * which beats clipping the last verses off.
 */
const MIN_BODY_PX = 9

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Any character from the Telugu Unicode block. */
const TELUGU = /[ఀ-౿]/

/**
 * One block laid out as two columns: Telugu on the left, its English on the
 * right, line against line.
 *
 * The pairing is positional, and it is safe to be: a bilingual slide is built as
 * a run of Telugu lines followed by THEIR English lines in the same order (see
 * chunkBilingualLines), so the nth of each side belong together. A block in one
 * language only — a Telugu-only song, an English-only reading — spans the full
 * width instead, rather than being squeezed into half a page beside nothing.
 */
function columns(lines: string[]): string {
  const te = lines.filter((l) => TELUGU.test(l))
  const en = lines.filter((l) => !TELUGU.test(l))
  const row = (cells: string): string => `<div style="display:flex;gap:22px;margin:0 0 0.18em 0">${cells}</div>`
  const cell = (t: string): string => `<div style="flex:1 1 0;min-width:0">${t ? esc(t) : '&nbsp;'}</div>`

  if (!te.length || !en.length) {
    return lines.map((l) => `<div style="margin:0 0 0.18em 0">${esc(l)}</div>`).join('')
  }
  const rows: string[] = []
  for (let i = 0; i < Math.max(te.length, en.length); i++) {
    rows.push(row(cell(te[i] ?? '') + cell(en[i] ?? '')))
  }
  return rows.join('')
}

/** One printed page. `blocks` are slide-sized groups of lines. */
interface PdfPage {
  title: string
  /** A lead-in that belongs to this page's item, e.g. "Responsive Reading". */
  kicker?: string[]
  blocks: string[][]
  slot?: string
  /** A continuation of the previous page, when one item could not fit on one. */
  cont?: boolean
}

const blocksOf = (item: ServiceItem): string[][] =>
  (item.slides ?? []).map((s) => (s.lines ?? []).filter((l) => l && l.trim())).filter((b) => b.length)

/**
 * Group items into pages.
 *
 * A psalm arrives as TWO items — a "Responsive Reading" heading and the verses
 * — because that is the pair Cantica presents. On paper a heading alone on its
 * own sheet is just a wasted page, so it folds into the verses' page as a
 * lead-in. The pairing is identified structurally (a single-slide scripture
 * item immediately followed by another scripture item), which is exactly what
 * psalmToItems emits and is not a shape a song produces.
 */
function toPages(items: ServiceItem[]): PdfPage[] {
  const pages: PdfPage[] = []
  for (let i = 0; i < items.length; i++) {
    const it = items[i]
    const next = items[i + 1]
    const isHeading =
      it.kind === 'scripture' && next?.kind === 'scripture' && (it.slides?.length ?? 0) === 1
    if (isHeading) {
      pages.push({
        title: next.title,
        // The heading slide carries its label in both languages, then the
        // reference the title already states — so only the label is kept.
        kicker: (it.slides?.[0]?.lines ?? []).filter((l) => l && l.trim()).slice(0, 2),
        blocks: blocksOf(next),
        slot: next.slot
      })
      i++
      continue
    }
    pages.push({ title: it.title, blocks: blocksOf(it), slot: it.slot })
  }
  return pages
}

function pageHtml(
  page: PdfPage,
  index: number,
  total: number,
  subtitle: string,
  links: ServiceLink[] = []
): string {
  const body = page.blocks.map((b) => `<div style="margin:0 0 0.72em 0">${columns(b)}</div>`).join('')

  const meta = [`${index + 1} / ${total}`, page.slot === 'offering' ? 'Offering' : '', page.slot === 'communion' ? 'Communion' : '', page.cont ? 'continued' : '']
    .filter(Boolean)
    .join(' · ')

  const kicker = page.kicker?.length
    ? `<div style="font-size:14px;color:#8b8172;line-height:1.4;margin-bottom:6px;">${page.kicker
        .map(esc)
        .join('<br>')}</div>`
    : ''

  // Everything is centred — a stand sheet is read at a glance, and centred text
  // keeps the eye in one place between verses — and centred within its own
  // column, so the Telugu and the English each stay under their own heading.
  return `
  <div style="
      width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;
      padding:56px 64px;background:#ffffff;color:#241f18;
      font-family:'Anek Telugu',Inter,system-ui,sans-serif;
      display:flex;flex-direction:column;text-align:center;">
    <div style="flex:none;border-bottom:2px solid #b8893f;padding-bottom:16px;margin-bottom:28px;">
      ${kicker}
      <div style="font-family:Fraunces,Georgia,serif;font-size:27px;font-weight:600;line-height:1.32;">${esc(page.title)}</div>
      <div style="font-size:13px;color:#8b8172;margin-top:6px;">${esc(meta)}</div>
    </div>
    <div data-body style="flex:1;min-height:0;overflow:hidden;font-size:${MAX_BODY_PX}px;line-height:1.4;font-weight:500;">${body}</div>
    <div style="border-top:1px solid #e8ddc9;padding-top:12px;margin-top:16px;flex:none;
                font-size:12px;color:#8b8172;display:flex;justify-content:space-between;gap:16px;text-align:left;">
      <span>${esc(subtitle)}${links
        .map((l) => `<br>${esc(l.label)} — ${esc(l.url)}`)
        .join('')}</span><span style="flex:none;">Telugu Community Church</span>
    </div>
  </div>`
}

/**
 * Shrink the body until it fits its box, and report whether it managed to.
 *
 * Sizing from a line count is a guess — line length, wrapping and the Telugu
 * face's metrics all move the answer — and guessing wrong pushes the last
 * verses straight through the footer.
 */
function fitBody(el: HTMLElement): boolean {
  const fits = (px: number): boolean => {
    el.style.fontSize = `${px}px`
    return el.scrollHeight <= el.clientHeight
  }
  if (fits(MAX_BODY_PX)) return true
  let lo = MIN_BODY_PX
  let hi = MAX_BODY_PX
  let best = MIN_BODY_PX
  for (let i = 0; i < 12 && hi - lo > 0.25; i++) {
    const mid = (lo + hi) / 2
    if (fits(mid)) {
      best = mid
      lo = mid
    } else {
      hi = mid
    }
  }
  el.style.fontSize = `${best}px`
  return fits(best)
}

export async function buildServicePdf(envelope: ServiceEnvelope, subtitle: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const pages = toPages(envelope.service.items ?? [])
  if (!pages.length) throw new Error('Nothing to put in the PDF.')

  // Offscreen but genuinely laid out — html2canvas cannot capture
  // display:none, and heights cannot be measured without real layout.
  const host = document.createElement('div')
  host.style.cssText = `position:fixed;left:-10000px;top:0;width:${PAGE_W}px;z-index:-1;`
  document.body.appendChild(host)

  try {
    // The Telugu face has to be resident before anything is measured or
    // captured, or both use the fallback font's metrics.
    if (document.fonts?.ready) await document.fonts.ready.catch(() => undefined)

    const pdf = new jsPDF({ orientation: 'portrait', unit: 'px', format: [PAGE_W, PAGE_H] })
    let first = true

    // On the first sheet only. Whoever is reading from the stand needs the
    // stream address once, not printed under every song.
    const links = usableLinks(envelope.service.links)

    /** Lay one page out and hand back its body element for measuring. */
    const layout = (p: PdfPage, i: number, n: number): HTMLElement => {
      host.innerHTML = pageHtml(p, i, n, subtitle, i === 0 ? links : [])
      return (host.firstElementChild as HTMLElement).querySelector('[data-body]') as HTMLElement
    }

    // A page whose blocks cannot be made to fit even at the smallest readable
    // size continues onto another sheet. Clipping would lose verses silently,
    // which is worse than a second page.
    const queue: PdfPage[] = pages.slice()
    const rendered: PdfPage[] = []
    for (let i = 0; i < queue.length; i++) {
      const p = queue[i]
      if (fitBody(layout(p, 0, 1)) || p.blocks.length <= 1) {
        rendered.push(p)
        continue
      }
      let n = p.blocks.length
      while (n > 1) {
        n--
        if (fitBody(layout({ ...p, blocks: p.blocks.slice(0, n) }, 0, 1))) break
      }
      rendered.push({ ...p, blocks: p.blocks.slice(0, n) })
      queue.splice(i + 1, 0, { ...p, kicker: undefined, blocks: p.blocks.slice(n), cont: true })
    }

    for (let i = 0; i < rendered.length; i++) {
      const body = layout(rendered[i], i, rendered.length)
      fitBody(body)
      const canvas = await html2canvas(host.firstElementChild as HTMLElement, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H
      })
      if (!first) pdf.addPage([PAGE_W, PAGE_H], 'portrait')
      first = false
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H)
    }

    return pdf.output('blob')
  } finally {
    host.remove()
  }
}
