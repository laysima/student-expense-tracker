import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'
import { describeAnthropicError } from '@/lib/anthropic-error'

const CYCLE_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  yearly: 1 / 12,
}

function isoWeek(date: Date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return `${d.getUTCFullYear()}-W${weekNo}`
}

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI insights need an ANTHROPIC_API_KEY configured in .env.local.' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: expenses }, { data: income }, { data: budgets }] = await Promise.all([
    supabase
      .from('expenses')
      .select('category, amount_cad, date, is_recurring')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo),
    supabase.from('income').select('amount_cad, is_recurring, recur_cycle').eq('user_id', user.id),
    supabase
      .from('budgets')
      .select('category, amount_cad, month, year')
      .eq('user_id', user.id)
      .eq('month', new Date().getMonth() + 1)
      .eq('year', new Date().getFullYear()),
  ])

  if (!expenses?.length && !income?.length) {
    return NextResponse.json(
      { error: 'Add a few expenses and an income source first — there is not enough data yet for a useful insight.' },
      { status: 422 },
    )
  }

  const spendByCategory: Record<string, number> = {}
  for (const expense of expenses ?? []) {
    spendByCategory[expense.category] = (spendByCategory[expense.category] ?? 0) + expense.amount_cad
  }

  const monthlyIncome = (income ?? [])
    .filter(item => item.is_recurring)
    .reduce((total, item) => total + item.amount_cad * (CYCLE_MULTIPLIER[item.recur_cycle ?? 'monthly'] ?? 1), 0)

  const summary = {
    last30DaysSpendByCategory: spendByCategory,
    totalSpentLast30Days: Object.values(spendByCategory).reduce((a, b) => a + b, 0),
    monthlyRecurringIncomeCad: Math.round(monthlyIncome * 100) / 100,
    currentBudgets: (budgets ?? []).map(b => ({ category: b.category, limitCad: b.amount_cad })),
  }

  const anthropic = new Anthropic({ apiKey })

  let title = 'Your weekly insight'
  let body = ''

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system:
        'You are a calm, encouraging financial coach for international students. ' +
        'Given a JSON summary of the last 30 days of spending, respond with ONLY a JSON object ' +
        '{"title": string, "body": string}. Title is under 8 words. Body is 1-2 short sentences, ' +
        'specific and actionable (reference real numbers/categories from the data), friendly but direct. ' +
        'No markdown, no preamble, just the JSON object.',
      messages: [{ role: 'user', content: JSON.stringify(summary) }],
    })

    const textBlock = message.content.find(block => block.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
    const parsed = JSON.parse(raw)
    title = typeof parsed.title === 'string' ? parsed.title : title
    body = typeof parsed.body === 'string' ? parsed.body : raw
  } catch (error) {
    const { message, status } = describeAnthropicError(
      error,
      'Could not generate an insight right now. Try again shortly.',
    )
    return NextResponse.json({ error: message }, { status })
  }

  if (!body) {
    return NextResponse.json({ error: 'Could not generate an insight right now. Try again shortly.' }, { status: 502 })
  }

  const dedupeKey = `ai_insight:${isoWeek(new Date())}`
  const { data: notification, error: upsertError } = await supabase
    .from('notifications')
    .upsert(
      { user_id: user.id, title, body, type: 'ai_insight', is_read: false, dedupe_key: dedupeKey },
      { onConflict: 'user_id,dedupe_key' },
    )
    .select()
    .single()

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 })
  }

  return NextResponse.json({ notification })
}
