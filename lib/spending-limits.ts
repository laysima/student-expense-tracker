export interface SpendingLimitSettings {
  mode: 'fixed' | 'income_percent'
  amount_cad: number | null
  income_percent: number
  warning_percent: number
  enabled: boolean
  timezone: string
}

interface Entry { date: string; amount_cad: number }

export function spendingSummary(settings: SpendingLimitSettings | null, expenses: Entry[], income: Entry[], now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings?.timezone ?? 'UTC', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now)
  const part = (type: string) => parts.find(item => item.type === type)!.value
  const today = `${part('year')}-${part('month')}-${part('day')}`
  const month = today.slice(0, 7)
  // Recorded transactions only: future paydays/expenses and recurring templates
  // do not create projected money in an actual spending boundary.
  const sum = (entries: Entry[]) => entries
    .filter(entry => entry.date.slice(0, 7) === month && entry.date.slice(0, 10) <= today)
    .reduce((total, entry) => total + Math.round(Number(entry.amount_cad) * 100), 0)
  const spent = sum(expenses)
  const earned = sum(income)
  const limit = settings?.mode === 'fixed'
    ? Math.round(Number(settings.amount_cad) * 100)
    : Math.round(earned * (settings?.income_percent ?? 80) / 100)
  const status = !settings || !settings.enabled ? 'inactive'
    : limit <= 0 ? 'waiting'
    : spent >= limit ? 'reached'
    : spent * 100 >= limit * settings.warning_percent ? 'warning' : 'on_track'
  return {
    month, spent: spent / 100, income: earned / 100, limit: limit / 100,
    remaining: (limit - spent) / 100,
    percentage: limit > 0 ? Math.floor(spent * 100 / limit) : 0,
    status,
  }
}
