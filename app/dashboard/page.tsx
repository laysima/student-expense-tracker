import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { renewRecurringExpenses } from '@/lib/recurring-expenses'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  // Verified locally against the project's signing keys — no network round
  // trip before the data queries below can start.
  const { data: auth } = await supabase.auth.getClaims()
  const claims = auth?.claims
  if (!claims?.sub) redirect('/login')
  const user = { id: claims.sub, email: typeof claims.email === 'string' ? claims.email : undefined }

  // Fill in any subscription or bill charges that came due since the last
  // visit, before reading expenses so they show up on this load.
  await renewRecurringExpenses(supabase, user.id)

  const [
    { data: profile },
    { data: expenses },
    { data: income },
    { data: budgets },
    { data: notifications },
    { data: savingsGoals },
    { data: spendingLimit },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
    supabase.from('spending_limits').select('*').eq('user_id', user.id).maybeSingle(),
  ])

  return (
    <DashboardClient
      userId={user.id}
      email={user.email ?? ''}
      profile={profile}
      expenses={expenses ?? []}
      income={income ?? []}
      budgets={budgets ?? []}
      notifications={notifications ?? []}
      savingsGoals={savingsGoals ?? []}
      spendingLimit={spendingLimit ?? null}
    />
  )
}
