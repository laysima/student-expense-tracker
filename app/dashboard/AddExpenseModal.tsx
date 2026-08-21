'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const CATEGORIES = ['Groceries', 'Rent', 'Tuition', 'Transport', 'Utilities', 'Entertainment', 'Other']
const CYCLES = ['weekly', 'biweekly', 'monthly', 'yearly']

interface ExpenseRecord {
  id: string
  category: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  note: string | null
  date: string
  is_recurring: boolean
  recur_cycle: string | null
  split_total_cad: number | null
  split_count: number | null
}

interface Props {
  userId: string
  homeCurrency: string
  expense?: ExpenseRecord | null
  onClose: () => void
  onSaved: () => void
}

export default function AddExpenseModal({ userId, homeCurrency, expense, onClose, onSaved }: Props) {
  const isEditing = Boolean(expense)
  const canConvert = homeCurrency !== 'CAD'
  const [showConverter, setShowConverter] = useState(Boolean(expense?.original_amount))
  const [form, setForm] = useState({
    category: expense?.category ?? 'Groceries',
    amountCad: expense
      ? String(expense.split_count ? expense.split_total_cad ?? expense.amount_cad : expense.amount_cad)
      : '',
    originalAmount: expense?.original_amount ? String(expense.original_amount) : '',
    note: expense?.note ?? '',
    date: expense?.date ?? new Date().toISOString().split('T')[0],
    isRecurring: expense?.is_recurring ?? false,
    recurCycle: expense?.recur_cycle ?? 'monthly',
    isSplit: Boolean(expense?.split_count),
    splitCount: expense?.split_count ? String(expense.split_count) : '2',
  })
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  function update(field: string, value: string | boolean) {
    setForm(previous => ({ ...previous, [field]: value }))
  }

  async function fetchConversion(amount: string) {
    if (!amount || isNaN(Number(amount))) return
    setConverting(true)
    try {
      const response = await fetch(
        `https://api.frankfurter.app/latest?amount=${amount}&from=${homeCurrency}&to=CAD`,
      )
      const data = await response.json()
      const cad = data.rates?.CAD
      if (cad) {
        setConvertedAmount(cad)
        setForm(previous => ({ ...previous, amountCad: cad.toFixed(2) }))
      }
    } catch {
      // The user can still enter the CAD amount manually.
    } finally {
      setConverting(false)
    }
  }

  useEffect(() => {
    if (!showConverter || !form.originalAmount) return
    const handle = setTimeout(() => fetchConversion(form.originalAmount), 500)
    return () => clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.originalAmount, showConverter])

  const splitCountNumber = Math.max(2, Number(form.splitCount) || 2)
  const yourShare = form.isSplit && form.amountCad ? Number(form.amountCad) / splitCountNumber : null

  async function handleSave() {
    if (!form.amountCad || isNaN(Number(form.amountCad))) {
      setError('Please enter a valid amount.')
      return
    }
    if (form.isSplit && (!form.splitCount || splitCountNumber < 2)) {
      setError('Split between at least 2 people.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      category: form.category,
      amount_cad: form.isSplit ? Number(form.amountCad) / splitCountNumber : Number(form.amountCad),
      original_amount: form.originalAmount ? Number(form.originalAmount) : null,
      original_currency: form.originalAmount ? homeCurrency : null,
      note: form.note || null,
      date: form.date,
      is_recurring: form.isRecurring,
      recur_cycle: form.isRecurring ? form.recurCycle : null,
      split_total_cad: form.isSplit ? Number(form.amountCad) : null,
      split_count: form.isSplit ? splitCountNumber : null,
    }
    const { error: saveError } = isEditing
      ? await supabase.from('expenses').update(payload).eq('id', expense!.id).eq('user_id', userId)
      : await supabase.from('expenses').insert({ user_id: userId, ...payload })

    if (saveError) {
      setError(saveError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  async function handleDelete() {
    if (!expense) return
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: deleteError } = await supabase
      .from('expenses')
      .delete()
      .eq('id', expense.id)
      .eq('user_id', userId)

    if (deleteError) {
      setError(deleteError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  const inputClass = 'w-full rounded-xl border border-transparent bg-[#F1F2ED] px-4 py-3.5 text-[14px] font-medium text-[#242522] placeholder-[#A4A79F] outline-none transition focus:border-[#E98563] focus:bg-white focus:ring-4 focus:ring-[#E98563]/10'
  const labelClass = 'mb-2 block text-[12px] font-semibold text-[#5F625B]'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-expense-title"
          className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-[#FCFCF9] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="flex items-start justify-between px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#C96042]">Money out</p>
              <h2 id="add-expense-title" className="text-[24px] font-semibold tracking-[-0.035em] text-[#242522]">{isEditing ? 'Edit expense' : 'Add expense'}</h2>
              <p className="mt-1 text-[12px] text-[#85887F]">{isEditing ? 'Update the details of this expense.' : 'Capture a purchase or upcoming cost.'}</p>
            </div>
            <button type="button" onClick={onClose} className="py-1 text-[12px] font-semibold text-[#85887F] transition hover:text-[#242522]">
              Close
            </button>
          </div>

          <div className="max-h-[68vh] space-y-6 overflow-y-auto px-6 py-5 sm:px-8">
            {error && <div className="rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{error}</div>}

            <div>
              <label className={labelClass}>Category</label>
              <div className="flex flex-wrap gap-x-1 gap-y-2" role="group" aria-label="Expense category">
                {CATEGORIES.map(category => (
                  <button
                    key={category}
                    type="button"
                    aria-pressed={form.category === category}
                    onClick={() => update('category', category)}
                    className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                      form.category === category
                        ? 'bg-[#4A2C23] text-white shadow-sm'
                        : 'text-[#74776F] hover:bg-[#F4E9E4] hover:text-[#5B382D]'
                    }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>{form.isSplit ? 'Total bill (CAD)' : 'Amount in CAD'}</label>
              <div className="relative">
                <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-[#7E8179]">$</span>
                <input
                  type="number"
                  inputMode="decimal"
                  value={form.amountCad}
                  onChange={event => update('amountCad', event.target.value)}
                  placeholder="0.00"
                  className={`${inputClass} pl-9 text-[18px]`}
                />
              </div>
              {canConvert && (
                <button type="button" onClick={() => setShowConverter(value => !value)} className="mt-2.5 text-[11px] font-semibold text-[#C96042] hover:underline">
                  {showConverter ? 'Hide currency converter' : `Convert from ${homeCurrency}`}
                </button>
              )}
            </div>

            <div className="flex items-center justify-between border-t border-[#E7E8E2] pt-5">
              <div>
                <p className="text-[13px] font-semibold text-[#343630]">Split with roommates</p>
                <p className="mt-0.5 text-[11px] text-[#91948C]">Only your share counts toward your spending</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isSplit}
                aria-label="Split with roommates"
                onClick={() => update('isSplit', !form.isSplit)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${form.isSplit ? 'bg-[#E98563]' : 'bg-[#D7D9D2]'}`}
              >
                <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${form.isSplit ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {form.isSplit && (
              <div className="rounded-2xl bg-[#FFF0EA] p-4">
                <label className={labelClass}>Split between how many people? <span className="font-normal text-[#A0A39B]">Including you</span></label>
                <input
                  type="number"
                  inputMode="numeric"
                  min={2}
                  value={form.splitCount}
                  onChange={event => update('splitCount', event.target.value)}
                  className={inputClass}
                />
                {yourShare !== null && (
                  <p className="mt-2.5 text-[11px] font-medium text-[#B9573A]">
                    Your share: {new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(yourShare)} — this is what gets tracked
                  </p>
                )}
              </div>
            )}

            {canConvert && showConverter && (
              <div className="rounded-2xl bg-[#FFF0EA] p-4">
                <label className={labelClass}>Amount in {homeCurrency}</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    inputMode="decimal"
                    value={form.originalAmount}
                    onChange={event => update('originalAmount', event.target.value)}
                    placeholder={`0.00 ${homeCurrency}`}
                    className={`${inputClass} min-w-0 flex-1`}
                  />
                  <button
                    type="button"
                    onClick={() => fetchConversion(form.originalAmount)}
                    disabled={converting || !form.originalAmount}
                    className="whitespace-nowrap rounded-xl bg-[#E98563] px-4 py-3 text-[12px] font-semibold text-white transition hover:bg-[#D87452] disabled:opacity-40"
                  >
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                </div>
                {convertedAmount && <p className="mt-2 text-[11px] font-medium text-[#B9573A]">≈ CA${convertedAmount.toFixed(2)} at today&apos;s rate — applied above</p>}
              </div>
            )}

            <div>
              <label className={labelClass}>What was it for? <span className="font-normal text-[#A0A39B]">Optional</span></label>
              <input
                type="text"
                value={form.note}
                onChange={event => update('note', event.target.value)}
                placeholder="e.g. Weekly grocery run"
                className={inputClass}
              />
            </div>

            <div>
              <label className={labelClass}>Date spent</label>
              <input type="date" value={form.date} onChange={event => update('date', event.target.value)} className={inputClass} />
            </div>

            <div className="flex items-center justify-between border-t border-[#E7E8E2] pt-5">
              <div>
                <p className="text-[13px] font-semibold text-[#343630]">Repeat this expense</p>
                <p className="mt-0.5 text-[11px] text-[#91948C]">Useful for rent, bills, or subscriptions</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isRecurring}
                aria-label="Repeat this expense"
                onClick={() => update('isRecurring', !form.isRecurring)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${form.isRecurring ? 'bg-[#E98563]' : 'bg-[#D7D9D2]'}`}
              >
                <span className={`absolute left-1 top-1 size-5 rounded-full bg-white shadow-sm transition-transform ${form.isRecurring ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {form.isRecurring && (
              <div>
                <label className={labelClass}>Repeats</label>
                <div className="flex flex-wrap gap-1 rounded-xl bg-[#F1F2ED] p-1">
                  {CYCLES.map(cycle => (
                    <button
                      key={cycle}
                      type="button"
                      onClick={() => update('recurCycle', cycle)}
                      className={`flex-1 rounded-lg px-3 py-2 text-[11px] font-semibold capitalize transition ${
                        form.recurCycle === cycle ? 'bg-white text-[#A64F35] shadow-sm' : 'text-[#85887F] hover:text-[#343630]'
                      }`}
                    >
                      {cycle}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 px-6 pb-7 pt-3 sm:px-8 sm:pb-8">
            {confirmingDelete ? (
              <div className="flex items-center gap-3">
                <span className="text-[12px] font-medium text-[#B9573A]">Delete this expense?</span>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={loading}
                  className="text-[13px] font-semibold text-[#B9573A] underline underline-offset-2 transition hover:text-[#9E4630] disabled:opacity-50"
                >
                  {loading ? 'Deleting...' : 'Yes, delete'}
                </button>
                <button type="button" onClick={() => setConfirmingDelete(false)} className="text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">No</button>
              </div>
            ) : (
              <div className="flex items-center gap-4">
                <button type="button" onClick={onClose} className="px-2 py-3 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">Cancel</button>
                {isEditing && (
                  <button type="button" onClick={() => setConfirmingDelete(true)} className="text-[13px] font-semibold text-[#B9573A] transition hover:text-[#9E4630]">Delete</button>
                )}
              </div>
            )}
            {!confirmingDelete && (
              <button
                type="button"
                onClick={handleSave}
                disabled={loading}
                className="min-w-[168px] rounded-xl bg-[#4A2C23] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(74,44,35,0.16)] transition hover:-translate-y-0.5 hover:bg-[#5B382D] disabled:translate-y-0 disabled:opacity-50"
              >
                {loading ? 'Saving...' : isEditing ? 'Save changes' : 'Save expense'}
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  )
}
