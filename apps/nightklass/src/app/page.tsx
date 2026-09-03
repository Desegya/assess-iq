'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { getSubjectColor } from '@/lib/subject-color'

const STARS = [
  [8, 12, 1.6], [22, 30, 1.2], [42, 8, 1.8], [65, 22, 1.3], [85, 14, 1.6],
  [92, 34, 1.1], [15, 55, 1.4], [50, 48, 1.2], [78, 52, 1.5], [95, 60, 1.2],
] as const

const FEATURES = [
  {
    title: 'Upload, and we structure it',
    desc: 'Drop in a course outline, notes, or textbook — we break it into topics for you to review and edit.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M12 12v9m0-9l-3 3m3-3l3 3" />
    ),
  },
  {
    title: 'A study plan built around you',
    desc: 'Tell us your exam date and when you can study — we schedule every topic so you finish in time, with revision built in.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    ),
  },
  {
    title: 'Self-quizzes & flashcards',
    desc: 'Test yourself after every session, and review flashcards on a spaced-repetition schedule that adapts to how well you know each one.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    ),
  },
  {
    title: 'Know your weak spots',
    desc: 'We track your quiz scores per topic and flag exactly what to revise before it costs you marks.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
    ),
  },
  {
    title: 'Ask AI about your notes',
    desc: 'Stuck on a concept? Ask the study buddy — it answers using your own uploaded material, and says so when it can\'t find the answer.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    ),
  },
  {
    title: 'No school sign-up needed',
    desc: 'Nightklass works whether or not your school has adopted it — just create an account and start studying.',
    icon: (
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
        d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M15 11a4 4 0 10-4-4" />
    ),
  },
]

const STEPS = [
  { n: '1', title: 'Add a course', desc: 'Create a course and upload your notes, outline, or textbook.' },
  { n: '2', title: 'Set your exam date', desc: 'Tell us when you can study and when the exam is.' },
  { n: '3', title: 'Get your plan', desc: 'A day-by-day schedule appears, built around your topics.' },
  { n: '4', title: 'Study, quiz, repeat', desc: 'Work through sessions, test yourself, and watch your weak spots shrink.' },
]

function LandingContent() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Logo size="sm" theme="dark" />
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary !py-2 !px-4">
              Get started free
            </Link>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-gradient-to-b from-brand-dark via-brand-dark to-brand-bg">
        <svg className="absolute inset-0 w-full h-full opacity-70 pointer-events-none" preserveAspectRatio="none" aria-hidden="true">
          {STARS.map(([x, y, r], i) => (
            <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="white" className="animate-twinkle" style={{ animationDelay: `${i * 0.35}s` }} />
          ))}
        </svg>
        <div className="absolute top-16 -right-16 w-72 h-72 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
        <div className="absolute top-0 -left-16 w-72 h-72 bg-blue-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />

        <div className="relative max-w-4xl mx-auto px-6 pt-20 pb-24 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-blue-100 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
            <span>🔥</span>
            Free to start — no school sign-up required
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white leading-tight animate-slide-up">
            Your <span className="bg-gradient-to-r from-cyan-300 to-lime-300 bg-clip-text text-transparent">personal study coach</span>, not just another app.
          </h1>
          <p className="mt-5 text-lg text-blue-100/80 max-w-2xl mx-auto animate-slide-up delay-75">
            Upload your notes, get a study plan built around your exam date, and test yourself along the way —
            with flashcards, quizzes, and an AI study buddy that knows your material.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap animate-slide-up delay-150">
            <Link href="/register" className="btn-primary !py-3 !px-6">
              Get started free
            </Link>
            <Link href="/login" className="bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-6 rounded-2xl text-sm transition-colors">
              Sign in
            </Link>
          </div>
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-6 py-16">
        <div className="text-center mb-12">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
            Everything you need to actually finish the syllabus
          </h2>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {FEATURES.map((f, i) => {
            const color = getSubjectColor(f.title)
            return (
              <div key={f.title} className="card p-6 animate-fade-in" style={{ animationDelay: `${i * 60}ms` }}>
                <div className={`w-10 h-10 rounded-xl ${color.bgSoft} flex items-center justify-center ${color.text} mb-4`}>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {f.icon}
                  </svg>
                </div>
                <h3 className="font-heading font-bold text-slate-900">{f.title}</h3>
                <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.desc}</p>
              </div>
            )
          })}
        </div>
      </section>

      <section className="bg-white border-y border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            From notes to exam-ready in four steps
          </h2>
          <div className="grid sm:grid-cols-4 gap-8">
            {STEPS.map(s => (
              <div key={s.n} className="text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-heading font-bold flex items-center justify-center mx-auto mb-4">
                  {s.n}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-6 py-20 text-center">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
          Stop cramming. Start a plan that actually finishes.
        </h2>
        <p className="text-slate-500 mt-3">Free to start. No school or lecturer sign-up needed.</p>
        <div className="mt-6">
          <Link href="/register" className="btn-primary !py-3 !px-8 inline-flex">
            Get started free
          </Link>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-6 flex items-center justify-between flex-wrap gap-4">
          <Logo size="sm" theme="dark" />
          <p className="text-xs text-slate-400">&copy; {new Date().getFullYear()} Nightklass. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}

export default function HomePage() {
  const { user, isLoading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!isLoading && user) router.replace('/dashboard')
  }, [isLoading, user, router])

  // Always render the landing page immediately — it must be visible on first
  // paint (and to crawlers) rather than blank while the auth check resolves.
  // A signed-in visitor briefly sees this before the redirect above fires.
  return <LandingContent />
}
