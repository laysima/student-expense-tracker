'use client'

import { useEffect, useRef, useState } from 'react'

const formatter = new Intl.NumberFormat('en-CA', {
  style: 'currency',
  currency: 'CAD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const DURATION_MS = 900
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - 2 ** (-10 * t))

interface Props {
  value: number
  className?: string
  /** Applied to the ".07" part, which is set smaller so the dollars lead. */
  centsClassName?: string
}

/**
 * A CAD amount that counts up to its value when the dashboard opens, and
 * glides to the new figure when it changes (e.g. switching to "By month").
 * Screen readers get the final value straight away.
 */
export default function AnimatedMoney({ value, className = '', centsClassName = '' }: Props) {
  const [shown, setShown] = useState(0)
  const shownRef = useRef(0)

  useEffect(() => {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const from = shownRef.current
    let frame = 0
    let start = -1
    const step = (now: number) => {
      if (start < 0) start = now
      const progress = reduceMotion ? 1 : Math.min(1, (now - start) / DURATION_MS)
      const next = progress >= 1 ? value : from + (value - from) * easeOutExpo(progress)
      shownRef.current = next
      setShown(next)
      if (progress < 1) frame = requestAnimationFrame(step)
    }
    frame = requestAnimationFrame(step)
    return () => cancelAnimationFrame(frame)
  }, [value])

  const text = formatter.format(shown)
  const point = text.lastIndexOf('.')
  const whole = point >= 0 ? text.slice(0, point) : text
  const cents = point >= 0 ? text.slice(point) : ''

  return (
    <span className={className}>
      <span className="sr-only">{formatter.format(value)}</span>
      <span aria-hidden="true">
        {whole}
        <span className={centsClassName}>{cents}</span>
      </span>
    </span>
  )
}
