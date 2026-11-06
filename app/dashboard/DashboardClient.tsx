'use client'

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  ArrowDownLeft,
  ArrowUpRight,
  BusFront,
  CalendarClock,
  ChartColumn,
  ChevronDown,
  ChevronRight,
  CircleAlert,
  Clapperboard,
  CreditCard,
  GraduationCap,
  Home,
  House,
  LogOut,
  Settings,
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
  X,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { createClient } from '@/lib/supabase/client'
import SiteLogo from '@/components/SiteLogo'
import AddBudgetModal from './AddBudgetModal'
import AddExpenseModal from './AddExpenseModal'
import AddIncomeModal from './AddIncomeModal'
import AddSavingsGoalModal from './AddSavingsGoalModal'
import BankSyncPanel from './BankSyncPanel'
import NotificationsPanel from './NotificationsPanel'
import StatementModal from './StatementModal'
import SpendingBreakdownModal from './SpendingBreakdownModal'
import FinancialChart from './FinancialChart'
import SpendingLimitCard from './SpendingLimitCard'
import SpendingAlertSync from './SpendingAlertSync'
import type { SpendingLimitSettings } from '@/lib/spending-limits'
import styles from './dashboard.module.css'
import SettingsPanel from './SettingsPanel'
import AnimatedMoney from './AnimatedMoney'
import MonthPicker, { monthKey as pickerMonthKey } from './MonthPicker'
import { budgetsInForce, setBudgetForMonth } from '@/lib/budgets'
import { categoryColor } from './chart-data'

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
  // Set on charges logged automatically from a recurring expense.
  recurring_source_id?: string | null
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
  email: string
  profile: Profile | null
  expenses: Expense[]
  income: Income[]
  budgets: Budget[]
  notifications: Notification[]
  savingsGoals: SavingsGoal[]
  spendingLimit: SpendingLimitSettings | null
}

type Tab = 'home' | 'report' | 'plan' | 'settings'

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
  { id: 'home', label: 'Home', icon: House },
  { id: 'report', label: 'Report', icon: ChartColumn },
  { id: 'plan', label: 'Plan', icon: Target },
  { id: 'settings', label: 'Settings', icon: Settings },
]

const CYCLE_MULTIPLIER: Record<string, number> = {
  weekly: 52 / 12,
  biweekly: 26 / 12,
  monthly: 1,
  yearly: 1 / 12,
}


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

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

interface MonthGroup<T> {
  key: string
  label: string
  entries: T[]
  // Totals skip anything dated after today, matching the overview: a bill
  // logged ahead of time hasn't left your account yet.
  total: number
  upcoming: Set<string>
}

// Newest month first, newest entry first within each month.
function groupByMonth<T extends { id: string; date: string; amount_cad: number }>(entries: T[]): MonthGroup<T>[] {
  const cutoff = endOfToday()
  const groups = new Map<string, MonthGroup<T>>()
  const sorted = [...entries].sort((a, b) => parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime())
  for (const entry of sorted) {
    const date = parseLocalDate(entry.date)
    const key = monthKey(date)
    let group = groups.get(key)
    if (!group) {
      group = {
        key,
        label: date.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' }),
        entries: [],
        total: 0,
        upcoming: new Set(),
      }
      groups.set(key, group)
    }
    group.entries.push(entry)
    if (date > cutoff) group.upcoming.add(entry.id)
    else group.total += entry.amount_cad
  }
  return [...groups.values()]
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

// Tinted with the category's chart colour, so a list scans by category.
function CategoryIcon({ category, small = false }: { category: string; small?: boolean }) {
  const Icon = CATEGORY_ICONS[category] ?? CreditCard
  const color = categoryColor(category)
  return (
    <div
      className={`grid shrink-0 place-items-center rounded-2xl ${small ? 'size-9' : 'size-11'}`}
      style={{ backgroundColor: `color-mix(in srgb, ${color} 13%, white)`, color }}
    >
      <Icon size={small ? 16 : 18} strokeWidth={2} aria-hidden="true" />
    </div>
  )
}

function IncomeIcon({ small = false }: { small?: boolean }) {
  return (
    <div className={`grid shrink-0 place-items-center rounded-2xl bg-[#E6F6EC] text-[#1C8F4E] ${small ? 'size-9' : 'size-11'}`}>
      <ArrowDownLeft size={small ? 16 : 18} strokeWidth={2.2} aria-hidden="true" />
    </div>
  )
}

function SectionTitle({ title, action, id }: { title: string; action?: ReactNode; id?: string }) {
  return (
    <div className="mb-3 flex items-center justify-between gap-3 px-1">
      <h2 id={id} className="text-[15px] font-semibold tracking-[-0.01em] text-[#16161D]">{title}</h2>
      {action}
    </div>
  )
}

function TextAction({ children, onClick, disabled, title }: { children: ReactNode; onClick?: () => void; disabled?: boolean; title?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="tap-target flex items-center gap-1 text-xs font-semibold text-[#8B8B9A] transition hover:text-[#16161D] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {children}
    </button>
  )
}

// Circular progress, as used for budgets.
function ProgressRing({ value, color, size = 54 }: { value: number; color: string; size?: number }) {
  const stroke = 4
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className="relative grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius - stroke} fill={`color-mix(in srgb, ${color} 10%, white)`} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={`color-mix(in srgb, ${color} 18%, white)`} strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
        />
      </svg>
      <span className="absolute text-[11px] font-semibold" style={{ color }}>{Math.round(value)}%</span>
    </div>
  )
}

// Change against the previous month. For spending, going up is the bad direction.
function DeltaChip({ current, previous, upIsGood }: { current: number; previous: number; upIsGood: boolean }) {
  if (previous <= 0) {
    return current > 0 ? <span className="rounded-full bg-[#F4F2FD] px-2 py-0.5 text-[10px] font-semibold text-[#6243EE]">New</span> : null
  }
  const change = ((current - previous) / previous) * 100
  const up = change >= 0
  const good = up === upIsGood
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${good ? 'bg-[#E6F6EC] text-[#1C8F4E]' : 'bg-[#FDECEC] text-[#D93F3F]'}`}>
      {up ? '+' : '−'}{Math.abs(Math.round(change))}%
    </span>
  )
}

function EmptyState({ type, onAction }: { type: 'expense' | 'income'; onAction: () => void }) {
  const isExpense = type === 'expense'
  return (
    <div className="flex min-h-56 flex-col items-center justify-center px-5 py-8 text-center">
      <div className={`mb-4 grid size-12 place-items-center rounded-2xl ${isExpense ? 'bg-[#FDECEC] text-[#E5484D]' : 'bg-[#E6F6EC] text-[#1C8F4E]'}`}>
        {isExpense ? <ReceiptText size={22} aria-hidden="true" /> : <TrendingUp size={22} aria-hidden="true" />}
      </div>
      <h3 className="text-sm font-semibold text-[#16161D]">No {type} added yet</h3>
      <p className="mt-1 max-w-xs text-xs leading-5 text-[#8B8B9A]">
        Add your first {type} to start seeing your money take shape here.
      </p>
      <button
        type="button"
        onClick={onAction}
        className="mt-5 rounded-full bg-[#7C5CFA] px-5 py-2.5 text-xs font-semibold text-white transition hover:bg-[#6A48F5]"
      >
        Add {type}
      </button>
    </div>
  )
}

export default function DashboardClient({ userId, email, profile, expenses, income, budgets, notifications, savingsGoals, spendingLimit }: Props) {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<Tab>('home')
  const [reportKind, setReportKind] = useState<'expense' | 'income'>('expense')
  const [quickAddOpen, setQuickAddOpen] = useState(false)
    const [showAddExpense, setShowAddExpense] = useState(false)
  const [showAddIncome, setShowAddIncome] = useState(false)
  const [showAddBudget, setShowAddBudget] = useState(false)
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [editingIncome, setEditingIncome] = useState<Income | null>(null)
  const [editingBudgetCategory, setEditingBudgetCategory] = useState<string | null>(null)
  const [showStatement, setShowStatement] = useState(false)
  const [showSpendingBreakdown, setShowSpendingBreakdown] = useState(false)
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

  // The Expenses and Income tabs follow the same scope as the overview: every
  // month stacked newest-first, or only the month on screen.
  const expenseGroups = useMemo(() => {
    const groups = groupByMonth(expenses)
    return showingRunning ? groups : groups.filter(group => group.key === monthKey(viewedMonth))
  }, [expenses, showingRunning, viewedMonth])
  const incomeGroups = useMemo(() => {
    const groups = groupByMonth(income)
    return showingRunning ? groups : groups.filter(group => group.key === monthKey(viewedMonth))
  }, [income, showingRunning, viewedMonth])
  const listedExpenseCount = expenseGroups.reduce((count, group) => count + group.entries.length, 0)
  const listedExpenseTotal = expenseGroups.reduce((total, group) => total + group.total, 0)
  const listedIncomeCount = incomeGroups.reduce((count, group) => count + group.entries.length, 0)
  const listedIncomeTotal = incomeGroups.reduce((total, group) => total + group.total, 0)

  // Shared by the overview, Expenses and Income tabs so picking a month in one
  // carries over to the others.
  const [monthPickerOpen, setMonthPickerOpen] = useState(false)
  const closeMonthPicker = useCallback(() => setMonthPickerOpen(false), [])
  const activeMonths = useMemo(() => {
    const keys = new Set<string>()
    for (const entry of [...expenses, ...income]) {
      const date = parseLocalDate(entry.date)
      keys.add(pickerMonthKey(date.getFullYear(), date.getMonth()))
    }
    return keys
  }, [expenses, income])
  function selectMonth(month: Date) {
    const today = new Date()
    setMonthOffset((month.getFullYear() - today.getFullYear()) * 12 + (month.getMonth() - today.getMonth()))
    setSummaryScope('month')
    setMonthPickerOpen(false)
  }

  function selectAllTime() {
    setMonthOffset(0)
    setSummaryScope('running')
    setMonthPickerOpen(false)
  }

  // The period selector: a pill that opens the month picker, with "All time"
  // as the first choice. Shared by every tab so the period follows you.
  function renderPeriodPill(tone: 'glass' | 'light', align: 'left' | 'center' | 'right' = 'right') {
    return (
      <div className="relative">
        <button
          type="button"
          onClick={() => setMonthPickerOpen(open => !open)}
          aria-expanded={monthPickerOpen}
          aria-haspopup="dialog"
          aria-label={`Period: ${showingRunning ? 'All time' : viewedMonthLabel}. Change period`}
          className={`flex h-10 items-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition ${
            tone === 'glass'
              ? 'bg-white/20 text-white ring-1 ring-white/30 backdrop-blur hover:bg-white/30'
              : 'border border-[#ECECF2] bg-white text-[#16161D] hover:bg-[#F6F5FB]'
          }`}
        >
          {showingRunning ? 'All time' : viewedMonthLabel}
          <ChevronDown size={15} className={`transition ${monthPickerOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
        </button>
        {monthPickerOpen && (
          <MonthPicker
            value={viewedMonth}
            min={earliestMonth}
            max={startOfMonth(new Date())}
            activeMonths={activeMonths}
            onSelect={selectMonth}
            onSelectAll={selectAllTime}
            allSelected={showingRunning}
            onClose={closeMonthPicker}
            align={align}
          />
        )}
      </div>
    )
  }

  const spentFigure = showingRunning ? runningTotals.spent : totalSpentThisMonth
  const earnedFigure = showingRunning ? runningTotals.earned : totalIncomeThisMonth
  // In the month view the balance still includes everything carried in from
  // earlier months; only spent/earned are limited to the month itself.
  const leftFigure = showingRunning ? runningTotals.balance : balanceBroughtForward + amountLeftThisMonth
  const spentShare = earnedFigure > 0 ? (spentFigure / earnedFigure) * 100 : 0
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
  const now = new Date()
  // Budgets follow whichever month is on screen, so browsing back shows the
  // limits that were in force then. A limit carries into every later month
  // until it's changed (lib/budgets.ts); spending against it resets monthly.
  // Notifications below deliberately stay on the real current month.
  const currentMonth = viewedMonth.getMonth() + 1
  const currentYear = viewedMonth.getFullYear()
  const currentBudgets = useMemo(
    () => budgetsInForce(budgets, currentMonth, currentYear),
    [budgets, currentMonth, currentYear],
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
  // Home transactions: every entry in the selected period up to today,
  // grouped by day, newest first.
  const dayGroups = useMemo(() => {
    const cutoff = endOfToday()
    const inScope = (date: Date) =>
      date <= cutoff &&
      (showingRunning || (date.getMonth() === viewedMonth.getMonth() && date.getFullYear() === viewedMonth.getFullYear()))
    const items = [
      ...expenses.map(item => ({
        id: `expense-${item.id}`,
        rawId: item.id,
        type: 'expense' as const,
        title: item.note ?? item.category,
        category: item.category,
        amount: item.amount_cad,
        date: item.date,
        createdAt: item.created_at ?? null,
        tag: item.recurring_source_id ? 'Auto-renewed' : item.is_recurring ? 'Recurring' : item.split_count ? `Split ${item.split_count} ways` : null,
        original: item.original_amount && item.original_currency ? `${item.original_currency} ${item.original_amount}` : null,
      })),
      ...income.map(item => ({
        id: `income-${item.id}`,
        rawId: item.id,
        type: 'income' as const,
        title: item.source,
        category: 'Income',
        amount: item.amount_cad,
        date: item.date,
        createdAt: item.created_at ?? null,
        tag: item.is_recurring ? `Recurring · ${item.recur_cycle}` : null,
        original: item.original_amount && item.original_currency ? `${item.original_currency} ${item.original_amount}` : null,
      })),
    ]
      .filter(item => inScope(parseLocalDate(item.date)))
      .sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt ?? '').localeCompare(a.createdAt ?? ''))

    const shown = items.slice(0, 12)
    const groups: Array<{ key: string; date: Date; net: number; items: typeof shown }> = []
    for (const item of shown) {
      const key = item.date.slice(0, 10)
      let group = groups.find(entry => entry.key === key)
      if (!group) {
        group = { key, date: parseLocalDate(key), net: 0, items: [] }
        groups.push(group)
      }
      group.items.push(item)
      group.net += item.type === 'income' ? item.amount : -item.amount
    }
    return { groups, total: items.length }
  }, [expenses, income, showingRunning, viewedMonth])

  function dayLabel(date: Date) {
    const today = startOfDay(new Date())
    const diff = Math.round((today.getTime() - startOfDay(date).getTime()) / 86_400_000)
    if (diff === 0) return 'Today'
    if (diff === 1) return 'Yesterday'
    return date.toLocaleDateString('en-CA', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }

  // Report: totals per category (or income source) for the period, with the
  // previous month alongside when a single month is selected.
  const recordedIncome = useMemo(() => {
    const cutoff = endOfToday()
    return income.filter(item => parseLocalDate(item.date) <= cutoff)
  }, [income])
  const reportData = useMemo(() => {
    const previousMonth = new Date(viewedMonth.getFullYear(), viewedMonth.getMonth() - 1, 1)
    const toRows = (kind: 'expense' | 'income', list: Array<Expense | Income>) =>
      list.map(entry => ({ key: kind === 'expense' ? (entry as Expense).category : (entry as Income).source, amount: entry.amount_cad }))
    const current = reportKind === 'expense'
      ? toRows('expense', showingRunning ? recordedExpenses : monthExpenses)
      : toRows('income', showingRunning ? recordedIncome : thisMonthIncome)
    const previous = showingRunning
      ? null
      : toRows(reportKind, reportKind === 'expense' ? getMonthEntries(expenses, previousMonth) : getMonthEntries(income, previousMonth))

    const sum = (rows: Array<{ key: string; amount: number }>) => {
      const totals = new Map<string, number>()
      for (const row of rows) totals.set(row.key, (totals.get(row.key) ?? 0) + row.amount)
      return totals
    }
    const totals = sum(current)
    const previousTotals = previous ? sum(previous) : null
    const total = [...totals.values()].reduce((a, b) => a + b, 0)
    const rows = [...totals.entries()]
      .map(([name, amount]) => ({
        name,
        amount,
        share: total > 0 ? (amount / total) * 100 : 0,
        previous: previousTotals?.get(name) ?? 0,
        fill: reportKind === 'income' && !Object.hasOwn(CATEGORY_ICONS, name) ? categoryColor(`income:${name}`) : categoryColor(name),
      }))
      .sort((a, b) => b.amount - a.amount)
    return { total, rows, compare: previousTotals !== null }
  }, [reportKind, showingRunning, recordedExpenses, monthExpenses, recordedIncome, thisMonthIncome, expenses, income, viewedMonth])

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
    // A limit of 0 marks a deleted budget, not a real limit to exceed.
    const realMonthBudgets = budgets.filter(
      budget => budget.month === realMonth && budget.year === realYear && budget.amount_cad > 0,
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
    const toSet = suggestions.filter(
      suggestion => !currentBudgets.some(budget => budget.category === suggestion.category),
    )

    // Through setBudgetForMonth so a budget deleted earlier this month is
    // revived in place instead of gaining a second row for the same month.
    for (const suggestion of toSet) {
      await setBudgetForMonth(supabase, {
        user_id: userId,
        category: suggestion.category,
        amount_cad: suggestion.suggested,
        month: currentMonth,
        year: currentYear,
      })
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
    setMonthPickerOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function openReport(kind: 'expense' | 'income') {
    setReportKind(kind)
    switchTab('report')
  }

  function quickAdd(action: 'expense' | 'income' | 'budget' | 'goal') {
    setQuickAddOpen(false)
    if (action === 'expense') { setEditingExpense(null); setShowAddExpense(true) }
    if (action === 'income') { setEditingIncome(null); setShowAddIncome(true) }
    if (action === 'budget') { setEditingBudgetCategory(null); setShowAddBudget(true) }
    if (action === 'goal') { setFundingGoal(null); setGoalSuggestion(null); setGoalModalOpen(true) }
  }

  function reviewSpendingLimit() {
    setActiveTab('plan')
    requestAnimationFrame(() => {
      const section = document.getElementById('spending-limit')
      section?.focus({ preventScroll: true })
      section?.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth', block: 'start' })
    })
  }

  const periodWord = showingRunning ? 'All time' : viewedMonthLabel
  const balanceLabel = showingRunning || viewingCurrentMonth
    ? 'Current Balance'
    : `Balance at end of ${viewedMonth.toLocaleDateString('en-CA', { month: 'long' })}`
  const netThisPeriod = amountLeftThisMonth
  const reportTitle = reportKind === 'expense' ? 'Expenses' : 'Income'
  const listGroups = reportKind === 'expense' ? expenseGroups : incomeGroups

  const pageHeader = (title: string, extra?: ReactNode) => (
    <header className="flex items-center justify-between gap-3 px-4 pb-4 pt-5 lg:px-0 lg:pt-0">
      <h1 className="text-[22px] font-semibold tracking-[-0.03em] text-[#16161D] lg:text-[28px]">{title}</h1>
      <div className="flex items-center gap-2">
        {extra}
        <NotificationsPanel notifications={notifications} onChanged={() => router.refresh()} variant="light" onReviewSpendingLimit={reviewSpendingLimit} />
      </div>
    </header>
  )

  const transactionRow = (item: (typeof dayGroups.groups)[number]['items'][number]) => (
    <button
      type="button"
      key={item.id}
      onClick={() => openEditActivity(item)}
      className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#F6F5FB]"
    >
      {item.type === 'expense' ? <CategoryIcon category={item.category} /> : <IncomeIcon />}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-semibold text-[#16161D]">
          <span className="truncate">{item.title}</span>
          {isRecentlyAdded(item.createdAt, now) && (
            <span className="shrink-0 rounded-full bg-[#F4F2FD] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6243EE]">New</span>
          )}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 truncate text-[11px] text-[#8B8B9A]">
          <span className="truncate">{item.category}</span>
          {item.tag && <><span aria-hidden="true">·</span><span className="truncate">{item.tag}</span></>}
        </p>
      </div>
      <div className="shrink-0 text-right">
        <p className={`text-sm font-semibold ${item.type === 'expense' ? 'text-[#E5484D]' : 'text-[#1C8F4E]'}`}>
          {item.type === 'expense' ? '−' : '+'}{formatCAD(item.amount)}
        </p>
        {item.original && <p className="mt-0.5 text-[11px] text-[#8B8B9A]">{item.original}</p>}
      </div>
    </button>
  )

  const quickAddOptions = [
    { id: 'expense' as const, label: 'Expense', note: 'Money out', icon: ArrowUpRight, tint: 'bg-[#FDECEC] text-[#E5484D]' },
    { id: 'income' as const, label: 'Income', note: 'Money in', icon: ArrowDownLeft, tint: 'bg-[#E6F6EC] text-[#1C8F4E]' },
    { id: 'budget' as const, label: 'Budget', note: 'Monthly limit', icon: PiggyBank, tint: 'bg-[#EAF1FE] text-[#3B79E8]' },
    { id: 'goal' as const, label: 'Savings goal', note: 'Something to save for', icon: Target, tint: 'bg-[#FEF0E4] text-[#D86A16]' },
  ]

  return (
    <div className={styles.dashboard}>
      <SpendingAlertSync
        active={Boolean(spendingLimit?.enabled)}
        activity={JSON.stringify([expenses.map(item => [item.id, item.date, item.amount_cad]), income.map(item => [item.id, item.date, item.amount_cad]), spendingLimit])}
        signature={JSON.stringify(notifications.map(item => ({ id: item.id, is_read: item.is_read })))}
      />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-[#ECECF2] bg-white px-4 py-6 lg:flex">
        <div className="px-2">
          <SiteLogo size="compact" surface="light" />
        </div>
        <button
          type="button"
          onClick={() => setQuickAddOpen(true)}
          className="mt-8 flex h-11 items-center justify-center gap-2 rounded-full bg-[#7C5CFA] text-[13px] font-semibold text-white shadow-[0_10px_24px_rgba(124,92,250,0.3)] transition hover:bg-[#6A48F5]"
        >
          <Plus size={16} strokeWidth={2.4} aria-hidden="true" /> New entry
        </button>
        <nav aria-label="Dashboard navigation" className="mt-6 space-y-1">
          {NAV_ITEMS.map(item => {
            const active = activeTab === item.id
            return (
              <button
                key={item.id}
                type="button"
                aria-current={active ? 'page' : undefined}
                onClick={() => switchTab(item.id)}
                className={`flex w-full items-center gap-3 rounded-2xl px-3.5 py-3 text-left text-sm font-medium transition ${
                  active ? 'bg-[#F4F2FD] text-[#6243EE]' : 'text-[#6B6B7A] hover:bg-[#F6F5FB] hover:text-[#16161D]'
                }`}
              >
                <item.icon size={19} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </nav>
        <div className="mt-auto flex items-center gap-3 rounded-2xl bg-[#F6F5FB] p-3">
          <div className="grid size-9 shrink-0 place-items-center rounded-full bg-[#7C5CFA] text-xs font-bold text-white">{initials}</div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-[#16161D]">{profile?.full_name ?? 'Xtrack user'}</p>
            <p className="text-[10px] text-[#8B8B9A]">Currency · {homeCurrency}</p>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            aria-label="Sign out"
            title="Sign out"
            className="grid size-8 shrink-0 place-items-center rounded-lg text-[#8B8B9A] transition hover:bg-white hover:text-[#E5484D]"
          >
            <LogOut size={16} aria-hidden="true" />
          </button>
        </div>
      </aside>

      <div className="pb-28 lg:pb-12 lg:pl-60">
        <main className="mx-auto max-w-[1180px] lg:px-8 lg:pt-8">
          {/* ---------------------------------------------------------------- HOME */}
          {activeTab === 'home' && (
            <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-6">
              <div className="min-w-0">
                <section aria-label="Balance" className={styles.hero}>
                  <div className="relative z-10 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => switchTab('settings')}
                      aria-label="Profile and settings"
                      className="flex items-center gap-2.5"
                    >
                      <span className="grid size-11 place-items-center rounded-full bg-white text-sm font-bold text-[#6243EE] ring-4 ring-white/25">{initials}</span>
                      <span className="hidden text-left lg:block">
                        <span className="block text-[11px] text-white/75">Welcome back</span>
                        <span className="block text-sm font-semibold">{firstName}</span>
                      </span>
                    </button>
                    {renderPeriodPill('glass', 'center')}
                    <NotificationsPanel notifications={notifications} onChanged={() => router.refresh()} variant="glass" onReviewSpendingLimit={reviewSpendingLimit} />
                  </div>

                  <div className="relative z-10 mt-8 text-center">
                    <p className="text-[13px] font-medium text-white/80">{balanceLabel}</p>
                    <AnimatedMoney value={leftFigure} className={`${styles.heroValue} mt-1.5`} centsClassName={styles.heroCents} />
                    <p className="mt-3 inline-flex items-center gap-1 rounded-full bg-white/18 px-3 py-1 text-[12px] font-medium text-white ring-1 ring-white/25" style={{ backgroundColor: 'rgb(255 255 255 / 0.16)' }}>
                      {netThisPeriod >= 0 ? <TrendingUp size={13} aria-hidden="true" /> : <TrendingDown size={13} aria-hidden="true" />}
                      {netThisPeriod >= 0 ? '+' : '−'}{formatCAD(Math.abs(netThisPeriod))} {monthWord}
                    </p>
                    {!showingRunning && (
                      <p className="mt-2 text-[11px] text-white/75">{formatCAD(balanceBroughtForward)} carried over from earlier months</p>
                    )}
                  </div>
                </section>

                <div className={styles.sheet}>
                  {/* Your money */}
                  <section aria-labelledby="your-money" className={`${styles.panel} p-4`}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2 id="your-money" className="flex items-center gap-1.5 text-[15px] font-semibold tracking-[-0.01em]">
                        Your Money <span className="text-[11px] font-medium text-[#8B8B9A]">· {periodWord}</span>
                      </h2>
                      <TextAction onClick={() => setShowSpendingBreakdown(true)}>
                        Details <ChevronRight size={14} aria-hidden="true" />
                      </TextAction>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button type="button" onClick={() => openReport('income')} className="rounded-[20px] border border-[#ECECF2] p-4 text-left transition hover:border-[#D9D3FB] hover:bg-[#FBFAFF]">
                        <span className="grid size-10 place-items-center rounded-full bg-[#EAF1FE] text-[#3B79E8]"><ArrowDownLeft size={18} strokeWidth={2.2} aria-hidden="true" /></span>
                        <p className="mt-4 text-xs font-medium text-[#8B8B9A]">Income</p>
                        <AnimatedMoney value={earnedFigure} className="mt-1 block text-[clamp(1.05rem,5vw,1.4rem)] font-semibold tracking-[-0.03em] text-[#16161D]" centsClassName={styles.cents} />
                      </button>
                      <button type="button" onClick={() => openReport('expense')} className="rounded-[20px] border border-[#ECECF2] p-4 text-left transition hover:border-[#D9D3FB] hover:bg-[#FBFAFF]">
                        <span className="grid size-10 place-items-center rounded-full bg-[#FDECEC] text-[#E5484D]"><ArrowUpRight size={18} strokeWidth={2.2} aria-hidden="true" /></span>
                        <p className="mt-4 text-xs font-medium text-[#8B8B9A]">Expenses</p>
                        <AnimatedMoney value={spentFigure} className="mt-1 block text-[clamp(1.05rem,5vw,1.4rem)] font-semibold tracking-[-0.03em] text-[#16161D]" centsClassName={styles.cents} />
                      </button>
                    </div>
                    {earnedFigure > 0 && (
                      <div className="mt-4 px-1">
                        <div className="mb-1.5 flex justify-between text-[11px] text-[#8B8B9A]">
                          <span>Spent {Math.round(spentShare)}% of income</span>
                          <span>{formatCAD(Math.max(0, earnedFigure - spentFigure))} unspent</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-[#F1F0F7]" aria-hidden="true">
                          <div className={`h-full rounded-full ${spentShare >= 100 ? 'bg-[#E5484D]' : 'bg-[#7C5CFA]'}`} style={{ width: `${Math.min(100, spentShare)}%` }} />
                        </div>
                      </div>
                    )}
                  </section>

                  {/* Savings banner */}
                  <button
                    type="button"
                    onClick={() => { switchTab('plan'); requestAnimationFrame(() => document.getElementById('savings')?.scrollIntoView({ block: 'start' })) }}
                    className="mt-4 flex w-full items-center gap-3 rounded-full bg-[#16161D] px-5 py-3.5 text-left text-white transition hover:bg-[#24242E]"
                  >
                    <Sparkles size={16} className="shrink-0 text-[#B9A6FD]" aria-hidden="true" />
                    <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                      {savingsPotential > 0
                        ? <>Save up to <span className="font-semibold">{formatCAD(savingsPotential)}</span>/mo</>
                        : 'Spending is above your income'}
                    </span>
                    <span className="flex shrink-0 items-center text-[12px] font-semibold text-white/70">
                      See plan <ChevronRight size={14} aria-hidden="true" />
                    </span>
                  </button>

                  {activePayday && (
                    <section aria-label="Payday check-in" className="mt-4 rounded-[24px] border border-[#CFE9D8] bg-[#EEF9F2] p-5">
                      <div className="flex items-start gap-3">
                        <span className="grid size-10 shrink-0 place-items-center rounded-2xl bg-[#D3EFDD] text-[#1C8F4E]">
                          <CalendarClock size={18} aria-hidden="true" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[#1C8F4E]">Payday check-in</p>
                          <p className="mt-1 text-[15px] font-semibold tracking-[-0.01em] text-[#16161D]">
                            How much were you paid on {formatDate(activePayday.dueDate, true)}?
                          </p>
                          <p className="mt-1 text-xs leading-5 text-[#4D6B58]">
                            {activePayday.source} repeats {activePayday.cycle} and is usually{' '}
                            <span className="font-semibold">{formatCAD(activePayday.expectedAmount)}</span>.
                          </p>
                          {paydayError && <p className="mt-2 text-xs font-medium text-[#D93F3F]">{paydayError}</p>}
                        </div>
                      </div>

                      {editingPayday ? (
                        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
                          <div className="relative">
                            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] font-semibold text-[#4D6B58]">$</span>
                            <input
                              type="number"
                              inputMode="decimal"
                              step="0.01"
                              autoFocus
                              aria-label="Amount you were paid"
                              value={paydayAmount}
                              onChange={event => setPaydayAmount(event.target.value)}
                              className="w-full rounded-2xl border border-[#CFE9D8] bg-white py-3 pl-8 pr-3 text-base font-semibold text-[#16161D] outline-none focus:border-[#1C8F4E] sm:w-40 sm:text-[15px]"
                            />
                          </div>
                          <div className="flex items-center gap-3">
                            <button type="button" onClick={() => confirmPayday(activePayday, Number(paydayAmount))} disabled={savingPayday} className="rounded-full bg-[#16161D] px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                              {savingPayday ? 'Saving…' : 'Log payment'}
                            </button>
                            <button type="button" onClick={() => { setEditingPayday(false); setPaydayError('') }} className="text-[13px] font-semibold text-[#4D6B58]">Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="mt-4 flex flex-wrap items-center gap-2">
                          <button type="button" onClick={() => confirmPayday(activePayday, activePayday.expectedAmount)} disabled={savingPayday} className="rounded-full bg-[#16161D] px-5 py-3 text-[13px] font-semibold text-white disabled:opacity-50">
                            {savingPayday ? 'Saving…' : `Yes, log ${formatCAD(activePayday.expectedAmount)}`}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setPaydayAmount(activePayday.expectedAmount.toFixed(2)); setEditingPayday(true); setPaydayError('') }}
                            className="rounded-full border border-[#CFE9D8] bg-white px-5 py-3 text-[13px] font-semibold text-[#1C8F4E]"
                          >
                            Different amount
                          </button>
                          <button type="button" onClick={() => skipPayday(activePayday)} className="px-2 text-[13px] font-semibold text-[#4D6B58]">Not paid</button>
                        </div>
                      )}
                      {duePaydays.length > 1 && (
                        <p className="mt-4 border-t border-[#CFE9D8] pt-3 text-[11px] text-[#4D6B58]">
                          {duePaydays.length - 1} earlier payday{duePaydays.length - 1 === 1 ? '' : 's'} still to confirm after this one.
                        </p>
                      )}
                    </section>
                  )}

                  {/* Transactions */}
                  <section aria-labelledby="transactions" className="mt-6">
                    <SectionTitle
                      id="transactions"
                      title="Transactions"
                      action={
                        <span className="rounded-full bg-[#F4F2FD] px-3 py-1 text-[11px] font-semibold text-[#6243EE]">{showingRunning ? 'All time' : viewedMonth.toLocaleDateString('en-CA', { month: 'short', year: 'numeric' })}</span>
                      }
                    />
                    {dayGroups.groups.length > 0 ? (
                      <div className="space-y-4">
                        {dayGroups.groups.map(group => (
                          <div key={group.key}>
                            <div className="mb-2 flex items-baseline justify-between px-1 text-[12px]">
                              <span className="text-[#8B8B9A]">{dayLabel(group.date)}</span>
                              <span className="text-[#8B8B9A]">
                                Total <span className="font-semibold text-[#16161D]">{group.net >= 0 ? '+' : '−'}{formatCAD(Math.abs(group.net))}</span>
                              </span>
                            </div>
                            <div className={`${styles.panel} p-1.5`}>{group.items.map(transactionRow)}</div>
                          </div>
                        ))}
                        {dayGroups.total > 12 && (
                          <button type="button" onClick={() => openReport('expense')} className="w-full rounded-full border border-[#ECECF2] bg-white py-3 text-[13px] font-semibold text-[#6243EE] transition hover:bg-[#F6F5FB]">
                            View all {dayGroups.total} transactions
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className={styles.panel}>
                        {expenses.length + income.length === 0
                          ? <EmptyState type="expense" onAction={() => quickAdd('expense')} />
                          : <p className="px-5 py-10 text-center text-sm text-[#8B8B9A]">Nothing recorded {monthWord}.</p>}
                      </div>
                    )}
                  </section>

                  <div className="lg:hidden">
                    <BankSyncPanel expenses={expenses} income={income} />
                  </div>
                </div>
              </div>

              {/* Desktop side column */}
              <aside className="hidden space-y-6 lg:block">
                <section aria-labelledby="coming-up" className={`${styles.panel} p-4`}>
                  <SectionTitle id="coming-up" title="Coming up" action={<TextAction onClick={() => switchTab('plan')}>View all <ChevronRight size={14} aria-hidden="true" /></TextAction>} />
                  {upcomingPayments.length > 0 ? (
                    <div className="space-y-1">
                      {upcomingPayments.slice(0, 4).map(payment => (
                        <div key={payment.id} className="flex items-center gap-3 rounded-2xl px-1 py-2">
                          <CategoryIcon category={payment.category} small />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold">{payment.note ?? payment.category}</p>
                            <p className="text-[11px] text-[#8B8B9A]">{payment.daysUntil === 0 ? 'Due today' : payment.daysUntil === 1 ? 'Tomorrow' : `In ${payment.daysUntil} days`}</p>
                          </div>
                          <span className="text-[13px] font-semibold">{formatCAD(payment.amount_cad)}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="px-1 pb-2 text-xs text-[#8B8B9A]">No recurring bills yet.</p>
                  )}
                </section>
                <BankSyncPanel expenses={expenses} income={income} />
              </aside>
            </div>
          )}

          {/* -------------------------------------------------------------- REPORT */}
          {activeTab === 'report' && (
            <div>
              {pageHeader('Report', renderPeriodPill('light', 'right'))}
              <div className="space-y-5 px-4 lg:px-0">
                <div className="flex items-center gap-2">
                  <div className="grid flex-1 grid-cols-2 rounded-full bg-[#ECECF2] p-1 sm:max-w-sm" role="group" aria-label="Report type">
                    {(['expense', 'income'] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        aria-pressed={reportKind === kind}
                        onClick={() => setReportKind(kind)}
                        className={`rounded-full py-2.5 text-[13px] font-semibold transition ${reportKind === kind ? 'bg-white text-[#16161D] shadow-sm' : 'text-[#8B8B9A] hover:text-[#16161D]'}`}
                      >
                        {kind === 'expense' ? 'Expenses' : 'Income'}
                      </button>
                    ))}
                  </div>
                  <button type="button" onClick={() => setShowStatement(true)} aria-label="Export statement" title="Export statement" className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ECECF2] bg-white text-[#16161D] transition hover:bg-[#F6F5FB]">
                    <Printer size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={AI_FEATURES_ENABLED ? handleGenerateInsight : undefined}
                    disabled={!AI_FEATURES_ENABLED || generatingInsight}
                    aria-label={AI_FEATURES_ENABLED ? 'AI insight' : 'AI insight, coming soon'}
                    title={AI_FEATURES_ENABLED ? 'AI insight' : 'AI insights are coming soon'}
                    className="grid size-11 shrink-0 place-items-center rounded-full border border-[#ECECF2] bg-white text-[#7C5CFA] transition hover:bg-[#F6F5FB] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <Sparkles size={17} aria-hidden="true" />
                  </button>
                </div>
                {insightError && <p className="rounded-2xl bg-[#FDECEC] px-4 py-3 text-[13px] font-medium text-[#D93F3F]">{insightError}</p>}

                <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <section aria-labelledby="report-chart" className={`${styles.panel} p-5`}>
                    <SectionTitle id="report-chart" title={`${reportTitle} Report`} action={<span className="text-[11px] font-medium text-[#8B8B9A]">{periodWord}</span>} />
                    {reportData.rows.length > 0 ? (
                      <div className="relative mx-auto aspect-square w-full max-w-[280px]">
                        <ResponsiveContainer width="100%" height="100%">
                          <PieChart>
                            <Pie
                              data={reportData.rows}
                              dataKey="amount"
                              nameKey="name"
                              innerRadius="64%"
                              outerRadius="100%"
                              paddingAngle={reportData.rows.length > 1 ? 3 : 0}
                              cornerRadius={10}
                              stroke="none"
                              startAngle={90}
                              endAngle={-270}
                              isAnimationActive
                            />
                            <Tooltip
                              cursor={false}
                              content={({ active, payload }) => {
                                const row = active ? payload?.[0]?.payload as (typeof reportData.rows)[number] | undefined : undefined
                                return row ? (
                                  <div className="rounded-full bg-[#16161D] px-3 py-1.5 text-[11px] font-semibold text-white shadow-lg">
                                    {row.name} · {Math.round(row.share)}%
                                  </div>
                                ) : null
                              }}
                            />
                          </PieChart>
                        </ResponsiveContainer>
                        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
                          <div>
                            <p className="text-[11px] font-medium text-[#8B8B9A]">Total {reportTitle.toLowerCase()}</p>
                            <AnimatedMoney value={reportData.total} className="mt-0.5 block text-[22px] font-semibold tracking-[-0.03em]" centsClassName={styles.cents} />
                          </div>
                        </div>
                      </div>
                    ) : (
                      <EmptyState type={reportKind} onAction={() => quickAdd(reportKind)} />
                    )}
                  </section>

                  <section aria-labelledby="report-breakdown">
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h2 id="report-breakdown" className="text-[13px] font-medium text-[#8B8B9A]">
                        {reportKind === 'expense' ? 'All expenses' : 'All income'}
                      </h2>
                      <span className="text-[13px] text-[#8B8B9A]">Total <span className="font-semibold text-[#16161D]">{formatCAD(reportData.total)}</span></span>
                    </div>
                    <div className="space-y-3">
                      {reportData.rows.map(row => (
                        <div key={row.name} className={`${styles.panel} p-4`}>
                          <div className="flex items-center gap-3">
                            {reportKind === 'expense' ? <CategoryIcon category={row.name} small /> : <IncomeIcon small />}
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{row.name}</p>
                              <p className="text-[11px] text-[#8B8B9A]">{row.share < 1 && row.share > 0 ? '<1' : Math.round(row.share)}% of total</p>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-semibold">{formatCAD(row.amount)}</p>
                              {reportData.compare && (
                                <p className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-[#8B8B9A]">
                                  <DeltaChip current={row.amount} previous={row.previous} upIsGood={reportKind === 'income'} />
                                  {row.previous > 0 && 'vs last month'}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="mt-3 h-2 overflow-hidden rounded-full" style={{ backgroundColor: `color-mix(in srgb, ${row.fill} 14%, white)` }}>
                            <div className="h-full rounded-full" style={{ width: `${Math.max(2, row.share)}%`, backgroundColor: row.fill }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>
                </div>

                {reportKind === 'expense' && (savingsTips || tipsError || AI_FEATURES_ENABLED) && (
                  <section className={`${styles.panel} p-5`}>
                    <SectionTitle
                      title="Savings tips"
                      action={
                        savingsTips
                          ? <TextAction onClick={() => setSavingsTips(null)}>Dismiss</TextAction>
                          : <TextAction onClick={handleGetSavingsTips} disabled={loadingTips}>{loadingTips ? 'Thinking…' : 'Get tips'}</TextAction>
                      }
                    />
                    {tipsError && <p className="text-[12px] font-medium text-[#D93F3F]">{tipsError}</p>}
                    {savingsTips && (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {savingsTips.map((tip, index) => (
                          <div key={index} className="rounded-2xl bg-[#F6F5FB] p-4">
                            <p className="text-[13px] font-semibold">{tip.title}</p>
                            <p className="mt-1.5 text-[12px] leading-5 text-[#5E5E6E]">{tip.body}</p>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                <FinancialChart
                  expenses={expenses}
                  income={income}
                  scope={summaryScope}
                  month={viewedMonth}
                  onAddExpense={() => quickAdd('expense')}
                  onAddIncome={() => quickAdd('income')}
                />

                <section aria-labelledby="report-list" className={`${styles.panel} overflow-hidden`}>
                  <div className={styles.sectionHeader}>
                    <div>
                      <h2 id="report-list" className="text-[15px] font-semibold tracking-[-0.01em]">{reportTitle} history</h2>
                      <p className="mt-0.5 text-xs text-[#8B8B9A]">
                        {(reportKind === 'expense' ? listedExpenseCount : listedIncomeCount)} entr{(reportKind === 'expense' ? listedExpenseCount : listedIncomeCount) === 1 ? 'y' : 'ies'} · {periodWord}
                      </p>
                    </div>
                    <p className={`text-sm font-semibold ${reportKind === 'expense' ? 'text-[#E5484D]' : 'text-[#1C8F4E]'}`}>
                      {formatCAD(reportKind === 'expense' ? listedExpenseTotal : listedIncomeTotal)}
                    </p>
                  </div>
                  {(reportKind === 'expense' ? expenses.length : income.length) === 0 ? (
                    <EmptyState type={reportKind} onAction={() => quickAdd(reportKind)} />
                  ) : listGroups.length === 0 ? (
                    <p className="px-5 py-10 text-center text-sm text-[#8B8B9A]">No {reportTitle.toLowerCase()} recorded in {viewedMonthLabel}.</p>
                  ) : listGroups.map(group => (
                    <div key={group.key}>
                      <div className={styles.monthDivider}>
                        <p className="text-[12px] font-semibold text-[#16161D]">{group.label} <span className="font-normal text-[#8B8B9A]">· {group.entries.length}</span></p>
                        <p className={`text-[12px] font-semibold ${reportKind === 'expense' ? 'text-[#E5484D]' : 'text-[#1C8F4E]'}`}>
                          {reportKind === 'expense' ? '−' : '+'}{formatCAD(group.total)}
                        </p>
                      </div>
                      <div className="p-1.5">
                        {reportKind === 'expense'
                          ? (group.entries as Expense[]).map(expense => (
                            <button key={expense.id} type="button" onClick={() => openEditExpense(expense)} className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#F6F5FB]">
                              <CategoryIcon category={expense.category} />
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 text-sm font-semibold">
                                  <span className="truncate">{expense.note ?? expense.category}</span>
                                  {group.upcoming.has(expense.id) && <span className="shrink-0 rounded-full bg-[#F1F0F7] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6B6B7A]">Upcoming</span>}
                                  {expense.recurring_source_id && <span className="shrink-0 rounded-full bg-[#F4F2FD] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6243EE]">Auto</span>}
                                </p>
                                <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[#8B8B9A]">
                                  {expense.category} · {formatDate(expense.date, true)}
                                  {expense.split_count && <span className="inline-flex items-center gap-1"><Users size={11} aria-hidden="true" />{expense.split_count}</span>}
                                </p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold text-[#16161D]">−{formatCAD(expense.amount_cad)}</p>
                                {expense.original_amount && expense.original_currency && <p className="text-[11px] text-[#8B8B9A]">{expense.original_currency} {expense.original_amount}</p>}
                              </div>
                            </button>
                          ))
                          : (group.entries as Income[]).map(item => (
                            <button key={item.id} type="button" onClick={() => openEditIncome(item)} className="group flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition hover:bg-[#F6F5FB]">
                              <IncomeIcon />
                              <div className="min-w-0 flex-1">
                                <p className="flex items-center gap-2 text-sm font-semibold">
                                  <span className="truncate">{item.source}</span>
                                  {group.upcoming.has(item.id) && <span className="shrink-0 rounded-full bg-[#F1F0F7] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.06em] text-[#6B6B7A]">Upcoming</span>}
                                </p>
                                <p className="mt-0.5 text-[11px] text-[#8B8B9A]">
                                  {formatDate(item.date, true)}{item.is_recurring && ` · Recurring ${item.recur_cycle}`}
                                </p>
                              </div>
                              <p className="shrink-0 text-sm font-semibold text-[#1C8F4E]">+{formatCAD(item.amount_cad)}</p>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </section>
              </div>
            </div>
          )}

          {/* ---------------------------------------------------------------- PLAN */}
          {activeTab === 'plan' && (
            <div>
              {pageHeader('My Plan', (
                <>
                  {renderPeriodPill('light', 'right')}
                  <button type="button" onClick={() => setQuickAddOpen(true)} aria-label="Add a goal or budget" className="grid size-10 place-items-center rounded-full bg-[#16161D] text-white transition hover:bg-[#2A2A35]">
                    <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
                  </button>
                </>
              ))}
              <div className="grid gap-6 px-4 lg:grid-cols-2 lg:px-0">
                {/* Goals */}
                <section aria-labelledby="goals">
                  <SectionTitle
                    id="goals"
                    title="Goals"
                    action={
                      <div className="flex items-center gap-4">
                        <TextAction
                          onClick={AI_FEATURES_ENABLED ? handleSuggestGoal : undefined}
                          disabled={!AI_FEATURES_ENABLED || suggestingGoal}
                          title={AI_FEATURES_ENABLED ? undefined : 'AI goal suggestions are coming soon'}
                        >
                          <Sparkles size={13} aria-hidden="true" />
                          {!AI_FEATURES_ENABLED ? 'AI · Soon' : suggestingGoal ? 'Thinking…' : 'Suggest'}
                        </TextAction>
                        <TextAction onClick={() => quickAdd('goal')}><Plus size={13} aria-hidden="true" /> New goal</TextAction>
                      </div>
                    }
                  />
                  {goalSuggestionError && <p className="mb-3 rounded-2xl bg-[#FDECEC] px-4 py-3 text-[12px] font-medium text-[#D93F3F]">{goalSuggestionError}</p>}
                  {savingsGoals.length > 0 ? (
                    <div className="space-y-4">
                      {savingsGoals.map(goal => {
                        const percentage = goal.target_amount_cad > 0 ? Math.min(100, (goal.current_amount_cad / goal.target_amount_cad) * 100) : 0
                        const reached = goal.current_amount_cad >= goal.target_amount_cad
                        const remaining = Math.max(0, goal.target_amount_cad - goal.current_amount_cad)
                        const monthsRemaining = goal.target_date
                          ? Math.max((parseLocalDate(goal.target_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24 * 30.44), 1 / 30.44)
                          : null
                        const neededPerMonth = monthsRemaining ? remaining / monthsRemaining : null
                        const pace = reached ? 'reached' : neededPerMonth !== null && avgMonthlySavings > 0
                          ? (neededPerMonth <= avgMonthlySavings ? 'on-track' : 'behind')
                          : null
                        return (
                          <article key={goal.id} className={`${styles.panel} overflow-hidden`}>
                            <div className="p-5">
                              <div className="flex items-start gap-3">
                                <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#FEF0E4] text-[#D86A16]"><Target size={18} aria-hidden="true" /></span>
                                <div className="min-w-0 flex-1">
                                  <p className="truncate text-sm font-semibold">{goal.title}</p>
                                  <p className="mt-0.5 text-[11px] text-[#8B8B9A]">{goal.target_date ? `Target ${formatDate(goal.target_date, true)}` : 'No deadline'}</p>
                                </div>
                                <button type="button" onClick={() => { setFundingGoal(goal); setGoalModalOpen(true) }} className="flex shrink-0 items-center gap-1 rounded-full bg-[#F4F2FD] px-3 py-1.5 text-[11px] font-semibold text-[#6243EE] transition hover:bg-[#ECE7FE]">
                                  <Plus size={12} aria-hidden="true" /> Add money
                                </button>
                              </div>
                              <p className="mt-5 text-[22px] font-semibold tracking-[-0.03em]">
                                {formatCAD(goal.current_amount_cad)} <span className="text-[13px] font-normal tracking-normal text-[#8B8B9A]">out of {formatCAD(goal.target_amount_cad)}</span>
                              </p>
                              <div className="relative mt-4 h-2.5 rounded-full bg-[#FDE9DA]" role="progressbar" aria-label={`${goal.title} progress`} aria-valuenow={Math.round(percentage)} aria-valuemin={0} aria-valuemax={100}>
                                <div className="h-full rounded-full bg-[#F2832C]" style={{ width: `${percentage}%` }} />
                                <span aria-hidden="true" className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-[#F2832C] shadow" style={{ left: `${Math.max(3, Math.min(97, percentage))}%` }} />
                              </div>
                              <div className="mt-2 flex justify-between text-[11px]">
                                <span className="text-[#8B8B9A]">Your progress · {Math.round(percentage)}%</span>
                                <span className="font-semibold">{formatCAD(remaining)} left</span>
                              </div>
                            </div>
                            {pace && (
                              <p className={`flex items-center gap-2 px-5 py-2.5 text-[12px] font-medium ${
                                pace === 'behind' ? 'bg-[#F2832C] text-white' : pace === 'reached' ? 'bg-[#7C5CFA] text-white' : 'bg-[#E6F6EC] text-[#1C8F4E]'
                              }`}>
                                <CircleAlert size={14} aria-hidden="true" />
                                {pace === 'behind' && neededPerMonth !== null && `Behind pace: needs ${formatCAD(neededPerMonth)}/month, you save about ${formatCAD(avgMonthlySavings)}`}
                                {pace === 'on-track' && neededPerMonth !== null && `On track: ${formatCAD(neededPerMonth)}/month gets you there`}
                                {pace === 'reached' && 'Goal reached. Nicely done.'}
                              </p>
                            )}
                          </article>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={`${styles.panel} flex flex-col items-center px-6 py-10 text-center`}>
                      <span className="grid size-12 place-items-center rounded-2xl bg-[#FEF0E4] text-[#D86A16]"><Target size={22} aria-hidden="true" /></span>
                      <p className="mt-4 text-sm font-semibold">No goals yet</p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-[#8B8B9A]">A trip, a laptop, an emergency fund — give your savings a target.</p>
                      <button type="button" onClick={() => quickAdd('goal')} className="mt-5 rounded-full bg-[#7C5CFA] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6A48F5]">Set a goal</button>
                    </div>
                  )}

                  {/* Savings potential */}
                  <section id="savings" aria-labelledby="savings-title" className={`${styles.panel} mt-6 scroll-mt-6 p-5`}>
                    <SectionTitle id="savings-title" title="Savings potential" />
                    <AnimatedMoney
                      value={savingsPotential}
                      className={`block text-[28px] font-semibold tracking-[-0.03em] ${savingsPotential >= 0 ? 'text-[#16161D]' : 'text-[#E5484D]'}`}
                      centsClassName={styles.cents}
                    />
                    <p className="mt-1 text-xs text-[#8B8B9A]">
                      {savingsPotential > 0
                        ? <>a month · about <span className="font-semibold text-[#16161D]">{formatCAD(weeklySavingsTarget)}</span> a week</>
                        : 'Your average spending is above your average income right now.'}
                    </p>
                    <div className="mt-4 space-y-2 rounded-2xl bg-[#F6F5FB] p-4 text-[12px]">
                      <p className="text-[11px] text-[#8B8B9A]">Averaged over {monthlyAverages.months} month{monthlyAverages.months === 1 ? '' : 's'} of activity</p>
                      <div className="flex justify-between"><span className="text-[#5E5E6E]">Average income</span><span className="font-semibold">{formatCAD(avgMonthlyIncome)}</span></div>
                      <div className="flex justify-between"><span className="text-[#5E5E6E]">Average spending</span><span className="font-semibold">−{formatCAD(avgMonthlySpend)}</span></div>
                    </div>
                    {topSpendCategories.length > 0 && (
                      <div className="mt-4">
                        <p className="text-[12px] font-semibold">Biggest levers {monthWord}</p>
                        <div className="mt-2 space-y-2">
                          {topSpendCategories.map(category => (
                            <div key={category.name} className="flex items-center gap-3 text-[12px]">
                              <CategoryIcon category={category.name} small />
                              <span className="flex-1 text-[#5E5E6E]">{category.name}</span>
                              <span className="font-semibold">{formatCAD(category.amount)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </section>
                </section>

                {/* Budgets */}
                <section aria-labelledby="budgets">
                  <SectionTitle
                    id="budgets"
                    title="Budgets"
                    action={<TextAction onClick={() => quickAdd('budget')}><Plus size={13} aria-hidden="true" /> Add budget</TextAction>}
                  />
                  <p className="-mt-2 mb-3 px-1 text-[11px] text-[#8B8B9A]">
                    {viewingCurrentMonth ? 'Limits repeat every month · spending resets on the 1st' : `Limits in force for ${viewedMonthLabel}`}
                  </p>
                  {currentBudgets.length > 0 ? (
                    <div className="space-y-3">
                      {currentBudgets.map(budget => {
                        const spent = monthExpenses
                          .filter(expense => expense.category === budget.category)
                          .reduce((total, expense) => total + expense.amount_cad, 0)
                        const percent = budget.amount_cad > 0 ? (spent / budget.amount_cad) * 100 : 100
                        const over = spent > budget.amount_cad
                        return (
                          <button
                            type="button"
                            key={budget.category}
                            onClick={() => openEditBudget(budget.category)}
                            className={`${styles.panel} flex w-full items-center gap-3 p-4 text-left transition hover:border-[#D9D3FB]`}
                          >
                            <CategoryIcon category={budget.category} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold">{budget.category}</p>
                              <p className="mt-0.5 text-[12px] text-[#8B8B9A]">
                                <span className={`font-semibold ${over ? 'text-[#E5484D]' : 'text-[#16161D]'}`}>{formatCAD(spent)}</span> of {formatCAD(budget.amount_cad)}
                              </p>
                              {over && <p className="mt-0.5 text-[11px] font-medium text-[#E5484D]">Over by {formatCAD(spent - budget.amount_cad)}</p>}
                            </div>
                            <ProgressRing value={percent} color={over ? '#E5484D' : categoryColor(budget.category)} />
                          </button>
                        )
                      })}
                    </div>
                  ) : (
                    <div className={`${styles.panel} flex flex-col items-center px-6 py-10 text-center`}>
                      <span className="grid size-12 place-items-center rounded-2xl bg-[#EAF1FE] text-[#3B79E8]"><PiggyBank size={22} aria-hidden="true" /></span>
                      <p className="mt-4 text-sm font-semibold">Give every dollar a plan</p>
                      <p className="mt-1 max-w-xs text-xs leading-5 text-[#8B8B9A]">Set a monthly limit yourself, or start from your recent spending.</p>
                      <div className="mt-5 flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => quickAdd('budget')} className="rounded-full bg-[#7C5CFA] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#6A48F5]">Set a budget</button>
                        {suggestions.length > 0 && (
                          <button type="button" onClick={handlePredictBudgets} disabled={predicting} className="rounded-full border border-[#ECECF2] px-5 py-2.5 text-xs font-semibold text-[#6243EE] hover:bg-[#F6F5FB] disabled:opacity-50">
                            {predicting ? 'Creating…' : 'Use suggestions'}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="mt-6">
                    <SpendingLimitCard
                      key={JSON.stringify(spendingLimit)}
                      settings={spendingLimit}
                      expenses={expenses}
                      income={income}
                      onSaved={() => router.refresh()}
                    />
                  </div>

                  {/* Upcoming payments */}
                  <section aria-labelledby="upcoming" className="mt-6">
                    <SectionTitle
                      id="upcoming"
                      title="Upcoming payments"
                      action={upcomingPayments.length > 0 ? <span className="text-[11px] text-[#8B8B9A]">Next in {upcomingPayments[0].daysUntil === 0 ? 'today' : `${upcomingPayments[0].daysUntil} day${upcomingPayments[0].daysUntil === 1 ? '' : 's'}`}</span> : undefined}
                    />
                    {upcomingPayments.length > 0 ? (
                      <div className={`${styles.panel} p-1.5`}>
                        {upcomingPayments.slice(0, 6).map(payment => {
                          const urgent = payment.daysUntil <= 3
                          return (
                            <div key={payment.id} className="flex items-center gap-3 rounded-2xl px-3 py-3">
                              <CategoryIcon category={payment.category} />
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm font-semibold">{payment.note ?? payment.category}</p>
                                <p className="mt-0.5 text-[11px] text-[#8B8B9A]">{payment.category} · {formatDate(payment.nextDue.toISOString())}</p>
                              </div>
                              <div className="shrink-0 text-right">
                                <p className="text-sm font-semibold">{formatCAD(payment.amount_cad)}</p>
                                <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${urgent ? 'bg-[#FDECEC] text-[#D93F3F]' : 'bg-[#F1F0F7] text-[#6B6B7A]'}`}>
                                  {payment.daysUntil === 0 ? 'Due today' : payment.daysUntil === 1 ? 'Tomorrow' : `In ${payment.daysUntil} days`}
                                </span>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    ) : (
                      <div className={`${styles.panel} px-6 py-8 text-center`}>
                        <CalendarClock size={22} className="mx-auto text-[#B4B4C2]" aria-hidden="true" />
                        <p className="mt-3 text-sm font-medium">No upcoming payments</p>
                        <p className="mt-1 text-xs text-[#8B8B9A]">Turn on “Repeat this expense” to track bills here.</p>
                      </div>
                    )}
                  </section>
                </section>
              </div>
            </div>
          )}

          {/* ------------------------------------------------------------ SETTINGS */}
          {activeTab === 'settings' && (
            <div>
              {pageHeader('Settings')}
              <div className="px-4 lg:px-0">
                <SettingsPanel
                  userId={userId}
                  email={email}
                  fullName={profile?.full_name ?? ''}
                  homeCurrency={homeCurrency}
                  onSignOut={handleSignOut}
                />
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Phone tab bar with the floating add button */}
      <nav aria-label="Dashboard navigation" className={`${styles.bottomNav} fixed inset-x-0 bottom-0 z-30 lg:hidden`}>
        <div className="mx-auto grid max-w-md grid-cols-5 items-end px-2 pt-2">
          {NAV_ITEMS.slice(0, 2).map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => switchTab(item.id)} className={`flex flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold ${active ? 'text-[#16161D]' : 'text-[#9C9CAA]'}`}>
                <item.icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
          <div className="flex justify-center">
            <button type="button" onClick={() => setQuickAddOpen(true)} aria-label="Add new entry" className={`${styles.fab} -mt-8`}>
              <Plus size={26} strokeWidth={2.4} aria-hidden="true" />
            </button>
          </div>
          {NAV_ITEMS.slice(2).map(item => {
            const active = activeTab === item.id
            return (
              <button key={item.id} type="button" aria-current={active ? 'page' : undefined} onClick={() => switchTab(item.id)} className={`flex flex-col items-center gap-1 pb-2 pt-1 text-[11px] font-semibold ${active ? 'text-[#16161D]' : 'text-[#9C9CAA]'}`}>
                <item.icon size={21} strokeWidth={active ? 2.3 : 1.9} aria-hidden="true" />
                {item.label}
              </button>
            )
          })}
        </div>
      </nav>

      {quickAddOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-[#16161D]/40 backdrop-blur-[4px]" onClick={() => setQuickAddOpen(false)} />
          <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6" onClick={() => setQuickAddOpen(false)}>
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="quick-add-title"
              onClick={event => event.stopPropagation()}
              className="xt-sheet w-full max-w-md rounded-t-[28px] bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:rounded-[28px]"
            >
              <div className="mb-4 flex items-center justify-between">
                <h2 id="quick-add-title" className="text-lg font-semibold tracking-[-0.02em]">Add new</h2>
                <button type="button" onClick={() => setQuickAddOpen(false)} aria-label="Close" className="grid size-9 place-items-center rounded-full bg-[#F4F4F8] text-[#5E5E6E]">
                  <X size={16} aria-hidden="true" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {quickAddOptions.map(option => (
                  <button key={option.id} type="button" onClick={() => quickAdd(option.id)} className="flex flex-col items-start gap-3 rounded-[20px] border border-[#ECECF2] p-4 text-left transition hover:border-[#D9D3FB] hover:bg-[#FBFAFF]">
                    <span className={`grid size-10 place-items-center rounded-full ${option.tint}`}><option.icon size={18} strokeWidth={2.2} aria-hidden="true" /></span>
                    <span>
                      <span className="block text-sm font-semibold">{option.label}</span>
                      <span className="block text-[11px] text-[#8B8B9A]">{option.note}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

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

      {showSpendingBreakdown && (
        <SpendingBreakdownModal
          title={showingRunning ? 'Spent in total' : `Spent ${monthWord}`}
          periodLabel={showingRunning ? 'All time, up to today' : viewedMonthLabel}
          expenses={showingRunning ? recordedExpenses : monthExpenses}
          icons={CATEGORY_ICONS}
          onViewAll={() => { setShowSpendingBreakdown(false); openReport('expense') }}
          onClose={() => setShowSpendingBreakdown(false)}
        />
      )}

      {showStatement && (
        <StatementModal
          fullName={profile?.full_name ?? 'Account holder'}
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
