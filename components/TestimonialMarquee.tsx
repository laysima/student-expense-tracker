'use client'

const TESTIMONIALS = [
  {
    quote: 'I finally know exactly how many days my money will last.',
    name: 'Amara O.',
    place: 'Waterloo',
  },
  {
    quote: 'Switching between cedis and dollars in my head was exhausting. Xtrack just does it.',
    name: 'Kwame A.',
    place: 'Thunder Bay',
  },
  {
    quote: 'The runway number changed how I budget for rent every month.',
    name: 'Priya S.',
    place: 'Vancouver',
  },
  {
    quote: 'Setup took two minutes. I was tracking spending the same day.',
    name: 'Daniel K.',
    place: 'Montréal',
  },
  {
    quote: 'It feels built for real life, not adapted from a banking app.',
    name: 'Grace M.',
    place: 'Toronto',
  },
  {
    quote: 'AI insights caught patterns I never noticed in my own spending.',
    name: 'Tariq H.',
    place: 'Kingston',
  },
]

const initials = (name: string) =>
  name
    .split(' ')
    .map(part => part[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

export default function TestimonialMarquee({ className = '' }: { className?: string }) {
  const items = [...TESTIMONIALS, ...TESTIMONIALS]

  return (
    <div
      className={`testimonial-marquee overflow-hidden ${className}`}
      aria-hidden="true"
    >
      <div className="testimonial-track flex w-max gap-5">
        {items.map((item, index) => (
          <div
            key={index}
            className="w-[320px] shrink-0 rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-md"
          >
            <p className="text-[14px] leading-[1.7] text-white/85">
              &ldquo;{item.quote}&rdquo;
            </p>
            <div className="mt-8 flex items-center gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-white/20 to-white/5 text-[11px] font-medium text-white/70">
                {initials(item.name)}
              </span>
              <div>
                <p className="text-[13px] font-medium text-white">{item.name}</p>
                <p className="text-[12px] text-white/45">{item.place}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
