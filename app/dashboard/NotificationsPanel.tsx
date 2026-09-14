'use client'

import { useEffect, useRef, useState } from 'react'
import { Popover } from '@base-ui/react/popover'
import { Bell, CalendarClock, CheckCheck, LoaderCircle, PiggyBank, Sparkles, Wallet, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import styles from './notifications.module.css'

interface Notification {
  id: string
  title: string
  body: string | null
  type: string
  is_read: boolean
  created_at: string
  dedupe_key?: string
}

interface Props {
  notifications: Notification[]
  onChanged: () => void
  variant?: 'dark' | 'light' | 'rail'
  onOpenChange?: (open: boolean) => void
  onReviewSpendingLimit?: () => void
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
  if (!Number.isFinite(hours)) return ''
  if (hours < 1) return 'Just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export default function NotificationsPanel({ notifications, onChanged, variant = 'dark', onOpenChange, onReviewSpendingLimit }: Props) {
  const [open, setOpen] = useState(false)
  const [readIds, setReadIds] = useState<string[]>([])
  const [pendingIds, setPendingIds] = useState<string[]>([])
  const [error, setError] = useState('')
  const saving = useRef(false)
  const closeRef = useRef<HTMLButtonElement>(null)
  const isRail = variant === 'rail'
  const isRead = (item: Notification) => item.is_read || readIds.includes(item.id)
  const unreadIds = notifications.filter(item => !isRead(item)).map(item => item.id)
  const unreadCount = unreadIds.length
  const busy = pendingIds.length > 0

  // Only the visible desktop/mobile trigger should own an open popover.
  useEffect(() => {
    const media = window.matchMedia('(min-width: 1024px)')
    const handleViewportChange = () => {
      if (media.matches !== isRail) {
        setOpen(false)
        onOpenChange?.(false)
      }
    }
    media.addEventListener('change', handleViewportChange)
    return () => media.removeEventListener('change', handleViewportChange)
  }, [isRail, onOpenChange])

  function changeOpen(next: boolean) {
    setOpen(next)
    onOpenChange?.(next)
    if (next) setError('')
  }

  async function markAsRead(ids: string[]) {
    if (saving.current || ids.length === 0) return
    saving.current = true
    setPendingIds(ids)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: saveError } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', ids)
        .select('id')
      if (saveError) throw saveError
      const updatedIds = (data ?? []).map(item => item.id as string)
      if (updatedIds.length > 0) {
        setReadIds(previous => [...new Set([...previous, ...updatedIds])])
        onChanged()
      }
      if (updatedIds.length !== ids.length) {
        setError('Some notifications could not be marked as read. Please try again.')
      }
    } catch {
      setError('Could not mark notifications as read. Please try again.')
    } finally {
      saving.current = false
      setPendingIds([])
    }
  }

  const buttonClass = isRail
    ? `flex w-full items-center gap-3 rounded-xl px-[11px] py-3 text-left text-sm font-medium transition ${open ? 'bg-white/[0.1] text-[#E98563]' : 'text-white/55 hover:bg-white/[0.06] hover:text-white'}`
    : variant === 'dark'
      ? 'grid size-10 place-items-center rounded-xl bg-white/10 text-white/70 transition hover:bg-white/[0.16] data-popup-open:bg-white/20'
      : 'grid size-10 place-items-center rounded-xl bg-[#F1F3EC] text-[#58755F] transition hover:bg-[#E5EBDD]'

  return (
    <Popover.Root open={open} onOpenChange={changeOpen}>
      <Popover.Trigger
        aria-label={unreadCount ? `Notifications, ${unreadCount} unread` : 'Notifications'}
        title="Notifications"
        className={`${buttonClass} cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E98563]`}
      >
        <span className="relative grid size-[18px] shrink-0 place-items-center">
          <Bell size={18} strokeWidth={1.8} aria-hidden="true" />
          {unreadCount > 0 && (
            <span aria-hidden="true" className="absolute -right-2 -top-2 grid min-w-4 place-items-center rounded-full bg-[#E98563] px-1 text-[9px] font-bold leading-4 text-[#191919] ring-2 ring-[#191A18]">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </span>
        {isRail && (
          <span aria-hidden="true" className="whitespace-nowrap opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-focus-within/rail:opacity-100 group-data-[notifications-open=true]/rail:opacity-100">
            Notifications
          </span>
        )}
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Positioner
          side={isRail ? 'right' : 'bottom'}
          align={isRail ? 'start' : 'end'}
          sideOffset={isRail ? 24 : 12}
          collisionPadding={12}
          positionMethod="fixed"
          className="z-[60]"
        >
          <Popover.Popup
            className={styles.popup}
            initialFocus={closeRef}
            finalFocus={() => window.matchMedia('(min-width: 1024px)').matches === isRail}
          >
            <div className="shrink-0 border-b border-[#EAEBE6] px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Popover.Title className="text-sm font-semibold text-[#242522]">Notifications</Popover.Title>
                  <Popover.Description className="mt-1 text-xs text-[#74776F]" aria-live="polite">
                    {unreadCount ? `${unreadCount} unread update${unreadCount === 1 ? '' : 's'}` : 'You’re all caught up'}
                  </Popover.Description>
                </div>
                <Popover.Close ref={closeRef} aria-label="Close notifications" className="grid size-8 shrink-0 place-items-center rounded-lg text-[#85887F] transition hover:bg-[#F1F3EC] hover:text-[#242522]">
                  <X size={17} aria-hidden="true" />
                </Popover.Close>
              </div>
              {unreadCount > 0 && (
                <button type="button" onClick={() => markAsRead(unreadIds)} disabled={busy} className="mt-3 flex items-center gap-1.5 text-[11px] font-semibold text-[#58755F] hover:text-[#3F6548] disabled:opacity-50">
                  {busy ? <LoaderCircle size={13} className="animate-spin motion-reduce:animate-none" aria-hidden="true" /> : <CheckCheck size={13} aria-hidden="true" />}
                  {busy ? 'Marking as read…' : 'Mark all read'}
                </button>
              )}
            </div>

            {error && <p role="alert" className="shrink-0 border-b border-[#F0D9CE] bg-[#FFF3EC] px-5 py-3 text-xs leading-5 text-[#B9573A]">{error}</p>}

            {notifications.length > 0 ? (
              <ul className={styles.list} aria-label="Recent notifications">
                {notifications.map(item => {
                  const Icon = TYPE_ICON[item.type] ?? Bell
                  const read = isRead(item)
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        onClick={() => !read && markAsRead([item.id])}
                        disabled={busy}
                        className={`flex w-full items-start gap-3 px-5 py-4 text-left transition hover:bg-[#F5F6F0] disabled:cursor-wait ${read ? 'bg-white' : 'bg-[#FFF8F3]'}`}
                      >
                        <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-[#FFF0EA] text-[#D86F4E]">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start gap-2">
                            <span className="min-w-0 flex-1 break-words text-[13px] font-semibold leading-5 text-[#343630]">{item.title}</span>
                            {!read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#E98563]" aria-hidden="true" />}
                            <span className="sr-only">{read ? 'Read' : 'Unread. Mark as read'}</span>
                          </span>
                          {item.body && <span className="mt-1 block break-words text-xs leading-5 text-[#74776F]">{item.body}</span>}
                          <time dateTime={item.created_at} className="mt-2 block text-[10px] text-[#85887F]">{timeAgo(item.created_at)}</time>
                        </span>
                      </button>
                      {item.dedupe_key?.startsWith('spending_limit:') && onReviewSpendingLimit && (
                        <button type="button" onClick={() => { changeOpen(false); onReviewSpendingLimit() }} className="w-full px-5 pb-3 pt-1 text-left text-[11px] font-semibold text-[#58755F] hover:underline">View spending limit →</button>
                      )}
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="flex flex-col items-center px-6 py-10 text-center">
                <span className="grid size-12 place-items-center rounded-2xl bg-[#F1F3EC] text-[#829A83]"><Bell size={22} aria-hidden="true" /></span>
                <p className="mt-4 text-sm font-medium text-[#454A3E]">No notifications yet</p>
                <p className="mt-2 max-w-60 text-xs leading-5 text-[#85887F]">Bill reminders, budget updates, and AI insights will appear here.</p>
              </div>
            )}
          </Popover.Popup>
        </Popover.Positioner>
      </Popover.Portal>
    </Popover.Root>
  )
}
