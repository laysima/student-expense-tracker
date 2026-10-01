import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { dueOccurrences, localIsoDate } from './recurrence'

// Xtrack is built for students in Canada; used until a timezone is saved.
const FALLBACK_TIMEZONE = 'America/Toronto'

interface Template {
  id: string
  category: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  note: string | null
  date: string
  recur_cycle: string | null
  split_total_cad: number | null
  split_count: number | null
  renewed_through: string | null
}

/**
 * Logs every charge a recurring expense should have made by today.
 *
 * The recurring row is the template. Each renewal is an ordinary one-off row
 * pointing back at it through `recurring_source_id`, and the template's
 * `renewed_through` remembers how far it has been filled in — so deleting one
 * renewal (a free month, a refund) doesn't bring it back on the next load.
 * A unique index on (recurring_source_id, date) stops two tabs loading at the
 * same moment from logging the same charge twice.
 *
 * Runs on the user's own session, so RLS scopes it to their rows. Never throws:
 * a failure here must not take the dashboard down with it.
 */
export async function renewRecurringExpenses(supabase: SupabaseClient, userId: string) {
  try {
    const [{ data: templates, error }, { data: limit }] = await Promise.all([
      supabase
        .from('expenses')
        .select('id, category, amount_cad, original_amount, original_currency, note, date, recur_cycle, split_total_cad, split_count, renewed_through')
        .eq('user_id', userId)
        .eq('is_recurring', true),
      supabase.from('spending_limits').select('timezone').eq('user_id', userId).maybeSingle(),
    ])
    if (error) {
      // Most likely supabase/migrations/202610010001_recurring_expenses.sql
      // hasn't been run yet.
      console.error('Recurring expenses not renewed:', error.message)
      return 0
    }

    const savedZone = limit?.timezone && limit.timezone !== 'UTC' ? limit.timezone : FALLBACK_TIMEZONE
    const today = localIsoDate(new Date(), savedZone)
    let logged = 0

    for (const template of (templates ?? []) as Template[]) {
      const anchor = template.date.slice(0, 10)
      const after = template.renewed_through && template.renewed_through > anchor ? template.renewed_through : anchor
      const due = dueOccurrences(anchor, template.recur_cycle, after, today)
      if (due.length === 0) continue

      const { error: insertError } = await supabase.from('expenses').upsert(
        due.map(date => ({
          user_id: userId,
          category: template.category,
          amount_cad: template.amount_cad,
          original_amount: template.original_amount,
          original_currency: template.original_currency,
          note: template.note,
          date,
          is_recurring: false,
          recur_cycle: null,
          split_total_cad: template.split_total_cad,
          split_count: template.split_count,
          recurring_source_id: template.id,
        })),
        { onConflict: 'recurring_source_id,date', ignoreDuplicates: true },
      )
      if (insertError) {
        console.error('Could not renew recurring expense', template.id, insertError.message)
        continue
      }

      await supabase.from('expenses').update({ renewed_through: due[due.length - 1] }).eq('id', template.id)
      logged += due.length
    }
    return logged
  } catch (error) {
    console.error('Recurring expenses not renewed:', error)
    return 0
  }
}
