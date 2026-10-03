'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { getSubjectColor } from '@/lib/subject-color'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { StudyScene } from '@/components/ui/NightIllustration'

const STARS = [
  [8, 12, 1.6], [22, 30, 1.2], [42, 8, 1.8], [65, 22, 1.3], [85, 14, 1.6],
  [92, 34, 1.1], [15, 55, 1.4], [50, 48, 1.2], [78, 52, 1.5], [95, 60, 1.2],
] as const

const ENTRY_POINTS: { title: string; desc: string; soon?: boolean }[] = [
  {
    title: 'Just a course title',
    desc: 'Type "Biostatistics" or "BIO 223" and Nightklass drafts a topic outline you can edit anytime.',
  },
  {
    title: 'Your syllabus',
    desc: 'Upload the course outline your lecturer gave you and confirm the topics we pull out of it.',
  },
  {
    title: 'Notes & handouts',
    desc: 'Upload lecture notes, PDFs, Word documents or textbooks and we build the course from them.',
  },
  {
    title: 'Department & level',
    desc: 'Tell us your programme and level and we suggest courses you’re likely taking this semester.',
  },
]

const JOURNEY = [
  { title: 'Start anywhere', desc: 'Course title, syllabus or uploaded materials.' },
  { title: 'Build the course', desc: 'Generate or edit a topic outline.' },
  { title: 'Learn', desc: 'Detailed lessons from your uploads or AI.' },
  { title: 'Plan', desc: 'A schedule built around your exam date.' },
  { title: 'Test', desc: 'Quizzes from basic to advanced.' },
  { title: 'Improve', desc: 'Spot weak areas and revise them.' },
  { title: 'Retain', desc: 'Flashcards with spaced review.' },
  { title: 'Track', desc: 'Completion, streaks and mastery.' },
]

const FEATURES: { text: string; soon?: boolean }[] = [
  { text: 'No syllabus yet? Generate a topic outline and edit it anytime, or photograph the one you have.' },
  { text: 'Upload lecture notes, slides, PDFs, Word documents and textbooks.' },
  { text: 'Detailed lessons for every topic, built from your notes (with citations) or with AI.' },
  { text: 'Turn your course into a day-by-day study plan around your exam date.' },
  { text: 'Take quizzes from basic to advanced, and see exactly what you got wrong.' },
  { text: 'Flashcards that resurface right before you forget.' },
  { text: 'Track completion, weak areas and mastery per topic.' },
  { text: 'Ask AI anything about your course, even before you upload notes.' },
  { text: 'Course suggestions based on your department and level.' },
  { text: 'Essay and structured questions with feedback.', soon: true },
  { text: 'Recommended videos and supplementary resources for every topic.' },
]

const FAQS = [
  {
    q: 'What if I don’t have a syllabus or notes?',
    a: 'That’s fine. Add a course with just its title and Nightklass suggests the topics it usually covers, writes study notes and builds quizzes. Upload your own material later to make everything match your lecturer.',
  },
  {
    q: 'Do I need my school to sign up first?',
    a: 'No. Nightklass works whether or not your institution has adopted it. You create your own account and it’s entirely yours.',
  },
  {
    q: 'Will my quizzes be graded?',
    a: 'Yes. Nightklass scores every quiz so it can track your mastery and find weak areas. Scores are for you only and are never shared with your school.',
  },
  {
    q: 'Is my uploaded material private?',
    a: 'Yes. Your notes and documents are only used to build your topics, notes and quizzes, and to answer your questions.',
  },
  {
    q: 'Can I use it for more than one course at a time?',
    a: 'Yes. Add every course you’re taking and plan each one around its exam date.',
  },
  {
    q: 'Is it really free?',
    a: 'Yes, to start. No card, no lecturer sign-up, no institutional licence required.',
  },
]

function SoonTag() {
  return (
    <span className="inline-block align-middle ml-1.5 text-[10px] font-bold uppercase tracking-wide bg-slate-100 text-slate-500 rounded-full px-2 py-0.5">
      Coming soon
    </span>
  )
}

function LandingContent() {
  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <Logo size="sm" theme="dark" />
            <span className="hidden md:inline text-xs font-semibold text-slate-500 border-l border-slate-200 pl-3">
              Your AI Personal Study Coach
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <Link href="/login" className="text-sm font-medium text-slate-600 hover:text-slate-900 transition-colors">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary !py-2 !px-4">
              Start free
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

        <div className="relative max-w-4xl mx-auto px-4 sm:px-6 pt-16 sm:pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 bg-white/10 backdrop-blur text-blue-100 text-xs font-semibold px-3 py-1.5 rounded-full mb-6 animate-fade-in">
            <span>✨</span>
            No syllabus required. Start with just your course title.
          </div>
          <h1 className="font-heading text-4xl sm:text-5xl font-bold text-white leading-tight animate-slide-up">
            Study like the plan{' '}
            <span className="bg-gradient-to-r from-cyan-300 to-lime-300 bg-clip-text text-transparent">actually works.</span>
          </h1>
          <p className="mt-5 text-base sm:text-lg text-blue-100/80 max-w-2xl mx-auto animate-slide-up delay-75">
            Start with your department, course title, syllabus or study materials. Nightklass builds your learning path, creates
            detailed lessons, plans what to study, tests what you understand and adapts until exam day.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap animate-slide-up delay-150">
            <Link href="/register" className="btn-primary !py-3 !px-6">
              Start Studying Free
            </Link>
            <a href="#how-it-works" className="bg-white/10 hover:bg-white/15 text-white font-semibold py-3 px-6 rounded-2xl text-sm transition-colors">
              See How Nightklass Works
            </a>
          </div>
        </div>

        {/* Product preview */}
        <div className="relative max-w-3xl mx-auto px-4 sm:px-6 pb-16 sm:pb-20 animate-slide-up delay-150">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2.5 h-2.5 rounded-full bg-red-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-amber-300" />
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-300" />
            </div>
            <div className="grid sm:grid-cols-[1.3fr_1fr] gap-4">
              <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-cyan-500 p-4 sm:p-5 text-left">
                <p className="text-[10px] font-bold uppercase tracking-wider text-blue-100">Today’s study</p>
                <p className="text-white font-heading font-bold text-base sm:text-lg mt-1">BIO 223 — Descriptive Statistics</p>
                <p className="text-blue-100 text-xs mt-1">Mean, median and mode · 45 minutes</p>
                <div className="flex flex-wrap gap-2 mt-4">
                  <span className="bg-white text-blue-700 text-xs font-bold rounded-lg px-3 py-1.5">Continue lesson</span>
                  <span className="bg-white/15 text-white text-xs font-bold rounded-lg px-3 py-1.5">Take revision quiz</span>
                </div>
              </div>
              <div className="rounded-2xl bg-slate-50 border border-slate-100 p-4 flex items-center gap-3 text-left">
                <ProgressRing percent={67} size={56} strokeWidth={5} color="#2563eb" />
                <div>
                  <p className="text-xs font-semibold text-slate-700">Weekly plan</p>
                  <p className="text-xs text-slate-400 mt-0.5">67% completed</p>
                </div>
              </div>
            </div>
            <div className="mt-3 rounded-xl bg-amber-50 border border-amber-100 px-4 py-3 flex items-center justify-between gap-3 text-left">
              <div>
                <p className="text-xs font-semibold text-amber-800">Recent quiz: 8/10</p>
                <p className="text-xs text-amber-700/80 mt-0.5">Revise measures of dispersion</p>
              </div>
              <span className="text-xs font-bold text-amber-800 flex-shrink-0">Weak area →</span>
            </div>
          </div>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16 sm:py-20">
        <div className="grid md:grid-cols-[1fr_1.4fr] gap-10 items-center">
          <div>
            <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3">Start anywhere</p>
            <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 leading-snug">
              You bring the course. Nightklass plans, teaches, tests and tracks the rest.
            </h2>
            <p className="text-slate-500 mt-4 leading-relaxed">
              You don’t need a syllabus, notes or a textbook to get going. Start with whatever you have, and Nightklass
              gets more personal as you add more.
            </p>
            <div className="hidden md:flex mt-6">
              <StudyScene className="w-full max-w-[220px] h-auto" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            {ENTRY_POINTS.map(e => {
              const color = getSubjectColor(e.title)
              return (
                <div key={e.title} className="card p-5">
                  <div className={`w-2 h-8 rounded-full ${color.bgSoft} mb-3`} aria-hidden="true" />
                  <h3 className="font-heading font-bold text-slate-900">
                    {e.title}
                    {e.soon && <SoonTag />}
                  </h3>
                  <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{e.desc}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="bg-white border-y border-slate-200 scroll-mt-16">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
          <p className="text-xs font-bold text-blue-600 uppercase tracking-wide mb-3 text-center">How Nightklass works</p>
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-12">
            From course title to exam-ready
          </h2>
          <ol className="grid grid-cols-2 md:grid-cols-4 gap-x-6 gap-y-10">
            {JOURNEY.map((s, i) => (
              <li key={s.title} className="text-center">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-600 to-cyan-500 text-white font-heading font-bold flex items-center justify-center mx-auto mb-3">
                  {i + 1}
                </div>
                <h3 className="font-semibold text-slate-900 text-sm">{s.title}</h3>
                <p className="text-xs text-slate-500 mt-1.5 leading-relaxed">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
        <div className="text-center mb-10">
          <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900">
            More than flashcards. A study system.
          </h2>
          <p className="text-slate-500 mt-3">Everything you need to actually finish the syllabus.</p>
        </div>
        <ul className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
          {FEATURES.map(f => (
            <li key={f.text} className="flex items-start gap-3 text-sm text-slate-700">
              <span className={`mt-0.5 font-bold ${f.soon ? 'text-slate-300' : 'text-blue-600'}`}>✓</span>
              <span className={f.soon ? 'text-slate-500' : ''}>
                {f.text}
                {f.soon && <SoonTag />}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
        <h2 className="font-heading text-2xl sm:text-3xl font-bold text-slate-900 text-center mb-10">
          Questions people actually ask
        </h2>
        <div className="grid sm:grid-cols-2 gap-x-8 gap-y-6">
          {FAQS.map(f => (
            <div key={f.q}>
              <h3 className="font-semibold text-slate-900 text-sm">{f.q}</h3>
              <p className="text-sm text-slate-500 mt-1.5 leading-relaxed">{f.a}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-16">
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-brand-dark via-blue-950 to-blue-900 px-6 sm:px-10 py-14 sm:py-16 text-center">
          <div className="absolute -top-10 -right-10 w-64 h-64 bg-cyan-500/20 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <div className="absolute -bottom-16 -left-10 w-64 h-64 bg-lime-400/10 rounded-full blur-3xl pointer-events-none" aria-hidden="true" />
          <h2 className="relative font-heading text-2xl sm:text-3xl font-bold text-white">
            Turn your course into a plan that gets you exam-ready.
          </h2>
          <p className="relative text-blue-100/80 mt-3">Free to start. No syllabus, school or lecturer sign-up needed.</p>
          <div className="relative mt-6">
            <Link href="/register" className="btn-primary !py-3 !px-8 inline-flex">
              Start Studying Free
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 flex items-center justify-between flex-wrap gap-4">
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
