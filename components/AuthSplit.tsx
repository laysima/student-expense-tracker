'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import TestimonialMarquee from '@/components/TestimonialMarquee'
import SiteLogo from '@/components/SiteLogo'

type Props = { mode: 'login' | 'signup'; title: string; description: string; children: ReactNode }

export default function AuthSplit({ mode, title, description, children }: Props) {
  const [oauthError, setOauthError] = useState('')
  const [oauthLoading, setOauthLoading] = useState<'google' | 'github' | null>(null)

  // Auth pages always render dark and don't have a theme toggle. If the
  // landing page's light mode was left on, its .light-theme class stays on
  // <html> across client-side navigation (same document, different route),
  // which selectively flips text colors here without a matching background
  // flip — making input text unreadable. Force it off while mounted.
  useEffect(() => {
    document.documentElement.classList.remove('light-theme')
    document.documentElement.style.colorScheme = 'dark'
  }, [])
  const alternate = mode === 'login'
    ? { prompt: 'New to Xtrack?', label: 'Create account', href: '/signup' }
    : { prompt: 'Already tracking?', label: 'Sign in', href: '/login' }

  async function handleOAuth(provider: 'google' | 'github') {
    setOauthError('')
    setOauthLoading(provider)
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/dashboard` },
    })
    if (error) { setOauthError(error.message); setOauthLoading(null) }
  }

  return (
    <main className="min-h-screen bg-[#1A1A1A] p-[10px] text-[#F5F5F3]">
      <div className="mx-auto grid min-h-[calc(100vh-20px)] max-w-[1440px] overflow-hidden rounded-[28px] border border-white/[0.08] bg-[#141414] lg:grid-cols-2">

        <section className="flex min-h-full flex-col justify-between px-6 py-8 sm:px-12 sm:py-10 lg:px-16 lg:py-14">
          <div className="w-full max-w-[420px]">
            <SiteLogo size="large" surface="dark" />

            <h1 className="mt-8 text-[32px] font-semibold tracking-[-0.8px] text-[#F5F5F3] sm:text-[36px]">
              {title}
            </h1>
            <p className="mt-2 text-[14px] text-[#85857E]">{description}</p>

            <div className="mt-9">{children}</div>

            <div className="mt-7 grid gap-3 sm:grid-cols-2">
              <button type="button" onClick={() => handleOAuth('google')} disabled={oauthLoading !== null} className="flex min-h-11 items-center justify-center gap-3 rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 text-[13px] text-[#F5F5F3] transition-colors hover:border-[#E2835F]/50 disabled:opacity-50"><span className="text-[16px] font-semibold text-[#E2835F]">G</span>{oauthLoading === 'google' ? 'Connecting…' : 'Google'}</button>
              <button type="button" onClick={() => handleOAuth('github')} disabled={oauthLoading !== null} className="flex min-h-11 items-center justify-center gap-3 rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 text-[13px] text-[#F5F5F3] transition-colors hover:border-[#E2835F]/50 disabled:opacity-50"><svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M12 2C6.48 2 2 6.59 2 12.25c0 4.53 2.87 8.37 6.84 9.73.5.1.68-.22.68-.49v-1.91c-2.78.62-3.37-1.21-3.37-1.21-.45-1.18-1.11-1.49-1.11-1.49-.91-.64.07-.62.07-.62 1 .07 1.53 1.06 1.53 1.06.9 1.57 2.35 1.12 2.92.85.09-.66.35-1.12.64-1.37-2.22-.26-4.56-1.14-4.56-5.07 0-1.12.39-2.03 1.03-2.75-.1-.26-.45-1.3.1-2.71 0 0 .84-.28 2.75 1.05A9.32 9.32 0 0 1 12 7.03c.85 0 1.7.12 2.5.34 1.91-1.33 2.75-1.05 2.75-1.05.55 1.41.2 2.45.1 2.71.64.72 1.03 1.63 1.03 2.75 0 3.94-2.34 4.8-4.57 5.06.36.32.68.94.68 1.9v2.75c0 .27.18.59.69.49A10.25 10.25 0 0 0 22 12.25C22 6.59 17.52 2 12 2Z" /></svg>{oauthLoading === 'github' ? 'Connecting…' : 'GitHub'}</button>
            </div>
            {oauthError && <p role="alert" className="mt-4 rounded-lg border border-[#E2835F]/20 bg-[#E2835F]/10 px-4 py-3 text-[12px] text-[#E2835F]">{oauthError}</p>}

            <p className="mt-7 text-[13px] text-[#73736D]">{alternate.prompt} <Link href={alternate.href} className="font-medium text-[#E2835F] hover:underline">{alternate.label}</Link></p>
          </div>

          <Link href="/" className="mt-10 flex w-fit items-center gap-2 text-[13px] text-[#85857E] transition-colors hover:text-[#F5F5F3]">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to home
          </Link>
        </section>

        <section className="auth-dotted-grid relative hidden items-center overflow-hidden lg:flex">
          <TestimonialMarquee className="w-full" />
        </section>

      </div>
    </main>
  )
}
