import 'server-only'
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  type RemovedTransaction,
  type Transaction,
} from 'plaid'
import type { SupabaseClient } from '@supabase/supabase-js'

// ---------------------------------------------------------------------------
// Client
// ---------------------------------------------------------------------------

export function plaidConfigured() {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET)
}

// PlaidEnvironments' keys are lowercase ('sandbox', 'production'). Its type is
// a plain index signature, so a typo like `.Sandbox` compiles and silently
// yields undefined — resolve through an explicit whitelist instead.
function plaidBasePath() {
  const env = (process.env.PLAID_ENV ?? 'sandbox').toLowerCase()
  if (env !== 'sandbox' && env !== 'production') {
    throw new Error(`PLAID_ENV must be "sandbox" or "production" (got "${env}").`)
  }
  return PlaidEnvironments[env]
}

let cached: PlaidApi | null = null

export function plaidClient() {
  if (!cached) {
    cached = new PlaidApi(
      new Configuration({
        basePath: plaidBasePath(),
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID ?? '',
            'PLAID-SECRET': process.env.PLAID_SECRET ?? '',
          },
        },
      }),
    )
  }
  return cached
}

interface PlaidErrorBody {
  error_code?: string
  error_message?: string
  display_message?: string | null
}

function plaidErrorBody(error: unknown): PlaidErrorBody | undefined {
  return (error as { response?: { data?: PlaidErrorBody } })?.response?.data
}

/** Plaid errors arrive as axios errors; the useful part is in response.data. */
export function plaidErrorMessage(error: unknown) {
  const body = plaidErrorBody(error)
  if (body?.error_code) {
    return `${body.error_code}: ${body.display_message ?? body.error_message ?? 'Plaid request failed'}`
  }
  return error instanceof Error ? error.message : 'Plaid request failed'
}

// ---------------------------------------------------------------------------
// Mapping Plaid's categories onto Xtrack's
// ---------------------------------------------------------------------------

// Only a suggestion — the user confirms or changes it before anything imports.
export function suggestExpenseCategory(primary?: string | null, detailed?: string | null) {
  if (detailed === 'FOOD_AND_DRINK_GROCERIES') return 'Groceries'
  if (detailed === 'RENT_AND_UTILITIES_RENT') return 'Rent'
  if (detailed?.startsWith('GENERAL_SERVICES_EDUCATION')) return 'Tuition'
  switch (primary) {
    case 'TRANSPORTATION':
    case 'TRAVEL':
      return 'Transport'
    case 'RENT_AND_UTILITIES':
      return 'Utilities'
    case 'FOOD_AND_DRINK': // eating out, coffee — groceries are caught above
    case 'ENTERTAINMENT':
      return 'Entertainment'
    default:
      return 'Other'
  }
}

export function suggestIncomeSource(detailed?: string | null) {
  return detailed === 'INCOME_WAGES' ? 'Part-time job' : 'Other'
}

// Money moving between the user's own accounts isn't spending or earning, and
// importing both legs would double-count. Flagged so the UI can say so.
function isTransfer(primary?: string | null) {
  return primary === 'TRANSFER_IN' || primary === 'TRANSFER_OUT' || primary === 'LOAN_PAYMENTS'
}

// ---------------------------------------------------------------------------
// Sync
// ---------------------------------------------------------------------------

interface PlaidItemRow {
  item_id: string
  access_token: string
  cursor: string | null
}

async function pullAllChanges(accessToken: string, startCursor: string | null) {
  // If the item changes mid-pagination Plaid asks us to restart from the
  // cursor we began with; give it a few attempts before surfacing the error.
  for (let attempt = 0; attempt < 3; attempt++) {
    const added: Transaction[] = []
    const modified: Transaction[] = []
    const removed: RemovedTransaction[] = []
    let cursor = startCursor ?? undefined
    try {
      let hasMore = true
      while (hasMore) {
        const { data } = await plaidClient().transactionsSync({ access_token: accessToken, cursor })
        added.push(...data.added)
        modified.push(...data.modified)
        removed.push(...data.removed)
        hasMore = data.has_more
        cursor = data.next_cursor
      }
      return { added, modified, removed, cursor: cursor ?? null }
    } catch (error) {
      if (plaidErrorBody(error)?.error_code !== 'TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION') throw error
    }
  }
  throw new Error('Plaid kept changing during sync — try again in a moment.')
}

/**
 * Pulls new/changed/removed transactions for every bank this user has linked
 * and stages them in bank_transactions for review.
 *
 * `admin` is the service-role client, so RLS does NOT protect these queries —
 * every one of them filters on userId explicitly.
 */
export async function syncUserTransactions(admin: SupabaseClient, userId: string) {
  const { data: items, error } = await admin
    .from('plaid_items')
    .select('item_id, access_token, cursor')
    .eq('user_id', userId)
  if (error) throw new Error(error.message)

  let staged = 0
  let removedCount = 0
  let skippedForeignCurrency = 0

  for (const item of (items ?? []) as PlaidItemRow[]) {
    const { added, modified, removed, cursor } = await pullAllChanges(item.access_token, item.cursor)

    const rows = [...added, ...modified]
      // Pending charges get replaced by a posted transaction with a new id;
      // staging only posted ones avoids reviewing the same purchase twice.
      .filter(transaction => !transaction.pending)
      .filter(transaction => {
        const currency = transaction.iso_currency_code ?? 'CAD'
        if (currency !== 'CAD') skippedForeignCurrency++
        return currency === 'CAD'
      })
      .map(transaction => {
        const primary = transaction.personal_finance_category?.primary ?? null
        const detailed = transaction.personal_finance_category?.detailed ?? null
        // Plaid sign convention: positive = money out, negative = money in.
        const direction = transaction.amount > 0 ? 'out' : 'in'
        return {
          user_id: userId,
          item_id: item.item_id,
          plaid_transaction_id: transaction.transaction_id,
          account_id: transaction.account_id,
          name: transaction.name,
          merchant_name: transaction.merchant_name ?? null,
          amount_cad: Math.abs(transaction.amount),
          direction,
          date: transaction.date,
          plaid_category: primary,
          suggested_category:
            direction === 'out' ? suggestExpenseCategory(primary, detailed) : suggestIncomeSource(detailed),
          is_transfer: isTransfer(primary),
        }
      })

    if (rows.length > 0) {
      // `status` is deliberately absent: a modified transaction the user has
      // already imported or dismissed keeps that decision.
      const { error: upsertError } = await admin
        .from('bank_transactions')
        .upsert(rows, { onConflict: 'plaid_transaction_id' })
      if (upsertError) throw new Error(upsertError.message)
      staged += rows.length
    }

    const removedIds = removed.map(entry => entry.transaction_id).filter(Boolean)
    if (removedIds.length > 0) {
      const { error: deleteError, count } = await admin
        .from('bank_transactions')
        .delete({ count: 'exact' })
        .eq('user_id', userId)
        .eq('status', 'pending')
        .in('plaid_transaction_id', removedIds)
      if (deleteError) throw new Error(deleteError.message)
      removedCount += count ?? 0
    }

    const { error: cursorError } = await admin
      .from('plaid_items')
      .update({ cursor, last_synced_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('item_id', item.item_id)
    if (cursorError) throw new Error(cursorError.message)
  }

  return { staged, removed: removedCount, skippedForeignCurrency }
}
