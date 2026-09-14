import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { spendingLimitSchema } from '@/lib/spending-limit-validation'
import { deliverSpendingPush } from '@/lib/spending-push'

export async function PUT(request: NextRequest) {
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const parsed = spendingLimitSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Enter a valid limit and warning percentage.' }, { status: 400 })
  const { data, error } = await supabase.from('spending_limits')
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: 'user_id' }).select().single()
  if (error) return NextResponse.json({ error: 'Could not save your spending limit. Please try again shortly.' }, { status: 503 })
  after(async () => { await deliverSpendingPush(user.id).catch(() => console.error('Spending push delivery deferred to scheduled retry')) })
  return NextResponse.json({ settings: data })
}
