'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import { Menu } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import FoldText from '@/components/react-bits/FoldText'
import SpecularButton from '@/components/react-bits/SpecularButton'
import MaskedHeading from '@/components/react-bits/MaskedHeading'
import PricingPicker from '@/components/PricingPicker'
import SiteLogo from '@/components/SiteLogo'


const BAR_HEIGHTS = [55, 70, 42, 88, 60, 45, 75, 95, 50, 65]

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#pricing' },
  { label: 'FAQ', href: '#faq' },
]

const STEPS = [
  {
    number: '01',
    title: 'Create your account',
    description:
      'Choose your home currency and tell Xtrack where you are currently studying.',
  },
  {
    number: '02',
    title: 'Add your expenses',
    description:
      'Record purchases, recurring bills and income in seconds from any device.',
  },
  {
    number: '03',
    title: 'Understand your money',
    description:
      'See your runway, spending patterns and personalised AI-powered insights.',
  },
]

const AUTOMATION_LEDGER = [
  {
    title: 'Currency conversion',
    description: 'Spending converted to CAD automatically',
    pct: 92,
  },
  {
    title: 'Recurring bills',
    description: 'Rent, subscriptions and tuition tracked automatically',
    pct: 78,
  },
  {
    title: 'Budget suggestions',
    description: 'Category budgets predicted from your spending history',
    pct: 65,
  },
]

const AUTOMATION_THIS_MONTH = 87
const AUTOMATION_LAST_MONTH = 61

const FAQS = [
  {
    question: 'Is Xtrack only for international students?',
    answer:
      'Xtrack is designed around the financial challenges international students face, but any student can use it to manage expenses and understand their budget.',
  },
  {
    question: 'Can I track more than one currency?',
    answer:
      'Yes. You can record spending in your local currency while viewing its value in your home currency.',
  },
  {
    question: 'Does Xtrack connect to my bank account?',
    answer:
      'Bank connections can be added later. The first version focuses on simple, intentional expense tracking and clear financial insights.',
  },
  {
    question: 'What does budget runway mean?',
    answer:
      'Budget runway estimates how many days your available money may last based on your current spending pace.',
  },
]

const TRANSACTIONS = [
  { name: 'Walmart Grocery', status: 'Yesterday', amount: '−$64', type: 'expense' },
  { name: 'Part-time wage', status: 'Recurring', amount: '+$320', type: 'income' },
  { name: 'Rent — October', status: 'Monthly', amount: '−$750', type: 'expense' },
]

const UNIVERSITIES = ['Lakehead', 'UofT', 'McGill', 'UBC', 'Waterloo', 'Queens']

const TABS = ['Analytics', 'Revenue', 'Expenses', 'Sector']

export default function LandingPage() {
  const router = useRouter()

  useEffect(() => {
    const savedTheme = localStorage.getItem('xtrack-theme')
    const useLightTheme = savedTheme === 'light'

    document.documentElement.classList.toggle(
      'light-theme',
      useLightTheme
    )

    document.documentElement.style.colorScheme = useLightTheme
      ? 'light'
      : 'dark'
  }, [])

  const toggleTheme = () => {
    const useLightTheme =
      document.documentElement.classList.toggle('light-theme')

    const selectedTheme = useLightTheme ? 'light' : 'dark'

    document.documentElement.style.colorScheme = selectedTheme
    localStorage.setItem('xtrack-theme', selectedTheme)
  }

  return (
    <div className="min-h-screen bg-[#1A1A1A] p-[10px] transition-colors duration-500">
      <div className="min-h-[calc(100vh-20px)] overflow-hidden border-[20px] border-[#E2835F] bg-[#1A1A1A] transition-colors duration-500 flex flex-col">

        {/* NAVBAR */}
        <nav className="flex items-center justify-between px-8 py-5">
          <Link href="/" aria-label="Xtrack home" className="flex items-center">
            <SiteLogo size="compact" />
          </Link>

          <div className="hidden lg:flex items-center gap-8">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] font-medium text-[#9B9B94] hover:text-[#F5F5F3] transition-colors tracking-wide"
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-3">
<button
  type="button"
  onClick={toggleTheme}
  aria-label="Toggle light and dark mode"
  title="Toggle light and dark mode"
  className="theme-toggle flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#F5F5F3] transition-all duration-300 hover:border-[#E2835F]/50 hover:bg-white/[0.06]"
>
  {/* Sun: shown in dark mode */}
  <span className="theme-icon-sun">
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="3.5" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.42 1.42" />
      <path d="m17.65 17.65 1.42 1.42" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.35 17.65-1.42 1.42" />
      <path d="m19.07 4.93-1.42 1.42" />
    </svg>
  </span>

  {/* Moon: shown in light mode */}
  <span className="theme-icon-moon">
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z" />
    </svg>
  </span>
</button>

            <div className="hidden lg:flex items-center gap-3">
              <Link
                href="/login"
                className="text-[14px] font-medium text-[#F5F5F3] border border-[#E2835F] px-5 py-2 hover:bg-[#E2835F] transition-colors"
              >
                Sign in
              </Link>
              <SpecularButton
                size="sm"
                radius={4}
                tint="#E2835F"
                tintOpacity={1}
                textColor="#ffffff"
                lineColor="#ffffff"
                baseColor="#B5613F"
                proximity={200}
                onClick={() => router.push('/signup')}
              >
                Get started
              </SpecularButton>
            </div>

            <Sheet>
              <SheetTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Open menu"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.03] text-[#F5F5F3] hover:border-[#E2835F]/50 hover:bg-white/[0.06] lg:hidden"
                  />
                }
              >
                <Menu className="h-[18px] w-[18px]" aria-hidden="true" />
              </SheetTrigger>
              <SheetContent
                side="right"
                className="w-[280px] gap-0 border-white/[0.08] bg-[#1A1A1A] text-[#F5F5F3] sm:max-w-[280px]"
              >
                <SheetHeader>
                  <SheetTitle className="flex items-center text-[#F5F5F3]">
                    <SiteLogo size="compact" />
                  </SheetTitle>
                </SheetHeader>

                <div className="flex flex-col gap-1 px-4">
                  {NAV_LINKS.map(link => (
                    <SheetClose
                      key={link.label}
                      nativeButton={false}
                      render={
                        <Link
                          href={link.href}
                          className="rounded-lg px-3 py-3 text-[15px] font-medium text-[#9B9B94] transition-colors hover:bg-white/[0.04] hover:text-[#F5F5F3]"
                        />
                      }
                    >
                      {link.label}
                    </SheetClose>
                  ))}
                </div>

                <div className="mt-auto flex flex-col gap-3 p-4">
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href="/login"
                        className="text-center text-[14px] font-medium text-[#F5F5F3] border border-[#E2835F] px-5 py-2.5 hover:bg-[#E2835F] transition-colors"
                      />
                    }
                  >
                    Sign in
                  </SheetClose>
                  <SheetClose
                    nativeButton={false}
                    render={
                      <Link
                        href="/signup"
                        className="text-center text-[14px] font-medium text-white bg-[#E2835F] px-5 py-2.5 hover:opacity-90 transition-opacity"
                      />
                    }
                  >
                    Get started
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </div>
        </nav>

        {/* HERO */}
        <section className="flex-1 flex flex-col lg:flex-row items-center justify-between px-8 py-12 lg:py-16 gap-12 max-w-[1200px] mx-auto w-full">

          {/* Left text */}
          <div className="flex-none lg:w-[42%] max-w-[480px]">
            <p className="text-[12px] font-medium text-[#E2835F] tracking-[0.1em] uppercase mb-5">
              For international students
            </p>
            <h1 className="mb-6 flex flex-col text-[#F5F5F3]">
              <FoldText
                text={'Know exactly\nwhere your'}
                splitBy="word"
                hinge="top"
                trigger="mount"
                duration={0.6}
                stagger={0.05}
                ease="power3.out"
                perspective={700}
                creaseShading={0.5}
                fontSize="clamp(2.6rem, 5.2vw, 3.75rem)"
                fontWeight={300}
                color="currentColor"
              />
              <FoldText
                text="money goes."
                splitBy="word"
                hinge="top"
                trigger="mount"
                duration={0.6}
                stagger={0.05}
                ease="power3.out"
                perspective={700}
                creaseShading={0.5}
                fontSize="clamp(2.6rem, 5.2vw, 3.75rem)"
                fontWeight={300}
                color="#E2835F"
              />
            </h1>
            <p className="text-[15px] text-[#9B9B94] leading-[1.7] max-w-[380px] mb-8">
              Track spending across currencies and know exactly how long your budget will last.
            </p>
            <div className="flex items-center gap-5">
              <SpecularButton
                size="md"
                radius={4}
                tint="#E2835F"
                tintOpacity={1}
                textColor="#ffffff"
                lineColor="#ffffff"
                baseColor="#B5613F"
                proximity={300}
                onClick={() => router.push('/signup')}
              >
                Get started free
              </SpecularButton>
              <Link
                href="/login"
                className="text-[15px] font-medium text-[#F5F5F3] underline underline-offset-4 hover:text-[#E2835F] transition-colors"
              >
                View demo
              </Link>
            </div>
          </div>

{/* Right product visual */}
<div className="w-full flex-none lg:relative lg:mx-auto lg:h-[610px] lg:w-[55%] lg:max-w-[620px]">

{/* Compact summary card — mobile & tablet only */}
<div className="lg:hidden mx-auto w-full max-w-[400px]">
  <div className="hero-dashboard rounded-[24px] border border-white/[0.08] bg-[#222222] p-5 shadow-[0_25px_70px_rgba(0,0,0,0.4)]">
    <div className="mb-4 flex items-center justify-between">
      <div>
        <p className="text-[11px] text-[#777770]">Available balance</p>
        <p className="text-[27px] font-medium tracking-[-0.5px] text-[#F5F5F3]">
          $3,104.20
        </p>
      </div>
      <div className="rounded-full bg-[#E2835F] px-3 py-1 text-[11px] font-medium text-white">
        +8.4%
      </div>
    </div>

    <div className="mb-4 flex h-[46px] items-end gap-[5px]">
      {BAR_HEIGHTS.slice(0, 8).map((height, index) => (
        <div
          key={index}
          className="expense-bar flex-1 rounded-t-[4px]"
          style={{
            height: `${height}%`,
            background:
              index === 6
                ? '#E2835F'
                : index % 2 === 0
                  ? 'rgba(226,131,95,0.45)'
                  : 'rgba(169,186,158,0.38)',
            animationDelay: `${index * 70}ms`,
          }}
        />
      ))}
    </div>

    <div className="h-px bg-white/[0.06]" />

    <div className="mt-4 flex items-center justify-between">
      <div>
        <p className="text-[10px] text-[#777770]">Budget runway</p>
        <p className="text-[18px] text-[#F5F5F3]">
          47<span className="ml-1 text-[11px] font-normal text-[#777770]">days</span>
        </p>
      </div>
      <div className="text-right">
        <p className="text-[10px] text-[#777770]">Home currency</p>
        <p className="text-[18px] text-[#A9BA9E]">10.68 GHS</p>
      </div>
    </div>
  </div>
</div>

{/* Full dashboard mockup — desktop only */}
<div className="product-visual hidden lg:block lg:absolute lg:left-1/2 lg:top-1/2 lg:h-[610px] lg:w-[620px] lg:origin-center lg:-translate-x-1/2 lg:-translate-y-1/2">

  {/* Background atmosphere */}
  <div className="pointer-events-none absolute inset-0">
    <div className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E2835F]/10 blur-[80px]" />

    <div className="absolute left-1/2 top-1/2 h-[455px] w-[455px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/[0.07]" />

    <div className="absolute left-1/2 top-1/2 h-[355px] w-[355px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-[#E2835F]/10" />

    <div className="absolute left-[60px] top-[150px] h-2.5 w-2.5 rounded-full bg-[#E2835F]" />
    <div className="absolute right-[75px] top-[105px] h-2 w-2 rounded-full bg-[#A9BA9E]" />
    <div className="absolute bottom-[90px] left-[110px] h-2 w-2 rounded-full bg-[#F5F5F3]/40" />
    <div className="absolute bottom-[135px] right-[35px] h-3 w-3 rounded-full bg-[#E2835F]/70" />
  </div>

  {/* Main dashboard */}
  <div className="absolute left-1/2 top-1/2 z-20 w-[390px] -translate-x-1/2 -translate-y-1/2">
    <div className="hero-dashboard rounded-[30px] border border-white/[0.08] bg-[#222222] p-3 shadow-[0_35px_100px_rgba(0,0,0,0.48)]">

      <div className="overflow-hidden rounded-[23px] border border-white/[0.05] bg-[#181818]">

        {/* App header */}
        <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
          <div>
            <p className="text-[11px] text-[#777770]">Welcome back</p>
            <p className="text-[14px] font-medium text-[#F5F5F3]">
              Your finances
            </p>
          </div>

          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2835F] text-[13px] font-medium text-white">
            XL
          </div>
        </div>

        <div className="p-5">

          {/* Balance card */}
          <div className="mb-4 rounded-[20px] bg-[#E2835F] p-5 shadow-[0_18px_45px_rgba(226,131,95,0.18)]">
            <div className="mb-5 flex items-start justify-between">
              <div>
                <p className="mb-1 text-[11px] font-medium text-white/65">
                  Available balance
                </p>
                <p className="text-[29px] font-medium tracking-[-1px] text-white">
                  $3,104.20
                </p>
              </div>

              <div className="rounded-full bg-white/15 px-3 py-1 text-[10px] font-medium text-white">
                CAD
              </div>
            </div>

            <div className="flex items-end justify-between">
              <p className="text-[11px] text-white/65">
                Updated moments ago
              </p>

              <p className="text-[11px] font-medium text-white">
                +8.4%
              </p>
            </div>
          </div>

          {/* Analytics */}
          <div className="mb-4 rounded-[20px] border border-white/[0.06] bg-white/[0.025] p-4">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-[11px] text-[#777770]">Monthly activity</p>
                <p className="mt-1 text-[17px] font-medium text-[#F5F5F3]">
                  $2,464 tracked
                </p>
              </div>

              <div className="rounded-full bg-[#A9BA9E]/10 px-3 py-1 text-[10px] font-medium text-[#A9BA9E]">
                On track
              </div>
            </div>

            <div className="flex h-[85px] items-end gap-[7px]">
              {BAR_HEIGHTS.map((height, index) => (
                <div
                  key={index}
                  className="expense-bar flex-1 rounded-t-[5px]"
                  style={{
                    height: `${height}%`,
                    background:
                      index === 7
                        ? '#E2835F'
                        : index % 2 === 0
                          ? 'rgba(226,131,95,0.45)'
                          : 'rgba(169,186,158,0.38)',
                    animationDelay: `${index * 70}ms`,
                  }}
                />
              ))}
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4 flex rounded-full bg-white/[0.04] p-1">
            {TABS.slice(0, 3).map((tab, index) => (
              <button
                key={tab}
                type="button"
                className={`flex-1 rounded-full py-2 text-[10px] font-medium transition-colors ${
                  index === 0
                    ? 'bg-[#F5F5F3] text-[#1A1A1A]'
                    : 'text-[#777770] hover:text-[#F5F5F3]'
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Transactions */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[12px] font-medium text-[#F5F5F3]">
                Recent transactions
              </p>

              <button
                type="button"
                className="text-[10px] font-medium text-[#E2835F]"
              >
                View all
              </button>
            </div>

            <div className="space-y-1">
              {TRANSACTIONS.map((transaction) => (
                <div
                  key={transaction.name}
                  className="flex items-center justify-between rounded-[14px] px-2 py-2.5 transition-colors hover:bg-white/[0.035]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[11px] font-medium text-[#F5F5F3]">
                      {transaction.name}
                    </p>
                    <p className="text-[9px] text-[#777770]">
                      {transaction.status}
                    </p>
                  </div>

                  <p
                    className={`text-[11px] font-medium ${
                      transaction.type === 'expense'
                        ? 'text-[#E2835F]'
                        : 'text-[#A9BA9E]'
                    }`}
                  >
                    {transaction.amount}
                  </p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  </div>

  {/* Floating expense card */}
  <div className="absolute left-[5px] top-[75px] z-30">
    <div className="hero-float-one w-[185px] rounded-[18px] border border-white/[0.08] bg-[#242424]/95 p-4 shadow-[0_20px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <span className="rounded-full bg-[#E2835F]/10 px-2.5 py-1 text-[9px] font-medium text-[#E2835F]">
          This month
        </span>
      </div>

      <p className="text-[10px] text-[#777770]">Total expenses</p>
      <p className="mt-1 text-[23px] font-medium tracking-[-0.5px] text-[#F5F5F3]">
        $1,824
      </p>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
        <div className="h-full w-[68%] rounded-full bg-[#E2835F]" />
      </div>
    </div>
  </div>

  {/* Floating currency card */}
  <div className="absolute right-[0px] top-[115px] z-30">
    <div className="hero-float-two w-[170px] rounded-[18px] bg-[#A9BA9E] p-4 shadow-[0_20px_55px_rgba(0,0,0,0.32)]">
      <div className="mb-5 flex items-center justify-between">
        <p className="text-[10px] font-medium text-[#1A1A1A]/55">
          Home currency
        </p>

        <span className="rounded-full bg-[#1A1A1A]/10 px-2 py-1 text-[9px] font-medium text-[#1A1A1A]">
          Live
        </span>
      </div>

      <p className="text-[9px] text-[#1A1A1A]/50">1 CAD equals</p>
      <p className="mt-1 text-[23px] font-medium tracking-[-0.5px] text-[#1A1A1A]">
        10.68 GHS
      </p>
    </div>
  </div>

  {/* Floating AI insight */}
  <div className="absolute bottom-[55px] left-[15px] z-30">
    <div className="hero-float-three w-[210px] rounded-[18px] border border-white/[0.08] bg-[#242424]/95 p-4 shadow-[0_22px_65px_rgba(0,0,0,0.42)] backdrop-blur-xl">
      <div className="mb-3">
        <p className="text-[10px] font-medium text-[#F5F5F3]">AI insight</p>
        <p className="text-[9px] text-[#777770]">Based on your spending</p>
      </div>

      <p className="text-[10px] leading-[1.55] text-[#A7A79F]">
        You spent 18% less on groceries than last week.
      </p>
    </div>
  </div>

  {/* Floating runway card */}
  <div className="absolute bottom-[30px] right-[15px] z-40">
    <div className="hero-float-four w-[190px] rounded-[18px] border border-[#E2835F]/20 bg-[#1F1F1F]/95 p-4 shadow-[0_24px_70px_rgba(0,0,0,0.48)] backdrop-blur-xl">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[10px] text-[#777770]">
          Budget runway
        </p>

        <span className="h-2 w-2 rounded-full bg-[#A9BA9E] shadow-[0_0_12px_rgba(169,186,158,0.6)]" />
      </div>

      <p className="text-[27px] font-medium tracking-[-0.8px] text-[#F5F5F3]">
        47
        <span className="ml-1 text-[12px] font-normal text-[#777770]">
          days
        </span>
      </p>

      <p className="mt-1 text-[10px] font-medium text-[#E2835F]">
        Your budget is on track
      </p>
    </div>
  </div>

</div>
</div>
        </section>

        {/* TRUST STRIP */}
<section className="border-t border-white/[0.06] px-8 py-10">
  <div className="mx-auto flex max-w-[1100px] flex-col items-center gap-6">
    <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#777770]">
      Designed for students studying across Canada
    </p>

    <div className="flex w-full flex-wrap items-center justify-center gap-x-12 gap-y-5">
      {UNIVERSITIES.map(uni => (
        <span
          key={uni}
          className="text-[15px] font-medium tracking-[-0.2px] text-[#3F3F3B] transition-colors duration-300 hover:text-[#E2835F]"
        >
          {uni}
        </span>
      ))}
    </div>
  </div>
</section>

{/* FEATURES */}
<section
  id="features"
  className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
>
  <div className="mx-auto max-w-[1120px]">
    <div className="mb-14 max-w-[670px]">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
        Everything in one place
      </p>

      <MaskedHeading
        text="Financial clarity, no spreadsheets."
        tag="h2"
        mediaType="image"
        src="/aurora-mesh.svg"
        reveal="rise"
        trigger="view"
        align="left"
        weight={300}
        tracking={-0.03}
        lineHeight={1.12}
        textScale={0.082}
        parallax={18}
        drift={10}
        className="max-w-[670px]"
      />

      <p className="mt-6 max-w-[500px] text-[15px] leading-[1.8] text-[#8F8F88]">
        Spending, currencies and insights — in one focused workspace.
      </p>
    </div>

    <div className="border-t border-white/[0.07]">
      {/* Currency */}
      <div className="grid gap-10 border-b border-white/[0.07] py-14 md:grid-cols-[0.72fr_1.28fr] md:items-end md:gap-20 lg:py-20">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">01 / Currency</p>
          <h3 className="mt-5 max-w-[350px] text-[30px] leading-[1.15] tracking-[-1px] text-[#F5F5F3] md:text-[40px]">Spend here.<br />Understand it there.</h3>
        </div>
        <div className="flex items-baseline justify-between gap-5 border-b border-white/[0.12] pb-5">
          <div><p className="text-[10px] uppercase tracking-[0.12em] text-[#73736D]">Paid in CAD</p><p className="mt-2 text-[34px] tracking-[-1.4px] text-[#F5F5F3] md:text-[48px]">$84.20</p></div>
          <span className="h-px min-w-8 flex-1 bg-[#E2835F]/50" aria-hidden="true" />
          <div className="text-right"><p className="text-[10px] uppercase tracking-[0.12em] text-[#73736D]">Seen in GHS</p><p className="mt-2 text-[34px] tracking-[-1.4px] text-[#A9BA9E] md:text-[48px]">₵899</p></div>
        </div>
      </div>

      {/* Insight */}
      <div className="grid gap-10 border-b border-white/[0.07] py-14 md:grid-cols-[1.15fr_0.85fr] md:items-center md:gap-20 lg:py-20">
        <div className="md:order-2">
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">02 / Insight</p>
          <h3 className="mt-5 max-w-[390px] text-[30px] leading-[1.15] tracking-[-1px] text-[#F5F5F3] md:text-[40px]">Small signals.<br />Better decisions.</h3>
        </div>
        <div className="md:order-1">
          <p className="text-[72px] leading-none tracking-[-4px] text-[#E2835F] md:text-[104px]">18<span className="text-[34px] tracking-[-1px]">%</span></p>
          <div className="mt-5 flex max-w-[440px] items-start justify-between gap-8 border-t border-white/[0.1] pt-4 text-[12px] leading-[1.6] text-[#85857E]"><span>less spent on groceries</span><span className="text-right text-[#F5F5F3]">+6 days<br /><span className="text-[#73736D]">of runway</span></span></div>
        </div>
      </div>

      {/* Rhythm */}
      <div className="grid gap-12 py-14 md:grid-cols-[0.75fr_1.25fr] md:items-center md:gap-20 lg:py-20">
        <div>
          <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#A9BA9E]">03 / Rhythm</p>
          <h3 className="mt-5 max-w-[370px] text-[30px] leading-[1.15] tracking-[-1px] text-[#F5F5F3] md:text-[40px]">Know what&apos;s next.</h3>
          <p className="mt-5 max-w-[300px] text-[13px] leading-[1.7] text-[#85857E]">Regular spending, arranged before it becomes a surprise.</p>
        </div>
        <div className="relative pt-9">
          <div className="absolute left-0 right-0 top-2 h-px bg-white/[0.12]" />
          <div className="absolute left-[64%] top-0 h-5 w-px bg-[#E2835F]" />
          <div className="grid grid-cols-3 gap-4">
            {[['01','Rent','$750'],['06','Mobile','$42'],['08','Transit','$98']].map(([day, title, amount]) => (
              <div key={title} className="min-w-0"><p className="text-[28px] tracking-[-1px] text-[#F5F5F3]">{day}<span className="ml-1 text-[10px] uppercase tracking-[0.1em] text-[#666660]">Oct</span></p><p className="mt-6 truncate text-[12px] text-[#A7A79F]">{title}</p><p className="mt-1 text-[11px] text-[#666660]">{amount}</p></div>
            ))}
          </div>
        </div>
      </div>
    </div>
  </div>
</section>

{/* HOW IT WORKS */}
<section
  id="how-it-works"
  className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
>
  <div className="mx-auto max-w-[1120px]">
    <div className="mb-16 flex flex-col justify-between gap-8 md:flex-row md:items-end">
      <div className="max-w-[610px]">
        <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
          Simple from day one
        </p>

        <h2 className="text-[38px] leading-[1.12] tracking-[-1.3px] text-[#F5F5F3] md:text-[50px]">
          Start understanding your finances in minutes.
        </h2>
      </div>

      <p className="max-w-[350px] text-[14px] leading-[1.75] text-[#85857E]">
        No finance degree, complex setup or spreadsheet template required.
      </p>
    </div>

    <div className="grid gap-10 border-t border-white/[0.07] pt-12 md:grid-cols-3 md:gap-0 md:divide-x md:divide-white/[0.07] md:pt-16">
      {STEPS.map(step => (
        <div key={step.number} className="md:px-10 md:first:pl-0 md:last:pr-0">
          <p className="text-[13px] font-medium tracking-[-0.2px] text-[#E2835F]">
            {step.number}
          </p>

          <h3 className="mt-5 text-[23px] tracking-[-0.5px] text-[#F5F5F3]">
            {step.title}
          </h3>

          <p className="mt-4 text-[13px] leading-[1.75] text-[#85857E]">
            {step.description}
          </p>
        </div>
      ))}
    </div>
  </div>
</section>

{/* AUTOMATION STATS */}
<section
  id="automation"
  className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
>
  <div className="mx-auto grid max-w-[1120px] gap-16 lg:grid-cols-[0.95fr_1.05fr] lg:items-center">

    {/* Left: heading + ledger */}
    <div>
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
        Less manual tracking
      </p>

      <h2 className="text-[38px] leading-[1.12] tracking-[-1.3px] text-[#F5F5F3] md:text-[46px]">
        Budgeting that runs itself.
      </h2>

      <p className="mt-6 max-w-[460px] text-[15px] leading-[1.8] text-[#8F8F88]">
        Xtrack picks up the repetitive tracking work — currency conversion,
        recurring bills, category budgets — so you see the full picture
        without manual entry.
      </p>

      <div className="mt-10 divide-y divide-white/[0.07] border-t border-white/[0.07]">
        {AUTOMATION_LEDGER.map(item => (
          <div key={item.title} className="flex items-center gap-5 py-5">
            <div
              className="relative h-12 w-12 shrink-0 rounded-full"
              style={{
                background: `conic-gradient(#E2835F 0deg, #E2835F ${item.pct * 3.6}deg, var(--ring-track) ${item.pct * 3.6}deg, var(--ring-track) 360deg)`,
              }}
            >
              <div className="absolute inset-[4px] rounded-full bg-[#1A1A1A]" />
            </div>

            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium text-[#F5F5F3]">{item.title}</p>
              <p className="text-[12px] text-[#73736D]">{item.description}</p>
            </div>

            <p className="text-[22px] leading-none text-[#F5F5F3]">
              {item.pct}
              <span className="text-[13px] text-[#73736D]">%</span>
            </p>
          </div>
        ))}
      </div>
    </div>

    {/* Right: dual-ring dial */}
    <div className="flex flex-col items-center">
      <div className="relative h-[280px] w-[280px]">
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: `conic-gradient(var(--ring-bright) 0deg, var(--ring-bright) ${AUTOMATION_THIS_MONTH * 3.6}deg, var(--ring-track) ${AUTOMATION_THIS_MONTH * 3.6}deg, var(--ring-track) 360deg)`,
          }}
        />
        <div className="absolute inset-[16px] rounded-full bg-[#1A1A1A]" />

        <div
          className="absolute inset-[34px] rounded-full"
          style={{
            background: `conic-gradient(var(--ring-dim) 0deg, var(--ring-dim) ${AUTOMATION_LAST_MONTH * 3.6}deg, var(--ring-dim-track) ${AUTOMATION_LAST_MONTH * 3.6}deg, var(--ring-dim-track) 360deg)`,
          }}
        />
        <div className="absolute inset-[50px] rounded-full bg-[#1A1A1A]" />

        <div className="absolute inset-0 flex flex-col items-center justify-center px-10 text-center">
          <p className="text-[56px] font-light leading-none text-[#F5F5F3]">
            {AUTOMATION_THIS_MONTH}
            <span className="text-[24px]">%</span>
          </p>
          <p className="mt-3 text-[12px] leading-[1.6] text-[#9B9B94]">
            of this month&apos;s spending auto-categorized
          </p>
        </div>
      </div>

      <div className="mt-8 flex items-center gap-6">
        <span className="flex items-center gap-2 text-[12px] text-[#9B9B94]">
          <span className="h-2 w-2 rounded-full bg-[#F5F5F3]" />
          This month · {AUTOMATION_THIS_MONTH}%
        </span>
        <span className="flex items-center gap-2 text-[12px] text-[#9B9B94]">
          <span className="h-2 w-2 rounded-full bg-[#F5F5F3]/40" />
          Last month · {AUTOMATION_LAST_MONTH}%
        </span>
      </div>

      <p className="mt-3 text-[11px] text-[#666660]">
        An example month, tracked automatically.
      </p>
    </div>
  </div>
</section>

{/* PRICING */}
<PricingPicker />

{/* FAQ */}
<section
  id="faq"
  className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
>
  <div className="mx-auto grid max-w-[1050px] gap-12 lg:grid-cols-[0.8fr_1.2fr]">
    <div>
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
        Frequently asked
      </p>

      <h2 className="text-[38px] leading-[1.12] tracking-[-1.2px] text-[#F5F5F3] md:text-[48px]">
        A few things you may want to know.
      </h2>

      <p className="mt-5 max-w-[350px] text-[14px] leading-[1.75] text-[#85857E]">
        Xtrack is being built around real student experiences, not generic
        personal-finance assumptions.
      </p>
    </div>

    <div className="space-y-3">
      {FAQS.map(faq => (
        <details
          key={faq.question}
          className="faq-item group rounded-[20px] border border-white/[0.07] bg-[#202020] px-5"
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-5 py-5">
            <span className="text-[14px] text-[#F5F5F3]">
              {faq.question}
            </span>

            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/[0.04] text-[18px] text-[#E2835F] transition-transform duration-300 group-open:rotate-45">
              +
            </span>
          </summary>

          <p className="max-w-[560px] pb-5 pr-10 text-[12px] leading-[1.75] text-[#85857E]">
            {faq.answer}
          </p>
        </details>
      ))}
    </div>
  </div>
</section>

{/* FINAL CTA */}
<section className="px-4 pb-4 md:px-6 md:pb-6">
  <div className="accent-panel relative mx-auto max-w-[1180px] overflow-hidden rounded-[30px] bg-[#E2835F] px-7 py-16 text-center md:px-12 md:py-20">
    <div className="absolute -left-24 -top-24 h-[300px] w-[300px] rounded-full border-[55px] border-white/[0.05]" />
    <div className="absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full border-[65px] border-white/[0.05]" />

    <div className="relative z-10 mx-auto max-w-[700px]">
      <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/65">
        Take control of your student budget
      </p>

      <h2 className="flex justify-center">
        <FoldText
          text="Make your money feel less uncertain."
          splitBy="word"
          hinge="top"
          trigger="scroll"
          duration={0.6}
          stagger={0.04}
          ease="power3.out"
          perspective={700}
          creaseShading={0.5}
          fontSize="clamp(2.2rem, 5vw, 3.6rem)"
          fontWeight={400}
          color="#ffffff"
          className="text-center"
        />
      </h2>

      <p className="mx-auto mt-6 max-w-[440px] text-[14px] leading-[1.75] text-white/70">
        Know exactly how long your money will last.
      </p>

      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <SpecularButton
          size="md"
          radius={4}
          tint="#ffffff"
          tintOpacity={1}
          textColor="#E2835F"
          lineColor="#E2835F"
          baseColor="#f0c9b8"
          proximity={300}
          onClick={() => router.push('/signup')}
        >
          Get started free
        </SpecularButton>

        <Link
          href="/login"
          className="border border-white/30 px-7 py-3 text-[13px] font-medium text-white transition-colors hover:bg-white/10"
        >
          View demo
        </Link>
      </div>
    </div>
  </div>
</section>

{/* FOOTER */}
<footer className="px-8 py-12">
  <div className="mx-auto flex max-w-[1120px] flex-col justify-between gap-8 border-t border-white/[0.06] pt-10 md:flex-row md:items-end">
    <div>
      <Link href="/" aria-label="Xtrack home" className="inline-flex items-center">
        <SiteLogo />
      </Link>

      <p className="mt-3 max-w-[310px] text-[11px] leading-[1.7] text-[#666660]">
        A simpler way for international students to understand and manage their
        money.
      </p>
    </div>

    <div className="flex flex-wrap gap-x-8 gap-y-3">
      {NAV_LINKS.map(link => (
        <Link
          key={link.label}
          href={link.href}
          className="text-[11px] text-[#777770] transition-colors hover:text-[#E2835F]"
        >
          {link.label}
        </Link>
      ))}

      <Link
        href="/privacy"
        className="text-[11px] text-[#777770] transition-colors hover:text-[#E2835F]"
      >
        Privacy
      </Link>
    </div>
  </div>

  <div className="mx-auto mt-8 flex max-w-[1120px] flex-col justify-between gap-3 text-[10px] text-[#4F4F4A] sm:flex-row">
    <p>© 2026 Xtrack. All rights reserved.</p>
    <p>Built for students studying away from home.</p>
  </div>
</footer>


      </div>
    </div>
  )
}
