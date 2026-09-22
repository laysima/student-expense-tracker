import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { requireEnv } from '@/lib/supabase/require-env'

/**
 * Service-role client: bypasses Row Level Security entirely.
 *
 * Only for tables users must never touch directly (plaid_items holds bank
 * access tokens). Because RLS is off for this client, every query written with
 * it has to filter by the signed-in user's id itself — nothing else will.
 * `server-only` makes importing this from a client component a build error.
 */
export function createAdminClient() {
  return createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL', process.env.NEXT_PUBLIC_SUPABASE_URL),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY', process.env.SUPABASE_SERVICE_ROLE_KEY),
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
