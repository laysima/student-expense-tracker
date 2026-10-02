'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Rent', 'Groceries', 'Tuition', 'Transport', 'Utilities', 'Entertainment', 'Other']

interface ExistingBudget {
  category: string
  amount_cad: number
  // The month the limit was set in; earlier than the modal's month when it
  // carried over.
  month: number
  year: number
}

interface Suggestion {
  category: string
  suggested: number
}

interface Props {
  userId: string
  month: number
  year: number
  existingBudgets: ExistingBudget[]
  suggestions: Suggestion[]
  initialCategory?: string | null
  onClose: () => void
  onSaved: () => void
}

export default function AddBudgetModal({ userId, month, year, existingBudgets, suggestions, initialCategory, onClose, onSaved }: Props) {
  // Opening an existing budget for a custom category selects "Other" and puts
  // the name back in the text field.
  const savedCustomCategory =
    initialCategory && !CATEGORIES.includes(initialCategory) ? initialCategory : ''
  const [customCategory, setCustomCategory] = useState(savedCustomCategory)
  const [category, setCategory] = useState(
    savedCustomCategory ? 'Other' : initialCategory ?? CATEGORIES[0],
  )
  const [amount, setAmount] = useState(
    existingBudgets.find(budget => budget.category === (initialCategory ?? CATEGORIES[0]))?.amount_cad.toString() ?? '',
  )
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // What actually gets written and matched against — the typed name when one
  // is given, otherwise the chip itself.
  const effectiveCategory =
    category === 'Other' && customCategory.trim() ? customCategory.trim() : category

  const suggestion = suggestions.find(item => item.category === effectiveCategory)
  const existingForCategory = existingBudgets.find(budget => budget.category === effectiveCategory)

  function selectCategory(next: string) {
    setCategory(next)
    setAmount(existingBudgets.find(budget => budget.category === next)?.amount_cad.toString() ?? '')
  }

  async function handleSave() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    // A budget carried over from an earlier month is changed by recording a
    // new limit for this month, which then carries forward in its place.
    const setThisMonth = existingForCategory && existingForCategory.month === month && existingForCategory.year === year
    const { error: saveError } = setThisMonth
      ? await supabase
          .from('budgets')
          .update({ amount_cad: Number(amount) })
          .eq('user_id', userId)
          .eq('category', effectiveCategory)
          .eq('month', month)
          .eq('year', year)
      : await supabase
          .from('budgets')
          .insert({ user_id: userId, category: effectiveCategory, amount_cad: Number(amount), month, year })

    if (saveError) {
      setError(saveError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  const inputClass = 'w-full rounded-xl border border-transparent bg-[#F1F2ED] px-4 py-3.5 text-base font-medium text-[#242522] placeholder-[#A4A79F] sm:text-[14px] outline-none transition focus:border-[#829A83] focus:bg-white focus:ring-4 focus:ring-[#829A83]/10'
  const labelClass = 'mb-2 block text-[12px] font-semibold text-[#5F625B]'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-budget-title"
          className="xt-sheet flex max-h-[94dvh] w-full max-w-[520px] flex-col overflow-hidden rounded-t-[28px] bg-[#FCFCF9] sm:max-h-[90vh] sm:rounded-[28px] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="flex shrink-0 items-start justify-between px-6 pb-3 pt-6 sm:px-8 sm:pt-8">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#658069]">This month</p>
              <h2 id="add-budget-title" className="text-[24px] font-semibold tracking-[-0.035em] text-[#242522]">{existingForCategory ? 'Edit budget' : 'Set a budget'}</h2>
              <p className="mt-1 text-[12px] text-[#85887F]">{existingForCategory ? 'Update this category’s limit. The new amount applies from this month on.' : 'Set a monthly limit. It repeats every month until you change it.'}</p>
            </div>
            <button type="button" onClick={onClose} className="-mr-3 -mt-1 rounded-lg px-3 py-2 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">
              Close
            </button>
          </div>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto overscroll-contain px-6 py-5 sm:px-8">
            {error && <div className="rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{error}</div>}

            <div>
              <label className={labelClass}>Category</label>
              <div className="flex flex-wrap gap-x-1 gap-y-2" role="group" aria-label="Budget category">
                {CATEGORIES.map(item => (
                  <button
                    key={item}
                    type="button"
                    aria-pressed={category === item}
                    onClick={() => selectCategory(item)}
                    className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                      category === item
                        ? 'bg-[#28352A] text-white shadow-sm'
                        : 'text-[#74776F] hover:bg-[#ECEEE8] hover:text-[#343630]'
                    }`}
                  >
                    {item}
                  </button>
                ))}
              </div>

              {category === 'Other' && (
                <div className="mt-3">
                  <input
                    type="text"
                    value={customCategory}
                    onChange={event => setCustomCategory(event.target.value)}
                    placeholder="Name this category (optional) — e.g. Gym"
                    maxLength={24}
                    aria-label="Custom budget category"
                    className={inputClass}
                  />
                  <p className="mt-2 text-[11px] text-[#91948C]">
                    Match the name you used on your expenses so spending counts toward it.
                  </p>
                </div>
              )}
            </div>

            <div>
              <label className={labelClass}>Monthly limit in CAD</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-[#7E8179]">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={amount}
                  onChange={event => setAmount(event.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pl-9 text-[18px]`}
                />
              </div>
              {suggestion && (
                <button
                  type="button"
                  onClick={() => setAmount(String(suggestion.suggested))}
                  className="mt-2.5 text-left text-[11px] font-semibold leading-5 text-[#658069] hover:underline"
                >
                  Use suggested {new Intl.NumberFormat('en-CA', {
                    style: 'currency',
                    currency: 'CAD',
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  }).format(suggestion.suggested)} based on recent spending
                </button>
              )}
            </div>
          </div>

          <div className="flex shrink-0 items-center justify-between gap-3 border-t border-[#ECEDE7] px-6 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3 sm:gap-4 sm:border-t-0 sm:px-8 sm:pb-8">
            <button type="button" onClick={onClose} className="px-2 py-3 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="min-w-0 flex-1 rounded-xl sm:min-w-[168px] sm:flex-none bg-[#28352A] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637] disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Saving...' : existingForCategory ? 'Save changes' : 'Save budget'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
