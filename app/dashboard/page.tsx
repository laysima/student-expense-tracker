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
  ] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).single(),
    supabase.from('expenses').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(50),
    supabase.from('income').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(20),
    supabase.from('budgets').select('*').eq('user_id', user.id),
    supabase.from('notifications').select('*').eq('user_id', user.id).eq('is_read', false).limit(5),
  ])

  return (
    <DashboardClient
      profile={profile}
      expenses={expenses ?? []}
      income={income ?? []}
      budgets={budgets ?? []}
      notifications={notifications ?? []}
    />
  )
}