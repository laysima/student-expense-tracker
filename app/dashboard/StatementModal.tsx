'use client'

import { useMemo, useState } from 'react'
import SiteLogo from '@/components/SiteLogo'

interface StatementExpense {
  id: string
  category: string
  amount_cad: number
  note: string | null
  date: string
}

interface StatementIncome {
  id: string
  source: string
  amount_cad: number
  date: string
}

interface Props {
  fullName: string
  university?: string
  expenses: StatementExpense[]
  income: StatementIncome[]
  onClose: () => void
}

type Period = 'month' | 'threeMonths' | 'sixMonths' | 'year' | 'twoYears' | 'all'

const PERIODS: Array<{ id: Period; label: string }> = [
  { id: 'month', label: 'This month' },
  { id: 'threeMonths', label: '3 months' },
  { id: 'sixMonths', label: '6 months' },
  { id: 'year', label: 'This year' },
  { id: 'twoYears', label: '2 years' },
  { id: 'all', label: 'All time' },
]

function asLocalDate(value: string) {
  return new Date(value.includes('T') ? value : `${value}T00:00:00`)
}

function formatMoney(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
  }).format(value)
}

function formatDate(value: Date | string) {
  const date = typeof value === 'string' ? asLocalDate(value) : value
  return date.toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })
}

function periodStart(period: Period, now: Date) {
  if (period === 'month') return new Date(now.getFullYear(), now.getMonth(), 1)
  if (period === 'threeMonths') return new Date(now.getFullYear(), now.getMonth() - 2, 1)
  if (period === 'sixMonths') return new Date(now.getFullYear(), now.getMonth() - 5, 1)
  if (period === 'year') return new Date(now.getFullYear(), 0, 1)
  if (period === 'twoYears') return new Date(now.getFullYear() - 1, 0, 1)
  return null
}

export default function StatementModal({ fullName, university, expenses, income, onClose }: Props) {
  const [period, setPeriod] = useState<Period>('month')
  // '' means "use the rolling period above". Anything else is a single closed
  // month ('2026-08'), which the preset windows could never isolate — they all
  // run from some point in the past up to today.
  const [singleMonth, setSingleMonth] = useState('')
  const now = new Date()

  // Every month that actually has a transaction, newest first.
  const monthOptions = useMemo(() => {
    const seen = new Map<string, string>()
    for (const entry of [...expenses, ...income]) {
      const date = asLocalDate(entry.date)
      if (date > now) continue
      const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
      if (!seen.has(key)) {
        seen.set(key, date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }))
      }
    }
    return [...seen.entries()].sort((a, b) => b[0].localeCompare(a[0]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, income])

  const monthStart = singleMonth
    ? new Date(Number(singleMonth.slice(0, 4)), Number(singleMonth.slice(5, 7)) - 1, 1)
    : null
  const monthEnd = monthStart
    ? new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0, 23, 59, 59, 999)
    : null

  const start = monthStart ?? periodStart(period, now)
  const periodLabel = singleMonth
    ? monthOptions.find(([key]) => key === singleMonth)?.[1] ?? 'Statement'
    : PERIODS.find(option => option.id === period)?.label ?? 'Statement'

  const transactions = useMemo(() => {
    const cutoff = monthEnd ?? now
    const inPeriod = (date: string) => {
      const value = asLocalDate(date)
      return (!start || value >= start) && value <= cutoff
    }

    return [
      ...income.filter(item => inPeriod(item.date)).map(item => ({
        id: `income-${item.id}`,
        date: item.date,
        description: item.source,
        category: 'Income',
        income: item.amount_cad,
        expense: 0,
      })),
      ...expenses.filter(item => inPeriod(item.date)).map(item => ({
        id: `expense-${item.id}`,
        date: item.date,
        description: item.note ?? item.category,
        category: item.category,
        income: 0,
        expense: item.amount_cad,
      })),
    ].sort((a, b) => asLocalDate(b.date).getTime() - asLocalDate(a.date).getTime())
    // `start`, `cutoff` and `now` intentionally follow the selection on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expenses, income, period, singleMonth])

  const totalIncome = transactions.reduce((total, item) => total + item.income, 0)
  const totalExpenses = transactions.reduce((total, item) => total + item.expense, 0)
  const net = totalIncome - totalExpenses

  const earliestDate = transactions.length > 0
    ? transactions.reduce((earliest, item) => {
        const date = asLocalDate(item.date)
        return date < earliest ? date : earliest
      }, asLocalDate(transactions[0].date))
    : now
  const rangeStart = start ?? earliestDate

  function handlePrint() {
    window.print()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="statement-title"
          className="flex max-h-[94vh] w-full max-w-[860px] flex-col overflow-hidden rounded-[28px] bg-[#F7F7F3] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="statement-print-controls flex flex-col gap-5 border-b border-[#E1E2DC] px-5 py-5 sm:px-7">
            <div className="flex items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C96042]">Export</p>
                <h2 id="statement-title" className="mt-1 text-[22px] font-semibold tracking-[-0.035em] text-[#242522]">Print a statement</h2>
                <p className="mt-1 text-[12px] text-[#85887F]">Choose the period you want to review or save as a PDF.</p>
              </div>
              <button type="button" onClick={onClose} className="py-1 text-[12px] font-semibold text-[#85887F] hover:text-[#242522]">Close</button>
            </div>

            <div className="flex flex-wrap gap-1 rounded-xl bg-[#E9EAE4] p-1" role="group" aria-label="Statement period">
              {PERIODS.map(option => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={!singleMonth && period === option.id}
                  onClick={() => { setSingleMonth(''); setPeriod(option.id) }}
                  className={`flex-1 whitespace-nowrap rounded-lg px-3 py-2.5 text-[11px] font-semibold transition ${
                    !singleMonth && period === option.id
                      ? 'bg-white text-[#242522] shadow-sm'
                      : 'text-[#74776F] hover:text-[#242522]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            {monthOptions.length > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <label htmlFor="statement-month" className="whitespace-nowrap text-[11px] font-medium text-[#85887F]">
                  Or one month:
                </label>
                <select
                  id="statement-month"
                  value={singleMonth}
                  onChange={event => setSingleMonth(event.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-[#DFE0DA] bg-white px-3 py-2 text-[12px] font-medium text-[#242522] outline-none transition focus:border-[#829A83]"
                >
                  <option value="">Use the range above</option>
                  {monthOptions.map(([key, label]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-3 sm:p-6">
            <section className="statement-print-area mx-auto min-h-[720px] max-w-[760px] bg-white px-6 py-7 text-[#20211E] shadow-sm sm:px-10 sm:py-9">
              <div className="flex items-start justify-between gap-6 border-b-2 border-[#20211E] pb-6">
                <div className="flex items-center gap-3">
                  <SiteLogo size="compact" surface="light" />
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#85887F]">Student finance statement</p>
                </div>
                <div className="text-right">
                  <p className="text-[13px] font-semibold">{periodLabel}</p>
                  <p className="mt-1 text-[10px] text-[#85887F]">{formatDate(rangeStart)} – {formatDate(now)}</p>
                </div>
              </div>

              <div className="flex flex-col gap-4 border-b border-[#E3E4DF] py-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#91948C]">Prepared for</p>
                  <p className="mt-1 text-[15px] font-semibold">{fullName}</p>
                  {university && <p className="mt-0.5 text-[11px] text-[#74776F]">{university}</p>}
                </div>
                <p className="text-[10px] text-[#91948C]">Generated {formatDate(now)}</p>
              </div>

              <div className="grid grid-cols-3 gap-3 py-6">
                <div className="border-l-2 border-[#829A83] pl-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#91948C]">Income</p>
                  <p className="mt-1 text-[16px] font-semibold text-[#46664E]">{formatMoney(totalIncome)}</p>
                </div>
                <div className="border-l-2 border-[#E98563] pl-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#91948C]">Expenses</p>
                  <p className="mt-1 text-[16px] font-semibold text-[#B9573A]">{formatMoney(totalExpenses)}</p>
                </div>
                <div className="border-l-2 border-[#30312D] pl-3">
                  <p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#91948C]">Net change</p>
                  <p className={`mt-1 text-[16px] font-semibold ${net < 0 ? 'text-[#B9573A]' : 'text-[#242522]'}`}>{formatMoney(net)}</p>
                </div>
              </div>

              {transactions.length > 0 ? (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="border-b border-[#C9CBC3] text-[9px] font-semibold uppercase tracking-[0.12em] text-[#85887F]">
                      <th className="pb-2 pr-3">Date</th>
                      <th className="pb-2 pr-3">Description</th>
                      <th className="hidden pb-2 pr-3 sm:table-cell">Category</th>
                      <th className="pb-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map(item => (
                      <tr key={item.id} className="statement-row border-b border-[#ECEDE8] text-[10px]">
                        <td className="whitespace-nowrap py-3 pr-3 text-[#74776F]">{formatDate(item.date)}</td>
                        <td className="py-3 pr-3 font-medium">{item.description}</td>
                        <td className="hidden py-3 pr-3 text-[#74776F] sm:table-cell">{item.category}</td>
                        <td className={`whitespace-nowrap py-3 text-right font-semibold ${item.income > 0 ? 'text-[#46664E]' : 'text-[#B9573A]'}`}>
                          {item.income > 0 ? '+' : '−'}{formatMoney(item.income || item.expense)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="border-y border-[#E3E4DF] py-16 text-center">
                  <p className="text-[13px] font-semibold text-[#555851]">No transactions for this period</p>
                  <p className="mt-1 text-[10px] text-[#91948C]">Choose another period to view more activity.</p>
                </div>
              )}

              <div className="mt-8 border-t border-[#20211E] pt-3 text-[9px] leading-4 text-[#91948C]">
                This statement was generated from transactions recorded in Xtrack. Amounts are shown in Canadian dollars.
              </div>
            </section>
          </div>

          <div className="statement-print-controls flex items-center justify-between border-t border-[#E1E2DC] px-5 py-4 sm:px-7">
            <p className="text-[11px] text-[#85887F]">{transactions.length} transaction{transactions.length === 1 ? '' : 's'} included</p>
            <button
              type="button"
              onClick={handlePrint}
              className="rounded-xl bg-[#242522] px-5 py-3 text-[12px] font-semibold text-white shadow-sm transition hover:bg-[#393B35]"
            >
              Print statement
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
