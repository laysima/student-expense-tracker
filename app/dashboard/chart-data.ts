export interface ChartEntry {
  date: string
  amount_cad: number
}

export interface ChartExpense extends ChartEntry {
  category: string
}

export type ChartScope = 'running' | 'month'

interface ChartOptions {
  expenses: ChartExpense[]
  income: ChartEntry[]
  scope: ChartScope
  month: Date
  now?: Date
}

const CATEGORY_COLORS: Record<string, string> = {
  Rent: '#E98563',
  Groceries: '#829A83',
  Tuition: '#8D9FB9',
  Transport: '#CEAB68',
  Utilities: '#AC91AC',
  Entertainment: '#7CA4A1',
  Other: '#A7AAA0',
}
const CUSTOM_COLORS = ['#B68571', '#8398AD', '#A3A56F', '#AB8FAB', '#72A29B']

function categoryColor(name: string) {
  if (Object.hasOwn(CATEGORY_COLORS, name)) return CATEGORY_COLORS[name]
  const hash = Array.from(name).reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 0)
  return CUSTOM_COLORS[hash % CUSTOM_COLORS.length]
}

function localDate(value: string) {
  return new Date(value.includes('T') ? value : `${value}T00:00:00`)
}

function dayStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function bucketKey(date: Date, monthly: boolean) {
  return `${date.getFullYear()}-${date.getMonth()}${monthly ? '' : `-${date.getDate()}`}`
}

function fullDate(date: Date) {
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function buildFinancialChartData({ expenses, income, scope, month, now = new Date() }: ChartOptions) {
  const cutoff = new Date(now)
  cutoff.setHours(23, 59, 59, 999)
  const monthStart = new Date(month.getFullYear(), month.getMonth(), 1)
  const nextMonth = new Date(month.getFullYear(), month.getMonth() + 1, 1)
  const select = <T extends ChartEntry>(entries: T[]) => entries.filter(entry => {
    const date = localDate(entry.date)
    return Number.isFinite(entry.amount_cad) && date <= cutoff &&
      (scope === 'running' || (date >= monthStart && date < nextMonth))
  })
  const selectedExpenses = select(expenses)
  const selectedIncome = select(income)
  const entries = [...selectedExpenses, ...selectedIncome]
  const cents = (entry: ChartEntry) => Math.round(entry.amount_cad * 100)
  const incomeCents = selectedIncome.reduce((sum, entry) => sum + cents(entry), 0)
  const expenseCents = selectedExpenses.reduce((sum, entry) => sum + cents(entry), 0)
  const categoryTotals = new Map<string, number>()
  for (const entry of selectedExpenses) {
    categoryTotals.set(entry.category, (categoryTotals.get(entry.category) ?? 0) + cents(entry))
  }
  const categories = [...categoryTotals.entries()]
    .filter(([, amount]) => amount > 0)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([name, amount]) => ({
      name,
      amount: amount / 100,
      percentage: expenseCents > 0 ? (amount / expenseCents) * 100 : 0,
      fill: categoryColor(name),
    }))

  const earliest = entries.reduce((date, entry) => {
    const candidate = localDate(entry.date)
    return candidate < date ? candidate : date
  }, cutoff)
  const start = scope === 'month' ? monthStart : dayStart(earliest)
  const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0)
  const end = scope === 'month' && monthEnd < cutoff ? monthEnd : dayStart(cutoff)
  const monthSpan = (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth()
  const monthly = scope === 'running' && monthSpan > 1
  const buckets = new Map<string, { income: number; expenses: number }>()
  for (const [items, type] of [[selectedIncome, 'income'], [selectedExpenses, 'expenses']] as const) {
    for (const entry of items) {
      const key = bucketKey(localDate(entry.date), monthly)
      const bucket = buckets.get(key) ?? { income: 0, expenses: 0 }
      bucket[type] += cents(entry)
      buckets.set(key, bucket)
    }
  }

  const trend: Array<{ label: string; dateLabel: string; income: number; expenses: number; net: number }> = []
  if (entries.length > 0) {
    // An explicit opening point also makes a single transaction visible.
    trend.push({ label: 'Start', dateLabel: `Before ${fullDate(start)}`, income: 0, expenses: 0, net: 0 })
    const cursor = monthly ? new Date(start.getFullYear(), start.getMonth(), 1) : new Date(start)
    let earned = 0
    let spent = 0
    while (cursor <= end) {
      const bucket = buckets.get(bucketKey(cursor, monthly))
      earned += bucket?.income ?? 0
      spent += bucket?.expenses ?? 0
      const bucketEnd = monthly ? new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0) : cursor
      trend.push({
        label: cursor.toLocaleDateString('en-CA', monthly ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' }),
        dateLabel: `Through ${fullDate(bucketEnd > end ? end : bucketEnd)}`,
        income: earned / 100,
        expenses: spent / 100,
        net: (earned - spent) / 100,
      })
      if (monthly) cursor.setMonth(cursor.getMonth() + 1)
      else cursor.setDate(cursor.getDate() + 1)
    }
  }

  return {
    trend,
    categories,
    incomeTotal: incomeCents / 100,
    expenseTotal: expenseCents / 100,
    netTotal: (incomeCents - expenseCents) / 100,
    transactionCount: entries.length,
    grouping: monthly ? 'monthly' : 'daily',
  }
}
