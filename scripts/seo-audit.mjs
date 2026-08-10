/**
 * Hold every route to the contract a search engine and a screen reader read it
 * by — in the built app, in a real browser, in both versions.
 *
 * This is an audit in the shape of scripts/search-audit.mjs, not a unit test
 * suite, and deliberately so: none of what follows can be judged from the
 * source. The app renders on the client, the two shells produce different DOM
 * from the same route, and the questions that matter — is there exactly one h1,
 * is this title unique, does the Telugu carry lang="te" — are questions about
 * the document that comes out the far end.
 *
 * Runs both viewports on every route. Google indexes mobile-first, so the
 * phone version is the one that gets crawled; the desktop version is what a
 * person shares a link to. Both have to hold.
 *
 *   npm run build && npm run seo-audit         start a preview server and audit it
 *   SEO_BASE=https://cantica-web.onrender.com npm run seo-audit    audit the deploy
 *   npm run seo-audit -- --warn-only           report, always exit 0
 *
 * Exits non-zero if any ERROR check fails, so it can gate a deploy. WARN checks
 * are quality-of-result things that shouldn't block one.
 */
import { spawn } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import puppeteer from 'puppeteer-core'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.join(HERE, '..')
const PORT = Number(process.env.SEO_PORT || 4321)
const BASE = process.env.SEO_BASE || `http://localhost:${PORT}`
const OWN_SERVER = !process.env.SEO_BASE
const WARN_ONLY = process.argv.includes('--warn-only')
const CHROME = process.env.CHROME || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'

/** The canonical origin the site is served from, for canonical/OG assertions. */
const ORIGIN = process.env.SEO_ORIGIN || 'https://cantica-web.onrender.com'

/**
 * Routes a stranger can arrive at from a search result.
 *
 * `marketing` marks the ones that exist to be found — the pages about the
 * church itself. They carry the heaviest requirements, including that they must
 * not drag the Bible/songbook megachunks down with them.
 */
const PUBLIC = [
  { path: '/', name: 'Home', marketing: true },
  { path: '/about', name: 'About us', marketing: true },
  { path: '/services', name: 'Service times', marketing: true },
  { path: '/visit', name: 'Plan your visit', marketing: true },
  { path: '/give', name: 'Give', marketing: true },
  { path: '/watch', name: 'Watch' },
  { path: '/bible', name: 'Bible' },
  { path: '/songs', name: 'Songs' },
  { path: '/more', name: 'More' },
  { path: '/install', name: 'Install' },
  { path: '/notifications', name: 'Notifications' }
]

/**
 * Routes that must NOT be indexable. The operator remote and the builder are
 * tools for three people; a search result for "telugu church irving" that lands
 * a visitor on the slide controller is worse than no result at all.
 */
const PRIVATE = [
  { path: '/build', name: 'Service Builder' },
  { path: '/remote', name: 'Operator remote' },
  { path: '/notify', name: 'Send a notification' }
]

const VIEWPORTS = [
  { id: 'mobile', width: 390, height: 844, label: 'phone version (what Google indexes)' },
  { id: 'desktop', width: 1440, height: 900, label: 'desktop version (what people share)' }
]

// The Telugu block is matched inside scrape(), which is serialised into the
// page — it cannot close over anything declared out here.

const results = []
const record = (level, group, route, view, check, detail) =>
  results.push({ level, group, route, view, check, detail })
const ok = (group, route, view, check) => record('pass', group, route, view, check, '')
const err = (group, route, view, check, detail) => record('error', group, route, view, check, detail)
const warn = (group, route, view, check, detail) => record('warn', group, route, view, check, detail)

// ---------------------------------------------------------------- server ----

let server = null
async function startServer() {
  if (!OWN_SERVER) return
  server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore'
  })
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`${BASE}/`)
      if (r.ok) return
    } catch {
      /* not up yet */
    }
    await new Promise((r) => setTimeout(r, 500))
  }
  throw new Error(`preview server never came up on ${BASE} — did you run npm run build?`)
}

// -------------------------------------------------------- static contract ---
/**
 * The files a crawler asks for before it asks for a page, checked over HTTP
 * against the built output rather than on disk — a file that exists in public/
 * but 404s in production is the same as no file.
 */
async function auditStatic() {
  const G = 'crawl'

  const robots = await fetch(`${BASE}/robots.txt`)
  if (!robots.ok) {
    err(G, 'robots.txt', '—', 'exists', `GET /robots.txt returned ${robots.status}`)
  } else {
    const body = await robots.text()
    ok(G, 'robots.txt', '—', 'exists')
    if (/^\s*Disallow:\s*\/\s*$/im.test(body) && !/^\s*Allow:/im.test(body))
      err(G, 'robots.txt', '—', 'does not block the site', 'contains a bare `Disallow: /`')
    else ok(G, 'robots.txt', '—', 'does not block the site')

    if (/Sitemap:\s*http/i.test(body)) ok(G, 'robots.txt', '—', 'points at a sitemap')
    else warn(G, 'robots.txt', '—', 'points at a sitemap', 'no `Sitemap:` line')
  }

  const sm = await fetch(`${BASE}/sitemap.xml`)
  if (!sm.ok) {
    err(G, 'sitemap.xml', '—', 'exists', `GET /sitemap.xml returned ${sm.status}`)
    return
  }
  const xml = await sm.text()
  ok(G, 'sitemap.xml', '—', 'exists')
  const locs = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/g)].map((m) => m[1])
  const paths = locs.map((u) => {
    try {
      return new URL(u).pathname
    } catch {
      return u
    }
  })

  for (const r of PUBLIC) {
    if (paths.includes(r.path)) ok(G, 'sitemap.xml', '—', `lists ${r.path}`)
    else err(G, 'sitemap.xml', '—', `lists ${r.path}`, `${r.path} is missing from the sitemap`)
  }
  for (const r of PRIVATE) {
    if (paths.includes(r.path))
      err(G, 'sitemap.xml', '—', `omits ${r.path}`, `operator route ${r.path} is advertised to crawlers`)
    else ok(G, 'sitemap.xml', '—', `omits ${r.path}`)
  }
  for (const u of locs) {
    if (u.startsWith('http')) continue
    err(G, 'sitemap.xml', '—', 'urls are absolute', `<loc>${u}</loc> is not an absolute URL`)
  }
}

// ------------------------------------------------------- per-page contract --

/** Everything we need to judge a rendered page, pulled out in one evaluate. */
function scrape() {
  const text = (el) => (el.textContent || '').replace(/\s+/g, ' ').trim()
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content')?.trim() || null

  const headings = [...document.querySelectorAll('h1,h2,h3,h4,h5,h6')]
    .filter((h) => h.offsetParent !== null || h.getClientRects().length > 0)
    .map((h) => ({ level: Number(h.tagName[1]), text: text(h) }))

  const imgs = [...document.querySelectorAll('img')].map((i) => ({
    src: i.getAttribute('src') || '',
    alt: i.getAttribute('alt'),
    hidden: i.getAttribute('aria-hidden') === 'true' || i.getAttribute('role') === 'presentation'
  }))

  const links = [...document.querySelectorAll('a')].map((a) => ({
    href: a.getAttribute('href') || '',
    text: text(a),
    label: a.getAttribute('aria-label') || '',
    hasImg: !!a.querySelector('img,svg')
  }))

  // Telugu text nodes whose nearest lang= ancestor is not Telugu.
  const teluguUnmarked = []
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const t = (n.textContent || '').trim()
    if (!/[ఀ-౿]/.test(t)) continue
    let el = n.parentElement
    let lang = null
    while (el && !lang) {
      lang = el.getAttribute?.('lang') || null
      el = el.parentElement
    }
    if (lang !== 'te') teluguUnmarked.push({ text: t.slice(0, 40), lang })
  }

  const ids = [...document.querySelectorAll('[id]')].map((e) => e.id)
  const dupeIds = ids.filter((id, i) => ids.indexOf(id) !== i)

  const ld = [...document.querySelectorAll('script[type="application/ld+json"]')].map((s) => s.textContent)

  return {
    title: document.title.trim(),
    description: meta('meta[name="description"]'),
    canonical: document.querySelector('link[rel="canonical"]')?.getAttribute('href') || null,
    robots: meta('meta[name="robots"]'),
    ogTitle: meta('meta[property="og:title"]'),
    ogDesc: meta('meta[property="og:description"]'),
    ogImage: meta('meta[property="og:image"]'),
    ogUrl: meta('meta[property="og:url"]'),
    twitterCard: meta('meta[name="twitter:card"]'),
    htmlLang: document.documentElement.getAttribute('lang'),
    headings,
    imgs,
    links,
    teluguUnmarked,
    dupeIds,
    ld,
    // Mobile-friendliness: a page that scrolls sideways on a phone is the one
    // thing Google's own tooling calls out by name.
    overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
    bodyText: (document.body.textContent || '').replace(/\s+/g, ' ').trim().length
  }
}

async function auditPage(browser, route, view, seen) {
  const page = await browser.newPage()
  await page.setViewport({ width: view.width, height: view.height, deviceScaleFactor: 1 })

  const heavy = []
  page.on('request', (r) => {
    if (/\/assets\/(data-|songs\.worker-)/.test(r.url())) heavy.push(r.url().split('/').pop())
  })

  const resp = await page.goto(`${BASE}${route.path}`, { waitUntil: 'networkidle2', timeout: 60000 })

  /*
   * Wait for the page to have said something, rather than for a fixed beat.
   *
   * The songbook is answered by a worker that has to index four and a half
   * thousand songs, which takes well over a second on a cold load — a flat
   * delay reported /songs as an empty page, which is a bug in the audit, not in
   * the app. Polling means a genuinely empty page still fails, just at the far
   * end of the window instead of immediately.
   */
  for (let i = 0; i < 40; i++) {
    const chars = await page.evaluate(() => (document.body.textContent || '').trim().length)
    if (chars > 200) break
    await new Promise((r) => setTimeout(r, 150))
  }

  const G = 'page'
  const R = route.path
  const V = view.id

  if (!resp || resp.status() >= 400) {
    err(G, R, V, 'responds 200', `HTTP ${resp?.status()}`)
    await page.close()
    return
  }
  ok(G, R, V, 'responds 200')

  const d = await page.evaluate(scrape)
  const indexable = !PRIVATE.some((p) => p.path === route.path)

  // -- the page rendered at all -------------------------------------------
  // Only asked of pages meant to be read by a stranger. The operator routes
  // open on a PIN prompt and are supposed to be thin — that is the feature.
  if (indexable) {
    if (d.bodyText > 200) ok(G, R, V, 'renders content')
    else err(G, R, V, 'renders content', `only ${d.bodyText} chars of text — page looks empty`)
  }

  // -- title ---------------------------------------------------------------
  if (!d.title) err(G, R, V, 'has a title', 'document.title is empty')
  else {
    ok(G, R, V, 'has a title')
    const key = `${V}:${d.title}`
    if (seen.titles.has(key))
      err(G, R, V, 'title is unique', `same title as ${seen.titles.get(key)}: "${d.title}"`)
    else {
      seen.titles.set(key, R)
      ok(G, R, V, 'title is unique')
    }
    if (d.title.length > 60) warn(G, R, V, 'title fits a SERP', `${d.title.length} chars (>60 truncates)`)
    else ok(G, R, V, 'title fits a SERP')
  }

  // -- description ---------------------------------------------------------
  if (!d.description) err(G, R, V, 'has a meta description', 'none on the page')
  else {
    ok(G, R, V, 'has a meta description')
    const key = `${V}:${d.description}`
    if (seen.descs.has(key))
      err(G, R, V, 'description is unique', `same description as ${seen.descs.get(key)}`)
    else {
      seen.descs.set(key, R)
      ok(G, R, V, 'description is unique')
    }
    if (d.description.length > 160)
      warn(G, R, V, 'description fits a SERP', `${d.description.length} chars (>160 truncates)`)
    else ok(G, R, V, 'description fits a SERP')
  }

  // -- canonical -----------------------------------------------------------
  // Two shells render the same URL. Without a canonical, and with the desktop
  // and mobile DOM differing, this is exactly the duplicate-content shape.
  if (!d.canonical) err(G, R, V, 'declares a canonical', 'no <link rel="canonical">')
  else {
    const want = `${ORIGIN}${route.path}`
    if (d.canonical.replace(/\/$/, '') === want.replace(/\/$/, '')) ok(G, R, V, 'declares a canonical')
    else err(G, R, V, 'declares a canonical', `points at ${d.canonical}, expected ${want}`)
  }

  // -- indexability --------------------------------------------------------
  const noindex = /noindex/i.test(d.robots || '')
  if (indexable && noindex) err(G, R, V, 'is indexable', 'public route carries meta robots noindex')
  else if (!indexable && !noindex)
    err(G, R, V, 'is NOT indexable', 'operator route is missing meta robots noindex')
  else ok(G, R, V, indexable ? 'is indexable' : 'is NOT indexable')

  // -- social ---------------------------------------------------------------
  if (indexable) {
    for (const [k, v] of [
      ['og:title', d.ogTitle],
      ['og:description', d.ogDesc],
      ['og:image', d.ogImage],
      ['og:url', d.ogUrl]
    ]) {
      if (v) ok(G, R, V, `has ${k}`)
      else err(G, R, V, `has ${k}`, 'missing — a shared link renders as a bare URL')
    }
    if (d.twitterCard) ok(G, R, V, 'has twitter:card')
    else warn(G, R, V, 'has twitter:card', 'missing')
  }

  // -- headings -------------------------------------------------------------
  const h1s = d.headings.filter((h) => h.level === 1)
  if (h1s.length === 1) ok(G, R, V, 'has exactly one h1')
  else err(G, R, V, 'has exactly one h1', `found ${h1s.length}${h1s.length ? `: ${h1s.map((h) => `"${h.text}"`).join(', ')}` : ''}`)

  if (d.headings.length && d.headings[0].level !== 1)
    err(G, R, V, 'starts at h1', `first heading is an h${d.headings[0].level}: "${d.headings[0].text}"`)
  else ok(G, R, V, 'starts at h1')

  let skipped = null
  for (let i = 1; i < d.headings.length; i++) {
    const jump = d.headings[i].level - d.headings[i - 1].level
    if (jump > 1) {
      skipped = `h${d.headings[i - 1].level} → h${d.headings[i].level} at "${d.headings[i].text}"`
      break
    }
  }
  if (skipped) err(G, R, V, 'heading levels never skip', skipped)
  else ok(G, R, V, 'heading levels never skip')

  // -- images ---------------------------------------------------------------
  const noAlt = d.imgs.filter((i) => i.alt === null && !i.hidden)
  if (noAlt.length) err(G, R, V, 'every img has alt', noAlt.map((i) => i.src.slice(-40)).join(', '))
  else ok(G, R, V, 'every img has alt')

  // -- links ----------------------------------------------------------------
  const mute = d.links.filter((a) => !a.text && !a.label)
  if (mute.length) err(G, R, V, 'every link has discernible text', `${mute.length} with no text or aria-label`)
  else ok(G, R, V, 'every link has discernible text')

  const known = new Set([...PUBLIC, ...PRIVATE].map((r) => r.path))
  const dead = d.links
    .map((a) => a.href)
    .filter((h) => h.startsWith('/') && !h.startsWith('//'))
    .filter((h) => !known.has(h) && !/^\/(c|live|songs)\//.test(h))
  if (dead.length) err(G, R, V, 'internal links resolve', [...new Set(dead)].join(', '))
  else ok(G, R, V, 'internal links resolve')

  // -- language -------------------------------------------------------------
  if (d.htmlLang) ok(G, R, V, 'html has lang')
  else err(G, R, V, 'html has lang', 'no lang on <html>')

  if (d.teluguUnmarked.length)
    err(
      G,
      R,
      V,
      'Telugu text is marked lang="te"',
      `${d.teluguUnmarked.length} unmarked, e.g. "${d.teluguUnmarked[0].text}"`
    )
  else ok(G, R, V, 'Telugu text is marked lang="te"')

  // -- structured data ------------------------------------------------------
  if (route.marketing) {
    if (!d.ld.length) err(G, R, V, 'carries JSON-LD', 'no application/ld+json on a marketing page')
    else {
      let parsed = null
      try {
        parsed = d.ld.map((s) => JSON.parse(s))
        ok(G, R, V, 'JSON-LD parses')
      } catch (e) {
        err(G, R, V, 'JSON-LD parses', String(e.message))
      }
      if (parsed) {
        const flat = parsed.flatMap((x) => (Array.isArray(x) ? x : [x]))
        const church = flat.find((x) => /Church|Organization|LocalBusiness/.test(x['@type'] || ''))
        if (church) {
          ok(G, R, V, 'JSON-LD describes the church')
          for (const f of ['name', 'address', 'url'])
            if (church[f]) ok(G, R, V, `JSON-LD has ${f}`)
            else err(G, R, V, `JSON-LD has ${f}`, `Church node is missing ${f}`)
        } else {
          err(G, R, V, 'JSON-LD describes the church', `types found: ${flat.map((x) => x['@type']).join(', ')}`)
        }
      }
    }
  }

  // -- hygiene --------------------------------------------------------------
  if (d.dupeIds.length) err(G, R, V, 'no duplicate ids', [...new Set(d.dupeIds)].join(', '))
  else ok(G, R, V, 'no duplicate ids')

  if (d.overflow > 1) err(G, R, V, 'no sideways scroll', `${d.overflow}px wider than the viewport`)
  else ok(G, R, V, 'no sideways scroll')

  // -- weight ---------------------------------------------------------------
  // The Bible and the songbook are ~11MB chunks. They are lazy by design; a
  // marketing page that pulls one is a Core Web Vitals failure and a phone
  // data bill.
  if (route.marketing) {
    if (heavy.length) err(G, R, V, 'no megachunks', `pulled ${[...new Set(heavy)].join(', ')}`)
    else ok(G, R, V, 'no megachunks')
  }

  await page.close()
}

// ------------------------------------------------------- song addresses -----
/**
 * A song's URL is its title, and every URL a song ever had still works.
 *
 * The songbook is the long tail — four and a half thousand pages, and the only
 * reason anyone searching a Telugu lyric would land here. `/songs/1697` cannot
 * rank for anything; `/songs/priyudaa-nee-prema-paadamul-cherithi` can.
 */
async function auditSongUrls(browser) {
  const G = 'songs'
  const page = await browser.newPage()
  await page.setViewport({ width: 1440, height: 900 })

  await page.goto(`${BASE}/songs`, { waitUntil: 'networkidle2', timeout: 60000 })
  // The list arrives from a worker that indexes 4,517 songs first. A fixed wait
  // is a coin toss on a cold cache — poll until the links exist.
  const links = () =>
    page.evaluate(() => [...document.querySelectorAll('a[href^="/songs/"]')].map((a) => a.getAttribute('href')))
  let hrefs = []
  for (let i = 0; i < 60; i++) {
    hrefs = await links()
    if (hrefs.length) break
    await new Promise((r) => setTimeout(r, 250))
  }
  await page.close()

  if (!hrefs.length) {
    err(G, '/songs', 'desktop', 'the index links to songs', 'no /songs/… links rendered')
    return
  }
  ok(G, '/songs', 'desktop', 'the index links to songs')

  const numeric = hrefs.filter((h) => /^\/songs\/\d+$/.test(h))
  if (numeric.length) err(G, '/songs', 'desktop', 'song links are titles, not ids', numeric.slice(0, 3).join(', '))
  else ok(G, '/songs', 'desktop', 'song links are titles, not ids')

  const read = async (path) => {
    const p = await browser.newPage()
    await p.setViewport({ width: 1440, height: 900 })
    await p.goto(`${BASE}${path}`, { waitUntil: 'networkidle2', timeout: 60000 })
    await new Promise((r) => setTimeout(r, 1500))
    const out = await p.evaluate(() => ({
      url: location.pathname,
      h1: document.querySelector('h1')?.textContent?.trim() || null
    }))
    await p.close()
    return out
  }

  const slug = hrefs[0]
  const bySlug = await read(slug)
  if (bySlug.h1 && bySlug.h1 !== '…') ok(G, slug, 'desktop', 'a slug URL renders its song')
  else err(G, slug, 'desktop', 'a slug URL renders its song', `h1 was ${JSON.stringify(bySlug.h1)}`)
  if (bySlug.url === slug) ok(G, slug, 'desktop', 'a slug URL is already canonical')
  else err(G, slug, 'desktop', 'a slug URL is already canonical', `redirected to ${bySlug.url}`)

  // Every /songs/<id> ever shared or bookmarked has to keep working, and has to
  // settle on the one address the song now has.
  const legacy = await read('/songs/1')
  if (legacy.h1 && legacy.h1 !== '…') ok(G, '/songs/1', 'desktop', 'legacy id still finds the song')
  else err(G, '/songs/1', 'desktop', 'legacy id still finds the song', `h1 was ${JSON.stringify(legacy.h1)}`)
  if (legacy.url !== '/songs/1' && /^\/songs\/[a-z0-9-]+$/.test(legacy.url))
    ok(G, '/songs/1', 'desktop', 'legacy id redirects to the slug')
  else err(G, '/songs/1', 'desktop', 'legacy id redirects to the slug', `stayed at ${legacy.url}`)

  // A stale or mistyped slug must say so. It used to sit on an ellipsis that
  // never resolved, which reads as a hung page rather than a wrong address.
  const bogus = await read('/songs/this-song-does-not-exist-at-all')
  if (bogus.h1 && bogus.h1 !== '…') ok(G, '/songs/<unknown>', 'desktop', 'an unknown song says so')
  else err(G, '/songs/<unknown>', 'desktop', 'an unknown song says so', 'still showing the loading ellipsis')
}

// ------------------------------------------------------------------ run -----

await startServer()
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox']
})

try {
  await auditStatic()
  await auditSongUrls(browser)
  for (const view of VIEWPORTS) {
    // Uniqueness is judged per version: the same route in two shells is one
    // page, and must not be compared against itself.
    const seen = { titles: new Map(), descs: new Map() }
    for (const route of [...PUBLIC, ...PRIVATE]) await auditPage(browser, route, view, seen)
  }
} finally {
  await browser.close()
  server?.kill()
}

// --------------------------------------------------------------- report -----

const errors = results.filter((r) => r.level === 'error')
const warns = results.filter((r) => r.level === 'warn')
const passes = results.filter((r) => r.level === 'pass')

/** Group identical failures across routes — 22 lines of "no canonical" is one
 *  finding, and printing it 22 times buries the ones that are route-specific. */
function report(rows, label) {
  if (!rows.length) return
  console.log(`\n${label} (${rows.length})`)
  const by = new Map()
  for (const r of rows) {
    const k = r.check
    if (!by.has(k)) by.set(k, [])
    by.get(k).push(r)
  }
  for (const [check, rs] of [...by.entries()].sort((a, b) => b[1].length - a[1].length)) {
    const where = rs.map((r) => `${r.route}[${r.view}]`)
    console.log(`\n  ✗ ${check}  — ${rs.length}×`)
    console.log(`    ${where.slice(0, 6).join(' ')}${where.length > 6 ? ` …+${where.length - 6}` : ''}`)
    const details = [...new Set(rs.map((r) => r.detail).filter(Boolean))]
    for (const d of details.slice(0, 3)) console.log(`    ↳ ${d}`)
  }
}

console.log(`\nSEO audit · ${BASE} · ${PUBLIC.length + PRIVATE.length} routes × ${VIEWPORTS.length} versions`)
report(errors, 'ERRORS — these keep the site out of results, or put the wrong thing in them')
report(warns, 'WARNINGS — quality of the result, not whether there is one')
console.log(`\n${passes.length} passed · ${warns.length} warned · ${errors.length} failed`)

if (errors.length && !WARN_ONLY) {
  console.log('\nFailing. Run with --warn-only to report without gating.')
  process.exit(1)
}
