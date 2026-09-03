interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  iconOnly?: boolean
  theme?: 'dark' | 'white'
}

const SIZES = { sm: 28, md: 36, lg: 52 }

export function Logo({ size = 'md', iconOnly = false, theme = 'dark' }: LogoProps) {
  const px = SIZES[size]
  const id = `nk-logo-grad-${size}`

  const wordColor = theme === 'white' ? 'text-white' : 'text-slate-900'
  const klassColor = theme === 'white' ? 'text-lime-300' : 'text-blue-600'
  const fontSizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      <svg width={px} height={px} viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="36" y2="36" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#3b82f6" />
            <stop offset="55%" stopColor="#06b6d4" />
            <stop offset="100%" stopColor="#84cc16" />
          </linearGradient>
        </defs>
        <rect width="36" height="36" rx="11" fill={`url(#${id})`} />
        {/* Open book */}
        <path
          d="M18 14.5c-1.8-1.4-4.2-2-6.6-2-.6 0-1 .45-1 1v9c0 .6.45 1 1 1 2.1 0 4.2.5 5.8 1.6.5.35 1.1.35 1.6 0 1.6-1.1 3.7-1.6 5.8-1.6.55 0 1-.4 1-1v-9c0-.55-.4-1-1-1-2.4 0-4.8.6-6.6 2z"
          fill="white"
        />
        <path d="M18 14.5v9.6" stroke="#0891b2" strokeWidth="1.1" strokeLinecap="round" opacity="0.55" />
        {/* Spark */}
        <path d="M27 8.5l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9z" fill="white" opacity="0.95" />
      </svg>

      {!iconOnly && (
        <span className={`font-heading font-bold ${fontSizeMap[size]} ${wordColor} tracking-tight`}>
          Night<span className={klassColor}>klass</span>
        </span>
      )}
    </span>
  )
}
