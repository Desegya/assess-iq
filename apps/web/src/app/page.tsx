import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const FEATURES = [
  {
    title: 'AI-generated questions',
    desc: 'Upload your notes, past questions, or textbooks — Claude drafts quality MCQ, theory, and short-answer questions in seconds.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
    ),
  },
  {
    title: 'Teacher review workflow',
    desc: "AI drafts, you decide. Edit, approve, or reject every question before it reaches a student — nothing goes live unreviewed.",
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: 'Secure, fair assessments',
    desc: 'Timers, randomisation, tab-switch and copy/paste detection, and full activity logs — built in from day one.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    ),
  },
  {
    title: 'Instant analytics',
    desc: 'Score distributions, class performance, and weak-topic breakdowns the moment students submit — no spreadsheets.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
    ),
  },
  {
    title: 'Bulk student onboarding',
    desc: 'CSV import or a simple join code — get an entire class or school registered in minutes, not days.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M17 20h5v-2a4 4 0 00-3-3.87M9 20H4v-2a4 4 0 013-3.87m6-1a4 4 0 100-8 4 4 0 000 8zm6 3a4 4 0 00-3-3.87M9 12a4 4 0 100-8 4 4 0 000 8z" />
    ),
  },
  {
    title: 'Built for Nigerian schools',
    desc: 'From secondary schools to universities and tutorial centres — flexible enough for one class or an entire institution.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0121 15.5c0 1-1.5 2-9 2s-9-1-9-2a12.083 12.083 0 012.84-4.922L12 14z" />
    ),
  },
]

const STEPS = [
  { n: '1', title: 'Upload your notes', desc: 'Course outlines, past questions, or textbooks — PDF, DOCX, or TXT.' },
  { n: '2', title: 'AI drafts the questions', desc: 'Claude generates MCQ, theory, and short-answer questions from your material.' },
  { n: '3', title: 'You review and publish', desc: 'Edit or approve each question, set a timer, then publish to your class.' },
  { n: '4', title: 'See results instantly', desc: 'Scores, integrity flags, and weak-topic breakdowns as soon as students submit.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-brand-bg">
      {/* ── Nav ────────────────────────────────────────────────────────── */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" theme="dark" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary !py-2 !px-4">
              Register your institution
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ───────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        <div className="absolute -top-24 -left-24 w-96 h-96 bg-violet-300 rounded-full opacity-20 blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-10 right-0 w-72 h-72 bg-indigo-300 rounded-full opacity-20 blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-violet-50 text-violet-700 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
            </svg>
            30 days free — no credit card required
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-slate-900 leading-tight animate-slide-up">
            Assess smarter. <span className="text-gradient">Teach better.</span>
          </h1>
          <p className="mt-5 text-lg text-slate-500 max-w-2xl mx-auto animate-slide-up delay-75">
            KwikEval turns your notes into AI-generated exams in minutes, keeps them fair with built-in
            integrity checks, and shows you exactly where your class is struggling — before the real exam does.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap animate-slide-up delay-150">
            <Link href="/register" className="btn-primary !py-3 !px-6">
              Register your institution
            </Link>
            <Link href="/join" className="btn-secondary !py-3 !px-6">
              I&apos;m a student — join with a code
            </Link>
          </div>
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────────────────── */}
      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
            Everything a teacher needs, nothing they don&apos;t
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => (
            <div key={f.title} className="card p-6 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center text-violet-600 mb-4">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {f.icon}
                </svg>
              </div>
              <h3 className="font-heading font-bold text-slate-900">{f.title}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────────────────── */}
      <section className="bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            From notes to results in four steps
          </h2>
          <div className="grid sm:grid-cols-4 gap-8">
            {STEPS.map(s => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-violet-600 text-white font-heading font-bold flex items-center justify-center mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ────────────────────────────────────────────────────────── */}
      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
          Ready to give your school its first AI-assisted exam?
        </h2>
        <p className="text-slate-500 mt-3">Free for 30 days. No credit card. Set up in under two minutes.</p>
        <div className="mt-6">
          <Link href="/register" className="btn-primary !py-3 !px-8 inline-flex">
            Register your institution
          </Link>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────────────────── */}
      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <Logo size="sm" theme="dark" />
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} KwikEval. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
