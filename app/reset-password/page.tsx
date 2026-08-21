'use client'

import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useState } from 'react'
import AuthSplit from '@/components/AuthSplit'
import { createClient } from '@/lib/supabase/client'

const inputClass = 'w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-[14px] text-[#F5F5F3] placeholder:text-[#666660] focus:border-[#E2835F]/60 focus:outline-none'
const labelClass = 'mb-2 block text-[13px] font-medium text-[#F5F5F3]/90'

export default function ResetPasswordPage() {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (password !== confirmPassword) { setError('Passwords do not match.'); return }
    setLoading(true); setError('')
    const { error } = await createClient().auth.updateUser({ password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard'); router.refresh()
  }

  return (
    <AuthSplit mode="login" title="Choose a new password" description="This will replace your current password">
      {error && <p role="alert" className="mb-5 rounded-lg border border-[#E2835F]/20 bg-[#E2835F]/10 px-4 py-3 text-[12px] text-[#E2835F]">{error}</p>}
      <form onSubmit={handleReset} className="space-y-5">
        <div>
          <label htmlFor="new-password" className={labelClass}>New password</label>
          <div className="relative">
            <input id="new-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" className={`${inputClass} pr-11`} />
            <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73736D] hover:text-[#F5F5F3]">
              {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="confirm-password" className={labelClass}>Confirm new password</label>
          <input id="confirm-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} placeholder="Re-enter your password" className={inputClass} />
        </div>
        <button type="submit" disabled={loading} className="min-h-12 w-full rounded-lg bg-[#F5F5F3] px-6 text-[13px] font-semibold text-[#1A1A1A] hover:bg-white disabled:opacity-50">{loading ? 'Updating…' : 'Update password'}</button>
      </form>
    </AuthSplit>
  )
}
