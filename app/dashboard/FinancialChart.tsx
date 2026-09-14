'use client'

import { useId, useMemo, useState } from 'react'
import { ChartNoAxesCombined, ChartPie, ChevronDown, Plus, ReceiptText, TrendingUp } from 'lucide-react'
import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { buildFinancialChartData, type ChartEntry, type ChartExpense, type ChartScope } from './chart-data'
import styles from './dashboard.module.css'

interface Props {
  expenses: ChartExpense[]
  income: ChartEntry[]
  scope: ChartScope
  month: Date
  onAddExpense: () => void
  onAddIncome: () => void
}

const money = (amount: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(amount)

const axisMoney = (amount: number) => new Intl.NumberFormat('en-CA', {
  style: 'currency', currency: 'CAD', notation: 'compact', maximumFractionDigits: 1,
}).format(amount)

const share = (percentage: number) => percentage > 0 && percentage < 0.1 ? '<0.1%' : `${Number(percentage.toFixed(1))}%`

export default function FinancialChart({ expenses, income, scope, month, onAddExpense, onAddIncome }: Props) {
  const [view, setView] = useState<'flow' | 'categories'>('flow')
  const gradientId = useId().replace(/:/g, '')
  const data = useMemo(() => buildFinancialChartData({ expenses, income, scope, month }), [expenses, income, scope, month])
  const period = scope === 'running' ? 'All recorded activity' : month.toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })
  const hasData = view === 'flow' ? data.transactionCount > 0 : data.categories.length > 0
  const tooltipStyle = { background: '#252822', border: '1px solid #3C4036', borderRadius: 14, padding: '12px 16px', fontSize: 11, boxShadow: '0 8px 24px #20211e20' }

  return (
    <section className={`${styles.panel} flex flex-col p-5 sm:p-6`} aria-labelledby={`${gradientId}-heading`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#FAEEE7] text-[#C56A49]">
            <ChartNoAxesCombined size={19} aria-hidden="true" />
          </span>
          <div>
            <h2 id={`${gradientId}-heading`} className="text-base font-semibold tracking-[-0.02em]">Money overview</h2>
            <p className="mt-1 text-[11px] text-[#74776F]">{period} <span aria-hidden="true">·</span> CAD</p>
          </div>
        </div>
        <div className="flex gap-1 rounded-xl bg-[#F0F1EB] p-1" role="group" aria-label="Chart view">
          {([
            { id: 'flow', label: 'Cash flow', icon: TrendingUp },
            { id: 'categories', label: 'Categories', icon: ChartPie },
          ] as const).map(option => (
            <button
              type="button"
              key={option.id}
              aria-pressed={view === option.id}
              onClick={() => setView(option.id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-semibold transition ${view === option.id ? 'bg-white text-[#30352B] shadow-sm' : 'text-[#767C6F] hover:text-[#30352B]'}`}
            >
              <option.icon size={13} aria-hidden="true" />{option.label}
            </button>
          ))}
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-3 gap-3 border-b border-[#ECEEE6] pb-5">
        {[
          { label: 'Income', value: data.incomeTotal, color: '#58755F', dot: '#829A83' },
          { label: 'Spending', value: data.expenseTotal, color: '#B85D3F', dot: '#E98563' },
          { label: 'Net cash flow', value: data.netTotal, color: data.netTotal < 0 ? '#B85D3F' : '#30352B', dot: '#555D4C' },
        ].map(item => (
          <div key={item.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-[10px] text-[#74776F] sm:text-[11px]">
              <span aria-hidden="true" className="size-1.5 shrink-0 rounded-full" style={{ background: item.dot }} />{item.label}
            </dt>
            <dd className="mt-2 break-all text-[clamp(0.9rem,1.65vw,1.35rem)] font-semibold tracking-[-0.04em]" style={{ color: item.color }}>{money(item.value)}</dd>
          </div>
        ))}
      </dl>

      {hasData ? view === 'flow' ? (
        <div className="pt-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3 text-[10px] text-[#74776F]">
            <p>Cumulative income &amp; spending</p>
            <div className="flex items-center gap-4" aria-label="Chart legend">
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 border-t-2 border-dashed border-[#829A83]" />Income</span>
              <span className="flex items-center gap-1.5"><span aria-hidden="true" className="w-4 border-t-2 border-[#E98563]" />Spending</span>
            </div>
          </div>
          <div className="h-[250px] min-w-0 sm:h-[275px]" role="group" aria-label="Cumulative income and spending chart. Use the arrow keys to explore each point, or open the chart data below.">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 560, height: 275 }}>
              <AreaChart data={data.trend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }} accessibilityLayer>
                <defs>
                  <linearGradient id={`${gradientId}-income`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#829A83" stopOpacity={0.2} />
                    <stop offset="100%" stopColor="#829A83" stopOpacity={0.01} />
                  </linearGradient>
                  <linearGradient id={`${gradientId}-spending`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#E98563" stopOpacity={0.24} />
                    <stop offset="100%" stopColor="#E98563" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#E9ECE3" strokeDasharray="3 5" />
                <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: '#7A8072', fontSize: 10 }} minTickGap={32} tickMargin={12} interval="preserveStartEnd" height={36} />
                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#7A8072', fontSize: 10 }} tickFormatter={axisMoney} width={48} tickCount={5} domain={[0, 'auto']} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  labelStyle={{ color: '#D7DDCE', marginBottom: 8 }}
                  itemStyle={{ color: '#F5F7F1', padding: '3px 0' }}
                  cursor={{ stroke: '#B9C0AF', strokeDasharray: '3 3' }}
                  formatter={(value, name) => [money(Number(value ?? 0)), name]}
                  labelFormatter={(_, payload) => payload[0]?.payload?.dateLabel ?? ''}
                />
                <Area type="monotone" dataKey="income" name="Income" stroke="#78947A" strokeWidth={2.5} strokeDasharray="5 4" fill={`url(#${gradientId}-income)`} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive="auto" />
                <Area type="monotone" dataKey="expenses" name="Spending" stroke="#E28360" strokeWidth={2.5} fill={`url(#${gradientId}-spending)`} dot={false} activeDot={{ r: 5, stroke: '#fff', strokeWidth: 2 }} isAnimationActive="auto" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      ) : (
        <div className="grid min-h-[327px] items-center gap-5 py-5 sm:grid-cols-[210px_minmax(0,1fr)]">
          <div className="relative mx-auto h-[220px] w-[210px]">
            <ResponsiveContainer width="100%" height="100%" initialDimension={{ width: 210, height: 220 }}>
              <PieChart accessibilityLayer>
                <Pie data={data.categories} dataKey="amount" nameKey="name" innerRadius={70} outerRadius={96} paddingAngle={data.categories.length > 1 ? 3 : 0} cornerRadius={5} stroke="none" isAnimationActive="auto" />
                <Tooltip contentStyle={tooltipStyle} itemStyle={{ color: '#F5F7F1' }} formatter={(value, name) => [money(Number(value ?? 0)), name]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-9 text-center" aria-hidden="true">
              <span className="text-[10px] text-[#74776F]">Total spent</span>
              <span className="mt-1 w-full break-all text-lg font-semibold tracking-[-0.04em]">{money(data.expenseTotal)}</span>
              <span className="mt-1 text-[10px] text-[#92998A]">{data.categories.length} categories</span>
            </div>
          </div>
          <ul className="max-h-[280px] space-y-4 overflow-y-auto pr-1" aria-label="Spending by category">
            {data.categories.map(category => (
              <li key={category.name}>
                <div className="flex items-start gap-2 text-[11px]">
                  <span className="mt-1 size-2 shrink-0 rounded-full" style={{ background: category.fill }} aria-hidden="true" />
                  <span className="min-w-0 flex-1 break-words font-medium text-[#454B3D]">{category.name}</span>
                  <span className="shrink-0 font-semibold text-[#343A2D]">{money(category.amount)}</span>
                </div>
                <div className="mt-1.5 flex items-center gap-3 pl-4">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#F0F2EB]" aria-hidden="true">
                    <div className="h-full rounded-full" style={{ width: `${category.percentage}%`, background: category.fill }} />
                  </div>
                  <span className="w-10 text-right text-[10px] text-[#7A8171]">{share(category.percentage)}</span>
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="flex min-h-[327px] flex-col items-center justify-center py-8 text-center">
          <span className="grid size-12 place-items-center rounded-2xl bg-[#F5F2EB] text-[#B28A64]">
            {view === 'flow' ? <ChartNoAxesCombined size={23} aria-hidden="true" /> : <ReceiptText size={23} aria-hidden="true" />}
          </span>
          <p className="mt-4 text-sm font-semibold">{view === 'categories' ? 'No spending to break down' : 'Your money story starts here'}</p>
          <p className="mt-2 max-w-xs text-xs leading-5 text-[#7A8171]">
            {scope === 'month' ? 'No entries for this view in the selected month. Try another month or add a transaction.' : 'Add a transaction to see your real activity here.'}
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            <button type="button" onClick={onAddExpense} className="flex items-center gap-1 rounded-lg bg-[#FFF0E7] px-3 py-2 text-xs font-semibold text-[#B85D3F] transition hover:bg-[#FBE5D8]"><Plus size={13} aria-hidden="true" />Add expense</button>
            {view === 'flow' && <button type="button" onClick={onAddIncome} className="flex items-center gap-1 rounded-lg bg-[#EAF2E7] px-3 py-2 text-xs font-semibold text-[#58755F] transition hover:bg-[#DDEBD8]"><Plus size={13} aria-hidden="true" />Add income</button>}
          </div>
        </div>
      )}

      <div className="mt-auto border-t border-[#ECEEE6] pt-4">
        <p className="text-[10px] leading-5 text-[#7A8171]">
          {view === 'flow'
            ? `Each point carries forward earlier activity. Shown ${data.grouping}.`
            : 'Categories ranked by their share of your recorded spending.'}
          {' '}{data.transactionCount} transaction{data.transactionCount === 1 ? '' : 's'} in this period.
        </p>
        {hasData && (
          <details key={`${view}-${scope}-${month.getTime()}`} className="group mt-2">
            <summary className="flex w-fit cursor-pointer list-none items-center gap-1 text-[11px] font-semibold text-[#58755F] [&::-webkit-details-marker]:hidden">
              View chart data <ChevronDown size={13} className="transition group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="mt-3 max-h-52 overflow-auto rounded-xl border border-[#E7EADF]">
              <table className="w-full text-left text-[10px]">
                <caption className="sr-only">{view === 'flow' ? 'Cumulative income and spending' : 'Spending by category'}: {period}, in CAD</caption>
                <thead className="sticky top-0 bg-[#F4F6EF] text-[#626B57]">
                  <tr>{(view === 'flow' ? ['Date', 'Income', 'Spending', 'Net'] : ['Category', 'Spent', 'Share']).map((label, index) => <th key={label} scope="col" className={`px-3 py-2 font-medium ${index ? 'text-right' : ''}`}>{label}</th>)}</tr>
                </thead>
                <tbody className="divide-y divide-[#EDF0E7] text-[#505847]">
                  {view === 'flow' ? data.trend.map(point => (
                    <tr key={point.dateLabel}><th scope="row" className="px-3 py-2 font-normal">{point.dateLabel}</th><td className="whitespace-nowrap px-3 py-2 text-right">{money(point.income)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{money(point.expenses)}</td><td className="whitespace-nowrap px-3 py-2 text-right">{money(point.net)}</td></tr>
                  )) : data.categories.map(category => (
                    <tr key={category.name}><th scope="row" className="px-3 py-2 font-normal">{category.name}</th><td className="whitespace-nowrap px-3 py-2 text-right">{money(category.amount)}</td><td className="px-3 py-2 text-right">{share(category.percentage)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </section>
  )
}
