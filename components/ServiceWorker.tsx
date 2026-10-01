'use client'

import { useEffect } from 'react'
import { registerServiceWorker } from '@/lib/service-worker'

// Installs the worker for everyone (not only people who turn on spending
// alerts) so the home-screen app can open from its cache.
export default function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    const register = () => { registerServiceWorker().catch(() => {}) }
    if (document.readyState === 'complete') register()
    else window.addEventListener('load', register, { once: true })
    return () => window.removeEventListener('load', register)
  }, [])
  return null
}
