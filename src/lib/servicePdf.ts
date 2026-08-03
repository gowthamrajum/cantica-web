import type { ServiceEnvelope, ServiceItem } from './buildService'

/**
 * A printable service sheet: one item per page, lyrics laid out to be read from
 * a music stand.
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
const MIN_BODY_PX = 9

const esc = (s: string): string =>
  s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string)

/** Every slide of an item becomes a block; blank lines are dropped. */
function itemBlocks(item: ServiceItem): string[][] {
  return (item.slides ?? []).map((s) => (s.lines ?? []).filter((l) => l && l.trim()))
}

/**
 * Page markup. Spacing is in `em` so that changing the body's font-size scales
 * the whole layout — which is what lets the fit loop below work by adjusting a
 * single property.
 */
function pageHtml(item: ServiceItem, index: number, total: number, subtitle: string): string {
  const body = itemBlocks(item)
    .map(
      (b) =>
        `<div style="margin:0 0 0.72em 0">` +
        b.map((l) => `<div style="margin:0 0 0.18em 0">${esc(l)}</div>`).join('') +
        `</div>`
    )
    .join('')

  const slot = item.slot === 'offering' ? ' · Offering' : ''
  // The title is allowed two lines and is NOT clipped: a song whose name runs
  // long should wrap, not lose its descenders to an overflow:hidden box.
  return `
  <div style="
      width:${PAGE_W}px;height:${PAGE_H}px;box-sizing:border-box;
      padding:56px 64px;background:#ffffff;color:#241f18;
      font-family:'Anek Telugu',Inter,system-ui,sans-serif;
      display:flex;flex-direction:column;">
    <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:16px;
                border-bottom:2px solid #b8893f;padding-bottom:16px;margin-bottom:28px;flex:none;">
      <div style="font-family:Fraunces,Georgia,serif;font-size:27px;font-weight:600;
                  line-height:1.32;padding-bottom:2px;">${esc(item.title)}</div>
      <div style="font-size:13px;color:#8b8172;white-space:nowrap;padding-top:8px;">${index + 1} / ${total}${esc(slot)}</div>
    </div>
    <div data-body style="flex:1;min-height:0;font-size:${MAX_BODY_PX}px;line-height:1.4;font-weight:500;">${body}</div>
    <div style="border-top:1px solid #e8ddc9;padding-top:12px;margin-top:16px;flex:none;
                font-size:12px;color:#8b8172;display:flex;justify-content:space-between;">
      <span>${esc(subtitle)}</span><span>Telugu Community Church</span>
    </div>
  </div>`
}

/**
 * Shrink the body until it actually fits its box.
 *
 * Sizing from a line count is a guess — line length, wrapping and the Telugu
 * face's metrics all move the answer — and guessing wrong clips the end of a
 * song silently. Binary-searching the measured height cannot.
 */
function fitBody(el: HTMLElement): void {
  const fits = (px: number): boolean => {
    el.style.fontSize = `${px}px`
    return el.scrollHeight <= el.clientHeight
  }
  if (fits(MAX_BODY_PX)) return
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
}

/**
 * Render the service to a PDF, one page per item.
 *
 * jsPDF and html2canvas are imported here rather than at module scope so they
 * only load when someone actually shares — together they are ~600KB the rest of
 * the app never needs.
 */
export async function buildServicePdf(envelope: ServiceEnvelope, subtitle: string): Promise<Blob> {
  const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  const items = envelope.service.items ?? []
  if (!items.length) throw new Error('Nothing to put in the PDF.')

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

    for (let i = 0; i < items.length; i++) {
      host.innerHTML = pageHtml(items[i], i, items.length, subtitle)
      const page = host.firstElementChild as HTMLElement
      const body = page.querySelector('[data-body]') as HTMLElement | null
      if (body) fitBody(body)

      const canvas = await html2canvas(page, {
        scale: SCALE,
        backgroundColor: '#ffffff',
        logging: false,
        useCORS: true,
        width: PAGE_W,
        height: PAGE_H,
        windowWidth: PAGE_W,
        windowHeight: PAGE_H
      })
      if (i > 0) pdf.addPage([PAGE_W, PAGE_H], 'portrait')
      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, PAGE_W, PAGE_H)
    }

    return pdf.output('blob')
  } finally {
    host.remove()
  }
}
