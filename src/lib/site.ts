/**
 * WHERE THIS SITE LIVES. Change the domain here and nowhere else.
 *
 * The origin used to be written out in five places — the SEO tags, the install
 * screen, robots.txt, the sitemap, and the audit — and one of them was a PNG,
 * which is the kind of copy that does not turn up in a grep and does not fail
 * loudly. It just quietly sends people somewhere that no longer exists.
 *
 * Everything below is now derived from this one string:
 *
 *   · canonical, og:url and og:image on every route      (lib/seo.ts)
 *   · the link the install screen shares and copies      (routes/Install.tsx)
 *   · robots.txt, including its Sitemap: line            (generated)
 *   · every <loc> in sitemap.xml, all 4,528 of them      (generated)
 *   · public/install-qr.png — the QR shown on the         (generated)
 *     projector, which encodes the URL as pixels
 *   · what scripts/seo-audit.mjs holds the deploy to
 *
 * To move the site:
 *   1. change the line below
 *   2. `npm run build`   (regenerates robots, sitemap and the QR)
 *   3. `SEO_BASE=https://the-new-domain npm run seo-audit`
 *
 * The audit cross-checks robots.txt, the sitemap and the canonical tags against
 * each other, so a half-finished move fails rather than half-works. Point the
 * old host at the new one with a 301 as well — that is Render configuration,
 * not code, and nothing here can check it for you.
 */
export const SITE_ORIGIN = 'https://cantica-web.onrender.com'

/** `SITE_ORIGIN` with any trailing slash removed, joined to a route path. */
export function siteUrl(path = '/'): string {
  return `${SITE_ORIGIN.replace(/\/$/, '')}${path}`
}
