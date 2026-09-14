import assert from 'node:assert/strict'
import test from 'node:test'
import { spendingSummary } from './spending-limits.ts'
import { isPushEndpoint, pushSubscriptionSchema, spendingLimitSchema } from './spending-limit-validation.ts'

const settings = { mode: 'fixed', amount_cad: 100, income_percent: 80, warning_percent: 80, enabled: true, timezone: 'America/Toronto' }
const now = new Date('2026-09-08T12:00:00Z')
const entry = (amount_cad, date = '2026-09-08') => ({ amount_cad, date })
const summarize = (expenses, income = [], changes = {}) => spendingSummary({ ...settings, ...changes }, expenses, income, now)

test('exact early-warning and reached boundaries, including cents', () => {
  assert.equal(summarize([entry(79.99)]).status, 'on_track')
  assert.equal(summarize([entry(79.99), entry(.01)]).status, 'warning')
  assert.equal(summarize([entry(99.99)]).status, 'warning')
  assert.equal(summarize([entry(99.99), entry(.01)]).status, 'reached')
  assert.equal(summarize([entry(100.01)]).remaining, -.01)
})

test('income percentage adjusts to recorded money, excluding future and previous months', () => {
  const summary = summarize([entry(70), entry(900, '2026-08-31'), entry(900, '2026-09-09')],
    [entry(100), entry(1000, '2026-10-01')], { mode: 'income_percent', amount_cad: null })
  assert.equal(summary.limit, 80)
  assert.equal(summary.spent, 70)
  assert.equal(summary.status, 'warning')
  assert.equal(summarize([entry(70)], [entry(200)], { mode: 'income_percent' }).status, 'on_track')
})

test('no income and paused alerts do not invent a zero-dollar exceeded limit', () => {
  assert.equal(summarize([entry(100)], [], { mode: 'income_percent' }).status, 'waiting')
  assert.equal(summarize([entry(100)], [], { enabled: false }).status, 'inactive')
  assert.equal(spendingSummary(null, [], [], now).status, 'inactive')
})

test('month boundaries use the saved timezone, not the server timezone', () => {
  const result = spendingSummary(settings, [entry(30, '2026-08-31'), entry(999, '2026-09-01')], [], new Date('2026-09-01T02:00:00Z'))
  assert.equal(result.month, '2026-08')
  assert.equal(result.spent, 30)
})

test('fixed amounts, integer percentages and IANA timezones are validated', () => {
  assert.ok(spendingLimitSchema.safeParse(settings).success)
  for (const invalid of [{ amount_cad: null }, { amount_cad: 0 }, { amount_cad: 1.001 }, { amount_cad: Infinity }, { income_percent: 101 }, { warning_percent: 100 }, { warning_percent: 49 }, { warning_percent: 80.5 }, { timezone: 'made-up/zone' }]) {
    assert.equal(spendingLimitSchema.safeParse({ ...settings, ...invalid }).success, false)
  }
})

test('push destinations reject private hosts, userinfo, lookalike domains and non-HTTPS URLs', () => {
  for (const endpoint of ['https://fcm.googleapis.com/fcm/send/abc', 'https://updates.push.services.mozilla.com/wpush/v2/a', 'https://web.push.apple.com/a', 'https://wns2-db5p.notify.windows.com/w/?token=x']) assert.ok(isPushEndpoint(endpoint))
  for (const endpoint of ['http://fcm.googleapis.com/a', 'https://localhost/a', 'https://127.0.0.1/a', 'https://169.254.169.254/a', 'https://fcm.googleapis.com.evil.test/a', 'https://evilpush.apple.com/a', 'https://u:p@fcm.googleapis.com/a', 'https://fcm.googleapis.com:8000/a']) assert.equal(isPushEndpoint(endpoint), false)
  assert.equal(pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/a', keys: { p256dh: 'bad', auth: 'bad' } }).success, false)
})
