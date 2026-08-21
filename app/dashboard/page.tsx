import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import DashboardClient from './DashboardClient'

export default async function DashboardPage() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [
    { data: profile },
    { data: expenses },
    { data: income },
    { data: budgets },
    { data: notifications },
    { data: savingsGoals },
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false }),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    supabase.from('savings_goals').select('*').eq('user_id', user.id).order('created_at', { ascending: false }),
  ])

  return (
    <DashboardClient
      userId={user.id}
      profile={profile}
      expenses={expenses ?? []}
      income={income ?? []}
      budgets={budgets ?? []}
      notifications={notifications ?? []}
      savingsGoals={savingsGoals ?? []}
    />
  )
}
