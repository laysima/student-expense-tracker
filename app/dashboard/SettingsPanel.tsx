'use client'

import { type FormEvent, type ReactNode, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, KeyRound, Loader2, LogOut, Mail, UserRound } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { CURRENCIES } from '@/lib/currencies'
import styles from './dashboard.module.css'

interface Props {
  userId: string
  email: string
  fullName: string
  homeCurrency: string
  onSignOut: () => void
}

type Feedback = { tone: 'ok' | 'error'; text: string } | null

const inputClass =
  'w-full rounded-xl border border-transparent bg-[#F1F2ED] px-4 py-3 text-base font-medium text-[#242522] placeholder-[#A4A79F] outline-none transition focus:border-[#829A83] focus:bg-white focus:ring-4 focus:ring-[#829A83]/15 sm:text-[14px]'
const labelClass = 'mb-2 block text-[12px] font-semibold text-[#5F625B]'
const primaryButton =
  'flex items-center justify-center gap-2 rounded-xl bg-[#28352A] px-5 py-3 text-[13px] font-semibold text-white transition hover:bg-[#344637] disabled:opacity-50'

function Section({ icon, title, description, tone, children }: { icon: ReactNode; title: string; description: string; tone: string; children: ReactNode }) {
  return (
    <section data-tone={tone} className={`${styles.panel} overflow-hidden`}>
      <div className={styles.sectionHeader}>
        <div className="flex items-center gap-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#EFF0EB] text-[#3F4A40]">{icon}</span>
          <div>
            <h2 className="text-base font-semibold tracking-[-0.02em] text-[#242522]">{title}</h2>
            <p className="mt-0.5 text-xs text-[#85887F]">{description}</p>
          </div>
        </div>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  )
}

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) return null
  return (
    <p
      role={feedback.tone === 'error' ? 'alert' : 'status'}
      className={`rounded-xl px-4 py-2.5 text-[12px] font-medium ${feedback.tone === 'error' ? 'bg-[#FFF0EA] text-[#B9573A]' : 'bg-[#EAF2E9] text-[#3F6548]'}`}
    >
      {feedback.text}
    </p>
  )
}

function PasswordInput({ id, label, value, onChange, autoComplete }: { id: string; label: string; value: string; onChange: (value: string) => void; autoComplete: string }) {
  const [visible, setVisible] = useState(false)
  return (
    <div>
      <label htmlFor={id} className={labelClass}>{label}</label>
      <div className="relative">
        <input
          id={id}
          type={visible ? 'text' : 'password'}
          autoComplete={autoComplete}
          value={value}
          onChange={event => onChange(event.target.value)}
          className={`${inputClass} pr-12`}
        />
        <button
          type="button"
          onClick={() => setVisible(current => !current)}
          aria-label={visible ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          className="absolute right-2 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-[#85887F] hover:text-[#242522]"
        >
          {visible ? <EyeOff size={16} aria-hidden="true" /> : <Eye size={16} aria-hidden="true" />}
        </button>
      </div>
    </div>
  )
}

export default function SettingsPanel({ userId, email, fullName, homeCurrency, onSignOut }: Props) {
  const router = useRouter()

  // Profile
  const [name, setName] = useState(fullName)
  const [currency, setCurrency] = useState(homeCurrency)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileFeedback, setProfileFeedback] = useState<Feedback>(null)
  const profileChanged = name.trim() !== fullName || currency !== homeCurrency

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) return setProfileFeedback({ tone: 'error', text: 'Your name can’t be empty.' })
    setSavingProfile(true)
    setProfileFeedback(null)
    const supabase = createClient()
    const { error } = await supabase.from('profiles').update({ full_name: trimmed, home_currency: currency }).eq('id', userId)
    if (!error) await supabase.auth.updateUser({ data: { full_name: trimmed } })
    setSavingProfile(false)
    if (error) return setProfileFeedback({ tone: 'error', text: error.message })
    setProfileFeedback({ tone: 'ok', text: 'Profile saved.' })
    router.refresh()
  }

  // Email
  const [newEmail, setNewEmail] = useState('')
  const [savingEmail, setSavingEmail] = useState(false)
  const [emailFeedback, setEmailFeedback] = useState<Feedback>(null)

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const target = newEmail.trim().toLowerCase()
    if (!target || target === email.toLowerCase()) {
      return setEmailFeedback({ tone: 'error', text: 'Enter a different email address.' })
    }
    setSavingEmail(true)
    setEmailFeedback(null)
    const { error } = await createClient().auth.updateUser(
      { email: target },
      { emailRedirectTo: `${window.location.origin}/dashboard` },
    )
    setSavingEmail(false)
    if (error) return setEmailFeedback({ tone: 'error', text: error.message })
    setNewEmail('')
    setEmailFeedback({
      tone: 'ok',
      text: `We sent a confirmation link to ${target}. Your email changes once you open it — you may also need to confirm from ${email}.`,
    })
  }

  // Password
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [savingPassword, setSavingPassword] = useState(false)
  const [passwordFeedback, setPasswordFeedback] = useState<Feedback>(null)

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordFeedback(null)
    if (!currentPassword) return setPasswordFeedback({ tone: 'error', text: 'Enter your current password.' })
    if (newPassword.length < 6) return setPasswordFeedback({ tone: 'error', text: 'Your new password needs at least 6 characters.' })
    if (newPassword !== confirmPassword) return setPasswordFeedback({ tone: 'error', text: 'The new passwords don’t match.' })
    if (newPassword === currentPassword) return setPasswordFeedback({ tone: 'error', text: 'Choose a password different from your current one.' })

    setSavingPassword(true)
    const supabase = createClient()
    // Confirm it's really the account owner before changing anything, so an
    // unlocked phone left lying around can't be used to take over the account.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: currentPassword })
    if (verifyError) {
      setSavingPassword(false)
      return setPasswordFeedback({ tone: 'error', text: 'Your current password is incorrect.' })
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setSavingPassword(false)
    if (error) return setPasswordFeedback({ tone: 'error', text: error.message })
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordFeedback({ tone: 'ok', text: 'Password updated. Use the new one next time you sign in.' })
  }

  // Sessions
  const [signingOutEverywhere, setSigningOutEverywhere] = useState(false)
  const [confirmEverywhere, setConfirmEverywhere] = useState(false)

  async function signOutEverywhere() {
    setSigningOutEverywhere(true)
    await createClient().auth.signOut({ scope: 'global' })
    router.push('/login')
    router.refresh()
  }

  return (
    <div className="mt-7 space-y-6">
      <div>
        <h2 className="text-xl font-semibold tracking-[-0.03em] text-[#242522]">Settings</h2>
        <p className="mt-1 text-[13px] text-[#74776F]">Manage your profile, sign-in details and sessions.</p>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Section icon={<UserRound size={17} aria-hidden="true" />} title="Profile" description="How Xtrack addresses you and shows your money" tone="ink">
          <form onSubmit={saveProfile} className="space-y-5">
            <div>
              <label htmlFor="settings-name" className={labelClass}>Full name</label>
              <input id="settings-name" autoComplete="name" value={name} onChange={event => setName(event.target.value)} className={inputClass} />
            </div>
            <div>
              <label htmlFor="settings-currency" className={labelClass}>Main currency</label>
              <select id="settings-currency" value={currency} onChange={event => setCurrency(event.target.value)} className={inputClass}>
                {CURRENCIES.map(([code, label]) => (
                  <option key={code} value={code}>{code} — {label}</option>
                ))}
              </select>
              <p className="mt-2 text-[11px] leading-5 text-[#85887F]">Used when you log an amount in another currency. Amounts already saved don’t change.</p>
            </div>
            <FeedbackLine feedback={profileFeedback} />
            <button type="submit" disabled={savingProfile || !profileChanged} className={primaryButton}>
              {savingProfile && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Save profile
            </button>
          </form>
        </Section>

        <Section icon={<Mail size={17} aria-hidden="true" />} title="Email address" description="Where sign-in links and alerts are sent" tone="plan">
          <form onSubmit={changeEmail} className="space-y-5">
            <div>
              <p className={labelClass}>Current email</p>
              <p className="truncate rounded-xl bg-[#F7F8F3] px-4 py-3 text-[14px] font-medium text-[#343630]">{email}</p>
            </div>
            <div>
              <label htmlFor="settings-email" className={labelClass}>New email</label>
              <input id="settings-email" type="email" autoComplete="email" value={newEmail} onChange={event => setNewEmail(event.target.value)} placeholder="name@example.com" className={inputClass} />
            </div>
            <FeedbackLine feedback={emailFeedback} />
            <button type="submit" disabled={savingEmail || !newEmail.trim()} className={primaryButton}>
              {savingEmail && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Send confirmation link
            </button>
          </form>
        </Section>

        <Section icon={<KeyRound size={17} aria-hidden="true" />} title="Password" description="Confirm your current password to set a new one" tone="limit">
          <form onSubmit={changePassword} className="space-y-5">
            <PasswordInput id="settings-current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" />
            <PasswordInput id="settings-new-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" />
            <PasswordInput id="settings-confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" />
            <FeedbackLine feedback={passwordFeedback} />
            <button type="submit" disabled={savingPassword} className={primaryButton}>
              {savingPassword && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
              Change password
            </button>
          </form>
        </Section>

        <Section icon={<LogOut size={17} aria-hidden="true" />} title="Sessions" description="Sign out here or on every device" tone="spend">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-[13px] font-semibold text-[#343630]">This device</p>
                <p className="mt-0.5 text-[11px] text-[#85887F]">Sign out of Xtrack on this phone or browser.</p>
              </div>
              <button type="button" onClick={onSignOut} className="rounded-xl border border-[#DFE0DA] px-4 py-2.5 text-[13px] font-semibold text-[#3F4A40] transition hover:border-[#BFC2B9]">
                Sign out
              </button>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#EEEFEA] pt-4">
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-semibold text-[#343630]">All devices</p>
                <p className="mt-0.5 text-[11px] text-[#85887F]">Useful if you signed in on a shared or lost device.</p>
              </div>
              {confirmEverywhere ? (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setConfirmEverywhere(false)} className="px-2 py-2.5 text-[13px] font-semibold text-[#85887F] hover:text-[#242522]">
                    Cancel
                  </button>
                  <button type="button" onClick={signOutEverywhere} disabled={signingOutEverywhere} className="flex items-center gap-2 rounded-xl bg-[#B9573A] px-4 py-2.5 text-[13px] font-semibold text-white transition hover:bg-[#A44A30] disabled:opacity-50">
                    {signingOutEverywhere && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
                    Sign out everywhere
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setConfirmEverywhere(true)} className="rounded-xl border border-[#F0C5B5] px-4 py-2.5 text-[13px] font-semibold text-[#B9573A] transition hover:bg-[#FFF0EA]">
                  Sign out everywhere
                </button>
              )}
            </div>
          </div>
        </Section>
      </div>
    </div>
  )
}
