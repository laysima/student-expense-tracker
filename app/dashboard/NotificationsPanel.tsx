'use client'

import { useEffect, useRef, useState } from 'react'
import { Bell, CalendarClock, PiggyBank, Sparkles, Wallet } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface Notification {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  created_at: string
}

interface Props {
  notifications: Notification[]
  onChanged: () => void
  variant?: 'dark' | 'light'
  align?: 'left' | 'right'
}

const TYPE_ICON: Record<string, typeof Bell> = {
  payment_due: CalendarClock,
  budget_exceeded: Wallet,
  ai_insight: Sparkles,
  savings_goal: PiggyBank,
}

function timeAgo(dateString: string) {
  const diffMs = Date.now() - new Date(dateString).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function NotificationsPanel({ notifications, onChanged, variant = 'dark', align = 'right' }: Props) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const unreadCount = notifications.filter(item => !item.is_read).length

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  async function markRead(id: string) {
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).eq('id', id)
    onChanged()
  }

  async function markAllRead() {
    const supabase = createClient()
    const unreadIds = notifications.filter(item => !item.is_read).map(item => item.id)
    if (unreadIds.length === 0) return
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    onChanged()
  }

  const buttonClass =
    variant === 'dark'
      ? 'grid size-10 place-items-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/[0.16]'
      : 'grid size-9 place-items-center rounded-lg text-white/40 transition hover:bg-white/[0.06] hover:text-[#E98563]'

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(value => !value)}
        aria-label="Notifications"
        aria-expanded={open}
        className={buttonClass}
      >
        <Bell size={variant === 'dark' ? 18 : 17} aria-hidden="true" />
        {unreadCount > 0 && (
          <span className="absolute right-1.5 top-1.5 grid size-4 place-items-center rounded-full bg-[#E98563] text-[9px] font-bold text-[#191919]">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className={`absolute top-12 z-30 w-[320px] overflow-hidden rounded-2xl border border-[#DFE0DA] bg-white shadow-[0_20px_60px_rgba(16,17,14,0.18)] ${align === 'left' ? 'left-0' : 'right-0'}`}>
          <div className="flex items-center justify-between border-b border-[#EAEBE6] px-4 py-3.5">
            <p className="text-sm font-semibold text-[#242522]">Notifications</p>
            {unreadCount > 0 && (
              <button type="button" onClick={markAllRead} className="text-[11px] font-semibold text-[#658069] hover:underline">
                Mark all read
              </button>
            )}
          </div>

          {notifications.length > 0 ? (
            <div className="max-h-[360px] divide-y divide-[#F1F2ED] overflow-y-auto">
              {notifications.map(item => {
                const Icon = TYPE_ICON[item.type] ?? Bell
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => !item.is_read && markRead(item.id)}
                    className={`flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-[#F8F8F5] ${!item.is_read ? 'bg-[#FFF8F5]' : ''}`}
                  >
                    <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#FFF0EA] text-[#D86F4E]">
                      <Icon size={15} aria-hidden="true" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-semibold text-[#242522]">{item.title}</span>
                        {!item.is_read && <span className="size-1.5 shrink-0 rounded-full bg-[#E98563]" />}
                      </span>
                      {item.body && <span className="mt-0.5 block text-[12px] leading-5 text-[#74776F]">{item.body}</span>}
                      <span className="mt-1 block text-[10px] text-[#A0A39B]">{timeAgo(item.created_at)}</span>
                    </span>
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="px-4 py-8 text-center">
              <Bell size={20} className="mx-auto text-[#C4C6BF]" aria-hidden="true" />
              <p className="mt-2 text-[12px] text-[#91948C]">You&apos;re all caught up</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
