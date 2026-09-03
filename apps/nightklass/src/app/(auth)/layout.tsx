import { Logo } from '@/components/ui/Logo'

const STARS = [
  [10, 15, 1.6], [30, 8, 1.2], [55, 20, 1.8], [78, 12, 1.3], [90, 30, 1.6],
  [18, 45, 1.2], [45, 60, 1.4], [70, 50, 1.2], [85, 68, 1.5], [25, 75, 1.2],
] as const

const PITCHES = [
  'Turn your course outline into a day-by-day plan.',
  'Self-quiz after every session — never for a grade.',
  'Flashcards that resurface right when you\'re about to forget.',
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* Decorative panel — desktop only */}
      <div className="hidden lg:flex lg:w-[45%] relative overflow-hidden bg-gradient-to-br from-brand-dark via-brand-dark to-blue-950 flex-col justify-between p-10">
        <svg className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" className="animate-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
        </svg>
        <div className="absolute -bottom-20 -left-10 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-24 -right-10 w-56 h-56 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <Logo size="md" theme="white" />

        <div className="relative">
          <h2 className="font-heading text-3xl font-bold text-white leading-tight">
            Study like the plan actually works.
          </h2>
          <ul className="mt-6 space-y-3">
            {PITCHES.map(p => (
              <li key={p} className="flex items-start gap-2.5 text-blue-100/90 text-sm">
                <span className="text-lime-300 mt-0.5">✓</span>
                {p}
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-blue-200/60">&copy; {new Date().getFullYear()} Nightklass</p>
      </div>

      {/* Form panel */}
      <div className="flex-1 flex items-center justify-center p-4 bg-brand-bg">
        <div className="w-full max-w-md">
          <div className="flex justify-center mb-8 lg:hidden">
            <Logo size="md" theme="dark" />
          </div>
          <div className="animate-fade-in">{children}</div>
          <p className="text-center text-xs text-slate-400 mt-8 lg:hidden">
            &copy; {new Date().getFullYear()} Nightklass. All rights reserved.
          </p>
        </div>
      </div>
    </div>
  )
}
