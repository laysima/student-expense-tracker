'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = [
  { code: 'GHS', label: 'GHS — Ghanaian Cedi' },
  { code: 'NGN', label: 'NGN — Nigerian Naira' },
  { code: 'KES', label: 'KES — Kenyan Shilling' },
  { code: 'ZAR', label: 'ZAR — South African Rand' },
  { code: 'INR', label: 'INR — Indian Rupee' },
  { code: 'USD', label: 'USD — US Dollar' },
  { code: 'GBP', label: 'GBP — British Pound' },
  { code: 'EUR', label: 'EUR — Euro' },
]

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    university: '',
    homeCurrency: 'GHS',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  function update(field: string, value: string) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSignup() {
    setLoading(true)
    setError('')
    const supabase = createClient()

    const { error } = await supabase.auth.signUp({
      email: form.email,
      password: form.password,
      options: { data: { full_name: form.fullName } },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await supabase.from('profiles').update({
        university: form.university,
        home_currency: form.homeCurrency,
      }).eq('id', user.id)
    }

    router.push('/dashboard')
    router.refresh()
  }

  const inputClass = "w-full px-4 py-3 bg-[#222] border border-[#2e2e2e] text-[14px] text-[#F5F5F3] placeholder-[#9B9B94]/50 focus:outline-none focus:border-[#E2835F]/60 transition-colors"
  const labelClass = "block text-[12px] font-medium text-[#9B9B94] mb-2 tracking-[0.05em] uppercase"

  return (
    <div
      className="min-h-screen bg-[#1A1A1A] flex items-center justify-center p-[10px]">

      {/* Coral frame */}
      <div className="w-full max-w-[480px] border-[10px] border-[#E2835F] bg-[#1A1A1A] overflow-hidden">

        {/* Top bar */}
        <div className="flex items-center justify-between px-8 py-5 border-b border-[#2a2a2a]">
          <span className="text-[21px] font-bold text-[#F5F5F3] tracking-tight">
           X<span className="text-[#E2835F]">track</span>
          </span>
          <Link
            href="/login"
            className="text-[13px] font-medium text-[#9B9B94] hover:text-[#F5F5F3] transition-colors"
          >
            Have an account? <span className="text-[#E2835F]">Sign in</span>
          </Link>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 px-8 pt-8">
          <div className={`h-1 flex-1 ${step >= 1 ? 'bg-[#E2835F]' : 'bg-[#2e2e2e]'}`} />
          <div className={`h-1 flex-1  ${step >= 2 ? 'bg-[#E2835F]' : 'bg-[#2e2e2e]'}`} />
        </div>

        {/* Form area */}
        <div className="px-8 py-8">
          <p className="text-[12px] font-medium text-[#E2835F] tracking-[0.1em] uppercase mb-4">
            {step === 1 ? 'Step 1 of 2' : 'Step 2 of 2'}
          </p>
          <h1 className="text-[32px] font-bold text-[#F5F5F3] leading-[1.1] tracking-[-1px] mb-2">
            {step === 1 ? (
              <>Create your<br /><span className="text-[#E2835F]">account.</span></>
            ) : (
              <>Your study<br /><span className="text-[#E2835F]">details.</span></>
            )}
          </h1>
          <p className="text-[14px] text-[#9B9B94] mb-8 leading-relaxed">
            {step === 1
              ? 'Join thousands of international students tracking their finances abroad.'
              : 'This helps us personalise your currency conversions and insights.'}
          </p>

          {error && (
            <div className="mb-6 px-4 py-3  bg-[#E2835F]/10 border border-[#E2835F]/20 text-[#E2835F] text-[13px] font-medium">
              {error}
            </div>
          )}

          {step === 1 ? (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>Full name</label>
                <input
                  type="text"
                  value={form.fullName}
                  onChange={e => update('fullName', e.target.value)}
                  placeholder="Shakur Laysima"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => update('email', e.target.value)}
                  placeholder="you@example.com"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  value={form.password}
                  onChange={e => update('password', e.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                />
              </div>
              <button
                onClick={() => {
                  if (!form.fullName || !form.email || !form.password) {
                    setError('Please fill in all fields.')
                    return
                  }
                  setError('')
                  setStep(2)
                }}
                className="w-full py-3 bg-[#E2835F] hover:opacity-90 text-white text-[14px] font-medium  transition-opacity mt-2"
              >
                Continue
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className={labelClass}>University</label>
                <input
                  type="text"
                  value={form.university}
                  onChange={e => update('university', e.target.value)}
                  placeholder="Lakehead University"
                  className={inputClass}
                />
              </div>
              <div>
                <label className={labelClass}>Home currency</label>
                <select
                  value={form.homeCurrency}
                  onChange={e => update('homeCurrency', e.target.value)}
                  className={inputClass + ' bg-[#222] cursor-pointer'}
                >
                  {CURRENCIES.map(c => (
                    <option key={c.code} value={c.code}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Preview stat card based on currency choice */}
              <div className="bg-[#A9BA9E]  p-4 flex items-center justify-between">
                <div>
                  <p className="text-[11px] font-medium text-[#1A1A1A]/60 mb-1">Your home currency</p>
                  <p className="text-[22px] font-bold text-[#1A1A1A] leading-none">{form.homeCurrency}</p>
                </div>
                <p className="text-[12px] text-[#1A1A1A]/50 text-right leading-relaxed max-w-[140px]">
                  We&apos;ll convert all expenses to this for you
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setStep(1)}
                  className="flex-1 py-3 bg-transparent border border-[#2e2e2e] hover:border-[#E2835F]/40 text-[#9B9B94] text-[14px] font-medium  transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={handleSignup}
                  disabled={loading}
                  className="flex-1 py-3 bg-[#E2835F] hover:opacity-90 disabled:opacity-50 text-white text-[14px] font-medium  transition-opacity"
                >
                  {loading ? 'Creating...' : 'Create account'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}