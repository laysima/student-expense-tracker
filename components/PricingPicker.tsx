'use client'

import Link from 'next/link'
import { Check, Sparkles } from 'lucide-react'
import { useState } from 'react'

const PLANS = [
  {
    name: 'Free',
    eyebrow: 'Start here',
    price: '$0',
    cadence: 'forever',
    description:
      'Everything you need to build a clear, consistent picture of your student finances.',
    features: [
      'Expense and income tracking',
      'Home-currency conversion',
      'Budget runway',
      'Recurring payment tracking',
    ],
    action: 'Start for free',
    href: '/signup',
  },
  {
    name: 'Plus',
    eyebrow: 'Coming soon',
    price: '$4.99',
    cadence: 'per month',
    description:
      'Deeper guidance and flexible reporting for students who want to plan further ahead.',
    features: [
      'Everything in Free',
      'Advanced AI recommendations',
      'Custom financial goals',
      'Automated reports and exports',
    ],
    action: 'Join the waitlist',
    href: '/signup',
  },
] as const

export default function PricingPicker() {
  const [selectedPlan, setSelectedPlan] = useState(0)
  const plan = PLANS[selectedPlan]

  return (
    <section
      id="pricing"
      className="section-reveal scroll-mt-24 border-t border-white/[0.06] px-6 py-24 md:px-8 lg:py-32"
    >
      <div className="mx-auto max-w-[1080px]">
        <div className="mb-14 max-w-[680px]">
          <p className="mb-4 text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
            Simple pricing
          </p>
          <h2 className="text-[38px] leading-[1.12] tracking-[-1.3px] text-[#F5F5F3] md:text-[50px]">
            Pick the support your money needs.
          </h2>
          <p className="mt-5 max-w-[560px] text-[14px] leading-[1.75] text-[#85857E]">
            Start with the essentials for free, then move up when smarter
            planning tools become valuable to you.
          </p>
        </div>

        <div className="grid overflow-hidden border border-white/[0.07] bg-[#202020] lg:grid-cols-[0.82fr_1.18fr]">
          <div className="border-b border-white/[0.07] p-3 lg:border-r lg:border-b-0">
            <div className="relative grid grid-cols-2 bg-[#181818] p-1">
              <span
                aria-hidden="true"
                className="absolute inset-y-1 left-1 w-[calc(50%-4px)] bg-[#E2835F] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${selectedPlan * 100}%)` }}
              />
              {PLANS.map((item, index) => (
                <button
                  key={item.name}
                  type="button"
                  onClick={() => setSelectedPlan(index)}
                  aria-pressed={selectedPlan === index}
                  className={`relative z-10 px-4 py-3 text-[13px] font-medium transition-colors duration-300 ${
                    selectedPlan === index
                      ? 'text-white'
                      : 'text-[#85857E] hover:text-[#F5F5F3]'
                  }`}
                >
                  {item.name}
                </button>
              ))}
            </div>

            <div className="p-6 md:p-8">
              <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
                Compare plans
              </p>
              <p className="mt-5 text-[15px] leading-[1.75] text-[#B0B0A9]">
                Switch between plans to see exactly what is included. No hidden
                fees, long contracts or complicated tiers.
              </p>
              <div className="mt-10 border-t border-white/[0.07] pt-6">
                <div className="flex items-center gap-3 text-[13px] text-[#85857E]">
                  <Sparkles className="h-4 w-4 text-[#E2835F]" aria-hidden="true" />
                  Made for student budgets
                </div>
              </div>
            </div>
          </div>

          <div
            key={plan.name}
            className="pricing-detail-enter flex min-h-[480px] flex-col p-7 md:p-10 lg:p-12"
          >
            <div className="flex flex-wrap items-start justify-between gap-5">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-[0.14em] text-[#E2835F]">
                  {plan.eyebrow}
                </p>
                <h3 className="mt-3 text-[28px] tracking-[-0.8px] text-[#F5F5F3]">
                  {plan.name}
                </h3>
              </div>
              <div className="text-right">
                <p className="text-[34px] leading-none tracking-[-1.5px] text-[#F5F5F3]">
                  {plan.price}
                </p>
                <p className="mt-2 text-[11px] text-[#85857E]">{plan.cadence}</p>
              </div>
            </div>

            <p className="mt-7 max-w-[520px] text-[14px] leading-[1.75] text-[#85857E]">
              {plan.description}
            </p>

            <ul className="mt-9 grid gap-4 sm:grid-cols-2">
              {plan.features.map(feature => (
                <li key={feature} className="flex items-start gap-3 text-[13px] text-[#B0B0A9]">
                  <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#E2835F]/10 text-[#E2835F]">
                    <Check className="h-3 w-3" aria-hidden="true" />
                  </span>
                  {feature}
                </li>
              ))}
            </ul>

            <div className="mt-auto pt-10">
              <Link
                href={plan.href}
                className="inline-flex min-h-11 w-full items-center justify-center bg-[#E2835F] px-6 py-3 text-[13px] font-medium text-white transition-colors hover:bg-[#c96f4d] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#E2835F]"
              >
                {plan.action}
              </Link>
              <p className="mt-3 text-center text-[11px] text-[#73736D]">
                No credit card required
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
