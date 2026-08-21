import XtrackLogo from '@/components/XtrackLogo'

type LogoSize = 'compact' | 'default' | 'large'
type LogoSurface = 'auto' | 'dark' | 'light'

interface Props {
  size?: LogoSize
  surface?: LogoSurface
  className?: string
}

// Width follows the logo's actual aspect ratio (viewBox 18 18 467 122 ≈ 3.83:1).
const SIZE_CLASSES: Record<LogoSize, string> = {
  compact: 'h-7 w-[107px]',
  default: 'h-12 w-[184px]',
  large: 'h-16 w-[245px]',
}

export default function SiteLogo({
  size = 'default',
  surface = 'auto',
  className = '',
}: Props) {
  return (
    <XtrackLogo
      className={`site-logo site-logo--${surface} block shrink-0 ${SIZE_CLASSES[size]} ${className}`}
    />
  )
}
