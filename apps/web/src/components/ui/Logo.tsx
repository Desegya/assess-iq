interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  /** If true, show only the icon mark without the wordmark */
  iconOnly?: boolean
  /** Override the wordmark colour scheme — 'dark' (default) | 'white' */
  theme?: 'dark' | 'white'
}

const SIZES = { sm: 24, md: 32, lg: 48 }

export function Logo({ size = 'md', iconOnly = false, theme = 'dark' }: LogoProps) {
  const px = SIZES[size]
  const id = `logo-grad-${size}`

  const wordColor   = theme === 'white' ? 'text-white'        : 'text-slate-900'
  const iqColor     = theme === 'white' ? 'text-violet-300'   : 'text-violet-600'
  const fontSizeMap = { sm: 'text-sm', md: 'text-base', lg: 'text-xl' }

  return (
    <span className="inline-flex items-center gap-2.5 select-none">
      {/* ── Icon mark ── */}
      <svg
        width={px}
        height={px}
        viewBox="0 0 32 32"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0%"   stopColor="#8b5cf6" />
            <stop offset="100%" stopColor="#4c1d95" />
          </linearGradient>
        </defs>

        {/* Rounded square background */}
        <rect width="32" height="32" rx="8" fill={`url(#${id})`} />

        {/* Stylised "A" — two ascending lines + crossbar */}
        <path
          d="M9 23 L16 9 L23 23"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
        <path
          d="M11.5 18.5 H20.5"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          fill="none"
        />

        {/* AI sparkle — small star circle top-right */}
        <circle cx="25" cy="7" r="3" fill="white" opacity="0.9" />
        <path
          d="M25 5.5 V8.5 M23.5 7 H26.5"
          stroke="#7c3aed"
          strokeWidth="1.2"
          strokeLinecap="round"
        />
      </svg>

      {/* ── Wordmark ── */}
      {!iconOnly && (
        <span className={`font-heading font-bold ${fontSizeMap[size]} ${wordColor} tracking-tight`}>
          Kwik<span className={iqColor}>Eval</span>
        </span>
      )}
    </span>
  )
}
