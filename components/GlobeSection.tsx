'use client'

import dynamic from 'next/dynamic'
import { useRef } from 'react'
import { motion, useInView } from 'motion/react'
import type { GlobeConfig } from '@/components/ui/globe'

const World = dynamic(() => import('@/components/ui/globe').then(m => m.World), {
  ssr: false,
})

const globeConfig: GlobeConfig = {
  pointSize: 4,
  globeColor: '#0b1f3a',
  showAtmosphere: true,
  atmosphereColor: '#F5F5F3',
  atmosphereAltitude: 0.12,
  emissive: '#0b1f3a',
  emissiveIntensity: 0.15,
  shininess: 0.9,
  polygonColor: 'rgba(245,245,243,0.55)',
  ambientLight: '#E2835F',
  directionalLeftLight: '#ffffff',
  directionalTopLight: '#ffffff',
  pointLight: '#ffffff',
  arcTime: 1400,
  arcLength: 0.9,
  rings: 1,
  maxRings: 3,
  initialPosition: { lat: 43.6532, lng: -79.3832 },
  autoRotate: true,
  autoRotateSpeed: 0.5,
}

const ORANGE = '#E2835F'
const SAGE = '#A9BA9E'

// Home countries students come from, arcing toward the Canadian cities where
// they study — Toronto, Vancouver and Montreal.
const TORONTO = { lat: 43.6532, lng: -79.3832 }
const VANCOUVER = { lat: 49.2827, lng: -123.1207 }
const MONTREAL = { lat: 45.5019, lng: -73.5674 }

const studentRoutes = [
  { order: 1, start: { lat: 5.6037, lng: -0.187 }, end: TORONTO, arcAlt: 0.4, color: ORANGE }, // Accra, Ghana
  { order: 1, start: { lat: 6.5244, lng: 3.3792 }, end: TORONTO, arcAlt: 0.42, color: ORANGE }, // Lagos, Nigeria
  { order: 2, start: { lat: 28.6139, lng: 77.209 }, end: VANCOUVER, arcAlt: 0.5, color: SAGE }, // New Delhi, India
  { order: 2, start: { lat: -1.2921, lng: 36.8219 }, end: MONTREAL, arcAlt: 0.45, color: ORANGE }, // Nairobi, Kenya
  { order: 3, start: { lat: 39.9042, lng: 116.4074 }, end: VANCOUVER, arcAlt: 0.4, color: SAGE }, // Beijing, China
  { order: 3, start: { lat: 37.5665, lng: 126.978 }, end: VANCOUVER, arcAlt: 0.35, color: SAGE }, // Seoul, South Korea
  { order: 4, start: { lat: 14.5995, lng: 120.9842 }, end: VANCOUVER, arcAlt: 0.45, color: ORANGE }, // Manila, Philippines
  { order: 4, start: { lat: 21.0285, lng: 105.8542 }, end: TORONTO, arcAlt: 0.5, color: SAGE }, // Hanoi, Vietnam
  { order: 5, start: { lat: -23.5505, lng: -46.6333 }, end: TORONTO, arcAlt: 0.3, color: ORANGE }, // Sao Paulo, Brazil
  { order: 5, start: { lat: 51.5072, lng: -0.1276 }, end: MONTREAL, arcAlt: 0.25, color: SAGE }, // London, UK
  { order: 6, start: { lat: 19.4326, lng: -99.1332 }, end: TORONTO, arcAlt: 0.25, color: ORANGE }, // Mexico City, Mexico
  { order: 6, start: { lat: 24.7136, lng: 46.6753 }, end: TORONTO, arcAlt: 0.45, color: SAGE }, // Riyadh, Saudi Arabia
]

const sampleArcs = studentRoutes.map(route => ({
  order: route.order,
  startLat: route.start.lat,
  startLng: route.start.lng,
  endLat: route.end.lat,
  endLng: route.end.lng,
  arcAlt: route.arcAlt,
  color: route.color,
}))

export default function GlobeSection() {
  const globeContainer = useRef<HTMLDivElement>(null)
  const showGlobe = useInView(globeContainer, { once: true, margin: '160px' })

  return (
    <section className="section-reveal border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32">
      <div className="mx-auto max-w-[1120px]">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8 }}
          className="mx-auto max-w-[610px] text-center"
        >
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
            Wherever you&apos;re from
          </p>
          <h2 className="text-[38px] leading-[1.12] tracking-[-1.3px] text-[#F5F5F3] md:text-[50px]">
            We&apos;re all around the world.
          </h2>
          <p className="mx-auto mt-6 max-w-[440px] text-[14px] leading-[1.75] text-[#85857E]">
            Xtrack is built for students who left home to study — wherever that home is.
          </p>
        </motion.div>

        <div ref={globeContainer} className="relative -mx-6 mt-4 h-[420px] overflow-hidden md:-mx-8 md:h-[520px]">
          <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-24 bg-gradient-to-b from-[#1A1A1A] to-transparent" />
          {showGlobe && <World data={sampleArcs} globeConfig={globeConfig} />}
        </div>
      </div>
    </section>
  )
}
