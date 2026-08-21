'use client'

import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useState } from 'react'
import AuthSplit from '@/components/AuthSplit'
import { createClient } from '@/lib/supabase/client'

const inputClass = 'w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-[14px] text-[#F5F5F3] placeholder:text-[#666660] focus:border-[#E2835F]/60 focus:outline-none'
const labelClass = 'mb-2 block text-[13px] font-medium text-[#F5F5F3]/90'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [mode, setMode] = useState<'login' | 'forgot' | 'forgot-sent'>('login')
  const [resetLoading, setResetLoading] = useState(false)

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setLoading(true); setError('')
    const { error } = await createClient().auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  async function handleForgotPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setResetLoading(true); setError('')
    const { error } = await createClient().auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    setResetLoading(false)
    if (error) { setError(error.message); return }
    setMode('forgot-sent')
  }

  if (mode === 'forgot-sent') {
    return (
      <AuthSplit mode="login" title="Check your email" description={`We sent a password reset link to ${email}.`}>
        <p className="text-[13px] leading-[1.75] text-[#85857E]">
          Click the link in that email to choose a new password, then come back and sign in.
        </p>
        <button type="button" onClick={() => setMode('login')} className="mt-5 text-[13px] font-medium text-[#E2835F] hover:underline">
          Back to sign in
        </button>
      </AuthSplit>
    )
  }

  if (mode === 'forgot') {
    return (
      <AuthSplit mode="login" title="Reset your password" description="Enter your email and we'll send you a reset link">
        {error && <p role="alert" className="mb-5 rounded-lg border border-[#E2835F]/20 bg-[#E2835F]/10 px-4 py-3 text-[12px] text-[#E2835F]">{error}</p>}
        <form onSubmit={handleForgotPassword} className="space-y-5">
          <div><label htmlFor="forgot-email" className={labelClass}>Email address</label><input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className={inputClass} /></div>
          <button type="submit" disabled={resetLoading} className="min-h-12 w-full rounded-lg bg-[#F5F5F3] px-6 text-[13px] font-semibold text-[#1A1A1A] hover:bg-white disabled:opacity-50">{resetLoading ? 'Sending…' : 'Send reset link'}</button>
        </form>
        <button type="button" onClick={() => { setMode('login'); setError('') }} className="mt-5 text-[13px] font-medium text-[#E2835F] hover:underline">
          Back to sign in
        </button>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit mode="login" title="Welcome back" description="Enter your credentials to access your account">
      {error && <p role="alert" className="mb-5 rounded-lg border border-[#E2835F]/20 bg-[#E2835F]/10 px-4 py-3 text-[12px] text-[#E2835F]">{error}</p>}
      <form onSubmit={handleLogin} className="space-y-5">
        <div><label htmlFor="login-email" className={labelClass}>Email address</label><input id="login-email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="name@example.com" className={inputClass} /></div>
        <div>
          <div className="flex items-center justify-between gap-4"><label htmlFor="login-password" className={labelClass}>Password</label><button type="button" onClick={() => { setMode('forgot'); setError('') }} className="mb-2 text-[11px] text-[#85857E] hover:text-[#E2835F]">Forgot password?</button></div>
          <div className="relative">
            <input id="login-password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} placeholder="Enter your password" className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73736D] hover:text-[#F5F5F3]">
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#F5F5F3] px-6 text-[13px] font-semibold text-[#1A1A1A] hover:bg-white disabled:opacity-50">{loading ? 'Signing in…' : 'Sign in'}</button>
      </form>
    </AuthSplit>
  )
}
