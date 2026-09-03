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

/** A person studying at a desk lamp, late at night — used decoratively on the landing page. */
export function StudyScene({ className = '' }: { className?: string }) {
  return (
    <svg width="280" height="220" viewBox="0 0 280 220" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" className={className}>
      <defs>
        <linearGradient id="study-sky" x1="0" y1="0" x2="280" y2="220" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="100%" stopColor="#0b1120" />
        </linearGradient>
        <radialGradient id="lamp-glow" cx="0.5" cy="0" r="0.75">
          <stop offset="0%" stopColor="#fde68a" stopOpacity="0.9" />
          <stop offset="100%" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* Moon + stars backdrop */}
      <circle cx="228" cy="38" r="22" fill="url(#study-sky)" opacity="0.9" />
      <path d="M236 20a17 17 0 100 36 18 18 0 01-8-16 18 18 0 018-20z" fill="#0b1120" opacity="0.35" />
      <circle cx="30" cy="24" r="1.6" fill="#93c5fd" className="animate-twinkle" />
      <circle cx="60" cy="14" r="1.2" fill="#93c5fd" className="animate-twinkle" style={{ animationDelay: '0.4s' }} />
      <circle cx="180" cy="18" r="1.4" fill="#93c5fd" className="animate-twinkle" style={{ animationDelay: '0.8s' }} />

      {/* Lamp glow */}
      <ellipse cx="95" cy="90" rx="90" ry="70" fill="url(#lamp-glow)" />

      {/* Desk */}
      <rect x="20" y="168" width="240" height="10" rx="3" fill="#1e293b" />
      <rect x="30" y="178" width="8" height="28" fill="#1e293b" />
      <rect x="222" y="178" width="8" height="28" fill="#1e293b" />

      {/* Laptop */}
      <rect x="62" y="140" width="70" height="46" rx="4" fill="#334155" />
      <rect x="66" y="144" width="62" height="34" rx="2" fill="#7dd3fc" opacity="0.85" />
      <rect x="58" y="166" width="78" height="6" rx="2" fill="#1e293b" />

      {/* Mug + steam */}
      <rect x="150" y="152" width="18" height="16" rx="3" fill="#f97316" />
      <path d="M168 156c4 0 6 2 6 5s-2 5-6 5" stroke="#f97316" strokeWidth="2" fill="none" />
      <path d="M155 146c-2-4 2-6 0-10" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />
      <path d="M161 146c-2-4 2-6 0-10" stroke="#fde68a" strokeWidth="1.6" strokeLinecap="round" opacity="0.8" />

      {/* Desk lamp */}
      <circle cx="205" cy="120" r="3" fill="#1e293b" />
      <path d="M205 120l-25 34" stroke="#1e293b" strokeWidth="3" strokeLinecap="round" />
      <path d="M180 154l-14 8 28 4z" fill="#fde68a" />
      <rect x="203" y="150" width="4" height="28" rx="2" fill="#1e293b" />

      {/* Person: rounded body at desk, arm resting near laptop */}
      <ellipse cx="112" cy="205" rx="46" ry="8" fill="#0b1120" opacity="0.4" />
      <path d="M78 206v-30c0-20 16-34 36-34s36 14 36 34v30z" fill="#2563eb" />
      <circle cx="114" cy="128" r="18" fill="#fbbf78" />
      <path d="M97 122c0-11 8-19 17-19s17 8 17 19c-6-4-11-4-17-4s-11 0-17 4z" fill="#1e293b" />
      <path d="M92 158c6 6 14 9 22 9s16-3 22-9" stroke="#1d4ed8" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
