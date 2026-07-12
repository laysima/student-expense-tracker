'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      router.push('/dashboard')
      router.refresh()
    }
  }

  return (
    <div
      className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-[10px]">

      {/* Coral frame */}
      <div className="w-full max-w-[480px] border-[10px] border-[#E2835F]  bg-[#1A1A1A] overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#2a2a2a]">
          <span className="text-[21px] font-bold text-[#F5F5F3] tracking-tight">
            X<span className="text-[#E2835F]">track</span>
          </span>
          <Link
            href="/signup"
            className="text-[13px] font-medium text-[#9B9B94] hover:text-[#F5F5F3] transition-colors"
          >
            No account? <span className="text-[#E2835F]">Sign up</span>
          </Link>
        </div>

        {/* Form area */}
        <div className="px-8 py-10">
          <p className="text-[12px] font-medium text-[#E2835F] tracking-[0.1em] uppercase mb-4">
            Welcome back
          </p>
          <h1 className="text-[36px] font-bold text-[#F5F5F3] leading-[1.08] tracking-[-1px] mb-2">
            Sign in to your<br />
            <span className="text-[#E2835F]">account.</span>
          </h1>
          <p className="text-[14px] text-[#9B9B94] mb-8 leading-relaxed">
            Track your spending, monitor your runway, and stay on top of your budget abroad.
          </p>

          {error && (
            <div className="mb-6 px-4 py-3  bg-[#E2835F]/10 border border-[#E2835F]/20 text-[#E2835F] text-[13px] font-medium">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-[12px] font-medium text-[#9B9B94] mb-2 tracking-[0.05em] uppercase">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="you@example.com"
                className="w-full px-4 py-3 bg-[#222] border border-[#2e2e2e]  text-[14px] text-[#F5F5F3] placeholder-[#9B9B94]/50 focus:outline-none focus:border-[#E2835F]/60 transition-colors"
              />
            </div>

            <div>
              <label className="block text-[12px] font-medium text-[#9B9B94] mb-2 tracking-[0.05em] uppercase">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                placeholder="••••••••"
                className="w-full px-4 py-3 bg-[#222] border border-[#2e2e2e]  text-[14px] text-[#F5F5F3] placeholder-[#9B9B94]/50 focus:outline-none focus:border-[#E2835F]/60 transition-colors"
              />
            </div>

            <div className="flex justify-end">
              <button className="text-[13px] text-[#9B9B94] hover:text-[#E2835F] transition-colors underline underline-offset-2">
                Forgot password?
              </button>
            </div>

            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full py-3 bg-[#E2835F] hover:opacity-90 disabled:opacity-50 text-white text-[14px] font-medium  transition-opacity mt-2"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>

          {/* Mini stat cards at bottom for visual flavor */}
          <div className="mt-10 grid grid-cols-2 gap-3">
            <div className="bg-[#E2835F]  p-4">
              <p className="text-[11px] font-medium text-white/70 mb-1">Budget runway</p>
              <p className="text-[22px] font-bold text-white leading-none">47 days</p>
            </div>
            <div className="bg-[#A9BA9E]  p-4">
              <p className="text-[11px] font-medium text-[#1A1A1A]/60 mb-1">Saved this month</p>
              <p className="text-[22px] font-bold text-[#1A1A1A] leading-none">$640</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}