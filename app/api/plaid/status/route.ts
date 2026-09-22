import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { plaidConfigured } from '@/lib/plaid'

// What the bank panel needs to render: linked banks (never their tokens) and
// transactions waiting for review.
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  // Not configured is a normal state (e.g. a deployment without Plaid keys);
  // the panel just stays hidden rather than showing an error.
  if (!plaidConfigured()) return NextResponse.json({ configured: false, items: [], pending: [] })

  const [{ data: items, error: itemsError }, { data: pending, error: pendingError }] = await Promise.all([
    // plaid_items has no RLS policies, so it's read with the service role —
    // explicitly scoped to this user and explicitly excluding access_token.
    createAdminClient()
      .from('plaid_items')
      .select('item_id, institution_name, last_synced_at')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true }),
    // bank_transactions has a read-own policy, so the user's own session is enough.
    supabase
      .from('bank_transactions')
      .select('id, name, merchant_name, amount_cad, direction, date, suggested_category, is_transfer')
      .eq('status', 'pending')
      .order('date', { ascending: false })
      .limit(200),
  ])

  if (itemsError || pendingError) {
    console.error('[plaid] status', itemsError ?? pendingError)
    return NextResponse.json(
      { error: 'Could not load bank connections. Has supabase/plaid.sql been run?' },
      { status: 500 },
    )
  }

  return NextResponse.json({ configured: true, items: items ?? [], pending: pending ?? [] })
}
