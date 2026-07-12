import Link from 'next/link'


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
  { icon: '🛒', name: 'Walmart Grocery', status: 'Yesterday', amount: '−$64', type: 'expense' },
  { icon: '💼', name: 'Part-time wage', status: 'Recurring', amount: '+$320', type: 'income' },
  { icon: '🏠', name: 'Rent — October', status: 'Monthly', amount: '−$750', type: 'expense' },
]

const UNIVERSITIES = ['Lakehead', 'UofT', 'McGill', 'UBC', 'Waterloo', 'Queens']

const TABS = ['Analytics', 'Revenue', 'Expenses', 'Sector']

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-[#1A1A1A] p-[10px]">
      <div className="min-h-[calc(100vh-20px)] border-[20px] border-[#E2835F] bg-[#1A1A1A] overflow-hidden flex flex-col">

        {/* NAVBAR */}
        <nav className="flex items-center justify-between px-8 py-5">
          <span className="text-[21px]  text-[#F5F5F3] tracking-tight">
            X<span className="text-[#E2835F]">track</span>
          </span>

          <div className="hidden md:flex items-center gap-8">
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
            <Link
              href="/login"
              className="text-[14px] font-medium text-[#F5F5F3] border border-[#E2835F] px-5 py-2 hover:bg-[#E2835F] transition-colors"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="text-[14px] font-medium text-white bg-[#E2835F] px-5 py-2 hover:opacity-90 transition-opacity"
            >
              Get started
            </Link>
          </div>
        </nav>

        {/* HERO */}
        <section className="flex-1 flex flex-col lg:flex-row items-center justify-between px-8 py-12 lg:py-16 gap-12 max-w-[1200px] mx-auto w-full">

          {/* Left text */}
          <div className="flex-none lg:w-[42%] max-w-[480px]">
            <p className="text-[12px] font-medium text-[#E2835F] tracking-[0.1em] uppercase mb-5">
              For international students
            </p>
            <h1 className="text-[52px] lg:text-[60px]  text-[#F5F5F3] leading-[1.06] tracking-[-1.5px] mb-6">
              Know exactly<br />
              where your<br />
              <span className="text-[#E2835F]">money goes.</span>
            </h1>
            <p className="text-[15px] text-[#9B9B94] leading-[1.7] max-w-[380px] mb-8">
              Track expenses in CAD and your home currency, get AI-powered insights, and see exactly how long your budget will last. Built for students studying abroad.
            </p>
            <div className="flex items-center gap-5">
              <Link
                href="/signup"
                className="text-[15px] font-medium text-white bg-[#E2835F] px-7 py-3 hover:opacity-90 transition-opacity"
              >
                Get started free
              </Link>
              <Link
                href="/login"
                className="text-[15px] font-medium text-[#F5F5F3] underline underline-offset-4 hover:text-[#E2835F] transition-colors"
              >
                View demo
              </Link>
            </div>
          </div>

{/* Right image collage */}
{/* Right product visual */}
<div className="relative h-[610px] w-full max-w-[620px] flex-none lg:w-[55%]">

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
                  className="flex items-center gap-3 rounded-[14px] px-2 py-2 transition-colors hover:bg-white/[0.035]"
                >
                  <div
                    className={`flex h-9 w-9 items-center justify-center rounded-[11px] text-[14px] ${
                      transaction.type === 'expense'
                        ? 'bg-[#E2835F]/10'
                        : 'bg-[#A9BA9E]/10'
                    }`}
                  >
                    {transaction.icon}
                  </div>

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
        <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#E2835F]/15 text-[17px] text-[#E2835F]">
          ↓
        </div>

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
      <div className="mb-3 flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E2835F] text-[12px] text-white">
          ✦
        </div>

        <div>
          <p className="text-[10px] font-medium text-[#F5F5F3]">AI insight</p>
          <p className="text-[9px] text-[#777770]">Based on your spending</p>
        </div>
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

      <h2 className="text-[38px] leading-[1.12] tracking-[-1.4px] text-[#F5F5F3] md:text-[52px]">
        Financial clarity without the complicated spreadsheets.
      </h2>

      <p className="mt-6 max-w-[570px] text-[15px] leading-[1.8] text-[#8F8F88]">
        Xtrack brings your spending, currencies, recurring payments and
        financial insights into one calm, focused workspace.
      </p>
    </div>

    <div className="grid gap-5 md:grid-cols-12">

      {/* Multi-currency card */}
      <article className="feature-card relative overflow-hidden rounded-[28px] border border-white/[0.07] bg-[#202020] p-7 md:col-span-7 md:p-9">
        <div className="pointer-events-none absolute -right-20 -top-20 h-[280px] w-[280px] rounded-full bg-[#E2835F]/10 blur-[70px]" />

        <div className="relative z-10">
          <div className="mb-12 flex items-start justify-between">
            <div>
              <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#E2835F]">
                Multi-currency tracking
              </p>

              <h3 className="max-w-[390px] text-[28px] leading-[1.2] tracking-[-0.8px] text-[#F5F5F3] md:text-[34px]">
                Spend locally. Understand it in your home currency.
              </h3>
            </div>

            <div className="hidden h-12 w-12 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-[20px] text-[#E2835F] sm:flex">
              ↔
            </div>
          </div>

          <div className="rounded-[22px] border border-white/[0.07] bg-[#181818] p-5">
            <div className="mb-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E2835F] text-[11px] font-medium text-white">
                  CAD
                </div>

                <div>
                  <p className="text-[10px] text-[#73736D]">You spent</p>
                  <p className="text-[18px] text-[#F5F5F3]">$84.20</p>
                </div>
              </div>

              <div className="text-right">
                <p className="text-[10px] text-[#73736D]">
                  Home currency
                </p>
                <p className="text-[18px] text-[#A9BA9E]">₵899.26</p>
              </div>
            </div>

            <div className="h-px bg-white/[0.06]" />

            <div className="mt-4 flex items-center justify-between text-[10px] text-[#73736D]">
              <span>Automatic conversion</span>
              <span className="rounded-full bg-[#A9BA9E]/10 px-3 py-1 text-[#A9BA9E]">
                Updated today
              </span>
            </div>
          </div>
        </div>
      </article>

      {/* AI insights card */}
      <article className="feature-card relative overflow-hidden rounded-[28px] border border-[#E2835F]/15 bg-[#E2835F] p-7 md:col-span-5 md:p-9">
        <div className="absolute -bottom-20 -right-16 h-[230px] w-[230px] rounded-full border-[40px] border-white/[0.05]" />

        <div className="relative z-10 flex h-full min-h-[390px] flex-col">
          <div className="mb-auto">
            <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-full bg-white/15 text-[20px] text-white">
              ✦
            </div>

            <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-white/65">
              AI insights
            </p>

            <h3 className="text-[30px] leading-[1.18] tracking-[-0.9px] text-white">
              Small observations that improve everyday decisions.
            </h3>
          </div>

          <div className="mt-12 rounded-[20px] border border-white/15 bg-white/10 p-5 backdrop-blur-md">
            <p className="mb-3 text-[10px] uppercase tracking-[0.1em] text-white/60">
              Weekly insight
            </p>

            <p className="text-[14px] leading-[1.65] text-white">
              Your grocery spending fell by 18% this week. At this pace, your
              available balance could last 6 days longer.
            </p>
          </div>
        </div>
      </article>

      {/* Runway card */}
      <article className="feature-card rounded-[28px] border border-white/[0.07] bg-[#202020] p-7 md:col-span-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#E2835F]">
          Budget runway
        </p>

        <h3 className="text-[25px] leading-[1.25] tracking-[-0.6px] text-[#F5F5F3]">
          Know how long your money may last.
        </h3>

        <div className="mt-10 flex items-center justify-center">
          <div className="relative flex h-[180px] w-[180px] items-center justify-center rounded-full bg-[conic-gradient(#E2835F_0deg,#E2835F_265deg,#30302D_265deg,#30302D_360deg)]">
            <div className="flex h-[145px] w-[145px] flex-col items-center justify-center rounded-full bg-[#202020]">
              <p className="text-[43px] leading-none tracking-[-1.5px] text-[#F5F5F3]">
                47
              </p>
              <p className="mt-2 text-[11px] text-[#777770]">days remaining</p>
            </div>
          </div>
        </div>
      </article>

      {/* Smart categorisation */}
      <article className="feature-card rounded-[28px] border border-white/[0.07] bg-[#202020] p-7 md:col-span-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#A9BA9E]">
          Smart categories
        </p>

        <h3 className="text-[25px] leading-[1.25] tracking-[-0.6px] text-[#F5F5F3]">
          See exactly where your money is going.
        </h3>

        <div className="mt-9 space-y-3">
          {[
            { name: 'Housing', amount: '$750', width: '78%' },
            { name: 'Groceries', amount: '$264', width: '50%' },
            { name: 'Transport', amount: '$96', width: '29%' },
          ].map(category => (
            <div
              key={category.name}
              className="rounded-[15px] bg-white/[0.035] p-3"
            >
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] text-[#B3B3AC]">
                  {category.name}
                </span>
                <span className="text-[11px] text-[#F5F5F3]">
                  {category.amount}
                </span>
              </div>

              <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                <div
                  className="h-full rounded-full bg-[#A9BA9E]"
                  style={{ width: category.width }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>

      {/* Recurring bills */}
      <article className="feature-card rounded-[28px] border border-white/[0.07] bg-[#202020] p-7 md:col-span-4">
        <p className="mb-3 text-[11px] font-medium uppercase tracking-[0.12em] text-[#E2835F]">
          Recurring expenses
        </p>

        <h3 className="text-[25px] leading-[1.25] tracking-[-0.6px] text-[#F5F5F3]">
          Never let regular payments surprise you.
        </h3>

        <div className="mt-9 space-y-3">
          {[
            { icon: '⌂', title: 'Rent', date: 'Due Oct 01', amount: '$750' },
            { icon: '⌁', title: 'Mobile plan', date: 'Due Oct 06', amount: '$42' },
            { icon: '◉', title: 'Transit pass', date: 'Due Oct 08', amount: '$98' },
          ].map(item => (
            <div
              key={item.title}
              className="flex items-center gap-3 rounded-[15px] bg-white/[0.035] p-3"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-[11px] bg-[#E2835F]/10 text-[14px] text-[#E2835F]">
                {item.icon}
              </div>

              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-[#F5F5F3]">{item.title}</p>
                <p className="text-[9px] text-[#6F6F69]">{item.date}</p>
              </div>

              <p className="text-[11px] text-[#B3B3AC]">{item.amount}</p>
            </div>
          ))}
        </div>
      </article>
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

    <div className="grid gap-5 md:grid-cols-3">
      {STEPS.map(step => (
        <article
          key={step.number}
          className="feature-card relative min-h-[310px] overflow-hidden rounded-[26px] border border-white/[0.07] bg-[#202020] p-7"
        >
          <p className="absolute right-5 top-2 text-[88px] font-medium leading-none tracking-[-6px] text-white/[0.025]">
            {step.number}
          </p>

          <div className="relative z-10 flex h-full flex-col">
            <div className="mb-auto flex h-11 w-11 items-center justify-center rounded-full border border-[#E2835F]/25 bg-[#E2835F]/10 text-[12px] font-medium text-[#E2835F]">
              {step.number}
            </div>

            <div className="mt-20">
              <h3 className="text-[23px] tracking-[-0.5px] text-[#F5F5F3]">
                {step.title}
              </h3>

              <p className="mt-4 text-[13px] leading-[1.75] text-[#85857E]">
                {step.description}
              </p>
            </div>
          </div>
        </article>
      ))}
    </div>
  </div>
</section>

{/* PRICING */}
<section
  id="pricing"
  className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
>
  <div className="mx-auto max-w-[1000px]">
    <div className="mx-auto mb-14 max-w-[650px] text-center">
      <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
        Simple pricing
      </p>

      <h2 className="text-[38px] leading-[1.12] tracking-[-1.3px] text-[#F5F5F3] md:text-[50px]">
        Start free. Upgrade when you need more.
      </h2>

      <p className="mt-5 text-[14px] leading-[1.75] text-[#85857E]">
        Build the habit first. Pay only when advanced tools become valuable to
        you.
      </p>
    </div>

    <div className="grid gap-5 md:grid-cols-2">
      {/* Free */}
      <article className="feature-card rounded-[28px] border border-white/[0.07] bg-[#202020] p-8">
        <p className="text-[13px] font-medium text-[#F5F5F3]">Xtrack Free</p>

        <div className="mt-6 flex items-end gap-2">
          <p className="text-[48px] leading-none tracking-[-2px] text-[#F5F5F3]">
            $0
          </p>
          <p className="pb-1 text-[12px] text-[#777770]">forever</p>
        </div>

        <p className="mt-5 text-[13px] leading-[1.7] text-[#85857E]">
          Everything needed to start tracking and understanding your expenses.
        </p>

        <div className="my-7 h-px bg-white/[0.06]" />

        <div className="space-y-4">
          {[
            'Expense and income tracking',
            'Home-currency conversion',
            'Budget runway',
            'Recurring payment tracking',
          ].map(feature => (
            <div key={feature} className="flex items-center gap-3">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#A9BA9E]/10 text-[10px] text-[#A9BA9E]">
                ✓
              </span>
              <span className="text-[12px] text-[#B0B0A9]">{feature}</span>
            </div>
          ))}
        </div>

        <Link
          href="/signup"
          className="mt-9 flex w-full items-center justify-center border border-[#E2835F] px-6 py-3 text-[13px] font-medium text-[#F5F5F3] transition-colors hover:bg-[#E2835F]"
        >
          Start for free
        </Link>
      </article>

      {/* Plus */}
      <article className="feature-card relative overflow-hidden rounded-[28px] bg-[#E2835F] p-8">
        <div className="absolute -right-20 -top-20 h-[260px] w-[260px] rounded-full border-[50px] border-white/[0.05]" />

        <div className="relative z-10">
          <div className="flex items-center justify-between">
            <p className="text-[13px] font-medium text-white">Xtrack Plus</p>

            <span className="rounded-full bg-white/15 px-3 py-1 text-[9px] font-medium uppercase tracking-[0.08em] text-white">
              Coming soon
            </span>
          </div>

          <div className="mt-6 flex items-end gap-2">
            <p className="text-[48px] leading-none tracking-[-2px] text-white">
              Plus
            </p>
          </div>

          <p className="mt-5 text-[13px] leading-[1.7] text-white/70">
            Deeper insights and automation for students who want more control.
          </p>

          <div className="my-7 h-px bg-white/15" />

          <div className="space-y-4">
            {[
              'Everything in Xtrack Free',
              'Advanced AI recommendations',
              'Custom financial goals',
              'Automated reports and exports',
            ].map(feature => (
              <div key={feature} className="flex items-center gap-3">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white/15 text-[10px] text-white">
                  ✓
                </span>
                <span className="text-[12px] text-white/85">{feature}</span>
              </div>
            ))}
          </div>

          <button
            type="button"
            className="mt-9 flex w-full items-center justify-center bg-white px-6 py-3 text-[13px] font-medium text-[#E2835F] transition-opacity hover:opacity-90"
          >
            Join the waitlist
          </button>
        </div>
      </article>
    </div>
  </div>
</section>

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
  <div className="relative mx-auto max-w-[1180px] overflow-hidden rounded-[30px] bg-[#E2835F] px-7 py-16 text-center md:px-12 md:py-20">
    <div className="absolute -left-24 -top-24 h-[300px] w-[300px] rounded-full border-[55px] border-white/[0.05]" />
    <div className="absolute -bottom-32 -right-20 h-[340px] w-[340px] rounded-full border-[65px] border-white/[0.05]" />

    <div className="relative z-10 mx-auto max-w-[700px]">
      <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.14em] text-white/65">
        Take control of your student budget
      </p>

      <h2 className="text-[40px] leading-[1.1] tracking-[-1.5px] text-white md:text-[57px]">
        Make your money feel less uncertain.
      </h2>

      <p className="mx-auto mt-6 max-w-[540px] text-[14px] leading-[1.75] text-white/70">
        Track your spending, understand your runway and make better financial
        decisions while studying abroad.
      </p>

      <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
        <Link
          href="/signup"
          className="bg-white px-7 py-3 text-[13px] font-medium text-[#E2835F] transition-transform hover:-translate-y-0.5"
        >
          Get started free
        </Link>

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
      <Link
        href="/"
        className="text-[21px] tracking-tight text-[#F5F5F3]"
      >
        X<span className="text-[#E2835F]">track</span>
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

        {/* LOGO STRIP */}
        <div className="flex flex-col items-center gap-4 px-8 py-10 border-t border-[#222]">
          <p className="text-[11px] font-medium text-[#9B9B94] tracking-[0.1em] uppercase">
            Trusted by students at
          </p>
          <div className="flex flex-wrap items-center justify-center gap-10">
            {UNIVERSITIES.map(uni => (
              <span key={uni} className="text-[15px]  text-[#333]">
                {uni}
              </span>
            ))}
          </div>
        </div>

      </div>
    </div>
  )
}