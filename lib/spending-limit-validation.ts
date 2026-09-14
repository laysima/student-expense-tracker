import { z } from 'zod'

export const spendingLimitSchema = z.object({
  mode: z.enum(['fixed', 'income_percent']),
  amount_cad: z.number().positive().max(9999999999.99).multipleOf(0.01).nullable(),
  income_percent: z.number().int().min(1).max(100),
  warning_percent: z.number().int().min(50).max(99),
  enabled: z.boolean(),
  timezone: z.string().max(100).refine(value => {
    try { new Intl.DateTimeFormat('en', { timeZone: value }); return true } catch { return false }
  }),
}).refine(value => value.mode !== 'fixed' || value.amount_cad !== null)

// Never send a server-side HTTP request to an arbitrary client-supplied URL.
// Support the browser vendors' public push services; reject credentials/ports.
export function isPushEndpoint(value: string) {
  try {
    const url = new URL(value)
    return url.protocol === 'https:' && !url.username && !url.password && !url.port && !url.hash && (
      url.hostname === 'fcm.googleapis.com' ||
      url.hostname === 'updates.push.services.mozilla.com' ||
      url.hostname.endsWith('.push.apple.com') ||
      url.hostname.endsWith('.notify.windows.com')
    )
  } catch { return false }
}

export const pushSubscriptionSchema = z.object({
  endpoint: z.string().max(2048).refine(isPushEndpoint),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{87}=?$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{22}(==)?$/),
  }),
})
