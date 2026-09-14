/* Push-only worker: deliberately does not cache authenticated financial pages. */
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
