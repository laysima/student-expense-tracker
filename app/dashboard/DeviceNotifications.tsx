'use client'

import { useEffect, useState } from 'react'
import { Bell, BellRing } from 'lucide-react'

export default function DeviceNotifications() {
  const [status, setStatus] = useState<'loading' | 'unsupported' | 'unavailable' | 'off' | 'on' | 'blocked'>('loading')
  const [publicKey, setPublicKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    async function load() {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || !('Notification' in window)) {
        if (!cancelled) setStatus('unsupported')
        return
      }
      try {
        const response = await fetch('/api/push-subscriptions')
        if (!response.ok) throw new Error('Could not check device notifications. Refresh to try again.')
        const data = await response.json()
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (cancelled) return
        setPublicKey(data.publicKey ?? '')
        setStatus(!data.publicKey ? 'unavailable' : Notification.permission === 'denied' ? 'blocked'
          : subscription && data.endpoints.includes(subscription.endpoint) ? 'on' : 'off')
      } catch (error) {
        if (!cancelled) {
          setStatus('unavailable')
          setError(error instanceof Error ? error.message : 'Could not check device notifications.')
        }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [])

  async function toggle() {
    if (busy) return
    setBusy(true)
    setError('')
    let newSubscription: PushSubscription | null = null
    try {
      if (status === 'on') {
        const registration = await navigator.serviceWorker.getRegistration('/')
        const subscription = await registration?.pushManager.getSubscription()
        if (subscription) {
          const response = await fetch('/api/push-subscriptions', {
            method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ endpoint: subscription.endpoint }),
          })
          if (!response.ok) throw new Error('Could not turn off device notifications. Please try again.')
          await subscription.unsubscribe()
        }
        setStatus('off')
      } else {
        // Permission is requested only after an explicit click, never on load.
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') {
          setStatus(permission === 'denied' ? 'blocked' : 'off')
          if (permission === 'default') setError('Notifications weren’t enabled. You can try again whenever you’re ready.')
          return
        }
        await navigator.serviceWorker.register('/spending-sw.js', { scope: '/', updateViaCache: 'none' })
        const registration = await navigator.serviceWorker.ready
        const existing = await registration.pushManager.getSubscription()
        const padded = publicKey.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - publicKey.length % 4) % 4)
        const key = Uint8Array.from(atob(padded), character => character.charCodeAt(0))
        const subscription = existing ?? await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
        if (!existing) newSubscription = subscription
        const response = await fetch('/api/push-subscriptions', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(subscription.toJSON()),
        })
        const data = await response.json()
        if (!response.ok) throw new Error(data.error ?? 'Could not enable device notifications.')
        setStatus('on')
      }
    } catch (error) {
      await newSubscription?.unsubscribe().catch(() => {})
      setError(error instanceof Error ? error.message : 'Could not update device notifications. Please try again.')
    } finally { setBusy(false) }
  }

  const description = status === 'on' ? 'Alerts can reach this device when Xtrack is closed.'
    : status === 'unsupported' ? 'Use a browser that supports push alerts. On iPhone or iPad, add Xtrack to your Home Screen first.'
    : status === 'blocked' ? 'Notifications are blocked. Allow them in your browser’s site settings, then refresh.'
    : status === 'unavailable' ? 'Device alerts are not available yet. You can still use the in-app notification bell.'
    : status === 'loading' ? 'Checking notification availability…'
    : 'Get a reminder to visit Xtrack as you approach your limit, even with the app closed.'

  return (
    <div className="rounded-xl border border-[#E5E8DF] bg-[#F8F9F5] p-4">
      <div className="flex flex-wrap items-center gap-3">
        {status === 'on' ? <BellRing size={18} className="text-[#58755F]" aria-hidden="true" /> : <Bell size={18} className="text-[#85887F]" aria-hidden="true" />}
        <div className="min-w-[180px] flex-1">
          <p className="text-xs font-semibold text-[#41443E]">{status === 'on' ? 'Device notifications on' : 'Device notifications'}</p>
          <p className="mt-1 text-[11px] leading-5 text-[#74776F]">{description}</p>
        </div>
        {(status === 'on' || status === 'off') && <button type="button" disabled={busy} onClick={toggle} className="rounded-lg border border-[#D9DFD3] bg-white px-3 py-2 text-xs font-semibold text-[#58755F] hover:bg-[#EDF2E8] disabled:opacity-50">{busy ? 'Updating…' : status === 'on' ? 'Turn off on this device' : 'Enable on this device'}</button>}
      </div>
      {error && <p role="alert" className="mt-2 text-xs text-[#B9573A]">{error}</p>}
    </div>
  )
}
