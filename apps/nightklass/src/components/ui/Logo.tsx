interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  theme?: 'dark' | 'white'
}

const SIZES = { sm: 24, md: 32, lg: 48 }

export function Logo({ size = 'md', iconOnly = false, theme = 'dark' }: LogoProps) {
  const px = SIZES[size]
  const id = `nk-logo-grad-${size}`

  const wordColor = theme === 'white' ? 'text-white' : 'text-slate-900'
  const klassColor = theme === 'white' ? 'text-indigo-300' : 'text-indigo-600'
  const fontSizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={px} height={px} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#818cf8" />
            <stop offset="100%" stopColor="#312e81" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="8" fill={`url(#${id})`} />
        {/* Crescent moon */}
        <path
          d="M20 8a8 8 0 100 16 8.4 8.4 0 01-3.5-6.9A8.4 8.4 0 0120 8z"
          fill="white"
        />
        {/* Stars */}
        <circle cx="10" cy="10" r="1.1" fill="white" opacity="0.9" />
        <circle cx="8" cy="16" r="0.8" fill="white" opacity="0.7" />
      </svg>

      {!iconOnly && (
        <span className={`font-heading font-bold ${fontSizeMap[size]} ${wordColor} tracking-tight`}>
          Night<span className={klassColor}>klass</span>
        </span>
      )}
    </span>
  )
}
