import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    // /launch, the manifest and the service worker are public and static:
    // skipping the session check keeps the home-screen launch instant.
    '/((?!_next/static|_next/image|favicon.ico|launch|manifest.webmanifest|spending-sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
