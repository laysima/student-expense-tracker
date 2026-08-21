'use client'

import { useRouter } from 'next/navigation'
import { Eye, EyeOff } from 'lucide-react'
import { FormEvent, useState } from 'react'
import AuthSplit from '@/components/AuthSplit'
import { createClient } from '@/lib/supabase/client'

const CURRENCIES = [['CAD','Canadian Dollar'],['GHS','Ghanaian Cedi'],['NGN','Nigerian Naira'],['KES','Kenyan Shilling'],['ZAR','South African Rand'],['INR','Indian Rupee'],['USD','US Dollar'],['GBP','British Pound'],['EUR','Euro']] as const
const inputClass = 'w-full rounded-lg border border-white/[0.09] bg-white/[0.03] px-4 py-3 text-[14px] text-[#F5F5F3] placeholder:text-[#666660] focus:border-[#E2835F]/60 focus:outline-none'
const labelClass = 'mb-2 block text-[13px] font-medium text-[#F5F5F3]/90'

export default function SignupPage() {
  const router = useRouter()
  const [step, setStep] = useState<1 | 2>(1)
  const [form, setForm] = useState({ fullName: '', email: '', password: '', university: '', homeCurrency: 'CAD' })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [needsConfirmation, setNeedsConfirmation] = useState(false)
  const update = (field: keyof typeof form, value: string) => setForm(old => ({ ...old, [field]: value }))

  function continueSignup(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); setStep(2) }
  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!form.university) { setError('Please enter your university.'); return }
    setLoading(true); setError('')
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({ email: form.email, password: form.password, options: { data: { full_name: form.fullName } } })
    if (error) { setError(error.message); setLoading(false); return }
    if (data.user) await supabase.from('profiles').update({ university: form.university, home_currency: form.homeCurrency }).eq('id', data.user.id)

    if (!data.session) {
      setLoading(false)
      setNeedsConfirmation(true)
      return
    }

    router.push('/dashboard'); router.refresh()
  }

  if (needsConfirmation) {
    return (
      <AuthSplit mode="signup" title="Check your email" description={`We sent a confirmation link to ${form.email}.`}>
        <p className="text-[13px] leading-[1.75] text-[#85857E]">
          Click the link in that email to activate your account, then come back and sign in.
        </p>
      </AuthSplit>
    )
  }

  return (
    <AuthSplit mode="signup" title={step === 1 ? 'Create your account' : 'Make Xtrack yours'} description={step === 1 ? 'Start building a calmer relationship with your student finances' : 'Tell us where you study and how you prefer to see your money'}>
      <div className="mb-7 grid grid-cols-2 gap-2" aria-label={`Signup step ${step} of 2`}><span className="h-1 rounded-full bg-[#E2835F]" /><span className={`h-1 rounded-full ${step === 2 ? 'bg-[#E2835F]' : 'bg-white/[0.08]'}`} /></div>
      {error && <p role="alert" className="mb-5 rounded-lg border border-[#E2835F]/20 bg-[#E2835F]/10 px-4 py-3 text-[12px] text-[#E2835F]">{error}</p>}
      {step === 1 ? (
        <form onSubmit={continueSignup} className="space-y-4">
          <div><label htmlFor="full-name" className={labelClass}>Full name</label><input id="full-name" autoComplete="name" required value={form.fullName} onChange={e => update('fullName', e.target.value)} placeholder="Your full name" className={inputClass} /></div>
          <div><label htmlFor="signup-email" className={labelClass}>Email address</label><input id="signup-email" type="email" autoComplete="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="name@example.com" className={inputClass} /></div>
          <div>
            <label htmlFor="signup-password" className={labelClass}>Password</label>
            <div className="relative">
              <input id="signup-password" type={showPassword ? 'text' : 'password'} autoComplete="new-password" minLength={6} required value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 6 characters" className={`${inputClass} pr-11`} />
              <button type="button" onClick={() => setShowPassword(v => !v)} aria-label={showPassword ? 'Hide password' : 'Show password'} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#73736D] hover:text-[#F5F5F3]">
                {showPassword ? <EyeOff className="h-4 w-4" aria-hidden="true" /> : <Eye className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          </div>
          <button type="submit" className="min-h-12 w-full rounded-lg bg-[#F5F5F3] px-6 text-[13px] font-semibold text-[#1A1A1A] hover:bg-white">Continue</button>
        </form>
      ) : (
        <form onSubmit={handleSignup} className="space-y-5">
          <div><label htmlFor="university" className={labelClass}>University</label><input id="university" required value={form.university} onChange={e => update('university', e.target.value)} placeholder="Lakehead University" className={inputClass} /></div>
          <div><label htmlFor="currency" className={labelClass}>Home currency</label><select id="currency" value={form.homeCurrency} onChange={e => update('homeCurrency', e.target.value)} className={inputClass}>{CURRENCIES.map(([code,name]) => <option key={code} value={code}>{code} — {name}</option>)}</select></div>
          <div className="flex gap-3"><button type="button" onClick={() => { setError(''); setStep(1) }} className="min-h-12 flex-1 rounded-lg border border-white/[0.1] text-[13px] text-[#B0B0A9] hover:border-[#E2835F]/50">Back</button><button type="submit" disabled={loading} className="min-h-12 flex-[1.5] rounded-lg bg-[#F5F5F3] px-5 text-[13px] font-semibold text-[#1A1A1A] hover:bg-white disabled:opacity-50">{loading ? 'Creating…' : 'Create account'}</button></div>
        </form>
      )}
    </AuthSplit>
  )
}
