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

export async function POST() {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      { error: 'AI goal suggestions need an ANTHROPIC_API_KEY configured in .env.local.' },
      { status: 503 },
    )
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Not signed in.' }, { status: 401 })
  }

  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate()).toISOString().split('T')[0]

  const [{ data: expenses }, { data: income }, { data: goals }] = await Promise.all([
    supabase
      .from('expenses')
      .select('category, amount_cad, date')
      .eq('user_id', user.id)
      .gte('date', threeMonthsAgo),
    supabase.from('income').select('amount_cad, date, is_recurring, recur_cycle').eq('user_id', user.id),
    supabase.from('savings_goals').select('title').eq('user_id', user.id),
  ])

  if (!expenses?.length && !income?.length) {
    return NextResponse.json(
      { error: 'Add a few expenses and an income source first — there is not enough data yet for a useful suggestion.' },
      { status: 422 },
    )
  }

  const spendByCategory: Record<string, number> = {}
  for (const expense of expenses ?? []) {
    spendByCategory[expense.category] = (spendByCategory[expense.category] ?? 0) + expense.amount_cad
  }
  // Mirrors computeMonthlyAverages on the dashboard: both sides of the ledger
  // averaged over the same window, so the AI's idea of what is affordable
  // matches the Savings potential figure the user is looking at.
  const recentIncome = (income ?? []).filter(item => item.date >= threeMonthsAgo)

  const monthsSeen = new Set(
    [...(expenses ?? []), ...recentIncome].map(entry => {
      const date = new Date(`${entry.date}T00:00:00`)
      return `${date.getFullYear()}-${date.getMonth()}`
    }),
  )
  const months = Math.max(1, monthsSeen.size)

  const avgMonthlySpend = (expenses ?? []).reduce((total, expense) => total + expense.amount_cad, 0) / months

  const monthlyRecurringIncome = (income ?? [])
    .filter(item => item.is_recurring)
    .reduce((total, item) => total + item.amount_cad * (CYCLE_MULTIPLIER[item.recur_cycle ?? 'monthly'] ?? 1), 0)

  const avgMonthlyIncome =
    recentIncome.length > 0
      ? recentIncome.reduce((total, item) => total + item.amount_cad, 0) / months
      : monthlyRecurringIncome

  const avgMonthlySavings = avgMonthlyIncome - avgMonthlySpend

  const round2 = (value: number) => Math.round(value * 100) / 100

  const summary = {
    avgMonthlySavingsCad: round2(avgMonthlySavings),
    avgMonthlyIncomeCad: round2(avgMonthlyIncome),
    avgMonthlySpendCad: round2(avgMonthlySpend),
    monthsOfHistory: months,
    last3MonthsSpendByCategory: spendByCategory,
    existingGoalTitles: (goals ?? []).map(goal => goal.title),
    todayIso: now.toISOString().split('T')[0],
  }

  const anthropic = new Anthropic({ apiKey })

  let suggestion: { title: string; targetAmountCad: number; targetDate: string | null; rationale: string } | null = null

  try {
    const message = await anthropic.messages.create({
      model: 'claude-opus-5',
      max_tokens: 16000,
      output_config: { effort: 'low' },
      system:
        'You are a calm, encouraging financial coach for international students. ' +
        'Given a JSON summary of their recent spending, income, and average monthly savings, suggest ONE ' +
        'concrete, realistic savings goal they do not already have (check existingGoalTitles). Respond with ' +
        'ONLY a JSON object: {"title": string, "targetAmountCad": number, "targetDate": string or null, "rationale": string}. ' +
        'Title is short and specific to real international-student life (e.g. "Flight home for the holidays", ' +
        '"Winter coat", "Laptop repair fund", "Emergency cushion") — under 6 words, no quotes inside it. ' +
        'targetAmountCad should be achievable within roughly 2-6 months at their avgMonthlySavingsCad pace — if ' +
        'that figure is zero or negative, suggest a small starter goal (e.g. 50-150 CAD) instead of a large one. ' +
        'targetDate is an ISO YYYY-MM-DD date after todayIso consistent with that pace, or null if avgMonthlySavingsCad ' +
        'is zero or negative. rationale is 1-2 short sentences, references real numbers from the summary, friendly ' +
        'but direct, explains why this goal and amount make sense right now. No markdown, no preamble, just the JSON object.',
      messages: [{ role: 'user', content: JSON.stringify(summary) }],
    })

    const textBlock = message.content.find(block => block.type === 'text')
    const raw = textBlock && 'text' in textBlock ? textBlock.text.trim() : ''
    const parsed = JSON.parse(raw)

    if (typeof parsed.title === 'string' && typeof parsed.targetAmountCad === 'number') {
      suggestion = {
        title: parsed.title,
        targetAmountCad: parsed.targetAmountCad,
        targetDate: typeof parsed.targetDate === 'string' ? parsed.targetDate : null,
        rationale: typeof parsed.rationale === 'string' ? parsed.rationale : '',
      }
    }
  } catch (error) {
    const { message, status } = describeAnthropicError(
      error,
      'Could not suggest a goal right now. Try again shortly.',
    )
    return NextResponse.json({ error: message }, { status })
  }

  if (!suggestion) {
    return NextResponse.json({ error: 'Could not suggest a goal right now. Try again shortly.' }, { status: 502 })
  }

  return NextResponse.json({ suggestion })
}
