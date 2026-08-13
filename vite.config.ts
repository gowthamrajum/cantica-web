import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site sets BASE_PATH=/cantica-web/ in CI; a custom domain
// or the Capacitor native build uses '/'.
const base = process.env.BASE_PATH || '/'

/**
 * The songbook is emitted as a .json asset rather than imported into a chunk
 * (see songSearch.ts). Named with the same `data-` prefix as the vendored Bible
 * chunks so one runtime-caching rule covers everything large and vendored.
 *
 * Shared with the worker build below, which is a separate rollup run and does
 * not inherit this. Without it there the worker emitted its own identically
 * hashed copy under a different name — one file on disk twice, and worse, the
 * worker and the main thread fetching different URLs for the same songs and
 * each caching their own. Same name from both builds means one asset.
 */
const assetFileNames = (info: { names?: readonly string[] }): string => {
  const name = info.names?.[0] ?? ''
  return name.endsWith('.json') ? 'assets/data-[hash][extname]' : 'assets/[name]-[hash][extname]'
}

export default defineConfig({
  base,
  // Emit imported JSON as `JSON.parse("…")` so the vendored Bible parses fast
  // rather than being walked as an object literal. Applies to the Bible only
  // now — the songbook is imported `?url` and fetched, so it never becomes JS.
  json: { stringify: true },
  build: {
    chunkSizeWarningLimit: 20000,
    rollupOptions: {
      output: {
        // Give the vendored-data chunks a stable prefix so the service worker can
        // runtime-cache them (they're too big for the precache).
        chunkFileNames(info) {
          const id = info.facadeModuleId || ''
          return id.includes('/src/data/') ? 'assets/data-[hash].js' : 'assets/[name]-[hash].js'
        },
        assetFileNames
      }
    }
  },
  worker: { rollupOptions: { output: { assetFileNames } } },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: null, // registered manually in main.tsx (polls for updates)
      // No `includeAssets`. It adds publicDir files to the precache, but
      // globPatterns below already sweeps every svg/png in the build output —
      // which is where those files land — so each icon was being listed twice.
      // Harmless but not free, and it grew every time an icon was added.
      workbox: {
        /*
         * The push and notificationclick listeners, pulled into the generated
         * worker rather than replacing it with a hand-written one. Switching to
         * injectManifest to add two listeners would mean re-implementing the
         * runtimeCaching below by hand, and those rules are the whole reason
         * 4,517 songs and the Bible work with no signal.
         */
        importScripts: ['push-sw.js'],
        // Precache the app shell only; the large data-* files are runtime-cached.
        // The search worker is back in the precache now that it is just the
        // matching code — it was excluded when it weighed eleven megabytes.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data-*.js', 'push-sw.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Vendored Bible chunks and the songbook .json, too big for the
            // precache — cached on first use so they are there offline. Both
            // are named `data-*` (see assetFileNames above), so one pattern
            // covers them. The search worker no longer needs listing: it used
            // to carry the songbook inside it, and now fetches this instead.
            urlPattern: ({ url, sameOrigin }) => sameOrigin && url.pathname.includes('/assets/data-'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tcc-data',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 180 },
              cacheableResponse: { statuses: [0, 200] }
            }
          },
          {
            urlPattern: ({ url }) => url.hostname.endsWith('gstatic.com') || url.hostname.endsWith('googleapis.com'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'tcc-fonts',
              expiration: { maxEntries: 24, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      },
      manifest: {
        name: 'Telugu Community Church',
        short_name: 'Cantica',
        description: 'Telugu Community Church, Irving TX — worship, study, and prayer.',
        theme_color: '#faf6ee',
        background_color: '#faf6ee',
        display: 'standalone',
        start_url: '.',
        icons: [
          { src: 'icons/pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      }
    })
  ]
})
