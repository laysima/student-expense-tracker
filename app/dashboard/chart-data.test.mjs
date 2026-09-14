import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFinancialChartData } from './chart-data.ts'

const now = new Date(2026, 8, 6, 12)
const entry = (date, amount_cad, category = 'Rent') => ({ date, amount_cad, category })
const build = (options = {}) => buildFinancialChartData({ expenses: [], income: [], scope: 'running', month: new Date(2026, 8, 1), now, ...options })

test('running charts include earlier months, custom categories, and exact cents', () => {
  const result = build({
    expenses: [entry('2026-07-31', 42.75, 'Books'), entry('2026-08-01', 700), entry('2026-09-06', 33.25, 'Groceries')],
    income: [entry('2026-07-01', 1500), entry('2026-09-01', 500)],
  })
  assert.equal(result.incomeTotal, 2000)
  assert.equal(result.expenseTotal, 776)
  assert.equal(result.netTotal, 1224)
  assert.equal(result.grouping, 'monthly')
  assert.deepEqual(result.categories.map(item => item.name), ['Rent', 'Books', 'Groceries'])
  assert.equal(result.categories.reduce((sum, item) => sum + item.amount, 0), 776)
  assert.ok(Math.abs(result.categories.reduce((sum, item) => sum + item.percentage, 0) - 100) < 0.000001)
  assert.equal(result.trend.at(-1).income, result.incomeTotal)
  assert.equal(result.trend.at(-1).expenses, result.expenseTotal)
  assert.equal(result.trend.at(-1).net, result.netTotal)
})

test('monthly scope includes day one and today, and excludes future entries on both sides', () => {
  const result = build({
    scope: 'month',
    expenses: [entry('2026-08-31', 800), entry('2026-09-01', 100), entry('2026-09-06', 25), entry('2026-09-07', 999)],
    income: [entry('2026-08-31', 800), entry('2026-09-01', 200), entry('2026-09-07', 999)],
  })
  assert.equal(result.transactionCount, 3)
  assert.equal(result.expenseTotal, 125)
  assert.equal(result.incomeTotal, 200)
  assert.equal(result.trend.length, 7)
  assert.equal(result.trend[1].expenses, 100)
  assert.equal(result.trend[5].expenses, 100)
  assert.equal(result.trend[6].expenses, 125)
})

test('running scope also excludes future activity and fills quiet months', () => {
  const result = build({
    expenses: [entry('2026-06-15', 10), entry('2026-09-07', 900)],
    income: [entry('2026-08-01', 100), entry('2026-10-01', 500)],
  })
  assert.deepEqual(result.trend.map(point => [point.income, point.expenses]), [[0, 0], [0, 10], [0, 10], [100, 10], [100, 10]])
  assert.equal(result.netTotal, 90)
})

test('historical months use their full calendar and reset cumulative totals at the start', () => {
  const result = build({
    scope: 'month', month: new Date(2026, 7, 1),
    expenses: [entry('2026-07-31', 200), entry('2026-08-01', 10), entry('2026-08-31', 20), entry('2026-09-01', 900)],
    income: [entry('2026-08-15', 25)],
  })
  assert.equal(result.trend.length, 32)
  assert.equal(result.trend[0].net, 0)
  assert.equal(result.trend.at(-1).net, -5)
  assert.equal(result.expenseTotal, 30)
})

test('one transaction has an opening point and a plotted point', () => {
  const result = build({ expenses: [entry('2026-09-06', 12.5)] })
  assert.equal(result.trend.length, 2)
  assert.equal(result.trend[0].expenses, 0)
  assert.equal(result.trend[1].expenses, 12.5)
  assert.equal(result.categories[0].percentage, 100)
})

test('income-only accounts still have a cash-flow graph', () => {
  const result = build({ income: [entry('2026-09-06', 250)] })
  assert.equal(result.trend.at(-1).income, 250)
  assert.equal(result.netTotal, 250)
  assert.equal(result.categories.length, 0)
  assert.equal(result.transactionCount, 1)
})

test('empty and future-only accounts have no fictional points', () => {
  for (const result of [build(), build({ expenses: [entry('2026-09-07', 10)], income: [entry('2026-10-01', 100)] })]) {
    assert.deepEqual(result.trend, [])
    assert.deepEqual(result.categories, [])
    assert.equal(result.transactionCount, 0)
    assert.equal(result.netTotal, 0)
  }
})

test('category colors remain stable when rankings and date scope change', () => {
  const expenses = [entry('2026-08-01', 1000, 'Books'), entry('2026-09-01', 10, 'Books'), entry('2026-09-01', 100, 'Rent')]
  const running = build({ expenses })
  const monthly = build({ expenses, scope: 'month' })
  for (const category of running.categories) {
    assert.equal(category.fill, monthly.categories.find(item => item.name === category.name).fill)
  }
  const custom = build({ expenses: [entry('2026-09-01', 1, '__proto__')] })
  assert.match(custom.categories[0].fill, /^#[0-9A-F]{6}$/i)
})

test('cents accumulate without floating-point drift', () => {
  const result = build({ expenses: [entry('2026-09-01', 0.1), entry('2026-09-01', 0.2)], income: [entry('2026-09-01', 0.4)] })
  assert.equal(result.expenseTotal, 0.3)
  assert.equal(result.netTotal, 0.1)
  assert.equal(result.trend.at(-1).net, 0.1)
})

test('daily buckets follow calendar days across daylight-saving changes and leap years', () => {
  const spring = build({ scope: 'month', month: new Date(2026, 2, 1), expenses: [entry('2026-03-08', 1), entry('2026-03-09', 2)] })
  assert.equal(spring.trend.length, 32)
  assert.equal(spring.trend[8].expenses, 1)
  assert.equal(spring.trend[9].expenses, 3)
  const leap = build({ scope: 'month', month: new Date(2024, 1, 1), expenses: [entry('2024-02-29', 5)] })
  assert.equal(leap.trend.length, 30)
  assert.equal(leap.trend.at(-1).expenses, 5)
})
