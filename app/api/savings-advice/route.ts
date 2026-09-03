import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'Savings tips need an ANTHROPIC_API_KEY configured in .env.local.' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

  const [{ data: expenses }, { data: budgets }] = await Promise.all([
    supabase
      .from('expenses')
      .select('category, amount_cad, note, is_recurring, recur_cycle, split_count')
      .eq('user_id', user.id)
      .gte('date', thirtyDaysAgo),
    supabase
      .from('budgets')
      .select('category, amount_cad')
      .eq('user_id', user.id)
      .eq('month', now.getMonth() + 1)
      .eq('year', now.getFullYear()),
  ])

  if (!expenses?.length) {
    return NextResponse.json(
      { error: 'Add a few expenses first — there is not enough data yet for useful savings tips.' },
      { status: 422 },
    )
  }

  const spendByCategory: Record<string, number> = {}
  for (const expense of expenses) {
    spendByCategory[expense.category] = (spendByCategory[expense.category] ?? 0) + expense.amount_cad
  }

  const recurringExpenses = expenses
    .filter(expense => expense.is_recurring)
    .map(expense => ({ category: expense.category, amountCad: expense.amount_cad, cycle: expense.recur_cycle, note: expense.note }))

  const currentBudgets = (budgets ?? []).map(budget => ({
    category: budget.category,
    limitCad: budget.amount_cad,
    spentCad: Math.round((spendByCategory[budget.category] ?? 0) * 100) / 100,
  }))

  const summary = {
    last30DaysSpendByCategory: spendByCategory,
    totalSpentLast30Days: Object.values(spendByCategory).reduce((a, b) => a + b, 0),
    recurringExpenses,
    currentBudgets,
  }

  const anthropic = new Anthropic({ apiKey })

  let tips: { category: string | null; title: string; body: string }[] | null = null

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 500,
      system:
        'You are a calm, encouraging financial coach for international students. ' +
        'Given a JSON summary of their last 30 days of spending by category, recurring expenses, and current ' +
        'budgets, give 2-4 concrete, actionable tips on how they could save more. Respond with ONLY a JSON ' +
        'object: {"tips": [{"category": string or null, "title": string, "body": string}]}. Each title is under ' +
        '6 words. Each body is 1-2 short sentences, references real numbers/categories from the data, suggests a ' +
        'specific concrete action (not vague advice like "spend less"), friendly but direct, realistic for a ' +
        'student budget. Prioritize categories that are over budget or have notably high spend, and flag ' +
        'recurring/subscription costs worth reconsidering if there are several. Set category to null only for a ' +
        'tip that is not about one specific category. No markdown, no preamble, just the JSON object.',
      messages: [{ role: 'user', content: JSON.stringify(summary) }],
    })

    const textBlock = message.content.find(block => block.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
    const parsed = JSON.parse(raw)

    if (Array.isArray(parsed.tips)) {
      tips = parsed.tips
        .filter((tip: unknown): tip is { category: unknown; title: unknown; body: unknown } =>
          typeof tip === 'object' && tip !== null,
        )
        .map((tip: { category: unknown; title: unknown; body: unknown }) => ({
          category: typeof tip.category === 'string' ? tip.category : null,
          title: typeof tip.title === 'string' ? tip.title : '',
          body: typeof tip.body === 'string' ? tip.body : '',
        }))
        .filter((tip: { category: string | null; title: string; body: string }) => tip.title && tip.body)
    }
  } catch {
    return NextResponse.json({ error: 'Could not generate savings tips right now. Try again shortly.' }, { status: 502 })
  }

  if (!tips || tips.length === 0) {
    return NextResponse.json({ error: 'Could not generate savings tips right now. Try again shortly.' }, { status: 502 })
  }

  return NextResponse.json({ tips })
}
