'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BusFront,
  CalendarClock,
  ChevronRight,
  Clapperboard,
  CreditCard,
  GraduationCap,
  Home,
  LayoutDashboard,
  LogOut,
  Pencil,
  PiggyBank,
  Plus,
  Printer,
  ReceiptText,
  ShoppingBasket,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { createClient } from '@/lib/supabase/client'
import SiteLogo from '@/components/SiteLogo'
import AddBudgetModal from './AddBudgetModal'
import AddExpenseModal from './AddExpenseModal'
import AddIncomeModal from './AddIncomeModal'
import AddSavingsGoalModal from './AddSavingsGoalModal'
import NotificationsPanel from './NotificationsPanel'
import StatementModal from './StatementModal'

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
  recur_cycle: string | null
  split_total_cad: number | null
  split_count: number | null
}

interface Income {
  id: string
  source: string
  amount_cad: number
  original_amount: number | null
  original_currency: string | null
  date: string
  is_recurring: boolean
  recur_cycle: string | null
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
  is_read: boolean
  created_at: string
}

interface SavingsGoal {
  id: string
  title: string
  target_amount_cad: number
  current_amount_cad: number
  target_date: string | null
}

interface Props {
  userId: string
  profile: Profile | null
  expenses: Expense[]
  income: Income[]
  budgets: Budget[]
  notifications: Notification[]
  savingsGoals: SavingsGoal[]
}

type Tab = 'overview' | 'expenses' | 'income'

const CATEGORIES = ['Rent', 'Groceries', 'Tuition', 'Transport', 'Utilities', 'Entertainment', 'Other']

const CATEGORY_ICONS: Record<string, LucideIcon> = {
  Rent: Home,
  Groceries: ShoppingBasket,
  Tuition: GraduationCap,
  Transport: BusFront,
  Utilities: Zap,
  Entertainment: Clapperboard,
  Other: CreditCard,
}

const NAV_ITEMS: Array<{ id: Tab; label: string; icon: LucideIcon }> = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'expenses', label: 'Expenses', icon: ReceiptText },
  { id: 'income', label: 'Income', icon: TrendingUp },
]

const CYCLE_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  yearly: 1 / 12,
}

const ICONS8_INCOME = 'https://img.icons8.com/ios-filled/50/191919/income.png'
const ICONS8_EXPENSE = 'https://img.icons8.com/ios-filled/50/191919/expense.png'

function formatCAD(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    maximumFractionDigits: 0,
  }).format(value)
}

function formatDate(date: string, includeYear = false) {
  return new Date(date).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

function getMonthExpenses(expenses: Expense[]) {
  const now = new Date()
  return expenses.filter(expense => {
    const date = new Date(expense.date)
    return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
  })
}

function getMonthlyRecurringIncome(income: Income[]) {
  return income
    .filter(item => item.is_recurring)
    .reduce(
      (total, item) =>
        total + item.amount_cad * (CYCLE_MULTIPLIER[item.recur_cycle ?? 'monthly'] ?? 1),
      0,
    )
}

function computeRunway(expenses: Expense[], income: Income[]) {
  const now = new Date()
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
  const recentExpenses = expenses.filter(expense => new Date(expense.date) >= thirtyDaysAgo)
  const totalSpent = recentExpenses.reduce((total, expense) => total + expense.amount_cad, 0)
  const dailyRate = totalSpent / 30
  const balance = getMonthlyRecurringIncome(income) - totalSpent

  if (dailyRate === 0) return null
  return Math.max(0, Math.round(balance / dailyRate))
}

function predictCategoryBudgets(expenses: Expense[], income: Income[]) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  const recent = expenses.filter(expense => new Date(expense.date) >= threeMonthsAgo)
  const byCategory: Record<string, { total: number; months: Set<string> }> = {}

  recent.forEach(expense => {
    const date = new Date(expense.date)
    const monthKey = `${date.getFullYear()}-${date.getMonth()}`
    if (!byCategory[expense.category]) {
      byCategory[expense.category] = { total: 0, months: new Set() }
    }
    byCategory[expense.category].total += expense.amount_cad
    byCategory[expense.category].months.add(monthKey)
  })

  let suggestions = Object.entries(byCategory)
    .map(([category, { total, months }]) => ({
      category,
      suggested: Math.round(total / Math.max(1, months.size)),
    }))
    .filter(suggestion => suggestion.suggested > 0)

  const monthlyIncome = getMonthlyRecurringIncome(income)
  const totalSuggested = suggestions.reduce((total, suggestion) => total + suggestion.suggested, 0)
  if (monthlyIncome > 0 && totalSuggested > monthlyIncome) {
    const scale = monthlyIncome / totalSuggested
    suggestions = suggestions.map(suggestion => ({
      ...suggestion,
      suggested: Math.round(suggestion.suggested * scale),
    }))
  }

  return suggestions
}

// A steadier basis for "is this goal realistic" than the this-month snapshot
// used elsewhere — averages actual spending over the last 3 months (or
// falls back to recurring income alone if there isn't 3 months of history)
// against monthly recurring income.
function computeAverageMonthlySavings(expenses: Expense[], income: Income[]) {
  const monthlyIncome = getMonthlyRecurringIncome(income)
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  const recent = expenses.filter(expense => new Date(expense.date) >= threeMonthsAgo)

  if (recent.length === 0) return monthlyIncome

  const monthsSeen = new Set(recent.map(expense => {
    const date = new Date(expense.date)
    return `${date.getFullYear()}-${date.getMonth()}`
  }))
  const avgMonthlySpend = recent.reduce((total, expense) => total + expense.amount_cad, 0) / Math.max(1, monthsSeen.size)

  return monthlyIncome - avgMonthlySpend
}

function addCycle(date: Date, cycle: string | null) {
  const next = new Date(date)
  switch (cycle) {
    case 'weekly':
      next.setDate(next.getDate() + 7)
      break
    case 'biweekly':
      next.setDate(next.getDate() + 14)
      break
    case 'yearly':
      next.setFullYear(next.getFullYear() + 1)
      break
    case 'monthly':
    default:
      next.setMonth(next.getMonth() + 1)
      break
  }
  return next
}

// Projects each recurring expense's last logged date forward to its next
// due date, since the schema only stores when it was last recorded.
function getUpcomingPayments(expenses: Expense[]) {
  const now = new Date()
  return expenses
    .filter(expense => expense.is_recurring)
    .map(expense => {
      let nextDue = new Date(expense.date)
      let guard = 0
      while (nextDue.getTime() < now.getTime() && guard < 60) {
        nextDue = addCycle(nextDue, expense.recur_cycle)
        guard++
      }
      const daysUntil = Math.ceil((nextDue.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      return { ...expense, nextDue, daysUntil }
    })
    .sort((a, b) => a.nextDue.getTime() - b.nextDue.getTime())
}

function Brand() {
  return (
    <div className="flex items-center">
      <SiteLogo size="compact" surface="dark" />
    </div>
  )
}

function CategoryIcon({ category }: { category: string }) {
  const Icon = CATEGORY_ICONS[category] ?? CreditCard

  return (
    <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FFF0EA] text-[#D86F4E]">
      <Icon size={18} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}

function EmptyState({ type, onAction }: { type: 'expense' | 'income'; onAction: () => void }) {
  const isExpense = type === 'expense'
  return (
    <div className="flex min-h-64 flex-col items-center justify-center px-5 text-center">
      <div className={`mb-4 grid size-12 place-items-center rounded-2xl ${isExpense ? 'bg-[#FFF0EA]' : 'bg-[#EAF2E9]'}`}>
        {isExpense ? <ReceiptText className="text-[#D86F4E]" size={22} /> : <TrendingUp className="text-[#58755F]" size={22} />}
      </div>
      <h3 className="text-sm font-semibold text-[#242522]">No {type} added yet</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[#74776F]">
        Add your first {type} to start seeing useful monthly insights here.
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-lg bg-[#22231F] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#34362F] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E98563]"
      >
        Add {type}
      </button>
    </div>
  )
}

export default function DashboardClient({ userId, profile, expenses, income, budgets, notifications, savingsGoals }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null)
  const [showStatement, setShowStatement] = useState(false)
  const [predicting, setPredicting] = useState(false)
  const [goalModalOpen, setGoalModalOpen] = useState(false)
  const [fundingGoal, setFundingGoal] = useState<SavingsGoal | null>(null)
  const [generatingInsight, setGeneratingInsight] = useState(false)
  const [insightError, setInsightError] = useState('')
  const homeCurrency = profile?.home_currency ?? 'USD'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const initials = profile?.full_name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'ST'

  const monthExpenses = useMemo(() => getMonthExpenses(expenses), [expenses])
  const totalSpentThisMonth = useMemo(
    () => monthExpenses.reduce((total, expense) => total + expense.amount_cad, 0),
    [monthExpenses],
  )
  const totalIncomeThisMonth = useMemo(() => {
    const now = new Date()
    return income
      .filter(item => {
        const date = new Date(item.date)
        return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
      })
      .reduce((total, item) => total + item.amount_cad, 0)
  }, [income])
  const amountLeftThisMonth = totalIncomeThisMonth - totalSpentThisMonth
  const runway = useMemo(() => computeRunway(expenses, income), [expenses, income])
  const monthlyRecurringIncome = useMemo(() => getMonthlyRecurringIncome(income), [income])
  const savingsPotential = monthlyRecurringIncome - totalSpentThisMonth
  const avgMonthlySavings = useMemo(() => computeAverageMonthlySavings(expenses, income), [expenses, income])

  const categoryData = useMemo(
    () =>
      CATEGORIES.map(category => ({
        name: category,
        amount: monthExpenses
          .filter(expense => expense.category === category)
          .reduce((total, expense) => total + expense.amount_cad, 0),
      })).filter(category => category.amount > 0),
    [monthExpenses],
  )
  const weeklySavingsTarget = savingsPotential / (52 / 12)
  const topSpendCategories = useMemo(
    () => [...categoryData].sort((a, b) => b.amount - a.amount).slice(0, 3),
    [categoryData],
  )
  const [savingsBreakdownOpen, setSavingsBreakdownOpen] = useState(false)
  const savingsCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (savingsCardRef.current && !savingsCardRef.current.contains(event.target as Node)) {
        setSavingsBreakdownOpen(false)
      }
    }
    if (savingsBreakdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [savingsBreakdownOpen])

  const now = new Date()
  const currentMonth = now.getMonth() + 1
  const currentYear = now.getFullYear()
  const currentBudgets = budgets.filter(
    budget => budget.month === currentMonth && budget.year === currentYear,
  )
  const suggestions = useMemo(() => predictCategoryBudgets(expenses, income), [expenses, income])
  const upcomingPayments = useMemo(() => getUpcomingPayments(expenses), [expenses])
  const recentActivity = useMemo(
    () =>
      [
        ...expenses.map(item => ({
          id: `expense-${item.id}`,
          rawId: item.id,
          type: 'expense' as const,
          title: item.note ?? item.category,
          category: item.category,
          amount: item.amount_cad,
          date: item.date,
          recurring: item.is_recurring,
          splitCount: item.split_count,
        })),
        ...income.map(item => ({
          id: `income-${item.id}`,
          rawId: item.id,
          type: 'income' as const,
          title: item.source,
          category: 'Income',
          amount: item.amount_cad,
          date: item.date,
          recurring: item.is_recurring,
          splitCount: null as number | null,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [expenses, income],
  )

  function handleEntrySaved() {
    router.refresh()
  }

  function openEditExpense(expense: Expense) {
    setEditingExpense(expense)
    setShowAddExpense(true)
  }

  function openEditIncome(item: Income) {
    setEditingIncome(item)
    setShowAddIncome(true)
  }

  function openEditBudget(category: string) {
    setEditingBudgetCategory(category)
    setShowAddBudget(true)
  }

  function openEditActivity(item: { rawId: string; type: 'expense' | 'income' }) {
    if (item.type === 'expense') {
      const found = expenses.find(expense => expense.id === item.rawId)
      if (found) openEditExpense(found)
    } else {
      const found = income.find(entry => entry.id === item.rawId)
      if (found) openEditIncome(found)
    }
  }

  // Turns "Upcoming payments" and "over budget" into real notification rows
  // instead of things you only see by opening the dashboard. Upserts on a
  // dedupe_key so this is safe to run on every load without spamming.
  useEffect(() => {
    const supabase = createClient()
    const rows: Array<{ user_id: string; title: string; body: string; type: string; dedupe_key: string }> = []

    for (const payment of upcomingPayments) {
      if (payment.daysUntil > 3) continue
      const dueLabel = payment.daysUntil === 0 ? 'today' : payment.daysUntil === 1 ? 'tomorrow' : `in ${payment.daysUntil} days`
      rows.push({
        user_id: userId,
        title: `${payment.note ?? payment.category} due ${dueLabel}`,
        body: `${formatCAD(payment.amount_cad)} due ${formatDate(payment.nextDue.toISOString())}.`,
        type: 'payment_due',
        dedupe_key: `payment_due:${payment.id}:${payment.nextDue.toISOString().split('T')[0]}`,
      })
    }

    for (const budget of currentBudgets) {
      const spent = monthExpenses
        .filter(expense => expense.category === budget.category)
        .reduce((total, expense) => total + expense.amount_cad, 0)
      if (spent <= budget.amount_cad) continue
      rows.push({
        user_id: userId,
        title: `Over budget in ${budget.category}`,
        body: `You've spent ${formatCAD(spent)} of a ${formatCAD(budget.amount_cad)} limit this month.`,
        type: 'budget_exceeded',
        dedupe_key: `budget_exceeded:${budget.category}:${currentYear}-${currentMonth}`,
      })
    }

    if (rows.length > 0) {
      supabase
        .from('notifications')
        .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .then(({ error }) => {
          if (!error) router.refresh()
        })
    }
    // Only needs to run once per dashboard load — the upsert itself is what
    // keeps this safe from creating duplicates on subsequent renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function handleGenerateInsight() {
    setGeneratingInsight(true)
    setInsightError('')
    try {
      const response = await fetch('/api/insights', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setInsightError(data.error ?? 'Could not generate an insight right now.')
        return
      }
      router.refresh()
    } catch {
      setInsightError('Could not reach the server. Try again shortly.')
    } finally {
      setGeneratingInsight(false)
    }
  }

  async function handlePredictBudgets() {
    setPredicting(true)
    const supabase = createClient()
    const toInsert = suggestions
      .filter(suggestion => !currentBudgets.some(budget => budget.category === suggestion.category))
      .map(suggestion => ({
        user_id: userId,
        category: suggestion.category,
        amount_cad: suggestion.suggested,
        month: currentMonth,
        year: currentYear,
      }))

    if (toInsert.length > 0) {
      await supabase.from('budgets').insert(toInsert)
    }
    setPredicting(false)
    router.refresh()
  }

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  return (
    <div className="min-h-screen bg-[#F3F3EF] text-[#242522]">
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-[236px] flex-col bg-[#191A18] px-5 py-6 lg:flex">
        <div className="flex items-center justify-between">
          <Brand />
          <NotificationsPanel notifications={notifications} onChanged={() => router.refresh()} variant="dark" align="left" />
        </div>

        <nav aria-label="Dashboard navigation" className="mt-12 space-y-1">
          <p className="mb-3 px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30">Workspace</p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => switchTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-white text-[#22231F] shadow-sm'
                    : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.8} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>

        <div className="mt-auto">
          {profile?.university && (
            <div className="mb-4 border-b border-white/10 pb-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Studying at</p>
              <p className="mt-1 truncate text-xs font-medium text-white/65">{profile.university}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E98563] text-xs font-bold text-[#191919]">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-white">{profile?.full_name ?? 'Student'}</p>
              <p className="text-[10px] text-white/35">Home currency · {homeCurrency}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-[#E98563]"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
          <a
            href="https://icons8.com"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block text-[9px] text-white/20 transition hover:text-white/45"
          >
            Action icons by Icons8
          </a>
        </div>
      </aside>

      <div className="lg:pl-[236px]">
        <header className="sticky top-0 z-10 border-b border-[#DFE0DA] bg-[#191A18] px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <div className="flex items-center gap-2">
              <NotificationsPanel notifications={notifications} onChanged={() => router.refresh()} variant="dark" />
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out"
                className="grid size-10 place-items-center rounded-xl bg-white/10 text-white/70"
              >
                <LogOut size={18} aria-hidden="true" />
              </button>
            </div>
          </div>
          <nav aria-label="Dashboard navigation" className="mt-3 grid grid-cols-3 gap-1 rounded-xl bg-white/[0.08] p-1">
            {NAV_ITEMS.map(item => (
              <button
                key={item.id}
                type="button"
                aria-current={activeTab === item.id ? 'page' : undefined}
                onClick={() => switchTab(item.id)}
                className={`rounded-lg px-2 py-2 text-xs font-semibold transition ${
                  activeTab === item.id ? 'bg-white text-[#242522] shadow-sm' : 'text-white/55'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10 xl:py-10">
          <div className="flex flex-col gap-6 border-b border-[#DADBD5] pb-7 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D86F4E]">
                {now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="mt-2 text-[clamp(1.8rem,4vw,2.6rem)] font-semibold leading-tight tracking-[-0.045em] text-[#20211E]">
                Good to see you, {firstName}.
              </h1>
              <p className="mt-2 max-w-lg text-sm leading-6 text-[#74776F]">
                Here&apos;s how your money is moving this month. Add a transaction whenever something changes.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap">
              <button
                type="button"
                onClick={handleGenerateInsight}
                disabled={generatingInsight}
                className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#D6D8D0] bg-white px-4 text-[#4D5049] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFC2B9] hover:text-[#242522] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#686B63] disabled:opacity-60 sm:col-span-1 sm:min-h-16 sm:min-w-[132px] sm:justify-start"
              >
                <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="text-left">
                  <span className="block text-sm font-semibold">{generatingInsight ? 'Thinking…' : 'AI insight'}</span>
                  <span className="hidden text-[10px] text-[#91948C] sm:block">This week&apos;s digest</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowStatement(true)}
                className="col-span-2 flex min-h-12 items-center justify-center gap-2 rounded-xl border border-[#D6D8D0] bg-white px-4 text-[#4D5049] shadow-sm transition hover:-translate-y-0.5 hover:border-[#BFC2B9] hover:text-[#242522] hover:shadow-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#686B63] sm:col-span-1 sm:min-h-16 sm:min-w-[132px] sm:justify-start"
              >
                <Printer size={18} strokeWidth={1.8} aria-hidden="true" />
                <span className="text-left">
                  <span className="block text-sm font-semibold">Statement</span>
                  <span className="hidden text-[10px] text-[#91948C] sm:block">Print or save PDF</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddIncome(true)}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#CCD8CA] bg-[#E3EDE1] px-4 text-left transition hover:-translate-y-0.5 hover:border-[#A9BDA7] hover:shadow-[0_10px_30px_rgba(57,78,60,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69876F] sm:min-w-[174px]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#B8CEB5] transition group-hover:scale-105">
                  <Image src={ICONS8_INCOME} alt="" width={22} height={22} unoptimized />
                </span>
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#69806B]">Money in</span>
                  <span className="mt-0.5 block text-sm font-semibold text-[#27362A]">Add income</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddExpense(true)}
                className="group flex min-h-16 items-center gap-3 rounded-2xl border border-[#F0C5B5] bg-[#FFE7DE] px-4 text-left transition hover:-translate-y-0.5 hover:border-[#E6A78F] hover:shadow-[0_10px_30px_rgba(118,61,40,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D86F4E] sm:min-w-[174px]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3AD92] transition group-hover:scale-105">
                  <Image src={ICONS8_EXPENSE} alt="" width={22} height={22} unoptimized />
                </span>
                <span>
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B76245]">Money out</span>
                  <span className="mt-0.5 block text-sm font-semibold text-[#492D24]">Add expense</span>
                </span>
              </button>
            </div>
          </div>

          {insightError && (
            <div className="mt-4 rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{insightError}</div>
          )}

          {activeTab === 'overview' && (
            <div className="mt-7 space-y-6">
              <section aria-label="Monthly summary" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
                <div className="relative overflow-hidden rounded-2xl bg-[#20211E] p-5 text-white shadow-[0_14px_40px_rgba(31,32,29,0.12)] sm:p-6">
                  <div className="absolute -right-8 -top-9 size-28 rounded-full border-[18px] border-[#E98563]/15" />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-white/55 sm:text-xs">Budget runway</p>
                    <WalletCards size={18} className="text-[#E98563]" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">
                    {runway ?? '—'} <span className="text-sm font-medium text-white/45">days</span>
                  </p>
                  <p className="mt-1 text-[10px] text-white/40 sm:text-[11px]">At your current spending rate</p>
                </div>

                <div className="rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#74776F] sm:text-xs">Spent this month</p>
                    <ReceiptText size={18} className="text-[#D86F4E]" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#242522] sm:text-3xl">{formatCAD(totalSpentThisMonth)}</p>
                  <p className="mt-1 text-[10px] text-[#91948C] sm:text-[11px]">{monthExpenses.length} transactions</p>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAddIncome(true)}
                  className="group rounded-2xl border border-[#D9E1D7] bg-white p-5 text-left transition hover:-translate-y-0.5 hover:border-[#A9C2AB] hover:shadow-[0_10px_30px_rgba(40,53,42,0.08)] sm:p-6"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#74776F] sm:text-xs">Income this month</p>
                    <TrendingUp size={18} className="text-[#58755F]" aria-hidden="true" />
                  </div>
                  <p className="mt-5 text-2xl font-semibold tracking-[-0.04em] text-[#242522] sm:text-3xl">{formatCAD(totalIncomeThisMonth)}</p>
                  <p className="mt-1 flex items-center gap-1 text-[10px] text-[#91948C] sm:text-[11px]">
                    {income.filter(item => item.is_recurring).length} recurring sources
                    <Plus size={12} className="ml-auto shrink-0 text-[#8AA48C] transition group-hover:text-[#58755F]" aria-hidden="true" />
                  </p>
                </button>

                <div className="rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#74776F] sm:text-xs">Left this month</p>
                    <Wallet size={18} className={amountLeftThisMonth >= 0 ? 'text-[#58755F]' : 'text-[#D86F4E]'} aria-hidden="true" />
                  </div>
                  <p className={`mt-5 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl ${amountLeftThisMonth >= 0 ? 'text-[#242522]' : 'text-[#C85F40]'}`}>
                    {formatCAD(amountLeftThisMonth)}
                  </p>
                  <p className="mt-1 text-[10px] text-[#91948C] sm:text-[11px]">{amountLeftThisMonth >= 0 ? 'Income minus spending so far' : 'Spending has outpaced income'}</p>
                </div>

                <div ref={savingsCardRef} className="relative rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-medium text-[#74776F] sm:text-xs">Savings potential</p>
                    <PiggyBank size={18} className={savingsPotential >= 0 ? 'text-[#58755F]' : 'text-[#D86F4E]'} aria-hidden="true" />
                  </div>
                  <p className={`mt-5 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl ${savingsPotential >= 0 ? 'text-[#3F6548]' : 'text-[#C85F40]'}`}>
                    {formatCAD(savingsPotential)}
                  </p>
                  <p className="mt-1 text-[10px] text-[#91948C] sm:text-[11px]">{savingsPotential >= 0 ? 'Available after typical costs' : 'Above your typical income'}</p>
                  <button
                    type="button"
                    onClick={() => setSavingsBreakdownOpen(value => !value)}
                    className="mt-1.5 text-[10px] font-semibold text-[#58755F] underline underline-offset-2 transition hover:text-[#3F6548] sm:text-[11px]"
                  >
                    {savingsBreakdownOpen ? 'Hide breakdown' : 'See how to get there'}
                  </button>

                  {savingsBreakdownOpen && (
                    <div className="absolute left-1/2 top-full z-30 mt-2 w-[290px] max-w-[85vw] -translate-x-1/2 rounded-2xl border border-[#DFE0DA] bg-white p-4 text-left shadow-[0_20px_60px_rgba(16,17,14,0.18)]">
                      {savingsPotential > 0 ? (
                        <>
                          <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#74776F]">Weekly target</p>
                          <p className="mt-1 text-lg font-semibold text-[#3F6548]">
                            {formatCAD(weeklySavingsTarget)} <span className="text-[11px] font-normal text-[#91948C]">/ week</span>
                          </p>
                          <p className="mt-1 text-[11px] leading-4 text-[#85887F]">
                            Set this aside each week and you&apos;ll bank {formatCAD(savingsPotential)} by the end of the month.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] leading-4 text-[#85887F]">
                          You&apos;re spending more than your typical recurring income this month, so there&apos;s no savings room yet. Trimming the categories below is the fastest way to change that.
                        </p>
                      )}

                      <div className="mt-3 space-y-1 border-t border-[#EAEBE6] pt-3 text-[11px] text-[#5F625B]">
                        <div className="flex items-center justify-between">
                          <span>Recurring income</span>
                          <span className="font-medium text-[#242522]">{formatCAD(monthlyRecurringIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Spent so far</span>
                          <span className="font-medium text-[#242522]">−{formatCAD(totalSpentThisMonth)}</span>
                        </div>
                        <div className={`flex items-center justify-between border-t border-[#EAEBE6] pt-1 font-semibold ${savingsPotential >= 0 ? 'text-[#3F6548]' : 'text-[#C85F40]'}`}>
                          <span>Savings potential</span>
                          <span>{formatCAD(savingsPotential)}</span>
                        </div>
                      </div>

                      {topSpendCategories.length > 0 && (
                        <div className="mt-3 border-t border-[#EAEBE6] pt-3">
                          <p className="text-[11px] font-semibold text-[#5F625B]">Biggest levers this month</p>
                          <div className="mt-1.5 space-y-1">
                            {topSpendCategories.map(category => (
                              <div key={category.name} className="flex items-center justify-between text-[11px] text-[#85887F]">
                                <span>{category.name}</span>
                                <span className="font-medium text-[#41443E]">{formatCAD(category.amount)}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </section>

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
                <div className="rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Spending by category</h2>
                      <p className="mt-1 text-xs text-[#85887F]">Where your money went this month</p>
                    </div>
                    <span className="text-xs font-semibold text-[#D86F4E]">{formatCAD(totalSpentThisMonth)}</span>
                  </div>

                  {categoryData.length > 0 ? (
                    <div className="mt-6 h-[270px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={categoryData} barSize={34} margin={{ top: 8, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid vertical={false} stroke="#ECEDE8" strokeDasharray="3 4" />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#85887F', fontSize: 10 }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fill: '#A0A39B', fontSize: 10 }} tickFormatter={value => `$${value}`} />
                          <Tooltip
                            cursor={{ fill: '#F6F6F2' }}
                            contentStyle={{ background: '#20211E', border: 0, borderRadius: 12, color: '#fff', fontSize: 12, boxShadow: '0 12px 28px rgba(0,0,0,.16)' }}
                            labelStyle={{ color: '#BFC1BA', marginBottom: 4 }}
                            formatter={value => [formatCAD(Number(value ?? 0)), 'Spent']}
                          />
                          <Bar dataKey="amount" radius={[8, 8, 3, 3]}>
                            {categoryData.map((category, index) => (
                              <Cell key={category.name} fill={index === 0 ? '#E98563' : '#F2B39B'} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  ) : (
                    <div className="flex h-[270px] flex-col items-center justify-center text-center">
                      <TrendingDown size={24} className="mb-3 text-[#C4C6BF]" />
                      <p className="text-sm font-medium text-[#555851]">Nothing to chart yet</p>
                      <p className="mt-1 text-xs text-[#91948C]">Your category breakdown will appear after you add an expense.</p>
                    </div>
                  )}
                </div>

                <div className="rounded-2xl border border-[#DFE0DA] bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Monthly budgets</h2>
                      <p className="mt-1 text-xs text-[#85887F]">Keep each category on track</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddBudget(true)}
                      className="shrink-0 text-xs font-semibold text-[#C96042] transition hover:text-[#9E492F]"
                    >
                      Add budget
                    </button>
                  </div>

                  {currentBudgets.length > 0 ? (
                    <div className="mt-7 space-y-6">
                      {currentBudgets.map(budget => {
                        const spent = monthExpenses
                          .filter(expense => expense.category === budget.category)
                          .reduce((total, expense) => total + expense.amount_cad, 0)
                        const percentage = budget.amount_cad > 0
                          ? Math.min(100, Math.round((spent / budget.amount_cad) * 100))
                          : 100
                        const over = spent > budget.amount_cad
                        const Icon = CATEGORY_ICONS[budget.category] ?? CreditCard
                        return (
                          <button
                            type="button"
                            key={budget.category}
                            onClick={() => openEditBudget(budget.category)}
                            className="group -mx-2 block w-full rounded-xl px-2 py-1 text-left transition hover:bg-[#F7F7F4]"
                          >
                            <div className="mb-2 flex items-center gap-2">
                              <Icon size={15} className={over ? 'text-[#D86F4E]' : 'text-[#667169]'} />
                              <span className="text-xs font-semibold text-[#41443E]">{budget.category}</span>
                              <Pencil size={12} className="text-[#C4C6BF] transition group-hover:text-[#85887F]" aria-hidden="true" />
                              <span className={`ml-auto text-[11px] font-medium ${over ? 'text-[#D86F4E]' : 'text-[#85887F]'}`}>
                                {formatCAD(spent)} of {formatCAD(budget.amount_cad)}
                              </span>
                            </div>
                            <div
                              className="h-2 overflow-hidden rounded-full bg-[#ECEDE8]"
                              role="progressbar"
                              aria-label={`${budget.category} budget used`}
                              aria-valuenow={percentage}
                              aria-valuemin={0}
                              aria-valuemax={100}
                            >
                              <div
                                className={`h-full rounded-full transition-all ${over ? 'bg-[#E98563]' : 'bg-[#829A83]'}`}
                                style={{ width: `${percentage}%` }}
                              />
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className="flex min-h-[240px] flex-col items-center justify-center text-center">
                      <div className="grid size-11 place-items-center rounded-2xl bg-[#F0F1EC] text-[#777B72]">
                        <PiggyBank size={21} />
                      </div>
                      <p className="mt-4 text-sm font-semibold text-[#41443E]">Give every dollar a plan</p>
                      <p className="mt-1 max-w-[240px] text-xs leading-5 text-[#91948C]">Set a monthly limit yourself or use a suggestion based on recent spending.</p>
                      <div className="mt-4 flex flex-wrap justify-center gap-3">
                        <button type="button" onClick={() => setShowAddBudget(true)} className="text-xs font-semibold text-[#C96042] hover:underline">Set a budget</button>
                        {suggestions.length > 0 && (
                          <button
                            type="button"
                            onClick={handlePredictBudgets}
                            disabled={predicting}
                            className="text-xs font-semibold text-[#58755F] hover:underline disabled:opacity-50"
                          >
                            {predicting ? 'Creating…' : 'Use smart suggestions'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white">
                <div className="flex items-center justify-between border-b border-[#EAEBE6] px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Upcoming payments</h2>
                    <p className="mt-1 text-xs text-[#85887F]">
                      {upcomingPayments.length > 0
                        ? `Next payment due in ${upcomingPayments[0].daysUntil === 0 ? 'today' : upcomingPayments[0].daysUntil === 1 ? '1 day' : `${upcomingPayments[0].daysUntil} days`}`
                        : 'No recurring bills tracked yet'}
                    </p>
                  </div>
                  {upcomingPayments.length > 0 && (
                    <CalendarClock size={18} className="text-[#D86F4E]" aria-hidden="true" />
                  )}
                </div>

                {upcomingPayments.length > 0 ? (
                  <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                    {upcomingPayments.slice(0, 5).map(payment => {
                      const urgent = payment.daysUntil <= 3
                      const Icon = CATEGORY_ICONS[payment.category] ?? CreditCard
                      return (
                        <div key={payment.id} className="flex items-center gap-3 py-4 sm:gap-4">
                          <div className={`grid size-10 shrink-0 place-items-center rounded-xl ${urgent ? 'bg-[#FFE7DE] text-[#C96042]' : 'bg-[#FFF0EA] text-[#D86F4E]'}`}>
                            <Icon size={18} strokeWidth={2} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#343630]">{payment.note ?? payment.category}</p>
                            <p className="mt-0.5 text-[11px] text-[#91948C]">{payment.category} · {formatDate(payment.nextDue.toISOString())}</p>
                          </div>
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${urgent ? 'bg-[#FFE7DE] text-[#C96042]' : 'bg-[#F0F1EC] text-[#666A62]'}`}>
                            {payment.daysUntil === 0 ? 'Due today' : payment.daysUntil === 1 ? 'Due tomorrow' : `In ${payment.daysUntil} days`}
                          </span>
                          <span className="shrink-0 text-sm font-semibold text-[#343630]">{formatCAD(payment.amount_cad)}</span>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
                    <CalendarClock size={22} className="text-[#B7BAB2]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-[#555851]">No upcoming payments</p>
                    <p className="mt-1 text-xs text-[#91948C]">Mark an expense as recurring to track when it&apos;s next due.</p>
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white">
                <div className="flex items-center justify-between border-b border-[#EAEBE6] px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Savings goals</h2>
                    <p className="mt-1 text-xs text-[#85887F]">Give a purpose to what you set aside</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => { setFundingGoal(null); setGoalModalOpen(true) }}
                    className="shrink-0 text-xs font-semibold text-[#C96042] transition hover:text-[#9E492F]"
                  >
                    New goal
                  </button>
                </div>

                {savingsGoals.length > 0 ? (
                  <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                    {savingsGoals.map(goal => {
                      const percentage = goal.target_amount_cad > 0
                        ? Math.min(100, Math.round((goal.current_amount_cad / goal.target_amount_cad) * 100))
                        : 0
                      const reached = goal.current_amount_cad >= goal.target_amount_cad
                      const remaining = Math.max(0, goal.target_amount_cad - goal.current_amount_cad)
                      const monthsRemaining = goal.target_date
                        ? Math.max((new Date(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 1 / 30.44)
                        : null
                      const monthsNeeded = avgMonthlySavings > 0 ? remaining / avgMonthlySavings : null
                      const pace = !reached && monthsRemaining !== null && monthsNeeded !== null
                        ? (monthsNeeded <= monthsRemaining ? 'on-track' : 'behind')
                        : null
                      return (
                        <div key={goal.id} className="py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-3">
                              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2E9] text-[#58755F]">
                                <Target size={17} aria-hidden="true" />
                              </span>
                              <div>
                                <p className="flex items-center gap-2 text-sm font-semibold text-[#343630]">
                                  {goal.title}
                                  {pace && (
                                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${pace === 'on-track' ? 'bg-[#EAF2E9] text-[#3F6548]' : 'bg-[#FFF0EA] text-[#B9573A]'}`}>
                                      {pace === 'on-track' ? 'On track' : 'Behind pace'}
                                    </span>
                                  )}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#91948C]">
                                  {formatCAD(goal.current_amount_cad)} of {formatCAD(goal.target_amount_cad)}
                                  {goal.target_date && ` · by ${formatDate(goal.target_date, true)}`}
                                </p>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => { setFundingGoal(goal); setGoalModalOpen(true) }}
                              className="flex shrink-0 items-center gap-1 rounded-lg bg-[#F1F2ED] px-2.5 py-1.5 text-[11px] font-semibold text-[#4D5049] transition hover:bg-[#E7E8E2]"
                            >
                              <Plus size={12} aria-hidden="true" /> Add
                            </button>
                          </div>
                          <div
                            className="mt-3 h-2 overflow-hidden rounded-full bg-[#ECEDE8]"
                            role="progressbar"
                            aria-label={`${goal.title} progress`}
                            aria-valuenow={percentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                          >
                            <div
                              className={`h-full rounded-full transition-all ${reached ? 'bg-[#58755F]' : 'bg-[#829A83]'}`}
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <div className="flex min-h-40 flex-col items-center justify-center px-5 text-center">
                    <Target size={22} className="text-[#B7BAB2]" aria-hidden="true" />
                    <p className="mt-3 text-sm font-medium text-[#555851]">No goals yet</p>
                    <p className="mt-1 text-xs text-[#91948C]">Flight home, a laptop, an emergency fund — give your savings a target.</p>
                    <button
                      type="button"
                      onClick={() => { setFundingGoal(null); setGoalModalOpen(true) }}
                      className="mt-4 text-xs font-semibold text-[#C96042] hover:underline"
                    >
                      Set a goal
                    </button>
                  </div>
                )}
              </section>

              <section className="overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white">
                <div className="flex items-center justify-between border-b border-[#EAEBE6] px-5 py-5 sm:px-6">
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Recent activity</h2>
                    <p className="mt-1 text-xs text-[#85887F]">Your latest money movements</p>
                  </div>
                  {recentActivity.length > 0 && (
                    <button type="button" onClick={() => switchTab('expenses')} className="flex items-center gap-1 text-xs font-semibold text-[#666A62] hover:text-[#242522]">
                      View expenses <ChevronRight size={14} />
                    </button>
                  )}
                </div>
                {recentActivity.length > 0 ? (
                  <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                    {recentActivity.map(item => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => openEditActivity(item)}
                        className="group -mx-2 flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F7F4] sm:gap-4"
                      >
                        {item.type === 'expense' ? (
                          <CategoryIcon category={item.category} />
                        ) : (
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2E9] text-[#58755F]">
                            <TrendingUp size={18} strokeWidth={2} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-[#343630]">{item.title}</p>
                          <p className="mt-0.5 text-[11px] text-[#91948C]">
                            {item.category} · {formatDate(item.date)}
                            {item.recurring && <span className="ml-2 font-medium text-[#69876F]">Recurring</span>}
                            {item.splitCount && <span className="ml-2 font-medium text-[#7C8378]">Split {item.splitCount} ways</span>}
                          </p>
                        </div>
                        <Pencil size={13} className="shrink-0 text-[#C4C6BF] transition group-hover:text-[#85887F]" aria-hidden="true" />
                        <span className={`shrink-0 text-sm font-semibold ${item.type === 'expense' ? 'text-[#C96042]' : 'text-[#4E7558]'}`}>
                          {item.type === 'expense' ? '−' : '+'}{formatCAD(item.amount)}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="flex min-h-48 flex-col items-center justify-center px-5 text-center">
                    <WalletCards size={24} className="text-[#B7BAB2]" />
                    <p className="mt-3 text-sm font-medium text-[#555851]">Your activity will show up here</p>
                    <p className="mt-1 text-xs text-[#91948C]">Start by adding income or an expense above.</p>
                  </div>
                )}
              </section>
            </div>
          )}

          {activeTab === 'expenses' && (
            <section className="mt-7 overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white">
              <div className="flex items-center justify-between border-b border-[#EAEBE6] px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-semibold text-[#242522]">All expenses</h2>
                  <p className="mt-1 text-xs text-[#85887F]">{expenses.length} recorded transactions</p>
                </div>
                <p className="text-sm font-semibold text-[#C96042]">{formatCAD(expenses.reduce((total, item) => total + item.amount_cad, 0))}</p>
              </div>
              {expenses.length > 0 ? (
                <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                  {expenses.map(expense => (
                    <button
                      type="button"
                      key={expense.id}
                      onClick={() => openEditExpense(expense)}
                      className="group -mx-2 flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F7F4] sm:gap-4"
                    >
                      <CategoryIcon category={expense.category} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#343630]">{expense.note ?? expense.category}</p>
                        <p className="mt-0.5 text-[11px] text-[#91948C]">
                          {expense.category} · {formatDate(expense.date, true)}
                          {expense.split_count && (
                            <span className="ml-2 inline-flex items-center gap-1 font-medium text-[#7C8378]">
                              <Users size={11} aria-hidden="true" /> Split {expense.split_count} ways
                            </span>
                          )}
                        </p>
                      </div>
                      {expense.original_amount && expense.original_currency && (
                        <span className="hidden text-[11px] text-[#91948C] sm:block">{expense.original_currency} {expense.original_amount}</span>
                      )}
                      <Pencil size={13} className="shrink-0 text-[#C4C6BF] transition group-hover:text-[#85887F]" aria-hidden="true" />
                      <span className="shrink-0 text-sm font-semibold text-[#C96042]">−{formatCAD(expense.amount_cad)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState type="expense" onAction={() => setShowAddExpense(true)} />
              )}
            </section>
          )}

          {activeTab === 'income' && (
            <section className="mt-7 overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white">
              <div className="flex items-center justify-between border-b border-[#EAEBE6] px-5 py-5 sm:px-6">
                <div>
                  <h2 className="text-base font-semibold text-[#242522]">All income</h2>
                  <p className="mt-1 text-xs text-[#85887F]">{income.length} recorded sources</p>
                </div>
                <p className="text-sm font-semibold text-[#4E7558]">{formatCAD(income.reduce((total, item) => total + item.amount_cad, 0))}</p>
              </div>
              {income.length > 0 ? (
                <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                  {income.map(item => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => openEditIncome(item)}
                      className="group -mx-2 flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F7F4] sm:gap-4"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2E9] text-[#58755F]">
                        <TrendingUp size={18} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#343630]">{item.source}</p>
                        <p className="mt-0.5 text-[11px] text-[#91948C]">
                          {formatDate(item.date, true)}
                          {item.is_recurring && <span className="ml-2 font-medium text-[#69876F]">Recurring · {item.recur_cycle}</span>}
                        </p>
                      </div>
                      <Pencil size={13} className="shrink-0 text-[#C4C6BF] transition group-hover:text-[#85887F]" aria-hidden="true" />
                      <span className="shrink-0 text-sm font-semibold text-[#4E7558]">+{formatCAD(item.amount_cad)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <EmptyState type="income" onAction={() => setShowAddIncome(true)} />
              )}
            </section>
          )}
        </main>
      </div>

      {showAddExpense && (
        <AddExpenseModal
          userId={userId}
          homeCurrency={homeCurrency}
          expense={editingExpense}
          onClose={() => { setShowAddExpense(false); setEditingExpense(null) }}
          onSaved={handleEntrySaved}
        />
      )}

      {showAddIncome && (
        <AddIncomeModal
          userId={userId}
          homeCurrency={homeCurrency}
          income={editingIncome}
          onClose={() => { setShowAddIncome(false); setEditingIncome(null) }}
          onSaved={handleEntrySaved}
        />
      )}

      {showAddBudget && (
        <AddBudgetModal
          userId={userId}
          month={currentMonth}
          year={currentYear}
          existingBudgets={currentBudgets}
          suggestions={suggestions}
          initialCategory={editingBudgetCategory}
          onClose={() => { setShowAddBudget(false); setEditingBudgetCategory(null) }}
          onSaved={handleEntrySaved}
        />
      )}

      {showStatement && (
        <StatementModal
          fullName={profile?.full_name ?? 'Student'}
          university={profile?.university}
          expenses={expenses}
          income={income}
          onClose={() => setShowStatement(false)}
        />
      )}

      {goalModalOpen && (
        <AddSavingsGoalModal
          userId={userId}
          goal={fundingGoal}
          avgMonthlySavings={avgMonthlySavings}
          onClose={() => setGoalModalOpen(false)}
          onSaved={handleEntrySaved}
        />
      )}
    </div>
  )
}
