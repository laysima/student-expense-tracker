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

  async function resolve(transaction: StagedTransaction, action: 'import' | 'dismiss') {
    setWorkingId(transaction.id)
    setError('')
    const category = choices[transaction.id] ?? transaction.suggested_category ?? 'Other'
    try {
      const response = await fetch('/api/plaid/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: transaction.id, action, category }),
      })
      const data = await response.json()
      // 409 means another tab already handled it — drop it from the list either way.
      if (!response.ok && response.status !== 409) {
        setError(data.error ?? 'Could not update that transaction.')
        return
      }
      setStatus(current =>
        current ? { ...current, pending: current.pending.filter(item => item.id !== transaction.id) } : current,
      )
      if (action === 'import') router.refresh()
    } catch {
      setError('Could not reach the server.')
    } finally {
      setWorkingId(null)
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

      {status.pending.length > 0 && (
        <div className="mt-5 border-t border-[#EAEBE6] pt-4">
          <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-[#74776F]">
            To review · {status.pending.length}
          </p>
          <ul className="divide-y divide-[#EEEFEA]">
            {status.pending.map(transaction => {
              const options = transaction.direction === 'out' ? EXPENSE_CATEGORIES : INCOME_SOURCES
              const chosen = choices[transaction.id] ?? transaction.suggested_category ?? 'Other'
              const selectOptions = options.includes(chosen) ? options : [chosen, ...options]
              const duplicate = possibleDuplicate(transaction)
              const working = workingId === transaction.id
              return (
                <li key={transaction.id} className="flex flex-col gap-3 py-3.5 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[#343630]">{transaction.merchant_name ?? transaction.name}</p>
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
                      className="rounded-lg border border-[#DFE0DA] bg-white px-2.5 py-2 text-[12px] font-medium text-[#242522] outline-none focus:border-[#829A83]"
                    >
                      {selectOptions.map(option => (
                        <option key={option} value={option}>{option}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => resolve(transaction, 'import')}
                      disabled={working}
                      className="rounded-lg bg-[#28352A] px-3 py-2 text-[12px] font-semibold text-white transition hover:bg-[#344637] disabled:opacity-50"
                    >
                      {working ? '…' : 'Add'}
                    </button>
                    <button
                      type="button"
                      onClick={() => resolve(transaction, 'dismiss')}
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
