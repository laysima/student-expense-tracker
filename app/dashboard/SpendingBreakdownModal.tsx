'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, CreditCard, Repeat, type LucideIcon } from 'lucide-react'
import { categoryColor } from './chart-data'

interface BreakdownExpense {
  id: string
  category: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  note: string | null
  date: string
  is_recurring: boolean
}

interface Props {
  // Mirrors the card that was tapped, e.g. "Spent this month".
  title: string
  periodLabel: string
  // Exactly the expenses behind the card's figure, so the totals always agree.
  expenses: BreakdownExpense[]
  icons: Record<string, LucideIcon>
  onViewAll: () => void
  onClose: () => void
}

function formatCAD(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatOriginal(amount: number, currency: string) {
  try {
    return new Intl.NumberFormat('en-CA', { style: 'currency', currency }).format(amount)
  } catch {
    return `${amount.toFixed(2)} ${currency}`
  }
}

// Date-only strings parse as UTC midnight; pin them to local time so an
// expense on the 1st doesn't display as the last day of the previous month.
function formatDay(date: string) {
  return new Date(date.includes('T') ? date : `${date}T00:00:00`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
  })
}

export default function SpendingBreakdownModal({ title, periodLabel, expenses, icons, onViewAll, onClose }: Props) {
  const [expanded, setExpanded] = useState<string | null>(null)

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const total = useMemo(() => expenses.reduce((sum, expense) => sum + expense.amount_cad, 0), [expenses])

  const groups = useMemo(() => {
    const byCategory = new Map<string, { total: number; items: BreakdownExpense[] }>()
    for (const expense of expenses) {
      const group = byCategory.get(expense.category) ?? { total: 0, items: [] }
      group.total += expense.amount_cad
      group.items.push(expense)
      byCategory.set(expense.category, group)
    }
    return [...byCategory.entries()]
      .map(([category, group]) => ({
        category,
        total: group.total,
        items: group.items.sort((a, b) => b.date.localeCompare(a.date)),
      }))
      .sort((a, b) => b.total - a.total)
  }, [expenses])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="spending-breakdown-title"
          className="xt-sheet flex max-h-[94dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-[#FCFCF9] sm:max-h-[90vh] sm:rounded-[28px] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="flex shrink-0 items-start justify-between px-6 pb-3 pt-6 sm:px-8 sm:pt-8">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#B9573A]">{title}</p>
              <h2 id="spending-breakdown-title" className="text-[24px] font-semibold tracking-[-0.035em] text-[#242522]">
                Where it went
              </h2>
              <p className="mt-1 text-[12px] text-[#85887F]">
                {formatCAD(total)} across {expenses.length} transaction{expenses.length === 1 ? '' : 's'} · {periodLabel}
              </p>
            </div>
            <button type="button" onClick={onClose} className="-mr-3 -mt-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-4 sm:px-8">
            {groups.length === 0 ? (
              <p className="py-10 text-center text-[13px] text-[#85887F]">Nothing spent in this period yet.</p>
            ) : (
              <ul className="space-y-2">
                {groups.map(group => {
                  const Icon = icons[group.category] ?? CreditCard
                  const color = categoryColor(group.category)
                  const share = total > 0 ? (group.total / total) * 100 : 0
                  const open = expanded === group.category
                  return (
                    <li key={group.category} className="rounded-2xl bg-white ring-1 ring-[#ECEDE7]">
                      <button
                        type="button"
                        aria-expanded={open}
                        onClick={() => setExpanded(open ? null : group.category)}
                        className="flex w-full items-center gap-3 px-4 py-3.5 text-left"
                      >
                        <span
                          className="grid size-9 shrink-0 place-items-center rounded-xl"
                          style={{ backgroundColor: `${color}1F`, color }}
                        >
                          <Icon size={16} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-baseline justify-between gap-3">
                            <span className="truncate text-[13px] font-semibold text-[#242522]">{group.category}</span>
                            <span className="shrink-0 text-[13px] font-semibold tabular-nums text-[#242522]">{formatCAD(group.total)}</span>
                          </span>
                          <span className="mt-1.5 flex items-center gap-2.5">
                            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#ECEDE8]" aria-hidden="true">
                              <span className="block h-full rounded-full" style={{ width: `${share}%`, backgroundColor: color }} />
                            </span>
                            <span className="shrink-0 text-[11px] tabular-nums text-[#85887F]">
                              {Math.round(share)}% · {group.items.length}
                            </span>
                          </span>
                        </span>
                        <ChevronDown
                          size={16}
                          aria-hidden="true"
                          className={`shrink-0 text-[#A4A79F] transition-transform ${open ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {open && (
                        <ul className="border-t border-[#F0F1EC] px-4 py-1">
                          {group.items.map(item => (
                            <li key={item.id} className="flex items-center justify-between gap-3 py-2.5">
                              <span className="min-w-0">
                                <span className="block truncate text-[13px] text-[#343630]">{item.note || item.category}</span>
                                <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#91948C]">
                                  {formatDay(item.date)}
                                  {item.is_recurring && (
                                    <>
                                      <span aria-hidden="true">·</span>
                                      <Repeat size={11} aria-hidden="true" /> Recurring
                                    </>
                                  )}
                                </span>
                              </span>
                              <span className="shrink-0 text-right">
                                <span className="block text-[13px] tabular-nums text-[#343630]">{formatCAD(item.amount_cad)}</span>
                                {item.original_currency && item.original_currency !== 'CAD' && item.original_amount != null && (
                                  <span className="block text-[11px] tabular-nums text-[#91948C]">
                                    {formatOriginal(item.original_amount, item.original_currency)}
                                  </span>
                                )}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#ECEDE7] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:gap-4 sm:border-t-0 sm:px-8 sm:pb-8">
            <button type="button" onClick={onClose} className="px-2 py-3 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">Close</button>
            <button
              type="button"
              onClick={onViewAll}
              className="min-w-0 flex-1 rounded-xl sm:min-w-[168px] sm:flex-none bg-[#28352A] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637]"
            >
              See all expenses
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
