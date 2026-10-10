/** Original, lightweight vector artwork. Decorative; the adjacent text carries its meaning. */
export function StudyArtwork({
  variant = 'course',
  className = '',
}: {
  variant?: 'course' | 'plan' | 'success' | 'chat' | 'search'
  className?: string
}) {
  return (
    <svg
      viewBox="0 0 240 180"
      fill="none"
      aria-hidden="true"
      className={`h-auto w-48 ${className}`}
    >
      <ellipse cx="120" cy="154" rx="82" ry="12" fill="#eee7f8" />
      <circle cx="120" cy="87" r="72" fill="#f7f2ff" />
      <g transform="rotate(-9 120 85)">
        <rect x="58" y="31" width="119" height="125" rx="12" fill="#ccb2ef" />
        <rect x="68" y="25" width="119" height="125" rx="12" fill="#fffaf0" stroke="#eee2d0" />
        <rect x="80" y="41" width="95" height="26" rx="7" fill="#ede0fb" />
        <path d="M93 54h59" stroke="#9c73cf" strokeWidth="5" strokeLinecap="round" />
        {[83, 105, 127].map((y) => (
          <g key={y}>
            <rect x="82" y={y - 6} width="11" height="11" rx="3" fill="#e5d4f6" />
            <path d={`M104 ${y}h48`} stroke="#c5b9af" strokeWidth="4" strokeLinecap="round" />
          </g>
        ))}
      </g>
      {variant === 'success' ? (
        <g>
          <circle cx="181" cy="121" r="25" fill="#7545cf" />
          <path
            d="m170 121 7 7 16-17"
            stroke="white"
            strokeWidth="4"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : variant === 'chat' ? (
        <g>
          <path d="M144 91h65v41h-33l-13 12v-12h-19V91Z" fill="#7545cf" />
          <path d="M158 106h36m-36 12h22" stroke="white" strokeWidth="3" strokeLinecap="round" />
        </g>
      ) : variant === 'search' ? (
        <g>
          <circle cx="170" cy="104" r="24" fill="#f4ebff" stroke="#9060cf" strokeWidth="5" />
          <path d="m188 122 23 23" stroke="#9060cf" strokeWidth="8" strokeLinecap="round" />
        </g>
      ) : (
        <g transform="rotate(35 185 115)">
          <rect x="180" y="63" width="11" height="86" rx="3" fill="#f2bd56" />
          <path d="m180 149 5.5 15 5.5-15" fill="#dec8a9" />
          <path d="m183 158 2.5 6 2.5-6" fill="#514066" />
          <path d="M184 79v62" stroke="#ffd886" strokeWidth="2" />
          <rect x="180" y="63" width="11" height="12" rx="2" fill="#aa83d3" />
        </g>
      )}
      <path d="m43 52 2 7 7 2-7 2-2 7-2-7-7-2 7-2 2-7Z" fill="#b18ce5" />
      <circle cx="203" cy="48" r="4" fill="#e5d4f6" />
      <path d="m35 119 6 3m159 36 5-4" stroke="#b18ce5" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
