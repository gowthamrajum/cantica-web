/**
 * The sitemap, generated rather than written.
 *
 * Eleven pages a visitor might search for, plus one per song — four and a half
 * thousand of them, each the only place a particular Telugu lyric is written
 * down and none of them linked from anywhere a crawler can reach without
 * running the app's search. That long tail is the whole reason this file
 * exists; a hand-maintained sitemap would list the eleven and lose the rest.
 *
 * Runs as `prebuild`, so `npm run build` cannot ship a sitemap that disagrees
 * with the songbook it was built from. The URLs come from the same songSlug
 * module the app routes with — if the two ever disagreed, every song URL in
 * here would 404.
 *
 *   npm run sitemap           write public/sitemap.xml
 *   npm run sitemap -- --check   report, write nothing
 *
 * Run through `node --experimental-strip-types` because it imports songSlug.ts
 * directly. Node strips types without the flag only from 23.6; Render builds on
 * 22, where the import would otherwise throw and take the whole build with it.
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { buildSlugIndex } from '../src/lib/songSlug.ts'
import songs from '../src/data/songsData.json' with { type: 'json' }

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(HERE, '..', 'public', 'sitemap.xml')
const CHECK = process.argv.includes('--check')

/** Must match SITE_ORIGIN in src/lib/seo.ts and SEO_ORIGIN in seo-audit.mjs. */
const ORIGIN = process.env.SITE_ORIGIN || 'https://cantica-web.onrender.com'

/**
 * Priority is a hint about relative importance within this site, nothing more.
 * The pages that answer "who are you and when do you meet" lead; the songbook
 * sits below them because it is deep, not because it is unimportant.
 *
 * The operator routes (/build, /remote, /notify) are deliberately absent — they
 * carry noindex, and advertising them here would be asking a crawler to fetch
 * a page that tells it to go away.
 */
const PAGES = [
  { path: '/', priority: '1.0', changefreq: 'daily' },
  { path: '/about', priority: '0.9', changefreq: 'monthly' },
  { path: '/services', priority: '0.9', changefreq: 'monthly' },
  { path: '/visit', priority: '0.9', changefreq: 'monthly' },
  { path: '/watch', priority: '0.8', changefreq: 'weekly' },
  { path: '/give', priority: '0.7', changefreq: 'monthly' },
  { path: '/songs', priority: '0.7', changefreq: 'weekly' },
  { path: '/bible', priority: '0.7', changefreq: 'monthly' },
  { path: '/more', priority: '0.4', changefreq: 'monthly' },
  { path: '/install', priority: '0.4', changefreq: 'yearly' },
  { path: '/notifications', priority: '0.4', changefreq: 'yearly' }
]

const esc = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

const { byId } = buildSlugIndex(songs)
const songUrls = songs
  .map((s) => byId.get(s.song_id))
  .filter(Boolean)
  .sort()
  .map((slug) => ({ path: `/songs/${slug}`, priority: '0.5', changefreq: 'yearly' }))

const all = [...PAGES, ...songUrls]

const NS = 'http://www.sitemaps.org/schemas/sitemap/0.9'

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="${NS}">
${all
  .map(
    (u) =>
      `  <url><loc>${esc(ORIGIN + u.path)}</loc><changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`
  )
  .join('\n')}
</urlset>
`

const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : null
const same = before === xml
console.log(
  `${same ? 'same' : CHECK ? 'WOULD WRITE' : 'wrote'}  sitemap.xml  ${PAGES.length} pages + ${songUrls.length} songs  ${Math.round(xml.length / 1024)}KB`
)
if (!same && !CHECK) fs.writeFileSync(OUT, xml)
