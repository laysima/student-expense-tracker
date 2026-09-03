import XtrackLogo from '@/components/XtrackLogo'

type LogoSize = 'compact' | 'default' | 'large'
type LogoSurface = 'auto' | 'dark' | 'light'
type LogoVariant = 'full' | 'mark'

interface Props {
  size?: LogoSize
  surface?: LogoSurface
  variant?: LogoVariant
  className?: string
}

// Widths follow each viewBox's actual aspect ratio, so nothing is squashed:
// full lockup (18 18 467 122) ≈ 3.83:1, icon-only mark (18 18 152 122) ≈ 1.25:1.
const SIZE_CLASSES: Record<LogoVariant, Record<LogoSize, string>> = {
  full: {
    compact: 'h-7 w-[107px]',
    default: 'h-12 w-[184px]',
    large: 'h-16 w-[245px]',
  },
  mark: {
    compact: 'h-7 w-[35px]',
    default: 'h-12 w-[60px]',
    large: 'h-16 w-[80px]',
  },
}

export default function SiteLogo({
  size = 'default',
  surface = 'auto',
  variant = 'full',
  className = '',
}: Props) {
  return (
    <XtrackLogo
      variant={variant}
      className={`site-logo site-logo--${surface} block shrink-0 ${SIZE_CLASSES[variant][size]} ${className}`}
    />
  )
}
