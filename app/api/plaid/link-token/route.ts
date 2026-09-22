import { NextResponse } from 'next/server'
import { CountryCode, Products } from 'plaid'
import { createClient } from '@/lib/supabase/server'
import { plaidClient, plaidConfigured, plaidErrorMessage } from '@/lib/plaid'

// Step 1 of linking: a short-lived token that lets the browser open Plaid Link.
// It carries no bank access on its own.
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: 'Bank linking is not configured on this server.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  try {
    const { data } = await plaidClient().linkTokenCreate({
      // Supabase's user id, not an email: Plaid asks for an opaque identifier.
      user: { client_user_id: user.id },
      client_name: 'Xtrack',
      products: [Products.Transactions],
      country_codes: [CountryCode.Ca],
      language: 'en',
      // Only needed for OAuth banks, and it must be registered in the Plaid
      // dashboard first — sending an unregistered one makes Link fail.
      ...(process.env.PLAID_REDIRECT_URI ? { redirect_uri: process.env.PLAID_REDIRECT_URI } : {}),
    })
    return NextResponse.json({ link_token: data.link_token })
  } catch (error) {
    console.error('[plaid] link token', error)
    return NextResponse.json({ error: plaidErrorMessage(error) }, { status: 502 })
  }
}
