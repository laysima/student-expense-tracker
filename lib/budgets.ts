// Budgets carry forward. A limit set in one month stays in force every month
// after it until the user sets a different amount for that category; spending
// against it still resets each month. Each change is stored as a row for the
// month it was made, so earlier months keep the limits they actually had.

import type { SupabaseClient } from '@supabase/supabase-js'

interface BudgetRow {
  category: string
  month: number
  year: number
  amount_cad: number
}

const monthIndex = (year: number, month: number) => year * 12 + (month - 1)

/**
 * The budget in force for each category in the given month: the most recent
 * row set in or before it. `inherited` is true when that row comes from an
 * earlier month. A row of 0 or less ends the budget from that month on.
 */
export function budgetsInForce<T extends BudgetRow>(budgets: T[], month: number, year: number) {
  const target = monthIndex(year, month)
  const latest = new Map<string, T>()
  for (const budget of budgets) {
    const index = monthIndex(budget.year, budget.month)
    if (index > target) continue
    const current = latest.get(budget.category)
    if (!current || index > monthIndex(current.year, current.month)) latest.set(budget.category, budget)
  }
  return [...latest.values()]
    .filter(budget => budget.amount_cad > 0)
    .map(budget => ({ ...budget, inherited: budget.month !== month || budget.year !== year }))
}

/**
 * Records `amount_cad` as the category's limit from the given month on; pass 0
 * to end the budget from that month. Updates the month's row when there is one
 * (including an ended one) and inserts otherwise, so removing and re-adding a
 * budget never leaves two rows competing for the same month.
 */
export async function setBudgetForMonth(
  supabase: SupabaseClient,
  budget: { user_id: string; category: string; month: number; year: number; amount_cad: number },
) {
  const { data, error } = await supabase
    .from('budgets')
    .update({ amount_cad: budget.amount_cad })
    .eq('user_id', budget.user_id)
    .eq('category', budget.category)
    .eq('month', budget.month)
    .eq('year', budget.year)
    .select('category')
  if (error) return error
  if (data.length > 0) return null

  const { error: insertError } = await supabase.from('budgets').insert(budget)
  return insertError
}
