'use client'

import { useEffect } from 'react'
import XtrackLogo from '@/components/XtrackLogo'
import { SPLASH_SEEN_KEY } from './constants'

// Shortest time the splash stays up, so a fast load still shows the bars
// move once instead of flashing the splash for a single frame.
const MIN_MS = 900
// Never hold the app hostage: leave after this however far loading has got.
const MAX_MS = 6500
// Matches the overlay's fade-out in splash-styles.ts.
const EXIT_MS = 550

// The mark from XtrackLogo, drawn here so its three bars can be animated.
// Pieces are in XtrackLogo's artwork units; the viewBox is its 'mark' crop.
function AnimatedMark() {
  return (
    <svg viewBox="18 18 152 122" className="xt-splash__mark" aria-hidden="true">
      <g fill="#f1ece2">
        <path d="M 27.58 38.632 L 58.27 38.632 L 88.96 74.668 L 72.22 94.072 Z" />
        <path d="M 102.91 99.616 L 128.02 130.108 L 158.71 130.108 L 119.65 85.756 Z" />
      </g>
      <path d="M 22 135.652 L 52.69 135.652 L 141.97 38.632 L 125.23 24.772 Z" fill="#E2835F" />
      <path d="M 125.23 44.176 L 164.29 22 L 144.76 60.808 Z" fill="#E2835F" />
      <g fill="#ffffff">
        <path className="xt-splash__bar" d="M 44.32 132.88 L 53.248 132.88 L 53.248 117.3568 L 44.32 117.3568 Z" />
        <path className="xt-splash__bar" d="M 59.944 132.88 L 68.872 132.88 L 68.872 107.932 L 59.944 107.932 Z" />
        <path className="xt-splash__bar" d="M 75.568 132.88 L 84.496 132.88 L 84.496 96.844 L 75.568 96.844 Z" />
      </g>
    </svg>
  )
}

/**
 * Launch screen for the installed (home-screen) app: the Xtrack mark with its
 * three bars moving like a live chart until the app is ready.
 *
 * The overlay is in the server HTML, hidden by default. An inline script in the
 * root layout sets <html data-splash="on"> before first paint when the app was
 * opened standalone and hasn't shown the splash this session, so it appears
 * instantly instead of after hydration. The animation is pure CSS, so it runs
 * before any JavaScript has loaded. This component only removes the overlay
 * once the page underneath has finished loading.
 *
 * Visibility is driven by DOM attributes rather than React state, so the
 * server and client render the same markup.
 */
export default function LaunchSplash() {
  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.splash !== 'on') return

    const startedAt = performance.now()
    let finished = false
    const timers: number[] = []

    // A route still showing its loading.tsx fallback isn't ready yet.
    const pageReady = () => document.readyState !== 'loading' && !document.querySelector('[data-route-loading]')

    function finish() {
      if (finished) return
      finished = true
      root.dataset.splash = 'leaving'
      try {
        sessionStorage.setItem(SPLASH_SEEN_KEY, '1')
      } catch {}
      timers.push(window.setTimeout(() => root.removeAttribute('data-splash'), EXIT_MS))
    }

    function check() {
      if (finished) return
      const elapsed = performance.now() - startedAt
      if (elapsed >= MAX_MS || (pageReady() && elapsed >= MIN_MS)) finish()
    }

    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('load', check)
    timers.push(window.setTimeout(check, MIN_MS), window.setTimeout(check, MAX_MS))

    return () => {
      observer.disconnect()
      window.removeEventListener('load', check)
      timers.forEach(clearTimeout)
    }
  }, [])

  return (
    <div className="xt-splash" role="status" aria-label="Opening Xtrack" style={{ display: 'none' }}>
      <div className="xt-splash__center" aria-hidden="true">
        <AnimatedMark />
        <XtrackLogo variant="word" className="xt-splash__word" />
        <span className="xt-splash__caption">Loading</span>
      </div>
    </div>
  )
}
