import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface ImportBody {
  id?: unknown
  action?: unknown
  category?: unknown
}

// Resolve one staged bank transaction: turn it into a real expense/income row,
// or dismiss it. Runs on the user's own session, so RLS scopes every query.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as ImportBody | null
  const id = typeof body?.id === 'string' ? body.id : ''
  const action = body?.action === 'import' || body?.action === 'dismiss' ? body.action : null
  if (!id || !action) return NextResponse.json({ error: 'Expected { id, action }.' }, { status: 400 })

  // Claim the row by flipping pending → final status in one conditional update.
  // A double-click or a second tab gets zero rows back and stops here, so the
  // same purchase can never be imported twice.
  const { data: claimed, error: claimError } = await supabase
    .from('bank_transactions')
    .update({ status: action === 'import' ? 'imported' : 'dismissed' })
    .eq('id', id)
    .eq('status', 'pending')
    .select('id, name, merchant_name, amount_cad, direction, date')
    .maybeSingle()

  if (claimError) return NextResponse.json({ error: claimError.message }, { status: 500 })
  if (!claimed) return NextResponse.json({ error: 'Already handled.' }, { status: 409 })
  if (action === 'dismiss') return NextResponse.json({ ok: true })

  // Custom names are allowed (the "Other" field elsewhere in the app), so this
  // is a length check rather than a whitelist.
  const category = typeof body?.category === 'string' ? body.category.trim().slice(0, 24) : ''
  if (!category) {
    await supabase.from('bank_transactions').update({ status: 'pending' }).eq('id', id)
    return NextResponse.json({ error: 'Pick a category first.' }, { status: 400 })
  }

  const label = claimed.merchant_name ?? claimed.name
  const { error: insertError } =
    claimed.direction === 'out'
      ? await supabase.from('expenses').insert({
          user_id: user.id,
          category,
          amount_cad: claimed.amount_cad,
          note: label,
          date: claimed.date,
          is_recurring: false,
        })
      : await supabase.from('income').insert({
          user_id: user.id,
          source: category,
          amount_cad: claimed.amount_cad,
          date: claimed.date,
          is_recurring: false,
        })

  if (insertError) {
    // Put it back in the inbox so nothing is silently lost.
    await supabase.from('bank_transactions').update({ status: 'pending' }).eq('id', id)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
