'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export const monthKey = (year: number, month: number) => `${year}-${month}`

interface Props {
  /** First day of the month on screen. */
  value: Date
  /** Earliest and latest months that can be picked (first of month). */
  min: Date
  max: Date
  /** monthKey(year, monthIndex) for months that have any entries. */
  activeMonths: Set<string>
  onSelect: (month: Date) => void
  onClose: () => void
  /** Shows an "All time" choice above the grid. */
  onSelectAll?: () => void
  /** True while "All time" is the active scope (no month is highlighted). */
  allSelected?: boolean
  /** Which edge of the trigger the panel lines up with. */
  align?: 'left' | 'center' | 'right'
}

/** A year-at-a-time grid of months, shown as a popover under the trigger. */
export default function MonthPicker({ value, min, max, activeMonths, onSelect, onClose, onSelectAll, allSelected = false, align = 'left' }: Props) {
  const [year, setYear] = useState(value.getFullYear())
  const panelRef = useRef<HTMLDivElement>(null)
  const selectedRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    selectedRef.current?.focus()
    function handlePointer(event: PointerEvent) {
      if (!panelRef.current?.contains(event.target as Node)) onClose()
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    // Deferred so the click that opened the picker doesn't immediately close it.
    const timer = window.setTimeout(() => document.addEventListener('pointerdown', handlePointer))
    document.addEventListener('keydown', handleKey)
    return () => {
      window.clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointer)
      document.removeEventListener('keydown', handleKey)
    }
  }, [onClose])

  const minIndex = min.getFullYear() * 12 + min.getMonth()
  const maxIndex = max.getFullYear() * 12 + max.getMonth()

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-label="Choose a month"
      className={`absolute top-full z-50 mt-2 w-[288px] max-w-[calc(100vw-32px)] rounded-3xl border border-[#D7D9D2] bg-white p-4 text-[#242522] shadow-[0_2px_6px_rgba(36,37,34,0.08),0_28px_64px_rgba(36,37,34,0.24)] ${
        align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
      }`}
    >
      {onSelectAll && (
        <button
          type="button"
          onClick={onSelectAll}
          aria-pressed={allSelected}
          className={`flex h-11 w-full items-center justify-center rounded-2xl border text-[13px] font-semibold transition ${
            allSelected ? 'border-[#28352A] bg-[#28352A] text-white' : 'border-[#DFE0DA] bg-white text-[#242522] hover:bg-[#F1F2ED]'
          }`}
        >
          All time
        </button>
      )}
      {onSelectAll && (
        <div className="my-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#91948C]" aria-hidden="true">
          <span className="h-px flex-1 bg-[#E7E8E2]" />or pick a month<span className="h-px flex-1 bg-[#E7E8E2]" />
        </div>
      )}
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => setYear(current => current - 1)}
          disabled={year <= min.getFullYear()}
          aria-label="Previous year"
          className="grid size-9 place-items-center rounded-lg text-[#5C5F57] transition hover:bg-[#F1F2ED] disabled:opacity-30"
        >
          <ChevronLeft size={16} aria-hidden="true" />
        </button>
        <p className="text-sm font-semibold text-[#242522]">{year}</p>
        <button
          type="button"
          onClick={() => setYear(current => current + 1)}
          disabled={year >= max.getFullYear()}
          aria-label="Next year"
          className="grid size-9 place-items-center rounded-lg text-[#5C5F57] transition hover:bg-[#F1F2ED] disabled:opacity-30"
        >
          <ChevronRight size={16} aria-hidden="true" />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-1.5">
        {MONTHS.map((label, month) => {
          const index = year * 12 + month
          const disabled = index < minIndex || index > maxIndex
          const selected = !allSelected && year === value.getFullYear() && month === value.getMonth()
          const isCurrent = index === maxIndex
          const hasActivity = activeMonths.has(monthKey(year, month))
          return (
            <button
              key={label}
              ref={selected ? selectedRef : undefined}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              aria-label={`${new Date(year, month, 1).toLocaleDateString('en-CA', { month: 'long', year: 'numeric' })}${hasActivity ? ', has activity' : ''}`}
              onClick={() => onSelect(new Date(year, month, 1))}
              className={`relative flex h-11 flex-col items-center justify-center rounded-xl text-[13px] font-semibold transition disabled:cursor-not-allowed disabled:text-[#C9CBC3] ${
                selected
                  ? 'bg-[#28352A] text-white'
                  : isCurrent
                    ? 'bg-[#EAF2E9] text-[#3F6548] hover:bg-[#EAF2E9]'
                    : 'text-[#343630] hover:bg-[#F1F2ED]'
              }`}
            >
              {label}
              {hasActivity && !disabled && (
                <span aria-hidden="true" className={`absolute bottom-1.5 size-1 rounded-full ${selected ? 'bg-white/70' : 'bg-[#28352A]'}`} />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
