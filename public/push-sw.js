/*
 * The push half of the service worker.
 *
 * Imported by the Workbox-generated sw.js rather than replacing it: the caching
 * rules in vite.config.ts are what keep the songbook and the Bible readable
 * with no signal, and hand-writing the worker to add two listeners would mean
 * hand-writing those rules too.
 *
 * Nothing here touches the cache. It only shows what arrives, and opens the app
 * where the notification points.
 */

self.addEventListener('push', (event) => {
  // A push with no readable body still has to show something. Both Chrome and
  // Safari revoke permission from a site that receives a push and shows no
  // notification, so there is no silent path out of here.
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { body: event.data && event.data.text ? event.data.text() : '' }
  }

  const title = data.title || 'Telugu Community Church'
  const options = {
    body: data.body || '',
    icon: '/icons/pwa-192.png',
    badge: '/icons/pwa-192.png',
    // The path to open on tap, carried through to notificationclick.
    data: { url: data.url || '/' },
    // One tag means a second notification replaces the first rather than
    // stacking. A church sends few enough that a pile-up is the likelier
    // annoyance.
    tag: data.tag || 'tcc',
    renotify: true
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      // Focus a window that is already open rather than stacking another copy
      // of the app on top of it — on a phone the second copy looks like the
      // first one lost its place.
      for (const client of all) {
        if ('focus' in client) {
          if ('navigate' in client) {
            try {
              await client.navigate(target)
            } catch {
              /* a client that refuses to navigate is still worth focusing */
            }
          }
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })()
  )
})
