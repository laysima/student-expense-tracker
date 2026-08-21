'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface SavingsGoal {
  id: string
  title: string
  target_amount_cad: number
  current_amount_cad: number
  target_date: string | null
}

interface Props {
  userId: string
  goal?: SavingsGoal | null
  avgMonthlySavings: number
  onClose: () => void
  onSaved: () => void
}

const money = (value: number) =>
  new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(value)

const DAYS_PER_MONTH = 30.44

function monthsBetween(from: Date, to: Date) {
  return (to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * DAYS_PER_MONTH)
}

export default function AddSavingsGoalModal({ userId, goal, avgMonthlySavings, onClose, onSaved }: Props) {
  const isAddingFunds = Boolean(goal)

  const [title, setTitle] = useState(goal?.title ?? '')
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.target_amount_cad) : '')
  const [targetDate, setTargetDate] = useState(goal?.target_date ?? '')
  const [fundsAmount, setFundsAmount] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const inputClass = 'w-full rounded-xl border border-transparent bg-[#F1F2ED] px-4 py-3.5 text-[14px] font-medium text-[#242522] placeholder-[#A4A79F] outline-none transition focus:border-[#829A83] focus:bg-white focus:ring-4 focus:ring-[#829A83]/10'
  const labelClass = 'mb-2 block text-[12px] font-semibold text-[#5F625B]'

  const amountNumber = Number(targetAmount)
  const hasValidAmount = Boolean(targetAmount) && !isNaN(amountNumber) && amountNumber > 0

  // How much they'd need to save monthly to hit the target date, versus what
  // they've actually been averaging over the last 3 months.
  const monthsUntilTarget = targetDate ? Math.max(monthsBetween(new Date(), new Date(targetDate)), 1 / DAYS_PER_MONTH) : null
  const requiredMonthly = hasValidAmount && monthsUntilTarget ? amountNumber / monthsUntilTarget : null

  let feasibility: 'comfortable' | 'ambitious' | 'unrealistic' | 'unknown' | null = null
  if (requiredMonthly !== null) {
    if (avgMonthlySavings <= 0) feasibility = 'unknown'
    else if (requiredMonthly <= avgMonthlySavings * 0.9) feasibility = 'comfortable'
    else if (requiredMonthly <= avgMonthlySavings * 1.15) feasibility = 'ambitious'
    else feasibility = 'unrealistic'
  }

  // No date chosen yet — show how long it would take at their current pace instead.
  const monthsToReachAtCurrentPace = !targetDate && hasValidAmount && avgMonthlySavings > 0
    ? amountNumber / avgMonthlySavings
    : null

  function suggestedDateFromPace() {
    const months = hasValidAmount && avgMonthlySavings > 0 ? amountNumber / avgMonthlySavings : 0
    const suggested = new Date()
    suggested.setDate(suggested.getDate() + Math.ceil(months * DAYS_PER_MONTH))
    return suggested.toISOString().split('T')[0]
  }

  const FEASIBILITY_STYLES: Record<string, string> = {
    comfortable: 'bg-[#EAF2E9] text-[#3F6548]',
    ambitious: 'bg-[#FFF3E2] text-[#96631E]',
    unrealistic: 'bg-[#FFF0EA] text-[#B9573A]',
    unknown: 'bg-[#F1F2ED] text-[#5F625B]',
  }

  async function handleCreateGoal() {
    if (!title.trim()) {
      setError('Please name your goal.')
      return
    }
    if (!hasValidAmount) {
      setError('Please enter a valid target amount.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: saveError } = await supabase.from('savings_goals').insert({
      user_id: userId,
      title: title.trim(),
      target_amount_cad: amountNumber,
      target_date: targetDate || null,
    })

    if (saveError) {
      setError(saveError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  async function handleAddFunds() {
    if (!goal) return
    if (!fundsAmount || isNaN(Number(fundsAmount)) || Number(fundsAmount) <= 0) {
      setError('Please enter a valid amount.')
      return
    }
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error: saveError } = await supabase
      .from('savings_goals')
      .update({ current_amount_cad: goal.current_amount_cad + Number(fundsAmount) })
      .eq('id', goal.id)
      .eq('user_id', userId)

    if (saveError) {
      setError(saveError.message)
      setLoading(false)
      return
    }

    onSaved()
    onClose()
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-[#171814]/50 backdrop-blur-[6px]" onClick={onClose} />

      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="savings-goal-title"
          className="w-full max-w-[480px] overflow-hidden rounded-[28px] bg-[#FCFCF9] shadow-[0_30px_90px_rgba(16,17,14,0.28)]"
        >
          <div className="flex items-start justify-between px-6 pb-3 pt-7 sm:px-8 sm:pt-8">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-[#658069]">
                {isAddingFunds ? 'Log savings' : 'New goal'}
              </p>
              <h2 id="savings-goal-title" className="text-[24px] font-semibold tracking-[-0.035em] text-[#242522]">
                {isAddingFunds ? `Add to ${goal!.title}` : 'Set a savings goal'}
              </h2>
              <p className="mt-1 text-[12px] text-[#85887F]">
                {isAddingFunds ? 'Record money you have set aside toward this goal.' : 'Give a purpose to what you save each month.'}
              </p>
            </div>
            <button type="button" onClick={onClose} className="py-1 text-[12px] font-semibold text-[#85887F] transition hover:text-[#242522]">
              Close
            </button>
          </div>

          <div className="space-y-5 px-6 py-5 sm:px-8">
            {error && <div className="rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{error}</div>}

            {isAddingFunds ? (
              <div>
                <label className={labelClass}>Amount to add (CAD)</label>
                <div className="relative">
                  <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-[#7E8179]">$</span>
                  <input
                    type="number"
                    inputMode="decimal"
                    autoFocus
                    value={fundsAmount}
                    onChange={event => setFundsAmount(event.target.value)}
                    placeholder="0.00"
                    className={`${inputClass} pl-9 text-[18px]`}
                  />
                </div>
                <p className="mt-2.5 text-[11px] text-[#85887F]">
                  Currently at {money(goal!.current_amount_cad)} of {money(goal!.target_amount_cad)}
                </p>
              </div>
            ) : (
              <>
                <div>
                  <label className={labelClass}>What are you saving for?</label>
                  <input
                    type="text"
                    value={title}
                    onChange={event => setTitle(event.target.value)}
                    placeholder="Flight home for the holidays"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className={labelClass}>Target amount (CAD)</label>
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[18px] font-semibold text-[#7E8179]">$</span>
                    <input
                      type="number"
                      inputMode="decimal"
                      value={targetAmount}
                      onChange={event => setTargetAmount(event.target.value)}
                      placeholder="0.00"
                      className={`${inputClass} pl-9 text-[18px]`}
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClass}>Target date (optional)</label>
                  <input
                    type="date"
                    value={targetDate}
                    onChange={event => setTargetDate(event.target.value)}
                    className={inputClass}
                  />
                </div>

                {feasibility && requiredMonthly !== null && (
                  <div className={`rounded-2xl p-4 text-[12px] leading-5 ${FEASIBILITY_STYLES[feasibility]}`}>
                    {feasibility === 'comfortable' && (
                      <p>
                        You&apos;d need to save about <strong>{money(requiredMonthly)}/month</strong> — comfortably within
                        your typical {money(avgMonthlySavings)}/month. This looks achievable.
                      </p>
                    )}
                    {feasibility === 'ambitious' && (
                      <p>
                        You&apos;d need to save about <strong>{money(requiredMonthly)}/month</strong> — a bit above your
                        typical {money(avgMonthlySavings)}/month. Doable if you tighten spending a little.
                      </p>
                    )}
                    {feasibility === 'unrealistic' && (
                      <>
                        <p>
                          You&apos;d need to save about <strong>{money(requiredMonthly)}/month</strong> — well above your
                          typical {money(avgMonthlySavings)}/month pace. This date isn&apos;t realistic at your current rate.
                        </p>
                        <button
                          type="button"
                          onClick={() => setTargetDate(suggestedDateFromPace())}
                          className="mt-2 font-semibold underline underline-offset-2"
                        >
                          Use a realistic date instead
                        </button>
                      </>
                    )}
                    {feasibility === 'unknown' && (
                      <p>
                        Your spending has been outpacing your income recently, so we can&apos;t project a reliable pace yet.
                        You can still set this goal — we&apos;ll track your progress as you go.
                      </p>
                    )}
                  </div>
                )}

                {!targetDate && monthsToReachAtCurrentPace !== null && (
                  <div className="rounded-2xl bg-[#F1F2ED] p-4 text-[12px] leading-5 text-[#5F625B]">
                    <p>
                      At your typical pace of {money(avgMonthlySavings)}/month, you&apos;d reach this goal in about{' '}
                      <strong>{Math.max(1, Math.ceil(monthsToReachAtCurrentPace))} month{Math.ceil(monthsToReachAtCurrentPace) === 1 ? '' : 's'}</strong>.
                    </p>
                    <button
                      type="button"
                      onClick={() => setTargetDate(suggestedDateFromPace())}
                      className="mt-2 font-semibold text-[#658069] underline underline-offset-2"
                    >
                      Use this as my target date
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-4 px-6 pb-7 pt-3 sm:px-8 sm:pb-8">
            <button type="button" onClick={onClose} className="px-2 py-3 text-[13px] font-semibold text-[#85887F] transition hover:text-[#242522]">Cancel</button>
            <button
              type="button"
              onClick={isAddingFunds ? handleAddFunds : handleCreateGoal}
              disabled={loading}
              className="min-w-[168px] rounded-xl bg-[#28352A] px-5 py-3.5 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637] disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Saving...' : isAddingFunds ? 'Add funds' : 'Create goal'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
