import { Logo } from '@/components/ui/Logo'

// Feature bullets shown on the left brand panel
const FEATURES = [
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
    title: 'AI-generated questions',
    desc: 'Upload your notes — Claude generates quality MCQs in seconds.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    title: 'Instant analytics',
    desc: 'See class performance and weak topic breakdowns at a glance.',
  },
  {
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
      </svg>
    ),
    title: 'Secure & fair assessments',
    desc: 'Auto-submit, time limits, and integrity controls built-in.',
  },
]

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      {/* ── Left brand panel (hidden on mobile) ───────────────────── */}
      <div className="hidden md:flex md:w-[420px] lg:w-[480px] xl:w-[520px] flex-shrink-0
                      bg-brand-panel flex-col relative overflow-hidden"
           style={{ background: 'linear-gradient(160deg, #2e1065 0%, #4c1d95 45%, #3730a3 100%)' }}>

        {/* Subtle geometric background pattern */}
        <div className="absolute inset-0 opacity-10" aria-hidden="true">
          <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="white" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Glowing orbs */}
        <div className="absolute -top-24 -left-24 w-72 h-72 bg-violet-500 rounded-full opacity-20 blur-3xl" aria-hidden="true" />
        <div className="absolute -bottom-32 -right-16 w-96 h-96 bg-indigo-600 rounded-full opacity-15 blur-3xl" aria-hidden="true" />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">
          {/* Logo */}
          <Logo size="md" theme="white" />

          {/* Main copy */}
          <div className="mt-16 flex-1">
            <h1 className="font-heading text-3xl xl:text-4xl font-bold text-white leading-snug">
              Assess smarter.<br />
              Teach better.
            </h1>
            <p className="mt-4 text-violet-200 text-sm leading-relaxed max-w-xs">
              The AI-powered platform built for Nigerian schools — generate questions,
              run assessments, and track student progress effortlessly.
            </p>

            {/* Feature bullets */}
            <div className="mt-10 space-y-5">
              {FEATURES.map((f, i) => (
                <div key={i} className="flex items-start gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-violet-300">
                    {f.icon}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{f.title}</p>
                    <p className="text-xs text-violet-300 mt-0.5 leading-relaxed">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Bottom trust note */}
          <div className="pt-8 border-t border-white/10">
            <p className="text-xs text-violet-300">
              Trusted by schools across Nigeria
            </p>
            <div className="flex items-center gap-2 mt-3">
              {[...Array(5)].map((_, i) => (
                <svg key={i} className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
              ))}
              <span className="text-xs text-violet-200 ml-1">4.9 / 5 from 200+ schools</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Right form panel ──────────────────────────────────────── */}
      <div className="flex-1 flex flex-col min-h-screen bg-[#F7F8FC] overflow-y-auto">
        {/* Mobile-only logo header */}
        <div className="md:hidden px-6 pt-8 pb-4">
          <Logo size="md" theme="dark" />
        </div>

        <div className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md animate-fade-in">
            {children}
          </div>
        </div>

        <p className="text-center text-xs text-slate-400 pb-8 px-6">
          &copy; {new Date().getFullYear()} KwikEval. All rights reserved.
        </p>
      </div>
    </div>
  )
}
