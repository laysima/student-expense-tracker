'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

const SOURCES = ['Part-time job', 'Scholarship', 'Family support', 'Freelance', 'Bursary', 'Other']
const CYCLES = ['weekly', 'biweekly', 'monthly', 'yearly']

interface IncomeRecord {
  id: string
  source: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  date: string
  is_recurring: boolean
  recur_cycle: string | null
}

interface Props {
  userId: string
  homeCurrency: string
  income?: IncomeRecord | null
  onClose: () => void
  onSaved: () => void
}

export default function AddIncomeModal({ userId, homeCurrency, income, onClose, onSaved }: Props) {
  const isEditing = Boolean(income)
  const canConvert = homeCurrency !== 'CAD'
  const [showConverter, setShowConverter] = useState(Boolean(income?.original_amount))
  const [form, setForm] = useState({
    source: income?.source ?? 'Part-time job',
    amountCad: income ? String(income.amount_cad) : '',
    originalAmount: income?.original_amount ? String(income.original_amount) : '',
    date: income?.date ?? new Date().toISOString().split('T')[0],
    isRecurring: income?.is_recurring ?? false,
    recurCycle: income?.recur_cycle ?? 'biweekly',
  })
  const [convertedAmount, setConvertedAmount] = useState<number | null>(null)
  const [converting, setConverting] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

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

  async function handleSave() {
    if (!form.amountCad || isNaN(Number(form.amountCad))) {
      setError('Please enter a valid amount.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const payload = {
      source: form.source,
      amount_cad: Number(form.amountCad),
      original_amount: form.originalAmount ? Number(form.originalAmount) : null,
      original_currency: form.originalAmount ? homeCurrency : null,
      date: form.date,
      is_recurring: form.isRecurring,
      recur_cycle: form.isRecurring ? form.recurCycle : null,
    }
    const { error: saveError } = isEditing
      ? await supabase.from('income').update(payload).eq('id', income!.id).eq('user_id', userId)
      : await supabase.from('income').insert({ user_id: userId, ...payload })

    if (saveError) {
      setError(saveError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  const inputClass = 'w-full rounded-xl border border-transparent bg-[#F1F2ED] px-4 py-3.5 text-[14px] font-medium text-[#242522] placeholder-[#A4A79F] outline-none transition focus:border-[#829A83] focus:bg-white focus:ring-4 focus:ring-[#829A83]/10'
  const labelClass = 'mb-2 block text-[12px] font-semibold text-[#5F625B]'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="add-income-title"
          className="w-full max-w-[520px] overflow-hidden rounded-[28px] bg-[#FCFCF9] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="flex items-start justify-between px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#658069]">Money in</p>
              <h2 id="add-income-title" className="text-[24px] font-semibold tracking-[-0.035em] text-[#242522]">{isEditing ? 'Edit income' : 'Add income'}</h2>
              <p className="mt-1 text-[12px] text-[#85887F]">{isEditing ? 'Update the details of this income.' : 'Record money you received.'}</p>
            </div>
            <button type="button" onClick={onClose} className="py-1 text-[12px] font-semibold text-[#85887F] transition hover:text-[#242522]">
              Close
            </button>
          </div>

          <div className="max-h-[68vh] space-y-6 overflow-y-auto px-6 py-5 sm:px-8">
            {error && <div className="rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{error}</div>}

            <div>
              <label className={labelClass}>Income source</label>
              <div className="flex flex-wrap gap-x-1 gap-y-2" role="group" aria-label="Income source">
                {SOURCES.map(source => (
                  <button
                    key={source}
                    type="button"
                    aria-pressed={form.source === source}
                    onClick={() => update('source', source)}
                    className={`rounded-full px-3.5 py-2 text-[12px] font-medium transition ${
                      form.source === source
                        ? 'bg-[#28352A] text-white shadow-sm'
                        : 'text-[#74776F] hover:bg-[#ECEEE8] hover:text-[#343630]'
                    }`}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className={labelClass}>Amount in CAD</label>
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
                <button type="button" onClick={() => setShowConverter(value => !value)} className="mt-2.5 text-[11px] font-semibold text-[#658069] hover:underline">
                  {showConverter ? 'Hide currency converter' : `Convert from ${homeCurrency}`}
                </button>
              )}
            </div>

            {canConvert && showConverter && (
              <div className="rounded-2xl bg-[#EDF2EB] p-4">
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
                    className="whitespace-nowrap rounded-xl bg-[#829A83] px-4 py-3 text-[12px] font-semibold text-white transition hover:bg-[#6F8971] disabled:opacity-40"
                  >
                    {converting ? 'Converting…' : 'Convert'}
                  </button>
                </div>
                {convertedAmount && <p className="mt-2 text-[11px] font-medium text-[#58755F]">≈ CA${convertedAmount.toFixed(2)} at today&apos;s rate — applied above</p>}
              </div>
            )}

            <div>
              <label className={labelClass}>Date received</label>
              <input type="date" value={form.date} onChange={event => update('date', event.target.value)} className={inputClass} />
            </div>

            <div className="flex items-center justify-between border-t border-[#E7E8E2] pt-5">
              <div>
                <p className="text-[13px] font-semibold text-[#343630]">Repeat this income</p>
                <p className="mt-0.5 text-[11px] text-[#91948C]">Useful for wages, support, or scholarships</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={form.isRecurring}
                aria-label="Repeat this income"
                onClick={() => update('isRecurring', !form.isRecurring)}
                className={`relative h-7 w-12 shrink-0 rounded-full transition-colors ${form.isRecurring ? 'bg-[#829A83]' : 'bg-[#D7D9D2]'}`}
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
                        form.recurCycle === cycle ? 'bg-white text-[#405B45] shadow-sm' : 'text-[#85887F] hover:text-[#343630]'
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
            <button type="button" onClick={onClose} className="px-2 py-3 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              className="min-w-[168px] rounded-xl bg-[#28352A] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637] disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isEditing ? 'Save changes' : 'Save income'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
