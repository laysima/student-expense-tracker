import assert from 'node:assert/strict'
import test from 'node:test'
import { dueOccurrences, localIsoDate, nthOccurrence } from './recurrence.ts'

test('monthly bills keep their day, clamped in short months', () => {
  assert.equal(nthOccurrence('2026-08-09', 'monthly', 1), '2026-09-09')
  assert.equal(nthOccurrence('2026-01-31', 'monthly', 1), '2026-02-28')
  assert.equal(nthOccurrence('2026-01-31', 'monthly', 2), '2026-03-31')
  assert.equal(nthOccurrence('2026-11-15', 'monthly', 2), '2027-01-15')
  assert.equal(nthOccurrence('2024-02-29', 'yearly', 1), '2025-02-28')
})

test('weekly and biweekly cycles step by days across month ends', () => {
  assert.equal(nthOccurrence('2026-09-28', 'weekly', 1), '2026-10-05')
  assert.equal(nthOccurrence('2026-12-25', 'biweekly', 1), '2027-01-08')
})

test('only missed occurrences up to today are due', () => {
  assert.deepEqual(dueOccurrences('2026-08-09', 'monthly', '2026-08-09', '2026-10-01'), ['2026-09-09'])
  assert.deepEqual(dueOccurrences('2026-08-09', 'monthly', '2026-08-09', '2026-10-09'), ['2026-09-09', '2026-10-09'])
  assert.deepEqual(dueOccurrences('2026-08-09', 'monthly', '2026-09-09', '2026-10-01'), [])
  assert.deepEqual(dueOccurrences('2026-09-18', 'monthly', '2026-09-18', '2026-10-01'), [])
  assert.equal(dueOccurrences('2020-01-01', 'weekly', '2020-01-01', '2026-10-01', 24).length, 24)
})

test('today follows the user, not the server', () => {
  const lateEvening = new Date('2026-10-09T02:00:00Z') // Oct 8, 10pm in Toronto
  assert.equal(localIsoDate(lateEvening, 'America/Toronto'), '2026-10-08')
  assert.equal(localIsoDate(lateEvening, 'UTC'), '2026-10-09')
})
