'use client'

import Image from 'next/image'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BusFront,
  CalendarClock,
  CalendarDays,
  ChevronLeft,
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
  TrendingUp,
  Users,
  Wallet,
  WalletCards,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import SiteLogo from '@/components/SiteLogo'
import AddBudgetModal from './AddBudgetModal'
import AddExpenseModal from './AddExpenseModal'
import AddIncomeModal from './AddIncomeModal'
import AddSavingsGoalModal from './AddSavingsGoalModal'
import BankSyncPanel from './BankSyncPanel'
import NotificationsPanel from './NotificationsPanel'
import StatementModal from './StatementModal'
import FinancialChart from './FinancialChart'
import SpendingLimitCard from './SpendingLimitCard'
import SpendingAlertSync from './SpendingAlertSync'
import type { SpendingLimitSettings } from '@/lib/spending-limits'
import styles from './dashboard.module.css'

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
  // Present when the table tracks it; the "Just added" badge simply never
  // shows if the column isn't there, so this degrades quietly.
  created_at?: string | null
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
  // Present when the table tracks it; the "Just added" badge simply never
  // shows if the column isn't there, so this degrades quietly.
  created_at?: string | null
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

interface GoalSuggestion {
  title: string
  targetAmountCad: number
  targetDate: string | null
  rationale: string
}

interface SavingsTip {
  category: string | null
  title: string
  body: string
}

interface DuePayday {
  source: string
  expectedAmount: number
  cycle: string
  dueDate: string
}

interface Props {
  userId: string
  profile: Profile | null
  expenses: Expense[]
  income: Income[]
  budgets: Budget[]
  notifications: Notification[]
  savingsGoals: SavingsGoal[]
  spendingLimit: SpendingLimitSettings | null
}

type Tab = 'overview' | 'expenses' | 'income'

// The three AI features (insight, goal suggestion, savings tips) are built and
// wired end to end — they just need credits on the Anthropic account. Until
// then they show as "Coming soon" rather than failing on a billing error.
// Flip this to true to switch all of them back on; nothing else needs changing.
const AI_FEATURES_ENABLED = false

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

// Every figure on screen is shown to the cent. Rounding to whole dollars made
// totals disagree with the amounts actually entered ($705.40 reading as $705).
function formatCAD(value: number) {
  return new Intl.NumberFormat('en-CA', {
    style: 'currency',
    currency: 'CAD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

// Date-only strings ('YYYY-MM-DD') are parsed by `new Date()` as UTC midnight.
// In a timezone behind UTC, converting that back to local time for getMonth()/
// getDate()/toLocaleDateString() rolls it back a day — so an expense dated the
// 1st of the month can read as the last day of the previous month. Appending a
// local time-of-day forces the string to be parsed in the local timezone instead.
function parseLocalDate(date: string) {
  return new Date(date.includes('T') ? date : `${date}T00:00:00`)
}

function formatDate(date: string, includeYear = false) {
  return parseLocalDate(date).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  })
}

function endOfToday() {
  const end = new Date()
  end.setHours(23, 59, 59, 999)
  return end
}

// Entries belonging to one calendar month, ignoring anything dated later than
// today. A bill you have logged ahead of time is a commitment, not money that
// has left your account — counting it as "spent" both overstated the month and
// made moving a future date backwards look like it did nothing.
// Upcoming payments still surface those separately.
function getMonthEntries<T extends { date: string }>(entries: T[], month: Date) {
  const cutoff = endOfToday()
  return entries.filter(entry => {
    const date = parseLocalDate(entry.date)
    return (
      date.getMonth() === month.getMonth() &&
      date.getFullYear() === month.getFullYear() &&
      date <= cutoff
    )
  })
}

// Include custom categories alongside the presets in a consistent order.
function getCategoryData(expenses: Expense[]) {
  const totals = new Map<string, number>()
  for (const expense of expenses) {
    totals.set(expense.category, (totals.get(expense.category) ?? 0) + expense.amount_cad)
  }

  const preset = CATEGORIES.filter(category => totals.has(category)).map(category => ({
    name: category,
    amount: totals.get(category) as number,
  }))
  const custom = [...totals.entries()]
    .filter(([name]) => !CATEGORIES.includes(name))
    .map(([name, amount]) => ({ name, amount }))
    .sort((a, b) => b.amount - a.amount)

  return [...preset, ...custom].filter(category => category.amount > 0)
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1)
}

const RECENTLY_ADDED_MS = 24 * 60 * 60 * 1000

// Flags a row that was *entered* in the last day, which is a different question
// from the date it's filed under — you can log an August receipt this morning.
// `now` is passed in rather than read here so this stays pure during render.
function isRecentlyAdded(createdAt: string | null | undefined, now: Date) {
  if (!createdAt) return false
  const added = new Date(createdAt).getTime()
  if (Number.isNaN(added)) return false
  return now.getTime() - added < RECENTLY_ADDED_MS
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
  const recentExpenses = expenses.filter(expense => parseLocalDate(expense.date) >= thirtyDaysAgo)
  const totalSpent = recentExpenses.reduce((total, expense) => total + expense.amount_cad, 0)
  const dailyRate = totalSpent / 30
  const balance = getMonthlyRecurringIncome(income) - totalSpent

  if (dailyRate === 0) return null
  return Math.max(0, Math.round(balance / dailyRate))
}

function predictCategoryBudgets(expenses: Expense[], income: Income[]) {
  const now = new Date()
  const threeMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())
  const recent = expenses.filter(expense => parseLocalDate(expense.date) >= threeMonthsAgo)
  const byCategory: Record<string, { total: number; months: Set<string> }> = {}

  recent.forEach(expense => {
    const date = parseLocalDate(expense.date)
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

// A steadier basis for "what can I realistically save" than the this-month
// snapshot: averages what actually came in and what actually went out over the
// same trailing window.
//
// This used to weigh averaged real spending against the *recurring rate* for
// income, which understated anyone whose pay lands as one-off rows — including
// every payday confirmed through the check-in banner. Both sides now come from
// the same ledger over the same months, so the number moves with real
// behaviour on either side.
function computeMonthlyAverages(expenses: Expense[], income: Income[]) {
  const now = new Date()
  const windowStart = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate())

  const recentExpenses = expenses.filter(expense => parseLocalDate(expense.date) >= windowStart)
  const recentIncome = income.filter(item => parseLocalDate(item.date) >= windowStart)

  // One shared denominator keeps the two sides comparable — a month with
  // spending but no logged income still drags the income average down, which
  // is the honest reading.
  const monthsSeen = new Set<string>()
  for (const entry of [...recentExpenses, ...recentIncome]) {
    const date = parseLocalDate(entry.date)
    monthsSeen.add(`${date.getFullYear()}-${date.getMonth()}`)
  }
  const months = Math.max(1, monthsSeen.size)

  const avgSpend = recentExpenses.reduce((total, expense) => total + expense.amount_cad, 0) / months
  // Nothing logged yet (fresh account, or income captured only as a recurring
  // template) — fall back to the configured rate rather than reporting a
  // deficit the user hasn't actually run.
  const avgIncome =
    recentIncome.length > 0
      ? recentIncome.reduce((total, item) => total + item.amount_cad, 0) / months
      : getMonthlyRecurringIncome(income)

  return { avgIncome, avgSpend, months, potential: avgIncome - avgSpend }
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
      let nextDue = parseLocalDate(expense.date)
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

// Local-time counterpart to toISOString().split('T')[0], which would shift the
// date backwards a day in any timezone behind UTC (see parseLocalDate).
function toIsoDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

// A payday that should have landed but has no income row yet.
//
// Recurring income rows double as templates: they carry the source, the normal
// amount and the cycle. Projecting the newest row for a source forward by its
// cycle gives the next expected payday — anything on or before today that has
// no matching row is money the user was probably paid but never logged.
function getDuePaydays(income: Income[]): DuePayday[] {
  const endOfToday = new Date()
  endOfToday.setHours(23, 59, 59, 999)

  const templates = new Map<string, Income>()
  for (const item of income) {
    if (!item.is_recurring) continue
    const existing = templates.get(item.source)
    if (!existing || parseLocalDate(item.date) > parseLocalDate(existing.date)) {
      templates.set(item.source, item)
    }
  }

  const due: DuePayday[] = []

  for (const [source, template] of templates) {
    // Latest money in for this source — the template itself, or a later one-off
    // row logged by confirming a previous payday prompt.
    const lastPaid = income
      .filter(item => item.source === source)
      .reduce((latest, item) => {
        const date = parseLocalDate(item.date)
        return date > latest ? date : latest
      }, new Date(0))

    let nextDue = addCycle(lastPaid, template.recur_cycle)
    let guard = 0
    while (nextDue.getTime() <= endOfToday.getTime() && guard < 12) {
      due.push({
        source,
        expectedAmount: template.amount_cad,
        cycle: template.recur_cycle ?? 'monthly',
        dueDate: toIsoDate(nextDue),
      })
      nextDue = addCycle(nextDue, template.recur_cycle)
      guard++
    }
  }

  return due.sort((a, b) => a.dueDate.localeCompare(b.dueDate))
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

export default function DashboardClient({ userId, profile, expenses, income, budgets, notifications, savingsGoals, spendingLimit }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [notificationsOpen, setNotificationsOpen] = useState(false)
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
  const [goalSuggestion, setGoalSuggestion] = useState<GoalSuggestion | null>(null)
  const [suggestingGoal, setSuggestingGoal] = useState(false)
  const [goalSuggestionError, setGoalSuggestionError] = useState('')
  const [generatingInsight, setGeneratingInsight] = useState(false)
  const [insightError, setInsightError] = useState('')
  const [savingsTips, setSavingsTips] = useState<SavingsTip[] | null>(null)
  const [loadingTips, setLoadingTips] = useState(false)
  const [tipsError, setTipsError] = useState('')
  const [editingPayday, setEditingPayday] = useState(false)
  const [paydayAmount, setPaydayAmount] = useState('')
  const [savingPayday, setSavingPayday] = useState(false)
  const [paydayError, setPaydayError] = useState('')
  const [skippedPaydays, setSkippedPaydays] = useState<string[]>([])
  const homeCurrency = profile?.home_currency ?? 'USD'
  const firstName = profile?.full_name?.split(' ')[0] ?? 'there'
  const initials = profile?.full_name
    ?.split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? 'ST'

  // 0 is the current month, -1 last month, and so on. The month-scoped figures
  // below follow this, so history stays reachable instead of the dashboard
  // wiping itself clean every 1st of the month.
  const [monthOffset, setMonthOffset] = useState(0)
  const viewedMonth = useMemo(() => {
    const today = new Date()
    return new Date(today.getFullYear(), today.getMonth() + monthOffset, 1)
  }, [monthOffset])
  const viewingCurrentMonth = monthOffset === 0

  const earliestMonth = useMemo(() => {
    const stamps = [...expenses, ...income].map(entry => parseLocalDate(entry.date).getTime())
    return stamps.length > 0 ? startOfMonth(new Date(Math.min(...stamps))) : startOfMonth(new Date())
  }, [expenses, income])
  const canGoBackAMonth = viewedMonth > earliestMonth
  const viewedMonthLabel = viewedMonth.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  const monthWord = viewingCurrentMonth
    ? 'this month'
    : `in ${viewedMonth.toLocaleDateString('en-CA', { month: 'long' })}`

  const monthExpenses = useMemo(() => getMonthEntries(expenses, viewedMonth), [expenses, viewedMonth])
  const totalSpentThisMonth = useMemo(
    () => monthExpenses.reduce((total, expense) => total + expense.amount_cad, 0),
    [monthExpenses],
  )
  const thisMonthIncome = useMemo(
    () =>
      getMonthEntries(income, viewedMonth).sort(
        (a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime(),
      ),
    [income, viewedMonth],
  )
  const totalIncomeThisMonth = useMemo(
    () => thisMonthIncome.reduce((total, item) => total + item.amount_cad, 0),
    [thisMonthIncome],
  )
  const amountLeftThisMonth = totalIncomeThisMonth - totalSpentThisMonth

  // Running totals across everything logged, ignoring month boundaries. Money
  // you didn't spend last month is still yours, so the balance carries forward
  // instead of the dashboard reading $0.00 every 1st.
  const recordedExpenses = useMemo(() => {
    const cutoff = endOfToday()
    return expenses.filter(expense => parseLocalDate(expense.date) <= cutoff)
  }, [expenses])
  const runningTotals = useMemo(() => {
    const cutoff = endOfToday()
    const upToToday = <T extends { date: string; amount_cad: number }>(entries: T[]) =>
      entries.filter(entry => parseLocalDate(entry.date) <= cutoff)

    const earned = upToToday(income).reduce((total, item) => total + item.amount_cad, 0)
    const spent = recordedExpenses.reduce((total, item) => total + item.amount_cad, 0)
    return { earned, spent, balance: earned - spent }
  }, [recordedExpenses, income])

  // Balance as it stood before the month on screen — the amount carried in.
  const balanceBroughtForward = useMemo(() => {
    const startOfViewed = viewedMonth.getTime()
    const before = <T extends { date: string; amount_cad: number }>(entries: T[]) =>
      entries.filter(entry => parseLocalDate(entry.date).getTime() < startOfViewed)

    const earned = before(income).reduce((total, item) => total + item.amount_cad, 0)
    const spent = before(expenses).reduce((total, item) => total + item.amount_cad, 0)
    return earned - spent
  }, [expenses, income, viewedMonth])

  // Default to the running view: opening the app should answer "what do I
  // actually have", not "what has happened since the 1st".
  const [summaryScope, setSummaryScope] = useState<'running' | 'month'>('running')
  const showingRunning = summaryScope === 'running'

  const spentFigure = showingRunning ? runningTotals.spent : totalSpentThisMonth
  const earnedFigure = showingRunning ? runningTotals.earned : totalIncomeThisMonth
  const leftFigure = showingRunning ? runningTotals.balance : amountLeftThisMonth
  const runway = useMemo(() => computeRunway(expenses, income), [expenses, income])
  const monthlyAverages = useMemo(() => computeMonthlyAverages(expenses, income), [expenses, income])
  const avgMonthlySavings = monthlyAverages.potential
  const savingsPotential = avgMonthlySavings
  const avgMonthlySpend = monthlyAverages.avgSpend
  const avgMonthlyIncome = monthlyAverages.avgIncome

  const weeklySavingsTarget = savingsPotential / (52 / 12)
  // Savings advice stays monthly regardless of the chart's selected scope.
  const topSpendCategories = useMemo(
    () => getCategoryData(monthExpenses).sort((a, b) => b.amount - a.amount).slice(0, 3),
    [monthExpenses],
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

  const [incomeBreakdownOpen, setIncomeBreakdownOpen] = useState(false)
  const incomeCardRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (incomeCardRef.current && !incomeCardRef.current.contains(event.target as Node)) {
        setIncomeBreakdownOpen(false)
      }
    }
    if (incomeBreakdownOpen) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [incomeBreakdownOpen])

  const now = new Date()
  // Budgets follow whichever month is on screen, so browsing back shows the
  // limits that were in force then. Notifications below deliberately stay on
  // the real current month — an alert is about now, not what you're reading.
  const currentMonth = viewedMonth.getMonth() + 1
  const currentYear = viewedMonth.getFullYear()
  const currentBudgets = budgets.filter(
    budget => budget.month === currentMonth && budget.year === currentYear,
  )
  const suggestions = useMemo(() => predictCategoryBudgets(expenses, income), [expenses, income])
  const upcomingPayments = useMemo(() => getUpcomingPayments(expenses), [expenses])
  const duePaydays = useMemo(() => getDuePaydays(income), [income])
  // Oldest unconfirmed payday first, so a run of missed ones is worked through
  // one at a time rather than stacking up on screen.
  const activePayday = duePaydays.find(
    payday => !skippedPaydays.includes(`${payday.source}|${payday.dueDate}`),
  )

  // "Not paid" dismissals live in the browser: skipping is a per-person "don't
  // ask me again", not financial data worth a table of its own.
  // Reading the initial value out of localStorage on mount — the rule's own
  // "subscribe to an external system" carve-out. It can't be a lazy useState
  // initializer without desyncing from the server render.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem('xtrack:skipped-paydays')
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setSkippedPaydays(JSON.parse(stored))
    } catch {
      // Private mode or blocked storage — prompts simply reappear next load.
    }
  }, [])

  function skipPayday(payday: DuePayday) {
    const key = `${payday.source}|${payday.dueDate}`
    const next = [...skippedPaydays, key]
    setSkippedPaydays(next)
    setEditingPayday(false)
    setPaydayError('')
    try {
      window.localStorage.setItem('xtrack:skipped-paydays', JSON.stringify(next))
    } catch {
      // Non-fatal: the skip still applies for this session.
    }
  }

  async function confirmPayday(payday: DuePayday, amount: number) {
    if (isNaN(amount) || amount <= 0) {
      setPaydayError('Please enter a valid amount.')
      return
    }
    setSavingPayday(true)
    setPaydayError('')
    const supabase = createClient()
    // Logged as a one-off row, not another recurring one: the existing
    // recurring entry is the template, and marking each payment recurring
    // too would multiply the projected monthly income every payday.
    const { error: saveError } = await supabase.from('income').insert({
      user_id: userId,
      source: payday.source,
      amount_cad: amount,
      date: payday.dueDate,
      is_recurring: false,
      recur_cycle: null,
    })

    if (saveError) {
      setPaydayError(saveError.message)
      setSavingPayday(false)
      return
    }

    setSavingPayday(false)
    setEditingPayday(false)
    setPaydayAmount('')
    router.refresh()
  }
  const recentActivity = useMemo(
    () =>
      [
        ...expenses.map(item => ({
          id: `expense-${item.id}`,
          rawId: item.id,
          createdAt: item.created_at ?? null,
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
          createdAt: item.created_at ?? null,
          type: 'income' as const,
          title: item.source,
          category: 'Income',
          amount: item.amount_cad,
          date: item.date,
          recurring: item.is_recurring,
          splitCount: null as number | null,
        })),
      ]
        .sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
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
    const now = new Date()
    const realMonth = now.getMonth() + 1
    const realYear = now.getFullYear()
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

    // Pinned to the real current month: browsing back through history should
    // never raise alerts about a month that has already closed.
    const realMonthBudgets = budgets.filter(
      budget => budget.month === realMonth && budget.year === realYear,
    )
    const realMonthExpenses = getMonthEntries(expenses, now)
    for (const budget of realMonthBudgets) {
      const spent = realMonthExpenses
        .filter(expense => expense.category === budget.category)
        .reduce((total, expense) => total + expense.amount_cad, 0)
      if (spent <= budget.amount_cad) continue
      rows.push({
        user_id: userId,
        title: `Over budget in ${budget.category}`,
        body: `You've spent ${formatCAD(spent)} of a ${formatCAD(budget.amount_cad)} limit this month.`,
        type: 'budget_exceeded',
        dedupe_key: `budget_exceeded:${budget.category}:${realYear}-${realMonth}`,
      })
    }

    if (rows.length > 0) {
      supabase
        .from('notifications')
        .upsert(rows, { onConflict: 'user_id,dedupe_key', ignoreDuplicates: true })
        .select('id')
        .then(({ data, error }) => {
          if (!error && data?.length) router.refresh()
        })
    }
  }, [budgets, expenses, upcomingPayments, userId, router])

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

  async function handleSuggestGoal() {
    setSuggestingGoal(true)
    setGoalSuggestionError('')
    try {
      const response = await fetch('/api/suggest-goal', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setGoalSuggestionError(data.error ?? 'Could not suggest a goal right now.')
        return
      }
      setGoalSuggestion(data.suggestion)
      setFundingGoal(null)
      setGoalModalOpen(true)
    } catch {
      setGoalSuggestionError('Could not reach the server. Try again shortly.')
    } finally {
      setSuggestingGoal(false)
    }
  }

  async function handleGetSavingsTips() {
    setLoadingTips(true)
    setTipsError('')
    try {
      const response = await fetch('/api/savings-advice', { method: 'POST' })
      const data = await response.json()
      if (!response.ok) {
        setTipsError(data.error ?? 'Could not generate savings tips right now.')
        return
      }
      setSavingsTips(data.tips)
    } catch {
      setTipsError('Could not reach the server. Try again shortly.')
    } finally {
      setLoadingTips(false)
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
    // Unsubscribe locally even if the server is unreachable, so a shared
    // device stops receiving pushes for the account that just signed out.
    try {
      if ('serviceWorker' in navigator) {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          await fetch('/api/push-subscriptions', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ endpoint: subscription.endpoint }), signal: AbortSignal.timeout(3000),
          }).catch(() => {})
          await subscription.unsubscribe()
        }
      }
    } catch { /* Signing out remains available if device cleanup fails. */ }
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  const switchTab = (tab: Tab) => {
    setActiveTab(tab)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function reviewSpendingLimit() {
    setActiveTab('overview')
    requestAnimationFrame(() => {
      const section = document.getElementById('spending-limit')
      section?.focus({ preventScroll: true })
      section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    })
  }

  return (
    <div className={styles.dashboard}>
      <SpendingAlertSync
        active={Boolean(spendingLimit?.enabled)}
        activity={JSON.stringify([expenses.map(item => [item.id, item.date, item.amount_cad]), income.map(item => [item.id, item.date, item.amount_cad]), spendingLimit])}
        signature={JSON.stringify(notifications.map(item => ({ id: item.id, is_read: item.is_read })))}
      />
      {/* Collapsed to an icon rail, widening over the content on hover — and on
          keyboard focus too, so tabbing through the nav still shows its labels.
          The page only ever reserves the collapsed width, so expanding
          overlays rather than reflowing everything. */}
      <aside
        data-notifications-open={notificationsOpen}
        className="group/rail fixed inset-y-0 left-0 z-30 hidden w-[76px] flex-col overflow-hidden bg-[#191A18] py-6 transition-[width] duration-200 ease-out hover:w-[236px] hover:shadow-[0_0_60px_rgba(0,0,0,0.45)] focus-within:w-[236px] focus-within:shadow-[0_0_60px_rgba(0,0,0,0.45)] data-[notifications-open=true]:w-[236px] data-[notifications-open=true]:shadow-[0_0_60px_rgba(0,0,0,0.45)] lg:flex"
      >
        <div className="flex items-center gap-2 px-[18px]">
          <SiteLogo size="compact" surface="dark" variant="mark" className="group-hover/rail:hidden group-focus-within/rail:hidden group-data-[notifications-open=true]/rail:hidden" />
          <div className="hidden group-hover/rail:block group-focus-within/rail:block group-data-[notifications-open=true]/rail:block">
            <SiteLogo size="compact" surface="dark" />
          </div>
        </div>

        <nav aria-label="Dashboard navigation" className="mt-12 space-y-1 px-3">
          <p className="mb-3 whitespace-nowrap px-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-white/30 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100">
            Workspace
          </p>
          {NAV_ITEMS.map(item => {
            const Icon = item.icon
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => switchTab(item.id)}
                title={item.label}
                className={`flex w-full items-center gap-3 rounded-xl px-[11px] py-3 text-left text-sm font-medium transition ${
                  active
                    ? 'bg-[#F6E7DF] text-[#472E24] shadow-sm'
                    : 'text-white/55 hover:bg-white/[0.06] hover:text-white'
                }`}
              >
                <Icon size={18} strokeWidth={active ? 2.3 : 1.8} className="shrink-0" aria-hidden="true" />
                <span className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100">
                  {item.label}
                </span>
              </button>
            )
          })}
          <NotificationsPanel
            notifications={notifications}
            onReviewSpendingLimit={reviewSpendingLimit}
            onChanged={() => router.refresh()}
            variant="rail"
            onOpenChange={setNotificationsOpen}
          />
        </nav>

        <div className="mt-auto px-[18px]">
          {profile?.university && (
            <div className="mb-4 overflow-hidden border-b border-white/10 pb-4 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100">
              <p className="whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.14em] text-white/30">Studying at</p>
              <p className="mt-1 truncate text-xs font-medium text-white/65">{profile.university}</p>
            </div>
          )}
          <div className="flex items-center gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#E98563] text-xs font-bold text-[#191919]">
              {initials}
            </div>
            <div className="min-w-0 flex-1 opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100">
              <p className="truncate text-xs font-semibold text-white">{profile?.full_name ?? 'Student'}</p>
              <p className="whitespace-nowrap text-[10px] text-white/35">Home currency · {homeCurrency}</p>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="grid size-9 shrink-0 place-items-center rounded-lg text-white/40 opacity-0 transition hover:bg-white/[0.06] hover:text-[#E98563] group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100"
            >
              <LogOut size={17} aria-hidden="true" />
            </button>
          </div>
          <a
            href="https://icons8.com"
            target="_blank"
            rel="noreferrer"
            className="mt-5 inline-block whitespace-nowrap text-[9px] text-white/20 opacity-0 transition hover:text-white/45 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100"
          >
            Action icons by Icons8
          </a>
        </div>
      </aside>

      <div className="lg:pl-[76px]">
        <header className="sticky top-0 z-10 border-b border-[#DFE0DA] bg-[#191A18] px-4 py-3 backdrop-blur-xl lg:hidden">
          <div className="flex items-center justify-between">
            <Brand />
            <div className="flex items-center gap-2">
              <NotificationsPanel notifications={notifications} onChanged={() => router.refresh()} variant="dark" onReviewSpendingLimit={reviewSpendingLimit} />
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
                  activeTab === item.id ? 'bg-[#F6E7DF] text-[#472E24] shadow-sm' : 'text-white/55'
                }`}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </header>

        <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 xl:px-10 xl:py-10">
          <div className="flex flex-col gap-6 border-b border-[#E0E2D9] pb-8 md:flex-row md:items-center md:justify-between md:gap-8">
            <div className="min-w-0">
              <p className="inline-flex items-center gap-2 rounded-full border border-[#EEDDD3] bg-[#FAEEE7] px-3 py-1.5 text-[10px] font-semibold tracking-[0.04em] text-[#AC5A3D] sm:text-[11px]">
                <CalendarDays size={13} aria-hidden="true" />
                {now.toLocaleDateString('en-CA', { weekday: 'long', month: 'long', day: 'numeric' })}
              </p>
              <h1 className="mt-4 text-[clamp(1.8rem,3.4vw,2.5rem)] font-semibold leading-tight tracking-[-0.045em] text-[#20211E]">
                Good to see you, {firstName}.
              </h1>
              <p className="mt-3 max-w-md text-[13px] leading-6 text-[#74776F]">
                Your spending, savings, and upcoming payments at a glance.
              </p>
            </div>

            {/* Even 2x2 block: every tile shares one height, radius and
                icon-plus-two-line structure, so nothing wraps raggedly.
                Primary money actions sit on top, tools underneath. */}
            <div className="grid w-full shrink-0 grid-cols-2 gap-2.5 md:w-auto md:grid-cols-[repeat(2,minmax(172px,1fr))]">
              <button
                type="button"
                onClick={() => setShowAddIncome(true)}
                className="group flex min-h-16 items-center gap-2.5 rounded-2xl border border-[#CCD8CA] bg-[#E3EDE1] px-3 text-left transition hover:-translate-y-0.5 hover:border-[#A9BDA7] sm:gap-3 sm:px-4 hover:shadow-[0_10px_30px_rgba(57,78,60,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#69876F]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#B8CEB5] transition group-hover:scale-105">
                  <Image src={ICONS8_INCOME} alt="" width={22} height={22} unoptimized />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#69806B]">Money in</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-[#27362A]">Add income</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowAddExpense(true)}
                className="group flex min-h-16 items-center gap-2.5 rounded-2xl border border-[#F0C5B5] bg-[#FFE7DE] px-3 text-left transition hover:-translate-y-0.5 hover:border-[#E6A78F] sm:gap-3 sm:px-4 hover:shadow-[0_10px_30px_rgba(118,61,40,0.10)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#D86F4E]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#F3AD92] transition group-hover:scale-105">
                  <Image src={ICONS8_EXPENSE} alt="" width={22} height={22} unoptimized />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#B76245]">Money out</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-[#492D24]">Add expense</span>
                </span>
              </button>
              <button
                type="button"
                onClick={AI_FEATURES_ENABLED ? handleGenerateInsight : undefined}
                disabled={!AI_FEATURES_ENABLED || generatingInsight}
                title={AI_FEATURES_ENABLED ? undefined : 'AI insights are coming soon'}
                className="group flex min-h-16 items-center gap-2.5 rounded-2xl border border-[#D6D8D0] bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-[#BFC2B9] sm:gap-3 sm:px-4 hover:shadow-[0_10px_30px_rgba(31,32,29,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#686B63] disabled:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-[#D6D8D0] disabled:hover:shadow-none"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EFF0EB] text-[#5C5F57] transition group-hover:scale-105">
                  <Sparkles size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8D84]">
                    {AI_FEATURES_ENABLED ? 'This week' : 'Coming soon'}
                  </span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-[#242522]">{AI_FEATURES_ENABLED && generatingInsight ? 'Thinking…' : 'AI insight'}</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => setShowStatement(true)}
                className="group flex min-h-16 items-center gap-2.5 rounded-2xl border border-[#D6D8D0] bg-white px-3 text-left transition hover:-translate-y-0.5 hover:border-[#BFC2B9] sm:gap-3 sm:px-4 hover:shadow-[0_10px_30px_rgba(31,32,29,0.07)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#686B63]"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EFF0EB] text-[#5C5F57] transition group-hover:scale-105">
                  <Printer size={18} strokeWidth={1.8} aria-hidden="true" />
                </span>
                <span className="min-w-0">
                  <span className="block text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8A8D84]">Export</span>
                  <span className="mt-0.5 block truncate text-sm font-semibold text-[#242522]">Statement</span>
                </span>
              </button>
            </div>
          </div>

          {activePayday && (
            <section
              aria-label="Payday check-in"
              className="mt-6 rounded-2xl border border-[#CCD8CA] bg-[#E3EDE1] p-5 sm:p-6"
            >
              <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3.5">
                  <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#B8CEB5] text-[#27362A]">
                    <CalendarClock size={19} aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#69806B]">
                      Payday check-in
                    </p>
                    <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[#27362A]">
                      How much were you paid on {formatDate(activePayday.dueDate, true)}?
                    </p>
                    <p className="mt-1 text-xs leading-5 text-[#5F7361]">
                      {activePayday.source} is set to repeat {activePayday.cycle} and normally comes in at{' '}
                      <span className="font-semibold">{formatCAD(activePayday.expectedAmount)}</span>. Confirm the
                      amount so it counts toward this month.
                    </p>
                    {paydayError && (
                      <p className="mt-2 text-xs font-medium text-[#B9573A]">{paydayError}</p>
                    )}
                  </div>
                </div>

                {editingPayday ? (
                  <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                    <div className="relative">
                      <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#6E7D6F]">
                        $
                      </span>
                      <input
                        type="number"
                        inputMode="decimal"
                        step="0.01"
                        autoFocus
                        aria-label="Amount you were paid"
                        value={paydayAmount}
                        onChange={event => setPaydayAmount(event.target.value)}
                        className="w-full rounded-xl border border-[#B8CEB5] bg-white py-3 pl-8 pr-3 text-[15px] font-semibold text-[#27362A] outline-none transition focus:border-[#829A83] focus:ring-4 focus:ring-[#829A83]/15 sm:w-[150px]"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => confirmPayday(activePayday, Number(paydayAmount))}
                        disabled={savingPayday}
                        className="rounded-xl bg-[#28352A] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637] disabled:translate-y-0 disabled:opacity-50"
                      >
                        {savingPayday ? 'Saving…' : 'Log payment'}
                      </button>
                      <button
                        type="button"
                        onClick={() => { setEditingPayday(false); setPaydayError('') }}
                        className="text-[13px] font-semibold text-[#5F7361] transition hover:text-[#27362A]"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex shrink-0 flex-wrap items-center gap-3">
                    <button
                      type="button"
                      onClick={() => confirmPayday(activePayday, activePayday.expectedAmount)}
                      disabled={savingPayday}
                      className="rounded-xl bg-[#28352A] px-5 py-3 text-[13px] font-semibold text-white shadow-[0_8px_20px_rgba(40,53,42,0.16)] transition hover:-translate-y-0.5 hover:bg-[#344637] disabled:translate-y-0 disabled:opacity-50"
                    >
                      {savingPayday ? 'Saving…' : `Yes, log ${formatCAD(activePayday.expectedAmount)}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPaydayAmount(activePayday.expectedAmount.toFixed(2))
                        setEditingPayday(true)
                        setPaydayError('')
                      }}
                      className="rounded-xl border border-[#B8CEB5] bg-white px-5 py-3 text-[13px] font-semibold text-[#3F6548] transition hover:-translate-y-0.5 hover:border-[#93AD91]"
                    >
                      It was a different amount
                    </button>
                    <button
                      type="button"
                      onClick={() => skipPayday(activePayday)}
                      className="px-1 text-[13px] font-semibold text-[#5F7361] transition hover:text-[#27362A]"
                    >
                      Not paid
                    </button>
                  </div>
                )}
              </div>

              {duePaydays.length > 1 && (
                <p className="mt-4 border-t border-[#CCD8CA] pt-3 text-[11px] text-[#5F7361]">
                  {duePaydays.length - 1} earlier payday{duePaydays.length - 1 === 1 ? '' : 's'} still to confirm after this one.
                </p>
              )}
            </section>
          )}

          <BankSyncPanel expenses={expenses} income={income} />

          {insightError && (
            <div className="mt-4 rounded-xl bg-[#FFF0EA] px-4 py-3 text-[13px] font-medium text-[#B9573A]">{insightError}</div>
          )}

          {activeTab === 'overview' && (
            <div className="mt-7 space-y-6">
              {/* Step back through closed months instead of the dashboard
                  resetting to zero every 1st. */}
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex gap-1 rounded-xl border border-[#E0E2D9] bg-[#ECEDE6] p-1" role="group" aria-label="Summary scope">
                  {([
                    { id: 'running', label: 'Running total' },
                    { id: 'month', label: 'By month' },
                  ] as const).map(option => (
                    <button
                      key={option.id}
                      type="button"
                      aria-pressed={summaryScope === option.id}
                      onClick={() => setSummaryScope(option.id)}
                      className={`whitespace-nowrap rounded-lg px-3 py-2 text-[11px] font-semibold transition ${
                        summaryScope === option.id
                          ? 'bg-white text-[#242522] shadow-sm'
                          : 'text-[#74776F] hover:text-[#242522]'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {showingRunning ? (
                  <p aria-live="polite" className="text-xs leading-5 text-[#74776F]">
                    All your activity, carried forward.
                  </p>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={() => setMonthOffset(offset => offset - 1)}
                      disabled={!canGoBackAMonth}
                      aria-label="Previous month"
                      className="grid size-9 place-items-center rounded-xl border border-[#DFE0DA] bg-white text-[#5C5F57] transition hover:border-[#BFC2B9] hover:text-[#242522] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronLeft size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setMonthOffset(offset => Math.min(0, offset + 1))}
                      disabled={viewingCurrentMonth}
                      aria-label="Next month"
                      className="grid size-9 place-items-center rounded-xl border border-[#DFE0DA] bg-white text-[#5C5F57] transition hover:border-[#BFC2B9] hover:text-[#242522] disabled:cursor-not-allowed disabled:opacity-35"
                    >
                      <ChevronRight size={16} aria-hidden="true" />
                    </button>
                    <p aria-live="polite" className="text-sm font-semibold tracking-[-0.01em] text-[#242522]">
                      {viewedMonthLabel}
                    </p>
                    {!viewingCurrentMonth && (
                      <button
                        type="button"
                        onClick={() => setMonthOffset(0)}
                        className="ml-auto rounded-lg px-3 py-1.5 text-xs font-semibold text-[#C96042] transition hover:bg-[#FFF0EA]"
                      >
                        Back to this month
                      </button>
                    )}
                  </>
                )}
              </div>

              <section aria-label={showingRunning ? 'Running summary' : 'Monthly summary'} className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5 xl:gap-4">
                <div className={`${styles.summaryCard} ${styles.runwayCard}`}>
                  <div aria-hidden="true" className="pointer-events-none absolute -bottom-12 -right-10 size-36 rounded-full border-[22px] border-white/[0.035]" />
                  <div className={styles.summaryHeader}>
                    <p className={styles.summaryLabel}>Budget runway</p>
                    <span className={styles.summaryIcon}><WalletCards size={16} className="text-[#E98563]" aria-hidden="true" /></span>
                  </div>
                  <p className={styles.summaryValue}>
                    {runway ?? '—'} <span className="text-sm font-medium tracking-normal text-white/60">days</span>
                  </p>
                  <p className={styles.summaryNote}>At your current spending rate</p>
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    <p className={styles.summaryLabel}>{showingRunning ? 'Spent in total' : `Spent ${monthWord}`}</p>
                    <span className={styles.summaryIcon}><ReceiptText size={16} className="text-[#D86F4E]" aria-hidden="true" /></span>
                  </div>
                  <p className={styles.summaryValue}>{formatCAD(spentFigure)}</p>
                  <p className={styles.summaryNote}>
                    {showingRunning
                      ? `${formatCAD(totalSpentThisMonth)} of it ${viewingCurrentMonth ? 'this month' : monthWord}`
                      : `${monthExpenses.length} transactions`}
                  </p>
                </div>

                <div ref={incomeCardRef} className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    <p className={styles.summaryLabel}>{showingRunning ? 'Earned in total' : `Income ${monthWord}`}</p>
                    <span className={styles.summaryIcon}><TrendingUp size={16} className="text-[#58755F]" aria-hidden="true" /></span>
                  </div>
                  <p className={styles.summaryValue}>{formatCAD(earnedFigure)}</p>
                  <p className={styles.summaryNote}>
                    {showingRunning
                      ? `${formatCAD(totalIncomeThisMonth)} of it ${viewingCurrentMonth ? 'this month' : monthWord}`
                      : `${income.filter(item => item.is_recurring).length} recurring sources`}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIncomeBreakdownOpen(value => !value)}
                    aria-expanded={incomeBreakdownOpen}
                    className="mt-1.5 text-[10px] font-semibold text-[#58755F] underline underline-offset-2 transition hover:text-[#3F6548] sm:text-[11px]"
                  >
                    {incomeBreakdownOpen ? 'Hide entries' : 'View or edit entries'}
                  </button>

                  {incomeBreakdownOpen && (
                    <div className="absolute left-1/2 top-full z-30 mt-2 w-[290px] max-w-[85vw] -translate-x-1/2 rounded-2xl border border-[#DFE0DA] bg-white p-4 text-left shadow-[0_20px_60px_rgba(16,17,14,0.18)]">
                      <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#74776F]">This month&apos;s income</p>

                      {thisMonthIncome.length > 0 ? (
                        <div className="mt-2 space-y-1">
                          {thisMonthIncome.map(item => (
                            <button
                              type="button"
                              key={item.id}
                              onClick={() => { setIncomeBreakdownOpen(false); openEditIncome(item) }}
                              className="group/row -mx-2 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-[#F1F4F0]"
                            >
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-[11px] font-medium text-[#343630]">{item.source}</p>
                                <p className="text-[10px] text-[#91948C]">{formatDate(item.date, true)}</p>
                              </div>
                              <Pencil size={11} className="shrink-0 text-[#C4C6BF] transition group-hover/row:text-[#58755F]" aria-hidden="true" />
                              <span className="shrink-0 text-[11px] font-semibold text-[#4E7558]">+{formatCAD(item.amount_cad)}</span>
                            </button>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] leading-4 text-[#85887F]">No income logged yet this month.</p>
                      )}

                      <button
                        type="button"
                        onClick={() => { setIncomeBreakdownOpen(false); setEditingIncome(null); setShowAddIncome(true) }}
                        className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-xl bg-[#F1F4F0] px-3 py-2.5 text-[11px] font-semibold text-[#3F6548] transition hover:bg-[#E7EDE6]"
                      >
                        <Plus size={12} aria-hidden="true" /> Add income
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.summaryCard}>
                  <div className={styles.summaryHeader}>
                    <p className={styles.summaryLabel}>{showingRunning ? 'Balance left' : `Left ${monthWord}`}</p>
                    <span className={styles.summaryIcon}><Wallet size={16} className={leftFigure >= 0 ? 'text-[#58755F]' : 'text-[#D86F4E]'} aria-hidden="true" /></span>
                  </div>
                  <p className={`${styles.summaryValue} ${leftFigure >= 0 ? 'text-[#242522]' : 'text-[#C85F40]'}`}>
                    {formatCAD(leftFigure)}
                  </p>
                  <p className={styles.summaryNote}>
                    {showingRunning
                      ? 'Everything earned minus everything spent'
                      : `${formatCAD(balanceBroughtForward)} carried in${amountLeftThisMonth >= 0 ? '' : ' · spending outpaced income'}`}
                  </p>
                </div>

                <div ref={savingsCardRef} className={`${styles.summaryCard} ${savingsPotential >= 0 ? styles.savingsCard : ''}`}>
                  <div className={styles.summaryHeader}>
                    <p className={styles.summaryLabel}>Savings potential</p>
                    <span className={styles.summaryIcon}><PiggyBank size={16} className={savingsPotential >= 0 ? 'text-[#58755F]' : 'text-[#D86F4E]'} aria-hidden="true" /></span>
                  </div>
                  <p className={`${styles.summaryValue} ${savingsPotential >= 0 ? 'text-[#3F6548]' : 'text-[#C85F40]'}`}>
                    {formatCAD(savingsPotential)}
                  </p>
                  <p className={styles.summaryNote}>{savingsPotential >= 0 ? 'Your average income minus average spending' : 'Spending is above your average income'}</p>
                  <button
                    type="button"
                    onClick={() => setSavingsBreakdownOpen(value => !value)}
                    aria-expanded={savingsBreakdownOpen}
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
                            Set this aside each week and you&apos;ll bank about {formatCAD(savingsPotential)} in a typical month.
                          </p>
                        </>
                      ) : (
                        <p className="text-[11px] leading-4 text-[#85887F]">
                          Your average spending has been outpacing your average income, so there&apos;s no savings room right now. Trimming the categories below is the fastest way to change that.
                        </p>
                      )}

                      <div className="mt-3 space-y-1 border-t border-[#EAEBE6] pt-3 text-[11px] text-[#5F625B]">
                        <p className="mb-1.5 text-[10px] text-[#91948C]">
                          Averaged over {monthlyAverages.months} month{monthlyAverages.months === 1 ? '' : 's'} of your
                          actual activity.
                        </p>
                        <div className="flex items-center justify-between">
                          <span>Average income</span>
                          <span className="font-medium text-[#242522]">{formatCAD(avgMonthlyIncome)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>Average spending</span>
                          <span className="font-medium text-[#242522]">−{formatCAD(avgMonthlySpend)}</span>
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

              <SpendingLimitCard
                key={JSON.stringify(spendingLimit)}
                settings={spendingLimit}
                expenses={expenses}
                income={income}
                onSaved={() => router.refresh()}
              />

              <section className="grid gap-6 xl:grid-cols-[minmax(0,1.55fr)_minmax(340px,0.85fr)]">
                <FinancialChart
                  expenses={expenses}
                  income={income}
                  scope={summaryScope}
                  month={viewedMonth}
                  onAddExpense={() => setShowAddExpense(true)}
                  onAddIncome={() => setShowAddIncome(true)}
                />

                <div className={`${styles.panel} p-5 sm:p-6`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Monthly budgets</h2>
                      <p className="mt-1 text-xs text-[#85887F]">{viewingCurrentMonth ? 'Keep each category on track' : `Limits set for ${viewedMonthLabel}`}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setShowAddBudget(true)}
                      className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-[#FFF1E9] px-2.5 py-2 text-xs font-semibold text-[#B85D3F] transition hover:bg-[#FBE5D8]"
                    >
                      <Plus size={13} aria-hidden="true" />
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
                            className="group block w-full rounded-xl px-2 py-1 text-left transition hover:bg-[#F7F8F3]"
                          >
                            <div className="mb-2 flex flex-wrap items-center gap-2">
                              <Icon size={15} className={over ? 'text-[#D86F4E]' : 'text-[#667169]'} />
                              <span className="text-xs font-semibold text-[#41443E]">{budget.category}</span>
                              <Pencil size={12} className="text-[#C4C6BF] transition group-hover:text-[#85887F]" aria-hidden="true" />
                              <span className={`ml-auto text-[11px] font-medium ${over ? 'text-[#C96042]' : 'text-[#74776F]'}`}>
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

              <section className={`${styles.panel} overflow-hidden`}>
                <div className={styles.sectionHeader}>
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
                        <div key={payment.id} className="grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 py-4 sm:flex sm:gap-4">
                          <div className={`row-span-2 grid size-10 shrink-0 place-items-center rounded-xl sm:row-span-1 ${urgent ? 'bg-[#FFE7DE] text-[#C96042]' : 'bg-[#FFF0EA] text-[#D86F4E]'}`}>
                            <Icon size={18} strokeWidth={2} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-semibold text-[#343630]">{payment.note ?? payment.category}</p>
                            <p className="mt-0.5 text-[11px] text-[#91948C]">{payment.category} · {formatDate(payment.nextDue.toISOString())}</p>
                          </div>
                          <span className={`col-start-2 row-start-2 w-fit shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold sm:text-[11px] ${urgent ? 'bg-[#FFE7DE] text-[#C96042]' : 'bg-[#F0F1EC] text-[#666A62]'}`}>
                            {payment.daysUntil === 0 ? 'Due today' : payment.daysUntil === 1 ? 'Due tomorrow' : `In ${payment.daysUntil} days`}
                          </span>
                          <span className="col-start-3 row-start-1 shrink-0 text-sm font-semibold text-[#343630]">{formatCAD(payment.amount_cad)}</span>
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

              <section className={`${styles.panel} overflow-hidden`}>
                <div className={styles.sectionHeader}>
                  <div>
                    <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">Savings goals</h2>
                    <p className="mt-1 text-xs text-[#85887F]">Give a purpose to what you set aside</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-4">
                    <button
                      type="button"
                      onClick={AI_FEATURES_ENABLED ? handleSuggestGoal : undefined}
                      disabled={!AI_FEATURES_ENABLED || suggestingGoal}
                      title={AI_FEATURES_ENABLED ? undefined : 'AI goal suggestions are coming soon'}
                      className="flex items-center gap-1 text-xs font-semibold text-[#58755F] transition hover:text-[#3F6548] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <Sparkles size={13} aria-hidden="true" />
                      {!AI_FEATURES_ENABLED ? 'Suggest with AI · Soon' : suggestingGoal ? 'Thinking…' : 'Suggest with AI'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setFundingGoal(null); setGoalSuggestion(null); setGoalModalOpen(true) }}
                      className="inline-flex items-center gap-1 rounded-lg bg-[#FFF1E9] px-2.5 py-2 text-xs font-semibold text-[#B85D3F] transition hover:bg-[#FBE5D8]"
                    >
                      <Plus size={13} aria-hidden="true" />
                      New goal
                    </button>
                  </div>
                </div>

                {goalSuggestionError && (
                  <p className="border-b border-[#EAEBE6] px-5 py-3 text-[12px] font-medium text-[#B9573A] sm:px-6">{goalSuggestionError}</p>
                )}

                {savingsGoals.length > 0 ? (
                  <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                    {savingsGoals.map(goal => {
                      const percentage = goal.target_amount_cad > 0
                        ? Math.min(100, Math.round((goal.current_amount_cad / goal.target_amount_cad) * 100))
                        : 0
                      const reached = goal.current_amount_cad >= goal.target_amount_cad
                      const remaining = Math.max(0, goal.target_amount_cad - goal.current_amount_cad)
                      const monthsRemaining = goal.target_date
                        ? Math.max((parseLocalDate(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 1 / 30.44)
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
                                <p className="flex flex-wrap items-center gap-2 text-sm font-semibold text-[#343630]">
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
                    <div className="mt-4 flex flex-wrap justify-center gap-4">
                      <button
                        type="button"
                        onClick={() => { setFundingGoal(null); setGoalSuggestion(null); setGoalModalOpen(true) }}
                        className="text-xs font-semibold text-[#C96042] hover:underline"
                      >
                        Set a goal
                      </button>
                      <button
                        type="button"
                        onClick={AI_FEATURES_ENABLED ? handleSuggestGoal : undefined}
                        disabled={!AI_FEATURES_ENABLED || suggestingGoal}
                        title={AI_FEATURES_ENABLED ? undefined : 'AI goal suggestions are coming soon'}
                        className="flex items-center gap-1 text-xs font-semibold text-[#58755F] hover:underline disabled:cursor-not-allowed disabled:no-underline disabled:opacity-50"
                      >
                        <Sparkles size={13} aria-hidden="true" />
                        {!AI_FEATURES_ENABLED ? 'Suggest with AI · Soon' : suggestingGoal ? 'Thinking…' : 'Suggest with AI'}
                      </button>
                    </div>
                  </div>
                )}
              </section>

              <section className={`${styles.panel} overflow-hidden`}>
                <div className={styles.sectionHeader}>
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
                        className="group flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F8F3] sm:gap-4"
                      >
                        {item.type === 'expense' ? (
                          <CategoryIcon category={item.category} />
                        ) : (
                          <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2E9] text-[#58755F]">
                            <TrendingUp size={18} strokeWidth={2} />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center truncate text-sm font-semibold text-[#343630]">
                            <span className="truncate">{item.title}</span>
                            {isRecentlyAdded(item.createdAt, now) && (
                              <span className="ml-2 rounded-full bg-[#EAF2E9] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#3F6548]">Just added</span>
                            )}
                          </p>
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
            <section className={`${styles.panel} mt-7 overflow-hidden`}>
              <div className={styles.sectionHeader}>
                <div>
                  <h2 className="text-base font-semibold text-[#242522]">All expenses</h2>
                  <p className="mt-1 text-xs text-[#85887F]">{expenses.length} recorded transactions</p>
                </div>
                <div className="flex items-center gap-4">
                  <button
                    type="button"
                    onClick={AI_FEATURES_ENABLED ? handleGetSavingsTips : undefined}
                    disabled={!AI_FEATURES_ENABLED || loadingTips}
                    title={AI_FEATURES_ENABLED ? undefined : 'AI savings tips are coming soon'}
                    className="flex items-center gap-1 text-xs font-semibold text-[#58755F] transition hover:text-[#3F6548] disabled:opacity-50"
                  >
                    <Sparkles size={13} aria-hidden="true" />
                    {!AI_FEATURES_ENABLED ? 'Savings tips · Soon' : loadingTips ? 'Thinking…' : 'Get savings tips'}
                  </button>
                  <p className="text-sm font-semibold text-[#C96042]">{formatCAD(expenses.reduce((total, item) => total + item.amount_cad, 0))}</p>
                </div>
              </div>

              {tipsError && (
                <p className="border-b border-[#EAEBE6] px-5 py-3 text-[12px] font-medium text-[#B9573A] sm:px-6">{tipsError}</p>
              )}

              {savingsTips && savingsTips.length > 0 && (
                <div className="space-y-3 border-b border-[#EAEBE6] bg-[#F7FAF6] px-5 py-5 sm:px-6">
                  <div className="flex items-center justify-between">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#58755F]">
                      <Sparkles size={13} aria-hidden="true" /> Savings tips
                    </p>
                    <button type="button" onClick={() => setSavingsTips(null)} className="text-[11px] font-semibold text-[#85887F] transition hover:text-[#242522]">
                      Dismiss
                    </button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {savingsTips.map((tip, index) => {
                      const Icon = tip.category ? (CATEGORY_ICONS[tip.category] ?? CreditCard) : Sparkles
                      return (
                        <div key={index} className="rounded-2xl border border-[#DCE6DB] bg-white p-4">
                          <div className="flex items-center gap-2">
                            <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-[#EAF2E9] text-[#58755F]">
                              <Icon size={13} aria-hidden="true" />
                            </span>
                            <p className="text-[12px] font-semibold text-[#343630]">{tip.title}</p>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-[#5F625B]">{tip.body}</p>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {expenses.length > 0 ? (
                <div className="divide-y divide-[#EEEFEA] px-5 sm:px-6">
                  {expenses.map(expense => (
                    <button
                      type="button"
                      key={expense.id}
                      onClick={() => openEditExpense(expense)}
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F8F3] sm:gap-4"
                    >
                      <CategoryIcon category={expense.category} />
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center truncate text-sm font-semibold text-[#343630]">
                          <span className="truncate">{expense.note ?? expense.category}</span>
                          {isRecentlyAdded(expense.created_at, now) && (
                              <span className="ml-2 rounded-full bg-[#EAF2E9] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#3F6548]">Just added</span>
                            )}
                        </p>
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
            <section className={`${styles.panel} mt-7 overflow-hidden`}>
              <div className={styles.sectionHeader}>
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
                      className="group flex w-full items-center gap-3 rounded-xl px-2 py-4 text-left transition hover:bg-[#F7F8F3] sm:gap-4"
                    >
                      <div className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#EAF2E9] text-[#58755F]">
                        <TrendingUp size={18} strokeWidth={2} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="flex items-center truncate text-sm font-semibold text-[#343630]">
                          <span className="truncate">{item.source}</span>
                          {isRecentlyAdded(item.created_at, now) && (
                              <span className="ml-2 rounded-full bg-[#EAF2E9] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.08em] text-[#3F6548]">Just added</span>
                            )}
                        </p>
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
          suggestion={fundingGoal ? null : goalSuggestion}
          onClose={() => { setGoalModalOpen(false); setGoalSuggestion(null) }}
          onSaved={handleEntrySaved}
        />
      )}
    </div>
  )
}
