'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function SpendingAlertSync({ active, activity, signature }: {
  active: boolean
  activity: string
  signature: string
}) {
  const router = useRouter()
  useEffect(() => {
    if (!active) return
    const controller = new AbortController()
    let busy = false
    async function sync() {
      if (busy || document.visibilityState === 'hidden') return
      busy = true
      try {
        const response = await fetch('/api/spending-limit/sync', { method: 'POST', signal: controller.signal })
        if (!response.ok) return
        const data = await response.json()
        if (!controller.signal.aborted && data.signature !== signature) router.refresh()
      } catch { /* The database already saved the alert; retry on focus/timer. */ }
      finally { busy = false }
    }
    void sync()
    const interval = window.setInterval(sync, 60_000)
    window.addEventListener('focus', sync)
    return () => {
      controller.abort()
      window.clearInterval(interval)
      window.removeEventListener('focus', sync)
    }
  }, [active, activity, signature, router])
  return null
}
