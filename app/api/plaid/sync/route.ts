import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { plaidConfigured, plaidErrorMessage, syncUserTransactions } from '@/lib/plaid'

// "Sync now": pull anything new from every bank this user has linked.
export async function POST() {
  if (!plaidConfigured()) {
    return NextResponse.json({ error: 'Bank linking is not configured on this server.' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })

  try {
    const result = await syncUserTransactions(createAdminClient(), user.id)
    return NextResponse.json(result)
  } catch (error) {
    console.error('[plaid] sync', error)
    return NextResponse.json({ error: plaidErrorMessage(error) }, { status: 502 })
  }
}
