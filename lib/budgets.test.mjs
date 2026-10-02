import assert from 'node:assert/strict'
import test from 'node:test'
import { budgetsInForce } from './budgets.ts'

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
