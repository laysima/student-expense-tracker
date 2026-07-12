'use client'

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'

// ── Types ──────────────────────────────────────────────────────────
interface Profile {
  full_name: string
  home_currency: string
  university: string
}
interface Expense {
  id: string
  category: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  note: string | null
  date: string
  is_recurring: boolean
}
interface Income {
  id: string
  source: string
  amount_cad: number
  date: string
  is_recurring: boolean
}
interface Budget {
  category: string
  amount_cad: number
  month: number
  year: number
}
interface Notification {
  id: string
  title: string
  body: string | null
  type: string
}

interface Props {
  profile: Profile | null
  expenses: Expense[]
  income: Income[]
  budgets: Budget[]
  notifications: Notification[]
}

const CATEGORIES = ['Rent', 'Groceries', 'Tuition', 'Transport', 'Utilities', 'Entertainment', 'Other']

// ── Helpers ────────────────────────────────────────────────────────
function formatCAD(n: number) {
  return new Intl.NumberFormat('en-CA', { style: 'currency', currency: 'CAD', maximumFractionDigits: 0 }).format(n)
}

function getMonthExpenses(expenses: Expense[]) {
  const now = new Date()
  return expenses.filter(e => {
    const d = new Date(e.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  })
}

function computeRunway(expenses: Expense[], income: Income[]) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentExpenses = expenses.filter(e => new Date(e.date) >= thirtyDaysAgo)
  const totalSpent = recentExpenses.reduce((s, e) => s + e.amount_cad, 0)
  const dailyRate = totalSpent / 30

  const monthlyIncome = income
    .filter(i => i.is_recurring)
    .reduce((s, i) => s + i.amount_cad, 0)

  const balance = monthlyIncome - totalSpent
  if (dailyRate === 0) return null
  return Math.max(0, Math.round(balance / dailyRate))
}

// ── Component ──────────────────────────────────────────────────────
export default function DashboardClient({ profile, expenses, income, budgets, notifications }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'expenses' | 'income'>('overview')

  const monthExpenses = useMemo(() => getMonthExpenses(expenses), [expenses])
  const totalSpentThisMonth = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount_cad, 0), [monthExpenses])
  const totalIncomeThisMonth = useMemo(() => {
  const now = new Date()
  return income.filter(i => {
    const d = new Date(i.date)
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
  }).reduce((s, i) => s + i.amount_cad, 0)
}, [income])
  const runway = useMemo(() => computeRunway(expenses, income), [expenses, income])

  // Spending by category for chart
  const categoryData = useMemo(() => {
    return CATEGORIES.map(cat => ({
      name: cat,
      amount: monthExpenses
        .filter(e => e.category === cat)
        .reduce((s, e) => s + e.amount_cad, 0)
    })).filter(c => c.amount > 0)
  }, [monthExpenses])

  // Budget progress
  const now = new Date()
  const currentBudgets = budgets.filter(b => b.month === now.getMonth() + 1 && b.year === now.getFullYear())

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-[10px]">
      <div className="min-h-[calc(100vh-20px)] border-[10px] border-[#E2835F] rounded-[24px] bg-[#1A1A1A] overflow-hidden flex flex-col">

        {/* ── NAVBAR ── */}
        <nav className="flex items-center justify-between px-8 py-5 border-b border-[#2a2a2a]">
          <span className="text-[21px] font-bold text-[#F5F5F3] tracking-tight">
            X<span className="text-[#E2835F]">track</span>
          </span>

          <div className="flex items-center gap-1 bg-[#222] rounded-[16px] p-1">
            {(['overview', 'expenses', 'income'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 rounded-[12px] text-[13px] font-medium transition-colors capitalize ${
                  activeTab === tab
                    ? 'bg-[#E2835F] text-white'
                    : 'text-[#9B9B94] hover:text-[#F5F5F3]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            {notifications.length > 0 && (
              <div className="relative">
                <button className="text-[#9B9B94] hover:text-[#F5F5F3] transition-colors">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                  </svg>
                </button>
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-[#E2835F] rounded-full text-[10px] text-white flex items-center justify-center font-bold">
                  {notifications.length}
                </span>
              </div>
            )}
            <button
              onClick={handleSignOut}
              className="text-[13px] font-medium text-[#9B9B94] hover:text-[#E2835F] transition-colors"
            >
              Sign out
            </button>
          </div>
        </nav>

        {/* ── CONTENT ── */}
        <div className="flex-1 p-8 overflow-y-auto">

          {/* Greeting */}
          <div className="mb-8">
            <p className="text-[12px] font-medium text-[#E2835F] tracking-[0.1em] uppercase mb-1">
              {new Date().toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            <h1 className="text-[32px] font-bold text-[#F5F5F3] tracking-tight leading-none">
              Hey, {firstName} 👋
            </h1>
          </div>

          {/* ── OVERVIEW TAB ── */}
          {activeTab === 'overview' && (
            <div className="space-y-6">

              {/* Top stat cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">

                {/* Runway — coral */}
                <div className="bg-[#E2835F] rounded-[16px] p-5">
                  <p className="text-[12px] font-medium text-white/70 mb-3">Budget runway</p>
                  <p className="text-[32px] font-bold text-white leading-none mb-1">
                    {runway !== null ? `${runway}` : '—'}
                    <span className="text-[16px] font-medium ml-1">days</span>
                  </p>
                  <p className="text-[12px] text-white/60">at current spending rate</p>
                </div>

                {/* Spent this month — dark */}
                <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
                  <p className="text-[12px] font-medium text-[#9B9B94] mb-3">Spent this month</p>
                  <p className="text-[32px] font-bold text-[#F5F5F3] leading-none mb-1">
                    {formatCAD(totalSpentThisMonth)}
                  </p>
                  <p className="text-[12px] text-[#9B9B94]">{monthExpenses.length} transactions</p>
                </div>

                {/* Income — sage */}
                <div className="bg-[#A9BA9E] rounded-[16px] p-5">
                  <p className="text-[12px] font-medium text-[#1A1A1A]/60 mb-3">Income this month</p>
                  <p className="text-[32px] font-bold text-[#1A1A1A] leading-none mb-1">
                    {formatCAD(totalIncomeThisMonth)}
                  </p>
                  <p className="text-[12px] text-[#1A1A1A]/50">
                    {income.filter(i => i.is_recurring).length} recurring sources
                  </p>
                </div>
              </div>

              {/* Spending chart + budget progress */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Spending by category */}
                <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
                  <p className="text-[13px] font-medium text-[#F5F5F3] mb-1">Spending by category</p>
                  <p className="text-[12px] text-[#9B9B94] mb-5">This month</p>
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={180}>
                      <BarChart data={categoryData} barSize={28}>
                        <XAxis dataKey="name" tick={{ fill: '#9B9B94', fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis hide />
                        <Tooltip
                          cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                          contentStyle={{ background: '#1A1A1A', border: '1px solid #2e2e2e', borderRadius: 12, fontSize: 12 }}
                          formatter={(v) => [formatCAD(Number(v ?? 0)), 'Spent']}
                        />
                        <Bar dataKey="amount" radius={[6, 6, 0, 0]}>
                          {categoryData.map((_, i) => (
                            <Cell key={i} fill={i % 2 === 0 ? '#E2835F' : '#A9BA9E'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-[180px] flex items-center justify-center">
                      <p className="text-[13px] text-[#9B9B94]">No expenses this month yet</p>
                    </div>
                  )}
                </div>

                {/* Budget progress */}
                <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
                  <p className="text-[13px] font-medium text-[#F5F5F3] mb-1">Budget progress</p>
                  <p className="text-[12px] text-[#9B9B94] mb-5">This month</p>
                  {currentBudgets.length > 0 ? (
                    <div className="space-y-4">
                      {currentBudgets.map(budget => {
                        const spent = monthExpenses
                          .filter(e => e.category === budget.category)
                          .reduce((s, e) => s + e.amount_cad, 0)
                        const pct = Math.min(100, Math.round((spent / budget.amount_cad) * 100))
                        const over = spent > budget.amount_cad
                        return (
                          <div key={budget.category}>
                            <div className="flex justify-between mb-1.5">
                              <span className="text-[12px] font-medium text-[#F5F5F3]">{budget.category}</span>
                              <span className={`text-[12px] font-medium ${over ? 'text-[#E2835F]' : 'text-[#9B9B94]'}`}>
                                {formatCAD(spent)} / {formatCAD(budget.amount_cad)}
                              </span>
                            </div>
                            <div className="h-1.5 bg-[#2e2e2e] rounded-full overflow-hidden">
                              <div
                                className="h-full rounded-full transition-all"
                                style={{
                                  width: `${pct}%`,
                                  background: over ? '#E2835F' : '#A9BA9E'
                                }}
                              />
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="h-[160px] flex flex-col items-center justify-center gap-3">
                      <p className="text-[13px] text-[#9B9B94]">No budgets set for this month</p>
                      <button className="text-[13px] font-medium text-[#E2835F] underline underline-offset-2">
                        Set a budget
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Recent transactions */}
              <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
                <p className="text-[13px] font-medium text-[#F5F5F3] mb-5">Recent transactions</p>
                {expenses.slice(0, 6).length > 0 ? (
                  <div className="space-y-1">
                    {expenses.slice(0, 6).map((e, i) => (
                      <div key={e.id} className={`flex items-center gap-4 py-3 ${i < 5 ? 'border-b border-[#2a2a2a]' : ''}`}>
                        <div className="w-9 h-9 rounded-[10px] bg-[#E2835F]/15 flex items-center justify-center text-[15px] flex-shrink-0">
                          {e.category === 'Groceries' ? '🛒' : e.category === 'Rent' ? '🏠' : e.category === 'Tuition' ? '🎓' : e.category === 'Transport' ? '🚌' : e.category === 'Entertainment' ? '🎬' : '💳'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#F5F5F3] truncate">{e.note ?? e.category}</p>
                          <p className="text-[11px] text-[#9B9B94]">
                            {new Date(e.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric' })}
                            {e.is_recurring && <span className="ml-2 text-[#A9BA9E]">Recurring</span>}
                          </p>
                        </div>
                        <span className="text-[13px] font-bold text-[#E2835F]">−{formatCAD(e.amount_cad)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[13px] text-[#9B9B94] py-4 text-center">No expenses logged yet</p>
                )}
              </div>
            </div>
          )}

          {/* ── EXPENSES TAB ── */}
          {activeTab === 'expenses' && (
            <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
              <p className="text-[13px] font-medium text-[#F5F5F3] mb-5">All expenses</p>
              {expenses.length > 0 ? (
                <div className="space-y-1">
                  {expenses.map((e, i) => (
                    <div key={e.id} className={`flex items-center gap-4 py-3 ${i < expenses.length - 1 ? 'border-b border-[#2a2a2a]' : ''}`}>
                      <div className="w-9 h-9 rounded-[10px] bg-[#E2835F]/15 flex items-center justify-center text-[15px] flex-shrink-0">
                        {e.category === 'Groceries' ? '🛒' : e.category === 'Rent' ? '🏠' : e.category === 'Tuition' ? '🎓' : e.category === 'Transport' ? '🚌' : e.category === 'Entertainment' ? '🎬' : '💳'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#F5F5F3] truncate">{e.note ?? e.category}</p>
                        <p className="text-[11px] text-[#9B9B94]">
                          {e.category} · {new Date(e.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      </div>
                      {e.original_amount && e.original_currency && (
                        <span className="text-[11px] text-[#9B9B94]">
                          {e.original_currency} {e.original_amount}
                        </span>
                      )}
                      <span className="text-[13px] font-bold text-[#E2835F]">−{formatCAD(e.amount_cad)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#9B9B94] py-8 text-center">No expenses logged yet</p>
              )}
            </div>
          )}

          {/* ── INCOME TAB ── */}
          {activeTab === 'income' && (
            <div className="bg-[#222] border border-[#2e2e2e] rounded-[16px] p-5">
              <p className="text-[13px] font-medium text-[#F5F5F3] mb-5">All income</p>
              {income.length > 0 ? (
                <div className="space-y-1">
                  {income.map((i, idx) => (
                    <div key={i.id} className={`flex items-center gap-4 py-3 ${idx < income.length - 1 ? 'border-b border-[#2a2a2a]' : ''}`}>
                      <div className="w-9 h-9 rounded-[10px] bg-[#A9BA9E]/15 flex items-center justify-center text-[15px] flex-shrink-0">
                        💼
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[13px] font-medium text-[#F5F5F3] truncate">{i.source}</p>
                        <p className="text-[11px] text-[#9B9B94]">
                          {new Date(i.date).toLocaleDateString('en-CA', { month: 'short', day: 'numeric', year: 'numeric' })}
                          {i.is_recurring && <span className="ml-2 text-[#A9BA9E]">Recurring</span>}
                        </p>
                      </div>
                      <span className="text-[13px] font-bold text-[#A9BA9E]">+{formatCAD(i.amount_cad)}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[13px] text-[#9B9B94] py-8 text-center">No income logged yet</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}