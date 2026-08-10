/**
 * Render the browser favicon, in PNG, from the church mark.
 *
 * favicon.svg used to paint a navy-900 tile behind the mark, which at 16px is
 * indistinguishable from black — the mark disappeared into a dark square. The
 * tile is gone now: the icon is the mark alone on transparency, so the tab
 * strip (light or dark) shows through and the shape is the shape.
 *
 * DELIBERATELY NOT TOUCHED: apple-touch-icon.png and icons/*.png. Those carry
 * the Cantica flame, which is that app's own mark and is meant to be the icon
 * on a home screen. Only the browser tab gets the church mark. If you ever do
 * want them regenerated, they are a different logo and belong in a different
 * script, not a wider glob here.
 *
 *   node scripts/make-favicons.mjs            write public/favicon-*.png
 *   node scripts/make-favicons.mjs --check    report what would change
 *
 * Rendered through headless Chrome (puppeteer-core is already a devDependency)
 * rather than a raster library: the mark is an SVG with a gradient and live
 * text, and Chrome is the thing that already agrees with how the app draws it.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const PUBLIC = path.join(HERE, '..', 'public')
const SVG = path.join(PUBLIC, 'favicon.svg')
const CHECK = process.argv.includes('--check')

/** Where Chrome is. Override with CHROME=… for a different install. */
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/**
 * The PNG fallbacks. 16 and 32 are what a browser tab actually uses; 48 and 96
 * are for bookmark bars, history entries and Android's "add to home screen"
 * when it declines the SVG.
 */
const SIZES = [16, 32, 48, 96]

const svg = fs.readFileSync(SVG, 'utf8')

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1']
})

let changed = 0
for (const size of SIZES) {
  const tab = await browser.newPage()
  await tab.setViewport({ width: size, height: size, deviceScaleFactor: 1 })
  await tab.setContent(
    `<!doctype html><meta charset="utf-8">
     <style>html,body{margin:0;padding:0;background:transparent}
     .b{width:${size}px;height:${size}px;display:block}
     .b svg{width:100%;height:100%;display:block}</style>
     <div class="b">${svg}</div>`,
    { waitUntil: 'load' }
  )
  const buf = await (await tab.$('.b')).screenshot({ omitBackground: true })
  await tab.close()

  const out = path.join(PUBLIC, `favicon-${size}.png`)
  const before = fs.existsSync(out) ? fs.readFileSync(out) : null
  const same = before && before.equals(buf)
  if (!same) changed++
  console.log(`${same ? '  same' : CHECK ? 'WOULD WRITE' : ' wrote'}  favicon-${size}.png  ${buf.length}B`)
  if (!same && !CHECK) fs.writeFileSync(out, buf)
}

await browser.close()
console.log(CHECK ? `\n${changed} icon(s) would change.` : `\n${changed} icon(s) written.`)
