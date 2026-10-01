'use client'

import { useEffect, useRef } from 'react'
import XtrackLogo from '@/components/XtrackLogo'
import { SPLASH_SEEN_KEY } from './constants'
import type { SplashScene } from './splash-scene'

// Shortest time the static logo stays up if the 3D scene isn't ready, so a
// fast load doesn't flash the splash for a single frame.
const MIN_STATIC_MS = 700
// Never hold the app hostage: leave after this however far loading has got.
const MAX_MS = 6500
const EXIT_MS = 550

/**
 * Launch screen for the installed (home-screen) app.
 *
 * The overlay is in the server HTML, hidden by default. An inline script in the
 * root layout sets <html data-splash="on"> before first paint when the app was
 * opened standalone and hasn't shown the splash this session, so it appears
 * instantly instead of after hydration. This component then upgrades the
 * static logo to the three.js scene and removes the overlay once the page
 * underneath has finished loading.
 *
 * Visibility is driven by DOM attributes rather than React state, so the
 * server and client render the same markup.
 */
export default function LaunchSplash() {
  const overlayRef = useRef<HTMLDivElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const root = document.documentElement
    if (root.dataset.splash !== 'on') return

    const startedAt = performance.now()
    let scene: SplashScene | null = null
    let introDone = false
    let finished = false
    // Set on unmount so a three.js import that resolves afterwards does nothing.
    let cancelled = false
    const timers: number[] = []

    // A route still showing its loading.tsx fallback isn't ready yet.
    const pageReady = () => document.readyState !== 'loading' && !document.querySelector('[data-route-loading]')

    function finish() {
      if (finished) return
      finished = true
      scene?.exit()
      root.dataset.splash = 'leaving'
      try {
        sessionStorage.setItem(SPLASH_SEEN_KEY, '1')
      } catch {}
      timers.push(
        window.setTimeout(() => {
          root.removeAttribute('data-splash')
          scene?.dispose()
          scene = null
        }, EXIT_MS),
      )
    }

    function check() {
      if (finished || cancelled) return
      const elapsed = performance.now() - startedAt
      if (elapsed >= MAX_MS) return finish()
      if (!pageReady()) return
      // Let a running intro finish; otherwise don't hang around for three.js.
      if (scene ? introDone : elapsed >= MIN_STATIC_MS) finish()
    }

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (!reduceMotion) {
      import('./splash-scene')
        .then(({ createSplashScene }) => {
          // Already gone, or the page loaded while three.js was downloading.
          if (finished || cancelled || !stageRef.current) return
          if (pageReady() && performance.now() - startedAt >= MIN_STATIC_MS) return check()
          scene = createSplashScene(stageRef.current, () => {
            introDone = true
            check()
          })
          if (scene) overlayRef.current?.setAttribute('data-live', '')
        })
        .catch(() => {})
    }

    const observer = new MutationObserver(check)
    observer.observe(document.body, { childList: true, subtree: true })
    window.addEventListener('load', check)
    timers.push(window.setTimeout(check, MIN_STATIC_MS), window.setTimeout(check, MAX_MS))
    check()

    return () => {
      cancelled = true
      observer.disconnect()
      window.removeEventListener('load', check)
      timers.forEach(clearTimeout)
      scene?.dispose()
    }
  }, [])

  return (
    <div ref={overlayRef} className="xt-splash" role="status" aria-label="Opening Xtrack" style={{ display: 'none' }}>
      <div ref={stageRef} className="xt-splash__stage" aria-hidden="true" />
      <span className="xt-splash__mark" aria-hidden="true">
        <XtrackLogo variant="mark" className="h-auto w-full" />
      </span>
      <span className="xt-splash__brand" aria-hidden="true">
        <XtrackLogo variant="word" className="xt-splash__word" />
        <span className="xt-splash__bar" />
      </span>
    </div>
  )
}
