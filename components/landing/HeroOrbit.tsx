'use client'

import { useEffect, useRef } from 'react'
import type { HeroOrbitScene } from './hero-orbit-scene'
import styles from './hero-orbit.module.css'

export default function HeroOrbit() {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!host) return
    const region = host.closest<HTMLElement>('[data-hero-visual]') ?? host
    const media = window.matchMedia('(min-width: 1024px) and (prefers-reduced-motion: no-preference)')
    let inView = false
    let disposed = false
    let loading = false
    let failed = false
    let scene: HeroOrbitScene | null = null
    const syncTheme = () => scene?.setTheme(document.documentElement.classList.contains('light-theme'))

    async function sync() {
      if (disposed) return
      if (!media.matches) {
        scene?.dispose()
        scene = null
        return
      }
      const active = inView && !document.hidden
      if (scene) { scene.setActive(active); return }
      if (!active || loading || failed) return
      loading = true
      try {
        const { createHeroOrbitScene } = await import('./hero-orbit-scene')
        if (disposed || !media.matches || !inView || document.hidden) return
        scene = createHeroOrbitScene(host!, region)
        failed = !scene
        syncTheme()
        scene?.setActive(true)
      } catch {
        // The decorative layer is optional; the CSS artwork stays visible.
        failed = true
      } finally {
        loading = false
      }
    }

    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting
      void sync()
    })
    observer.observe(region)
    const themeObserver = new MutationObserver(syncTheme)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    media.addEventListener('change', sync)
    document.addEventListener('visibilitychange', sync)
    return () => {
      disposed = true
      observer.disconnect()
      themeObserver.disconnect()
      media.removeEventListener('change', sync)
      document.removeEventListener('visibilitychange', sync)
      scene?.dispose()
    }
  }, [])

  return (
    <div className={styles.artwork} aria-hidden="true">
      <div className={styles.glow} />
      <div ref={hostRef} className={styles.canvas} />
      <div className={styles.fallback}>
        <span className={styles.outerRing} />
        <span className={styles.innerRing} />
        <span className={styles.node} />
      </div>
    </div>
  )
}
