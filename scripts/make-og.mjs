/**
 * The card a shared link turns into.
 *
 * Without an og:image, a link to this site pasted into WhatsApp, iMessage or a
 * church WhatsApp group renders as a bare URL — which is most of how anyone
 * would ever arrive here. 1200×630 is the size every platform crops from.
 *
 * Drawn in the app's own colours off the church mark, so the card and the site
 * are recognisably the same thing.
 *
 *   npm run og            write public/og-image.png
 *   npm run og -- --check report what would change
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'public', 'og-image.png')
const MARK = path.join(HERE, '..', 'public', 'favicon.svg')
const CHECK = process.argv.includes('--check')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

const svg = fs.readFileSync(MARK, 'utf8')

const html = `<!doctype html><meta charset="utf-8">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400..700&family=Anek+Telugu:wght@300..700&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;padding:0}
  .card{
    position:relative;width:1200px;height:630px;overflow:hidden;
    background:radial-gradient(120% 120% at 12% 0%,#22345c 0%,#151f38 52%,#0f1728 100%);
    color:#faf6ee;font-family:'Anek Telugu',system-ui,sans-serif;
    display:flex;align-items:center;gap:56px;padding:0 84px;box-sizing:border-box;
  }
  .grain{position:absolute;inset:0;
    background-image:radial-gradient(rgba(255,255,255,.06) 1px,transparent 1px);
    background-size:4px 4px;opacity:.5}
  .mark{position:relative;flex:none;width:230px;height:230px}
  .mark svg{width:100%;height:100%;display:block}
  .words{position:relative;min-width:0}
  .eyebrow{font-size:22px;font-weight:700;letter-spacing:.18em;text-transform:uppercase;color:#dcb457}
  h1{margin:16px 0 0;font-family:Fraunces,Georgia,serif;font-size:74px;font-weight:600;
     line-height:1.04;letter-spacing:-.025em}
  .te{margin-top:18px;font-size:34px;color:rgba(232,205,140,.92)}
  .rule{margin-top:30px;width:96px;height:4px;border-radius:3px;background:#b8893f}
  .when{margin-top:26px;font-size:27px;color:rgba(250,246,238,.72)}
</style>
<div class="card">
  <div class="grain"></div>
  <div class="mark">${svg}</div>
  <div class="words">
    <div class="eyebrow">Irving, Texas</div>
    <h1>Telugu Community Church</h1>
    <div class="te" lang="te">తెలుగు కమ్యూనిటీ చర్చి</div>
    <div class="rule"></div>
    <div class="when">Worship Sundays at 11:00 AM · in person and online</div>
  </div>
</div>`

const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--force-device-scale-factor=1']
})
const page = await browser.newPage()
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 })
await page.setContent(html, { waitUntil: 'networkidle0' })
// The card is mostly type; a screenshot taken before the webfonts land is the
// fallback stack, which is not the same card.
await page.evaluate(() => document.fonts.ready)
await new Promise((r) => setTimeout(r, 400))
const buf = await (await page.$('.card')).screenshot()
await browser.close()

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT) : null
const same = before && before.equals(buf)
console.log(`${same ? 'same' : CHECK ? 'WOULD WRITE' : 'wrote'}  og-image.png  1200x630  ${buf.length}B`)
if (!same && !CHECK) fs.writeFileSync(OUT, buf)
