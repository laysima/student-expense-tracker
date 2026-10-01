import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/server'

const MAX_ITEMS = 200

interface RequestedItem {
  id: string
  action: 'import' | 'dismiss'
  category: string
}

interface ClaimedRow {
  id: string
  name: string
  merchant_name: string | null
  amount_cad: number
  direction: 'out' | 'in'
  date: string
}

function parseItems(raw: unknown): RequestedItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0 || raw.length > MAX_ITEMS) return null
  const items: RequestedItem[] = []
  for (const entry of raw) {
    const item = entry as { id?: unknown; action?: unknown; category?: unknown }
    const id = typeof item.id === 'string' ? item.id : ''
    const action = item.action === 'import' || item.action === 'dismiss' ? item.action : null
    if (!id || !action) return null
    // Custom category names are allowed elsewhere in the app, so this is a
    // length check rather than a whitelist.
    const category = typeof item.category === 'string' ? item.category.trim().slice(0, 24) : ''
    if (action === 'import' && !category) return null
    items.push({ id, action, category })
  }
  return items
}

/** Hand rows back to the inbox so a failed write never loses a transaction. */
async function releaseClaims(supabase: SupabaseClient, ids: string[]) {
  if (ids.length > 0) {
    await supabase.from('bank_transactions').update({ status: 'pending' }).in('id', ids)
  }
}

// Resolve one or many staged bank transactions: turn them into real
// expense/income rows, or dismiss them. Runs on the user's own session, so RLS
// scopes every query to their data.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as { items?: unknown } | null
  const items = parseItems(body?.items)
  if (!items) {
    return NextResponse.json(
      { error: `Expected { items: [{ id, action, category }] } with 1-${MAX_ITEMS} entries.` },
      { status: 400 },
    )
  }

  const dismissIds = items.filter(item => item.action === 'dismiss').map(item => item.id)
  const importItems = items.filter(item => item.action === 'import')

  let dismissed = 0
  if (dismissIds.length > 0) {
    // One conditional update claims every row that is still pending. Rows a
    // second tab already handled simply aren't returned.
    const { data, error } = await supabase
      .from('bank_transactions')
      .update({ status: 'dismissed' })
      .in('id', dismissIds)
      .eq('status', 'pending')
      .select('id')
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    dismissed = data?.length ?? 0
  }

  let imported = 0
  if (importItems.length > 0) {
    const categoryById = new Map(importItems.map(item => [item.id, item.category]))

    const { data: claimed, error: claimError } = await supabase
      .from('bank_transactions')
      .update({ status: 'imported' })
      .in('id', importItems.map(item => item.id))
      .eq('status', 'pending')
      .select('id, name, merchant_name, amount_cad, direction, date')
    if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })

    const rows = (claimed ?? []) as ClaimedRow[]
    const expenses = rows.filter(row => row.direction === 'out')
    const incomes = rows.filter(row => row.direction === 'in')

    if (expenses.length > 0) {
      const { error } = await supabase.from('expenses').insert(
        expenses.map(row => ({
          user_id: user.id,
          category: categoryById.get(row.id) ?? 'Other',
          amount_cad: row.amount_cad,
          note: row.merchant_name ?? row.name,
          date: row.date,
          is_recurring: false,
        })),
      )
      if (error) {
        await releaseClaims(supabase, expenses.map(row => row.id))
        return NextResponse.json({ error: error.message }, { status: 500 })
      }
      imported += expenses.length
    }

    if (incomes.length > 0) {
      const { error } = await supabase.from('income').insert(
        incomes.map(row => ({
          user_id: user.id,
          source: categoryById.get(row.id) ?? 'Other',
          amount_cad: row.amount_cad,
          date: row.date,
          is_recurring: false,
        })),
      )
      if (error) {
        await releaseClaims(supabase, incomes.map(row => row.id))
        return NextResponse.json({ error: error.message, imported }, { status: 500 })
      }
      imported += incomes.length
    }
  }

  // Anything not counted was already handled elsewhere (another tab, a retry).
  const alreadyHandled = items.length - imported - dismissed
  return NextResponse.json({ imported, dismissed, alreadyHandled })
}
