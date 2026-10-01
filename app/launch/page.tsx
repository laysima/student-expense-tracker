import type { Metadata } from 'next'
import LaunchRedirect from './LaunchRedirect'

export const metadata: Metadata = { title: 'Xtrack' }

// Home-screen start URL. Static, public and data-free, so it is served from the
// CDN (or the service worker's cache) immediately and the splash paints at
// once. The dashboard then loads behind the splash, which waits for the
// data-route-loading marker to disappear before fading out.
export default function LaunchPage() {
  return (
    <div data-route-loading className="min-h-screen bg-[#1B211C]">
      <LaunchRedirect />
    </div>
  )
}
