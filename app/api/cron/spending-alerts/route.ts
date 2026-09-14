import { timingSafeEqual } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createPushAdmin, deliverSpendingPush, pushConfigured } from '@/lib/spending-push'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET
  const expected = Buffer.from(`Bearer ${secret ?? ''}`)
  const actual = Buffer.from(request.headers.get('authorization') ?? '')
  if (!secret || actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) return NextResponse.json({ error: 'Worker is not configured' }, { status: 503 })
  const admin = createPushAdmin()
  const { error } = await admin.rpc('check_all_spending_limits')
  if (error) return NextResponse.json({ error: 'Could not evaluate spending limits' }, { status: 503 })
  if (!pushConfigured()) return NextResponse.json({ error: 'Push delivery is not configured' }, { status: 503 })
  try { return NextResponse.json(await deliverSpendingPush()) }
  catch { return NextResponse.json({ error: 'Could not deliver alerts' }, { status: 503 }) }
}
