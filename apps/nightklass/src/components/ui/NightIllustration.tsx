type Variant = 'empty' | 'celebrate' | 'search' | 'chat'

function Sky({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <svg width="140" height="120" viewBox="0 0 140 120" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="140" y2="120" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#06b6d4" />
          <stop offset="100%" stopColor="#84cc16" />
        </linearGradient>
      </defs>
      {children}
    </svg>
  )
}

function Moon({ id, cx = 70, cy = 50, r = 26 }: { id: string; cx?: number; cy?: number; r?: number }) {
  return (
    <>
      <circle cx={cx} cy={cy} r={r} fill={`url(#${id})`} />
      <path
        d={`M${cx + 10} ${cy - r * 0.85}a${r * 0.72} ${r * 0.72} 0 100 ${r * 1.7} ${r * 0.9} ${r * 0.9} 0 01-4-${r * 0.85}A${r * 0.9} ${r * 0.9} 0 01${cx + 10} ${cy - r * 0.85}z`}
        fill="white"
      />
    </>
  )
}

function Stars({ points }: { points: [number, number, number][] }) {
  return (
    <>
      {points.map(([x, y, r], i) => (
        <circle key={i} cx={x} cy={y} r={r} fill="#7dd3fc" className="animate-twinkle" style={{ animationDelay: `${i * 0.4}s` }} />
      ))}
    </>
  )
}

export function NightIllustration({ variant, className = '' }: { variant: Variant; className?: string }) {
  const id = `nk-ill-${variant}`

  if (variant === 'celebrate') {
    return (
      <Sky id={id}>
        <g className={className}>
          <Moon id={id} />
          <path d="M70 30c2 0 2 4 0 4s-2-4 0-4z" fill="white" />
          <Stars
            points={[
              [20, 20, 2],
              [115, 25, 1.6],
              [25, 85, 1.8],
              [118, 80, 2.2],
              [45, 15, 1.4],
              [95, 95, 1.5],
            ]}
          />
        </g>
      </Sky>
    )
  }

  if (variant === 'search') {
    return (
      <Sky id={id}>
        <g className={className}>
          <Moon id={id} cx={58} cy={48} r={22} />
          <Stars
            points={[
              [18, 18, 1.6],
              [120, 30, 1.8],
              [25, 90, 1.4],
            ]}
          />
          <circle cx={95} cy={75} r={14} fill="none" stroke="#38bdf8" strokeWidth="3" />
          <line x1="105" y1="85" x2="118" y2="98" stroke="#38bdf8" strokeWidth="4" strokeLinecap="round" />
        </g>
      </Sky>
    )
  }

  if (variant === 'chat') {
    return (
      <Sky id={id}>
        <g className={className}>
          <Moon id={id} cx={50} cy={45} r={20} />
          <Stars
            points={[
              [110, 20, 1.6],
              [20, 20, 1.4],
            ]}
          />
          <rect x={78} y={55} width="48" height="34" rx="10" fill="#ecfeff" />
          <path d="M86 89l-6 10 14-10" fill="#ecfeff" />
          <circle cx={92} cy={72} r="3" fill="#0891b2" />
          <circle cx={102} cy={72} r="3" fill="#0891b2" />
          <circle cx={112} cy={72} r="3" fill="#0891b2" />
        </g>
      </Sky>
    )
  }

  return (
    <Sky id={id}>
      <g className={className}>
        <Moon id={id} />
        <Stars
          points={[
            [18, 18, 1.8],
            [120, 22, 1.6],
            [22, 88, 1.4],
            [122, 85, 1.8],
          ]}
        />
        <rect x={48} y={92} width="44" height="8" rx="2" fill="#dbeafe" />
        <rect x={54} y={84} width="32" height="8" rx="2" fill="#93c5fd" />
      </g>
    </Sky>
  )
}
