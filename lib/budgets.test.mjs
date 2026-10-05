import assert from 'node:assert/strict'
import test from 'node:test'
import { budgetsInForce, setBudgetForMonth } from './budgets.ts'

const row = (category, amount_cad, month, year = 2026) => ({ category, amount_cad, month, year })

test('a budget carries into every later month', () => {
  const budgets = [row('Groceries', 300, 8)]
  assert.deepEqual(budgetsInForce(budgets, 8, 2026).map(b => [b.category, b.amount_cad, b.inherited]), [['Groceries', 300, false]])
  assert.deepEqual(budgetsInForce(budgets, 10, 2026).map(b => [b.amount_cad, b.inherited]), [[300, true]])
  assert.deepEqual(budgetsInForce(budgets, 2, 2027).map(b => b.amount_cad), [300])
})

test('earlier months are not affected by a budget set later', () => {
  assert.deepEqual(budgetsInForce([row('Groceries', 300, 8)], 7, 2026), [])
})

test('a change applies from its month onward and keeps history', () => {
  const budgets = [row('Groceries', 300, 8), row('Groceries', 250, 10)]
  assert.equal(budgetsInForce(budgets, 9, 2026)[0].amount_cad, 300)
  assert.equal(budgetsInForce(budgets, 10, 2026)[0].amount_cad, 250)
  assert.equal(budgetsInForce(budgets, 12, 2026)[0].amount_cad, 250)
})

test('a zero row ends the budget from that month', () => {
  const budgets = [row('Rent', 1200, 8), row('Rent', 0, 10)]
  assert.equal(budgetsInForce(budgets, 9, 2026).length, 1)
  assert.equal(budgetsInForce(budgets, 11, 2026).length, 0)
})

test('categories are independent and the year boundary is handled', () => {
  const budgets = [row('Rent', 1200, 12, 2025), row('Transport', 100, 1)]
  assert.deepEqual(budgetsInForce(budgets, 1, 2026).map(b => b.category).sort(), ['Rent', 'Transport'])
})

test('a deleted budget set again later comes back from that month', () => {
  const budgets = [row('Groceries', 300, 8), row('Groceries', 0, 10), row('Groceries', 250, 11)]
  assert.equal(budgetsInForce(budgets, 10, 2026).length, 0)
  assert.equal(budgetsInForce(budgets, 11, 2026)[0].amount_cad, 250)
})

// Minimal stand-in for the Supabase query builder, recording each write.
function fakeSupabase({ matchingRows = 0, updateError = null, insertError = null } = {}) {
  const calls = []
  const client = {
    from(table) {
      return {
        update(values) {
          const filters = {}
          const chain = {
            eq(column, value) { filters[column] = value; return chain },
            async select() {
              calls.push({ op: 'update', table, values, filters })
              return { data: Array.from({ length: matchingRows }, () => ({})), error: updateError }
            },
          }
          return chain
        },
        async insert(values) {
          calls.push({ op: 'insert', table, values })
          return { error: insertError }
        },
      }
    },
  }
  return { client, calls }
}

const groceries = { user_id: 'u1', category: 'Groceries', month: 10, year: 2026, amount_cad: 0 }

test('setBudgetForMonth updates that month\'s row rather than adding a second one', async () => {
  const { client, calls } = fakeSupabase({ matchingRows: 1 })
  assert.equal(await setBudgetForMonth(client, groceries), null)
  assert.deepEqual(calls.map(c => c.op), ['update'])
  assert.deepEqual(calls[0].filters, { user_id: 'u1', category: 'Groceries', month: 10, year: 2026 })
  assert.deepEqual(calls[0].values, { amount_cad: 0 })
})

test('setBudgetForMonth inserts when that month has no row yet', async () => {
  const { client, calls } = fakeSupabase({ matchingRows: 0 })
  assert.equal(await setBudgetForMonth(client, { ...groceries, amount_cad: 250 }), null)
  assert.deepEqual(calls.map(c => c.op), ['update', 'insert'])
  assert.deepEqual(calls[1].values, { ...groceries, amount_cad: 250 })
})

test('setBudgetForMonth returns errors and does not insert after a failed update', async () => {
  const updateError = { message: 'permission denied' }
  const failingUpdate = fakeSupabase({ updateError })
  assert.equal(await setBudgetForMonth(failingUpdate.client, groceries), updateError)
  assert.deepEqual(failingUpdate.calls.map(c => c.op), ['update'])

  const insertError = { message: 'insert failed' }
  assert.equal(await setBudgetForMonth(fakeSupabase({ insertError }).client, groceries), insertError)
})
