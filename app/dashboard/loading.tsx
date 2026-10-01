import XtrackLogo from '@/components/XtrackLogo'

// Streams straight away while the dashboard's data loads. The launch splash
// waits for this marker to disappear before it fades out.
export default function Loading() {
  return (
    <div data-route-loading className="grid min-h-screen place-items-center bg-[#ecede6] text-[#242522]">
      <XtrackLogo variant="mark" className="h-auto w-14 animate-pulse" />
    </div>
  )
}
