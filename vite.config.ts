import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages project site sets BASE_PATH=/cantica-web/ in CI; a custom domain
// or the Capacitor native build uses '/'.
const base = process.env.BASE_PATH || '/'

export default defineConfig({
  base,
  // Emit JSON as `JSON.parse("…")` so the bundled Bible/Songs data parses fast
  // and ships inside a JS chunk rather than as a fetchable .json response.
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
        }
      }
    }
  },
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
        // Precache the app shell only; the large data-*.js chunks are runtime-cached.
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        globIgnores: ['**/data-*.js', '**/songs.worker-*.js', 'push-sw.js'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            // Vendored Bible + Songs ship as lazy chunks, too big for the
            // precache — cached on first use so they are there offline. The
            // search worker carries the songbook inside it and is the same kind
            // of thing: without it here, the songs would be missing offline
            // exactly on the screen that exists to search them.
            urlPattern: ({ url, sameOrigin }) =>
              sameOrigin &&
              (url.pathname.includes('/assets/data-') || url.pathname.includes('/assets/songs.worker-')),
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
