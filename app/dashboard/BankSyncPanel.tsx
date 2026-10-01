'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { usePlaidLink } from 'react-plaid-link'
import { AlertTriangle, ArrowLeftRight, Landmark, Loader2, RefreshCw } from 'lucide-react'

const EXPENSE_CATEGORIES = ['Groceries', 'Rent', 'Tuition', 'Transport', 'Utilities', 'Entertainment', 'Other']
const INCOME_SOURCES = ['Part-time job', 'Scholarship', 'Family support', 'Freelance', 'Bursary', 'Other']

interface LinkedBank {
  item_id: string
  institution_name: string | null
  last_synced_at: string | null
}

interface StagedTransaction {
  id: string
  name: string
  merchant_name: string | null
  amount_cad: number
  direction: 'out' | 'in'
  date: string
  suggested_category: string | null
  is_transfer: boolean
}

interface Status {
  configured: boolean
  items: LinkedBank[]
  pending: StagedTransaction[]
}

interface Props {
  expenses: { amount_cad: number; date: string; note: string | null; category: string }[]
  income: { amount_cad: number; date: string; source: string }[]
}

function formatCAD(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Date-only strings compared as whole days, parsed identically on both sides so
// the local timezone can't shift either one.
function dayNumber(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return Date.UTC(year, month - 1, day) / 86_400_000
}

function formatDay(date: string) {
  const [year, month, day] = date.slice(0, 10).split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })
}

type StatusResult = { status?: Status; error?: string }

async function fetchStatus(): Promise<StatusResult> {
  try {
    const response = await fetch('/api/plaid/status', { cache: 'no-store' })
    const data = await response.json()
    if (!response.ok) return { error: data.error ?? 'Could not load bank connections.' }
    return { status: data }
  } catch {
    return { error: 'Could not reach the server.' }
  }
}

export default function BankSyncPanel({ expenses, income }: Props) {
  const router = useRouter()
  const [status, setStatus] = useState<Status | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<'link' | 'sync' | null>(null)
  const [workingId, setWorkingId] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [choices, setChoices] = useState<Record<string, string>>({})
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [confirmingSkipAll, setConfirmingSkipAll] = useState(false)

  const applyStatus = useCallback((result: StatusResult) => {
    if (result.status) setStatus(result.status)
    if (result.error) setError(result.error)
    setLoading(false)
  }, [])

  const refresh = useCallback(async () => applyStatus(await fetchStatus()), [applyStatus])

  // Initial load: state is only set in the promise callback, and skipped if the
  // panel unmounted before the request came back.
  useEffect(() => {
    let cancelled = false
    fetchStatus().then(result => {
      if (!cancelled) applyStatus(result)
    })
    return () => {
      cancelled = true
    }
  }, [applyStatus])

  const finishLinking = useCallback(
    async (publicToken: string, institutionName: string | null) => {
      setBusy('link')
      setMessage('')
      setError('')
      try {
        const response = await fetch('/api/plaid/exchange', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ public_token: publicToken, institution_name: institutionName }),
        })
        const data = await response.json()
        if (!response.ok) {
          setError(data.error ?? 'Could not link the bank.')
          return
        }
        setMessage(
          data.staged > 0
            ? `Connected. ${data.staged} transaction${data.staged === 1 ? '' : 's'} ready to review.`
            : 'Connected. Your bank is still sending history — press Sync now in a minute.',
        )
        await refresh()
      } finally {
        setBusy(null)
        setLinkToken(null)
      }
    },
    [refresh],
  )

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess: (publicToken, metadata) => {
      // v5 types this as string | null; a missing token means Link didn't finish.
      if (!publicToken) {
        setError('Your bank did not finish connecting. Please try again.')
        setLinkToken(null)
        setBusy(null)
        return
      }
      void finishLinking(publicToken, metadata.institution?.name ?? null)
    },
    onExit: () => {
      setLinkToken(null)
      setBusy(null)
    },
  })

  // Link tokens are fetched on demand (they expire), then Link opens as soon as
  // its script has loaded the new token.
  useEffect(() => {
    if (linkToken && ready) open()
  }, [linkToken, ready, open])

  async function startLinking() {
    setBusy('link')
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/plaid/link-token', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Could not start bank linking.')
        setBusy(null)
        return
      }
      setLinkToken(data.link_token)
    } catch {
      setError('Could not reach the server.')
      setBusy(null)
    }
  }

  async function syncNow() {
    setBusy('sync')
    setMessage('')
    setError('')
    try {
      const response = await fetch('/api/plaid/sync', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Sync failed.')
        return
      }
      setMessage(data.staged > 0 ? `Pulled ${data.staged} transaction${data.staged === 1 ? '' : 's'}.` : 'Up to date.')
      await refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setBusy(null)
    }
  }

  function categoryFor(transaction: StagedTransaction) {
    return choices[transaction.id] ?? transaction.suggested_category ?? 'Other'
  }

  // One request whether it's a single row or every row on screen.
  async function resolve(transactions: StagedTransaction[], action: 'import' | 'dismiss') {
    if (transactions.length === 0) return
    const ids = new Set(transactions.map(transaction => transaction.id))
    setWorkingId(transactions.length === 1 ? transactions[0].id : 'bulk')
    setError('')
    setMessage('')
    try {
      const response = await fetch('/api/plaid/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: transactions.map(transaction => ({
            id: transaction.id,
            action,
            category: categoryFor(transaction),
          })),
        }),
      })
      const data = await response.json()
      if (!response.ok) {
        setError(data.error ?? 'Could not update those transactions.')
        return
      }
      setStatus(current =>
        current ? { ...current, pending: current.pending.filter(item => !ids.has(item.id)) } : current,
      )
      setSelected(current => {
        const next = new Set(current)
        ids.forEach(id => next.delete(id))
        return next
      })
      if (transactions.length > 1) {
        const parts: string[] = []
        if (data.imported) parts.push(`Added ${data.imported}`)
        if (data.dismissed) parts.push(`skipped ${data.dismissed}`)
        setMessage(parts.join(' · ') || 'Nothing left to do.')
      }
      if (data.imported > 0) router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setWorkingId(null)
      setConfirmingSkipAll(false)
    }
  }

  function possibleDuplicate(transaction: StagedTransaction) {
    const target = dayNumber(transaction.date)
    const amount = Number(transaction.amount_cad)
    const pool =
      transaction.direction === 'out'
        ? expenses.map(item => ({ amount: Number(item.amount_cad), date: item.date, label: item.note ?? item.category }))
        : income.map(item => ({ amount: Number(item.amount_cad), date: item.date, label: item.source }))
    return pool.find(item => Math.abs(item.amount - amount) < 0.005 && Math.abs(dayNumber(item.date) - target) <= 3)
  }

  if (loading) return null
  // The status call itself failed (most often: supabase/plaid.sql not run yet).
  // Say so instead of silently hiding the panel.
  if (!status) {
    return error ? (
      <p className="mt-6 rounded-2xl border border-[#F0C5B5] bg-[#FFF0EA] px-5 py-4 text-[12px] font-medium text-[#B9573A]">
        Bank accounts: {error}
      </p>
    ) : null
  }
  // Not configured (e.g. no Plaid keys on this deployment) → stay out of the way.
  if (!status.configured) return null

  const hasBanks = status.items.length > 0
  const pending = status.pending
  // Nothing ticked means "act on everything", which is what people expect from
  // a button labelled "Add all".
  const targets = selected.size > 0 ? pending.filter(item => selected.has(item.id)) : pending
  const allSelected = pending.length > 0 && selected.size === pending.length
  const bulkBusy = workingId === 'bulk'

  function toggleRow(id: string) {
    setSelected(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    setConfirmingSkipAll(false)
  }

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(pending.map(item => item.id)))
    setConfirmingSkipAll(false)
  }

  return (
    <section aria-label="Bank accounts" className="mt-6 rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#EFF0EB] text-[#3F4A40]">
            <Landmark size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Bank accounts</h2>
            <p className="mt-1 text-xs text-[#85887F]">
              {hasBanks
                ? status.items.map(item => item.institution_name ?? 'Linked bank').join(' · ')
                : 'Connect your bank and card purchases show up here to review — no more typing them in.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasBanks && (
            <button
              type="button"
              onClick={syncNow}
              disabled={busy !== null}
              className="flex items-center gap-1.5 rounded-xl border border-[#DFE0DA] px-3.5 py-2.5 text-xs font-semibold text-[#3F4A40] transition hover:border-[#BFC2B9] disabled:opacity-50"
            >
              {busy === 'sync' ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={13} aria-hidden="true" />}
              Sync now
            </button>
          )}
          <button
            type="button"
            onClick={startLinking}
            disabled={busy !== null}
            className="flex items-center gap-1.5 rounded-xl bg-[#28352A] px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#344637] disabled:opacity-50"
          >
            {busy === 'link' && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}
            {hasBanks ? 'Add another bank' : 'Connect bank'}
          </button>
        </div>
      </div>

      {(message || error) && (
        <p className={`mt-4 rounded-xl px-4 py-2.5 text-[12px] font-medium ${error ? 'bg-[#FFF0EA] text-[#B9573A]' : 'bg-[#EAF2E9] text-[#3F6548]'}`}>
          {error || message}
        </p>
      )}

      {pending.length > 0 && (
        <div className="mt-5 border-t border-[#EAEBE6] pt-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <label className="flex items-center gap-2.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#74776F]">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                aria-label="Select every transaction"
                className="size-4 accent-[#28352A]"
              />
              {selected.size > 0 ? `${selected.size} selected` : `To review · ${pending.length}`}
            </label>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => resolve(targets, 'import')}
                disabled={workingId !== null}
                className="flex items-center gap-1.5 rounded-lg bg-[#28352A] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#344637] disabled:opacity-50"
              >
                {bulkBusy && <Loader2 size={12} className="animate-spin" aria-hidden="true" />}
                {selected.size > 0 ? `Add selected (${targets.length})` : `Add all (${targets.length})`}
              </button>
              {confirmingSkipAll ? (
                <>
                  <button
                    type="button"
                    onClick={() => resolve(targets, 'dismiss')}
                    disabled={workingId !== null}
                    className="rounded-lg border border-[#E2B6A6] bg-[#FFF0EA] px-3 py-2 text-[12px] font-semibold text-[#B9573A] transition hover:bg-[#FCE4DA] disabled:opacity-50"
                  >
                    Skip {targets.length} for good
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmingSkipAll(false)}
                    className="px-1.5 text-[12px] font-semibold text-[#85887F] transition hover:text-[#242522]"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingSkipAll(true)}
                  disabled={workingId !== null}
                  className="rounded-lg border border-[#DFE0DA] px-3 py-2 text-[12px] font-semibold text-[#3F4A40] transition hover:border-[#BFC2B9] disabled:opacity-50"
                >
                  {selected.size > 0 ? `Skip selected (${targets.length})` : `Skip all (${targets.length})`}
                </button>
              )}
            </div>
          </div>
          <ul className="divide-y divide-[#EEEFEA]">
            {pending.map(transaction => {
              const options = transaction.direction === 'out' ? EXPENSE_CATEGORIES : INCOME_SOURCES
              const chosen = choices[transaction.id] ?? transaction.suggested_category ?? 'Other'
              const selectOptions = options.includes(chosen) ? options : [chosen, ...options]
              const duplicate = possibleDuplicate(transaction)
              const working = workingId === transaction.id || bulkBusy
              const label = transaction.merchant_name ?? transaction.name
              return (
                <li key={transaction.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                  <input
                    type="checkbox"
                    checked={selected.has(transaction.id)}
                    onChange={() => toggleRow(transaction.id)}
                    aria-label={`Select ${label}`}
                    className="size-4 shrink-0 self-start accent-[#28352A] sm:self-center"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#343630]">{label}</p>
                    <p className="mt-0.5 text-[11px] text-[#91948C]">{formatDay(transaction.date)}</p>
                    {transaction.is_transfer && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#7C8378]">
                        <ArrowLeftRight size={11} aria-hidden="true" /> Looks like a transfer between your accounts — usually skip it
                      </p>
                    )}
                    {duplicate && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] font-medium text-[#B9573A]">
                        <AlertTriangle size={11} aria-hidden="true" /> Possible duplicate of “{duplicate.label}” on {formatDay(duplicate.date)}
                      </p>
                    )}
                  </div>

                  <span className={`shrink-0 text-sm font-semibold ${transaction.direction === 'out' ? 'text-[#C96042]' : 'text-[#4E7558]'}`}>
                    {transaction.direction === 'out' ? '−' : '+'}{formatCAD(Number(transaction.amount_cad))}
                  </span>

                  <div className="flex shrink-0 items-center gap-2">
                    <select
                      value={chosen}
                      onChange={event => setChoices(current => ({ ...current, [transaction.id]: event.target.value }))}
                      aria-label={transaction.direction === 'out' ? 'Expense category' : 'Income source'}
                      className="rounded-lg border border-[#DFE0DA] bg-white px-2.5 py-2 text-base font-medium text-[#242522] outline-none sm:text-[12px] focus:border-[#829A83]"
                    >
                      {selectOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => resolve([transaction], 'import')}
                      disabled={working}
                      className="rounded-lg bg-[#28352A] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#344637] disabled:opacity-50"
                    >
                      {working ? '…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve([transaction], 'dismiss')}
                      disabled={working}
                      className="px-1.5 text-[12px] font-semibold text-[#85887F] transition hover:text-[#242522] disabled:opacity-50"
                    >
                      Skip
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </section>
  )
}
