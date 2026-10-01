// One URL for every registration: two different script URLs on the same scope
// would keep replacing each other. Production builds turn on the launch cache
// (see public/spending-sw.js); in development cached chunks would go stale
// between edits, so the worker only handles push there.
export const SERVICE_WORKER_URL = process.env.NODE_ENV === 'production' ? '/spending-sw.js?cache=1' : '/spending-sw.js'

export function registerServiceWorker() {
  return navigator.serviceWorker.register(SERVICE_WORKER_URL, { scope: '/', updateViaCache: 'none' })
}
