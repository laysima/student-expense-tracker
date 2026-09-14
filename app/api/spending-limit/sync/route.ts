import { after, NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { deliverSpendingPush } from '@/lib/spending-push'

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Invalid request.' }, { status: 403 })
  }
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const { error } = await supabase.rpc('check_my_spending_limit')
  if (error) return NextResponse.json({ error: 'Spending alerts are temporarily unavailable.' }, { status: 503 })
  const { data: notifications, error: readError } = await supabase.from('notifications').select('id,is_read')
    .eq('user_id', user.id).order('created_at', { ascending: false }).limit(20)
  if (readError) return NextResponse.json({ error: 'Could not refresh alerts.' }, { status: 503 })
  after(async () => { await deliverSpendingPush(user.id).catch(() => console.error('Spending push delivery deferred to scheduled retry')) })
  return NextResponse.json({ signature: JSON.stringify(notifications) })
}
