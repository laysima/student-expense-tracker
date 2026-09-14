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
