import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import { isPushEndpoint } from './spending-limit-validation'

export function pushConfigured() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT)
}

export function createPushAdmin() {
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  })
}

interface Delivery {
  id: string; subscription_id: string; endpoint: string; p256dh: string; auth: string
  level: 'warning' | 'reached'; attempts: number
}

export async function deliverSpendingPush(userId?: string) {
  if (!pushConfigured()) return { configured: false, sent: 0, failed: 0 }
  const admin = createPushAdmin()
  const { data, error } = await admin.rpc('claim_spending_push', { p_user_id: userId ?? null })
  if (error) throw new Error('Could not claim spending alerts')
  const deliveries = (data ?? []) as Delivery[]
  let sent = 0
  let failed = 0
  // Bounded work fits a serverless request. The database lease prevents two
  // dashboard tabs or scheduled workers from claiming the same delivery.
  for (let offset = 0; offset < deliveries.length; offset += 5) {
    await Promise.all(deliveries.slice(offset, offset + 5).map(async delivery => {
      try {
        if (!isPushEndpoint(delivery.endpoint)) throw new Error('Unsupported push endpoint')
        await webpush.sendNotification({
          endpoint: delivery.endpoint, keys: { p256dh: delivery.p256dh, auth: delivery.auth },
        }, JSON.stringify({
          title: delivery.level === 'reached' ? 'You’ve reached your spending limit' : 'You’re approaching your spending limit',
          body: 'Visit Xtrack to review your spending and remaining budget.',
          tag: `spending-${delivery.id}`,
        }), {
          TTL: 3600, timeout: 4000, urgency: 'normal',
          vapidDetails: { subject: process.env.VAPID_SUBJECT!, publicKey: process.env.VAPID_PUBLIC_KEY!, privateKey: process.env.VAPID_PRIVATE_KEY! },
        })
        const { error: saveError } = await admin.from('spending_push_deliveries')
          .update({ sent_at: new Date().toISOString() }).eq('id', delivery.id)
        if (saveError) throw new Error('Could not acknowledge delivery')
        sent += 1
      } catch (error) {
        failed += 1
        const status = typeof error === 'object' && error !== null && 'statusCode' in error ? error.statusCode : null
        if (status === 404 || status === 410) {
          // Expired/revoked subscriptions should never be retried.
          await admin.from('push_subscriptions').delete().eq('id', delivery.subscription_id)
        } else {
          await admin.from('spending_push_deliveries').update({
            available_at: new Date(Date.now() + 60_000 * 5 * 2 ** (delivery.attempts - 1)).toISOString(),
          }).eq('id', delivery.id)
        }
      }
    }))
  }
  return { configured: true, sent, failed }
}
