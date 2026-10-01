/* Push notifications, plus a small launch cache for the home-screen app.
   Only two things are ever cached: the public /launch page and Next's
   content-hashed build files under /_next/static/. Authenticated financial
   pages and API responses always go to the network and are never stored. */
const CACHING = /[?&]cache=1(&|$)/.test(self.location.search || '')
const SHELL_CACHE = 'xtrack-shell-v1'
const STATIC_CACHE = 'xtrack-static-v1'
const STATIC_LIMIT = 200

self.addEventListener('install', event => {
  if (CACHING) event.waitUntil(caches.open(SHELL_CACHE).then(cache => cache.add('/launch')).catch(() => {}))
  self.skipWaiting()
})

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keep = CACHING ? [SHELL_CACHE, STATIC_CACHE] : []
    const keys = await caches.keys()
    await Promise.all(keys.filter(key => key.startsWith('xtrack-') && !keep.includes(key)).map(key => caches.delete(key)))
    await self.clients.claim()
  })())
})

async function trimStatic(cache) {
  const keys = await cache.keys()
  // Oldest first; build files from past deploys age out.
  await Promise.all(keys.slice(0, Math.max(0, keys.length - STATIC_LIMIT)).map(key => cache.delete(key)))
}

self.addEventListener('fetch', event => {
  if (!CACHING) return
  const request = event.request
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Launch page: answer from cache instantly, refresh it in the background.
  if (request.mode === 'navigate' && url.pathname === '/launch') {
    event.respondWith((async () => {
      const cache = await caches.open(SHELL_CACHE)
      const cached = await cache.match('/launch')
      const network = fetch(request).then(response => {
        if (response.ok) cache.put('/launch', response.clone())
        return response
      })
      if (cached) {
        event.waitUntil(network.catch(() => {}))
        return cached
      }
      return network
    })())
    return
  }

  // Build files never change once deployed (their names are content hashes).
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE)
      const cached = await cache.match(request)
      if (cached) return cached
      const response = await fetch(request)
      if (response.ok) {
        event.waitUntil(cache.put(request, response.clone()).then(() => trimStatic(cache)))
      }
      return response
    })())
  }
})

self.addEventListener('push', event => {
  let payload = {}
  try { payload = event.data?.json() ?? {} } catch { /* Use the generic message. */ }
  event.waitUntil(self.registration.showNotification(payload.title || 'Your Xtrack spending update', {
    body: payload.body || 'Visit Xtrack to review your spending limit.',
    icon: '/icon.png',
    badge: '/icon.png',
    tag: payload.tag || 'xtrack-spending',
    data: { url: '/dashboard#spending-limit' },
  }))
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const target = new URL('/dashboard#spending-limit', self.location.origin).href
  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true })
    const existing = windows.find(client => new URL(client.url).origin === self.location.origin && new URL(client.url).pathname === '/dashboard')
    if (existing) {
      await existing.navigate(target)
      await existing.focus()
    } else {
      await self.clients.openWindow(target)
    }
  })())
})
