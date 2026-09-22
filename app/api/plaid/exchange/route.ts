import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { plaidClient, plaidConfigured, plaidErrorMessage, syncUserTransactions } from '@/lib/plaid'

// Step 2 of linking: swap the one-time public token from Plaid Link for a
// long-lived access token. That token never leaves the server.
export async function POST(request: Request) {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: 'Bank linking is not configured on this server.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  const body = (await request.json().catch(() => null)) as
    | { public_token?: unknown; institution_name?: unknown }
    | null
  const publicToken = typeof body?.public_token === 'string' ? body.public_token : ''
  if (!publicToken) return NextResponse.json({ error: 'Missing public_token.' }, { status: 400 })
  const institutionName =
    typeof body?.institution_name === 'string' ? body.institution_name.slice(0, 120) : null

  let itemId: string
  let accessToken: string
  try {
    const { data } = await plaidClient().itemPublicTokenExchange({ public_token: publicToken })
    itemId = data.item_id
    accessToken = data.access_token
  } catch (error) {
    console.error('[plaid] exchange', error)
    return NextResponse.json({ error: plaidErrorMessage(error) }, { status: 502 })
  }

  const admin = createAdminClient()
  const { error: insertError } = await admin.from('plaid_items').insert({
    user_id: user.id,
    item_id: itemId,
    access_token: accessToken,
    institution_name: institutionName,
  })
  if (insertError) {
    console.error('[plaid] store item', insertError)
    return NextResponse.json({ error: 'Linked the bank but could not save the connection.' }, { status: 500 })
  }

  // First pull. Plaid is often still fetching history right after linking, so
  // an empty result here is normal — "Sync now" picks the rest up shortly.
  try {
    const result = await syncUserTransactions(admin, user.id)
    return NextResponse.json({ linked: true, ...result })
  } catch (error) {
    console.error('[plaid] initial sync', error)
    return NextResponse.json({ linked: true, staged: 0, syncError: plaidErrorMessage(error) })
  }
}
