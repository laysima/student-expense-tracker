'use client'

import { useState } from 'react'
import { BellRing, Check, Pencil, ShieldCheck, Target } from 'lucide-react'
import { spendingSummary, type SpendingLimitSettings } from '@/lib/spending-limits'
import DeviceNotifications from './DeviceNotifications'
import styles from './dashboard.module.css'

interface Props {
  settings: SpendingLimitSettings | null
  expenses: Array<{ date: string; amount_cad: number }>
  income: Array<{ date: string; amount_cad: number }>
  onSaved: () => void
}

const money = (amount: number) => new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD' }).format(amount)

function LimitForm({ settings, summary, onCancel, onSave }: {
  settings: SpendingLimitSettings | null
  summary: ReturnType<typeof spendingSummary>
  onCancel: () => void
  onSave: (settings: SpendingLimitSettings) => void
}) {
  const [mode, setMode] = useState(settings?.mode ?? 'income_percent')
  const [amount, setAmount] = useState(settings?.amount_cad?.toString() ?? (summary.income > 0 ? (Math.round(summary.income * 80) / 100).toString() : ''))
  const [incomePercent, setIncomePercent] = useState(String(settings?.income_percent ?? 80))
  const [warningPercent, setWarningPercent] = useState(String(settings?.warning_percent ?? 80))
  const [enabled, setEnabled] = useState(settings?.enabled ?? true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const inputClass = 'mt-2 w-full rounded-xl border border-[#DFE3D8] bg-white px-3.5 py-3 text-sm text-[#242522] outline-none focus:border-[#829A83] focus:ring-2 focus:ring-[#829A83]/20'

  async function save(event: React.FormEvent) {
    event.preventDefault()
    if (busy) return
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/spending-limit', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, amount_cad: mode === 'fixed' ? Number(amount) : null,
          income_percent: Number(incomePercent), warning_percent: Number(warningPercent), enabled,
          timezone: settings?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone }),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error ?? 'Could not save your spending limit.')
      onSave(data.settings)
    } catch (error) { setError(error instanceof Error ? error.message : 'Could not reach the server. Please try again.') }
    finally { setBusy(false) }
  }

  return (
    <form onSubmit={save} className="mt-5 border-t border-[#EAEBE6] pt-5" aria-label="Spending limit settings">
      <fieldset disabled={busy} className="space-y-5 disabled:opacity-60">
        <div className="grid gap-3 sm:grid-cols-2">
          {(['income_percent', 'fixed'] as const).map(value => <label key={value} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${mode === value ? 'border-[#829A83] bg-[#F2F6ED]' : 'border-[#E5E8DF]'}`}>
            <input type="radio" name="limit-mode" value={value} checked={mode === value} onChange={() => setMode(value)} className="mt-0.5 accent-[#58755F]" />
            <span><span className="block text-xs font-semibold text-[#41443E]">{value === 'income_percent' ? 'Based on my income' : 'A fixed monthly amount'}</span><span className="mt-1 block text-[11px] leading-5 text-[#74776F]">{value === 'income_percent' ? 'Adjusts as income is recorded this month.' : 'Stays the same as income changes.'}</span></span>
          </label>)}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {mode === 'fixed' ? <label className="text-xs font-semibold text-[#5F625B]">Monthly spending limit (CAD)<input autoFocus type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" required value={amount} onChange={event => setAmount(event.target.value)} placeholder="e.g. 1200.00" className={inputClass} /></label>
            : <label className="text-xs font-semibold text-[#5F625B]">Use this percentage of my income<input type="number" inputMode="numeric" min="1" max="100" step="1" required value={incomePercent} onChange={event => setIncomePercent(event.target.value)} className={inputClass} /><span className="mt-1.5 block text-[11px] font-normal leading-5 text-[#85887F]">{summary.income > 0 ? `${incomePercent || 0}% of ${money(summary.income)} recorded = ${money(summary.income * Number(incomePercent || 0) / 100)}` : 'Your limit activates once you record income this month.'}</span></label>}
          <label className="text-xs font-semibold text-[#5F625B]">Warn me at this percentage of my limit<input type="number" inputMode="numeric" min="50" max="99" step="1" required value={warningPercent} onChange={event => setWarningPercent(event.target.value)} className={inputClass} /><span className="mt-1.5 block text-[11px] font-normal leading-5 text-[#85887F]">An early warning, then another alert at 100%.</span></label>
        </div>
        <label className="flex items-center gap-2.5 text-xs text-[#5F625B]"><input type="checkbox" checked={enabled} onChange={event => setEnabled(event.target.checked)} className="size-4 accent-[#58755F]" />Spending alerts enabled</label>
        <p className="text-[11px] leading-5 text-[#85887F]">Repeats each calendar month in {settings?.timezone ?? 'your local time zone'}. Only recorded income and expenses up to today count. Each alert is sent once per month; pausing keeps your settings.</p>
        {error && <p role="alert" className="rounded-xl bg-[#FFF0EA] px-4 py-3 text-xs text-[#B9573A]">{error}</p>}
        <div className="flex justify-end gap-3"><button type="button" onClick={onCancel} className="rounded-lg px-4 py-2.5 text-xs font-semibold text-[#74776F] hover:bg-[#F1F3EC]">Cancel</button><button type="submit" className="rounded-lg bg-[#28352A] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#344637]">{busy ? 'Saving…' : 'Save spending limit'}</button></div>
      </fieldset>
    </form>
  )
}

export default function SpendingLimitCard({ settings, expenses, income, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [saved, setSaved] = useState<SpendingLimitSettings | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const current = saved ?? settings
  const summary = spendingSummary(current, expenses, income)
  const urgent = summary.status === 'reached'
  const warning = summary.status === 'warning'
  const label = summary.status === 'inactive' ? current ? 'Alerts paused' : 'Choose your limit'
    : summary.status === 'waiting' ? 'Waiting for income'
    : urgent ? summary.remaining < 0 ? 'Limit exceeded' : 'Limit reached'
    : warning ? 'Approaching your limit' : 'Within your limit'
  const monthLabel = new Date(`${summary.month}-15T12:00:00Z`).toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <section id="spending-limit" tabIndex={-1} aria-labelledby="spending-limit-title" className={`${styles.panel} scroll-mt-6 p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className={`grid size-10 shrink-0 place-items-center rounded-xl ${urgent || warning ? 'bg-[#FFF0EA] text-[#C96042]' : 'bg-[#EDF2E8] text-[#58755F]'}`}><ShieldCheck size={20} aria-hidden="true" /></span>
          <div><h2 id="spending-limit-title" className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Monthly spending limit</h2><p className="mt-1 text-xs text-[#85887F]">{monthLabel} · A heads-up before you spend too much</p></div>
        </div>
        <button type="button" onClick={() => { setEditing(!editing); setConfirmation('') }} aria-expanded={editing} className="inline-flex items-center gap-1.5 rounded-lg bg-[#F1F3EC] px-3 py-2 text-xs font-semibold text-[#58755F] hover:bg-[#E5EBDD]">{current ? <Pencil size={13} aria-hidden="true" /> : <Target size={13} aria-hidden="true" />}{editing ? 'Close settings' : current ? 'Edit limit' : 'Set a limit'}</button>
      </div>

      {current ? <div className="mt-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><span className="text-2xl font-semibold tracking-tight text-[#242522]">{money(summary.spent)}</span><span className="ml-2 text-xs text-[#85887F]">spent{summary.limit > 0 ? ` of ${money(summary.limit)}` : ' this month'}</span></div>
          <span className={`rounded-full px-3 py-1.5 text-[11px] font-semibold ${urgent || warning ? 'bg-[#FFF0EA] text-[#B9573A]' : 'bg-[#F1F3EC] text-[#58755F]'}`}>{label}</span>
        </div>
        <div className="relative mt-4 h-2.5 rounded-full bg-[#ECEDE8]" role="progressbar" aria-label="Monthly spending limit used" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.min(100, Math.max(0, summary.percentage))} aria-valuetext={summary.limit > 0 ? `${money(summary.spent)} spent of ${money(summary.limit)}; ${summary.percentage}% used` : 'Waiting for recorded income'}>
          <div className={`h-full rounded-full ${urgent ? 'bg-[#C96042]' : warning ? 'bg-[#D79B56]' : 'bg-[#829A83]'}`} style={{ width: `${Math.min(100, Math.max(0, summary.percentage))}%` }} />
          <span aria-hidden="true" className="absolute -top-1 h-4.5 w-px bg-[#5F625B]/50" style={{ left: `${current.warning_percent}%` }} />
        </div>
        <div className="mt-3 flex flex-wrap justify-between gap-x-4 gap-y-2 text-[11px] leading-5 text-[#74776F]">
          <span>{summary.status === 'waiting' ? 'Record income or choose a fixed limit to start tracking.' : summary.remaining < 0 ? `${money(-summary.remaining)} over your limit` : `${money(summary.remaining)} left before your limit`}</span>
          <span className="inline-flex items-center gap-1.5"><BellRing size={12} aria-hidden="true" />{current.enabled ? `Alerts at ${current.warning_percent}% and 100%` : 'Alerts paused'}</span>
        </div>
        <p className="mt-2 text-[11px] leading-5 text-[#85887F]">{current.mode === 'income_percent' ? `Your limit is ${current.income_percent}% of income recorded this month. It adjusts when income changes.` : 'Your fixed limit repeats monthly.'} This always tracks the current month, including when you browse past activity.</p>
      </div> : !editing && <div className="mt-5 rounded-xl bg-[#F7F8F3] px-4 py-4"><p className="text-sm font-medium text-[#41443E]">Give yourself room to spend, and a signal to slow down.</p><p className="mt-2 max-w-2xl text-xs leading-6 text-[#74776F]">Set an amount or use a percentage of your monthly income. We’ll notify you as you approach the limit and again when you reach it.</p></div>}

      {confirmation && <p role="status" className="mt-4 flex items-center gap-2 text-xs text-[#58755F]"><Check size={14} aria-hidden="true" />{confirmation}</p>}
      {editing && <LimitForm settings={current} summary={summary} onCancel={() => setEditing(false)} onSave={value => { setSaved(value); setEditing(false); setConfirmation(value.enabled ? 'Spending limit saved. Your alert thresholds are active.' : 'Spending limit saved. Alerts are paused.'); onSaved() }} />}
      {current && <div className="mt-5"><DeviceNotifications /></div>}
    </section>
  )
}
