import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createPushAdmin, pushConfigured } from '@/lib/spending-push'
import { pushSubscriptionSchema } from '@/lib/spending-limit-validation'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const { data, error } = await supabase.from('push_subscriptions').select('endpoint').eq('user_id', user.id)
  return NextResponse.json({
    publicKey: pushConfigured() && !error ? process.env.VAPID_PUBLIC_KEY : null,
    endpoints: (data ?? []).map(item => item.endpoint),
  })
}

export async function POST(request: NextRequest) {
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid request.' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  if (!pushConfigured()) return NextResponse.json({ error: 'Device notifications are not available yet. Your in-app alerts still work.' }, { status: 503 })
  const parsed = pushSubscriptionSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'This browser’s notification subscription is not supported.' }, { status: 400 })
  const admin = createPushAdmin()
  // Atomically assign this device to the account that explicitly enabled it.
  const { error } = await admin.rpc('register_spending_push', {
    p_user_id: user.id, p_endpoint: parsed.data.endpoint, p_p256dh: parsed.data.keys.p256dh, p_auth: parsed.data.keys.auth,
  })
  if (error) return NextResponse.json({ error: 'Could not enable notifications. Please try again.' }, { status: 503 })
  return NextResponse.json({ success: true })
}

export async function DELETE(request: NextRequest) {
  if (request.headers.get('origin') && request.headers.get('origin') !== request.nextUrl.origin) return NextResponse.json({ error: 'Invalid request.' }, { status: 403 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Please sign in again.' }, { status: 401 })
  const body = await request.json().catch(() => null)
  if (typeof body?.endpoint !== 'string') return NextResponse.json({ error: 'Invalid subscription.' }, { status: 400 })
  const { error } = await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', body.endpoint)
  if (error) return NextResponse.json({ error: 'Could not turn off device notifications.' }, { status: 503 })
  return NextResponse.json({ success: true })
}
