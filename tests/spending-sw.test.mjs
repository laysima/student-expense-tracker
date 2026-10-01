import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import vm from 'node:vm'

const source = await readFile(new URL('../public/spending-sw.js', import.meta.url), 'utf8')
function worker(windows = []) {
  const listeners = {}
  const shown = []
  const opened = []
  vm.runInNewContext(source, { URL, self: {
    location: { origin: 'https://xtrack.example' },
    addEventListener: (event, callback) => { listeners[event] = callback },
    registration: { showNotification: async (...args) => shown.push(args) },
    clients: { matchAll: async () => windows, openWindow: async url => opened.push(url) },
  } })
  return { listeners, shown, opened }
}

test('push displays a generic reminder and safely handles malformed payloads', async () => {
  const { listeners, shown } = worker()
  let done
  listeners.push({ data: { json() { throw new Error('invalid') } }, waitUntil(promise) { done = promise } })
  await done
  assert.equal(shown.length, 1)
  assert.equal(shown[0][1].data.url, '/dashboard#spending-limit')
  assert.match(shown[0][1].body, /Visit Xtrack/)
})

test('notification click opens the spending card, ignoring arbitrary payload URLs', async () => {
  const { listeners, opened } = worker()
  let done; let closed = false
  listeners.notificationclick({ notification: { data: { url: 'https://evil.example' }, close() { closed = true } }, waitUntil(promise) { done = promise } })
  await done
  assert.equal(closed, true)
  assert.deepEqual(opened, ['https://xtrack.example/dashboard#spending-limit'])
})

test('notification click reuses and focuses an existing dashboard window', async () => {
  const navigated = []; let focused = false; let done
  const { listeners, opened } = worker([{ url: 'https://xtrack.example/dashboard', navigate: async url => navigated.push(url), focus: async () => { focused = true } }])
  listeners.notificationclick({ notification: { close() {} }, waitUntil(promise) { done = promise } })
  await done
  assert.equal(focused, true)
  assert.equal(opened.length, 0)
  assert.deepEqual(navigated, ['https://xtrack.example/dashboard#spending-limit'])
})

function cachingWorker() {
  const listeners = {}
  const stores = new Map()
  const fetched = []
  const caches = {
    async open(name) {
      if (!stores.has(name)) stores.set(name, new Map())
      const store = stores.get(name)
      return {
        match: async request => store.get(typeof request === 'string' ? request : new URL(request.url).pathname),
        put: async (request, response) => { store.set(typeof request === 'string' ? request : new URL(request.url).pathname, response) },
        add: async path => { store.set(path, { ok: true, path }) },
        keys: async () => [...store.keys()],
        delete: async key => store.delete(key),
      }
    },
    keys: async () => [...stores.keys()],
    delete: async name => stores.delete(name),
  }
  const fetchStub = async request => { fetched.push(new URL(request.url).pathname); return { ok: true, clone() { return this } } }
  vm.runInNewContext(source, { URL, URLSearchParams, caches, fetch: fetchStub, self: {
    location: { origin: 'https://xtrack.example', search: '?cache=1' },
    addEventListener: (event, callback) => { listeners[event] = callback },
    skipWaiting() {},
    clients: { claim: async () => {} },
  } })
  return { listeners, stores, fetched }
}

function request(path, mode = 'cors', method = 'GET') {
  return { url: `https://xtrack.example${path}`, mode, method }
}

test('never intercepts authenticated pages or API calls', () => {
  const { listeners } = cachingWorker()
  for (const [path, mode] of [['/dashboard', 'navigate'], ['/api/plaid/status', 'cors'], ['/login', 'navigate']]) {
    let intercepted = false
    listeners.fetch({ request: request(path, mode), respondWith() { intercepted = true }, waitUntil() {} })
    assert.equal(intercepted, false, path)
  }
})

test('serves the launch page from cache once stored', async () => {
  const { listeners } = cachingWorker()
  let installed
  listeners.install({ waitUntil(promise) { installed = promise } })
  await installed
  let response
  listeners.fetch({ request: request('/launch', 'navigate'), respondWith(promise) { response = promise }, waitUntil() {} })
  assert.equal((await response).path, '/launch')
})

test('caches content-hashed build files', async () => {
  const { listeners, fetched } = cachingWorker()
  const pending = []
  const run = async () => {
    let response
    listeners.fetch({ request: request('/_next/static/chunks/app-abc123.js'), respondWith(promise) { response = promise }, waitUntil(promise) { pending.push(promise) } })
    await response
    await Promise.all(pending)
  }
  await run()
  await run()
  assert.deepEqual(fetched, ['/_next/static/chunks/app-abc123.js'])
})
