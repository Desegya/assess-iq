'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Geist, Instrument_Serif } from 'next/font/google'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { getSubjectColor } from '@/lib/subject-color'
import { StudyScene } from '@/components/ui/NightIllustration'

const geist = Geist({ subsets: ['latin'], display: 'swap' })

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', display: 'swap' })

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
  { text: 'Essay, structured and calculation questions, marked with feedback.' },
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
      <header className={`${geist.className} bg-white`}>
        <div className="relative mx-auto grid min-h-[76px] max-w-[1272px] grid-cols-[1fr_auto] items-center gap-x-4 border-x border-[#f1f1f1] px-4 py-4 sm:gap-y-3 sm:px-6 lg:min-h-[106px] lg:grid-cols-[1fr_auto_1fr] lg:px-6 lg:py-0 xl:px-1">
          <Link href="/" aria-label="NightKlass home" className="inline-flex min-h-11 w-fit items-center gap-2 text-[16px] font-semibold tracking-[-0.4px] text-black sm:gap-3">
            <Image src="/landing/nightklass-logo.svg" alt="" width={35} height={35} priority className="shrink-0" />
            NightKlass
          </Link>
          <nav aria-label="Main navigation" className="col-span-2 row-start-2 hidden items-center justify-center gap-8 text-sm text-[#707070] sm:flex lg:col-span-1 lg:col-start-2 lg:row-start-1">
            <a href="#how-it-works" className="inline-flex min-h-11 items-center transition-colors hover:text-[#7040ff]">How it works</a>
            <a href="#features" className="inline-flex min-h-11 items-center transition-colors hover:text-[#7040ff]">Features</a>
            <a href="#faqs" className="inline-flex min-h-11 items-center transition-colors hover:text-[#7040ff]">FAQs</a>
          </nav>
          <div className="col-start-2 row-start-1 hidden items-center justify-end gap-6 sm:flex lg:col-start-3 lg:gap-8">
            <Link href="/login" className="inline-flex min-h-11 items-center whitespace-nowrap text-sm font-semibold text-black transition-colors hover:text-[#7040ff]">
              Sign in
            </Link>
            <Link href="/register" className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-2xl bg-[#a477ff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#9060ef]">
              Start Studying Free
            </Link>
          </div>
          <details className="group col-start-2 row-start-1 sm:hidden">
            <summary aria-label="Toggle navigation menu" className="flex h-11 w-11 cursor-pointer list-none items-center justify-center rounded-xl text-[#7040ff] hover:bg-[#f6f1ff] [&::-webkit-details-marker]:hidden">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="group-open:hidden"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true" className="hidden group-open:block"><path d="m6 6 12 12M18 6 6 18" /></svg>
            </summary>
            <nav aria-label="Mobile navigation" className="absolute left-0 right-0 top-full z-30 flex flex-col gap-1 border-b border-[#eee] bg-white px-4 pb-5 pt-2 shadow-lg" onClick={event => {
              if ((event.target as HTMLElement).closest('a')) event.currentTarget.closest('details')?.removeAttribute('open')
            }}>
              <a href="#how-it-works" className="flex min-h-11 items-center rounded-lg px-3 text-sm text-[#707070] hover:bg-[#f6f1ff]">How it works</a>
              <a href="#features" className="flex min-h-11 items-center rounded-lg px-3 text-sm text-[#707070] hover:bg-[#f6f1ff]">Features</a>
              <a href="#faqs" className="flex min-h-11 items-center rounded-lg px-3 text-sm text-[#707070] hover:bg-[#f6f1ff]">FAQs</a>
              <Link href="/login" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-black hover:bg-[#f6f1ff]">Sign in</Link>
              <Link href="/register" className="mt-2 flex min-h-11 items-center justify-center rounded-2xl bg-[#a477ff] px-4 text-sm font-semibold text-white hover:bg-[#9060ef]">Start Studying Free</Link>
            </nav>
          </details>
        </div>
      </header>

      <section aria-labelledby="hero-heading" className={`${geist.className} bg-white text-black`}>
        <div className="relative mx-auto max-w-[1272px] border-x border-[#f1f1f1] px-5 pb-11 pt-12 text-center sm:px-8 sm:pt-16 lg:pt-16">
          <p className="flex items-center justify-center gap-2 text-xs text-[#606060] sm:text-sm">
            <span aria-hidden="true" className="text-xl leading-none text-black">✦</span>
            <span><span className="text-black">Your AI</span> Personal Study Coach</span>
          </p>
          <h1 id="hero-heading" className={`${instrumentSerif.className} mx-auto mt-6 max-w-[760px] text-[clamp(42px,6vw,76px)] font-normal leading-[1.08] tracking-[-1.5px] sm:tracking-[-2px]`}>
            Study smarter. Know<br className="hidden sm:block" /> exactly what to do next.
          </h1>
          <p className="mx-auto mt-6 max-w-[430px] text-sm leading-[1.5] text-[#777]">
            Nightklass helps you plan what to study, understand your courses, test yourself, and revise your weak areas.
          </p>
          <div className="relative mt-10 flex justify-center before:absolute before:left-[-21px] before:right-[-21px] before:top-1/2 before:h-px before:bg-[#f3ebff] sm:before:left-[-33px] sm:before:right-[-33px]">
            <Link href="/register" className="relative inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-[#a477ff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#9060ef]">
              Start Studying Free
            </Link>
          </div>
        </div>

        <div className="mx-auto max-w-[1272px] px-4 sm:px-0">
          <div className="relative isolate overflow-hidden px-4 py-8 sm:px-8 lg:py-8" style={{ background: 'radial-gradient(ellipse at 60% 0%, #f1c7f7 0%, transparent 54%), radial-gradient(ellipse at 10% 100%, #e6b8f8 0%, transparent 62%), linear-gradient(135deg, #7040f5, #c284fa 64%, #7644fa)' }}>
            <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-10 opacity-40" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent 0, transparent 82px, rgba(255,255,255,.35) 83px, transparent 85px)' }} />
            <div className="relative mx-auto max-w-[500px] pb-4">
              <div aria-hidden="true" className="absolute bottom-0 left-[5%] right-[5%] top-6 rounded-[20px] bg-white/95" />
              <article aria-label="Example of your daily study plan" className="relative rounded-[22px] bg-white p-5 shadow-[0_4px_0_rgba(255,255,255,.25)] sm:p-5">
                <div className="flex items-center justify-between gap-3 px-0 text-xs sm:px-3 sm:text-sm">
                  <p className="flex items-center gap-2 font-semibold">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><rect x="3" y="5" width="18" height="17" rx="2" fill="#b482ff" /><path d="M7 2v6M17 2v6M3 10h18" stroke="#b482ff" strokeWidth="2" /><path d="M7 14h2m3 0h2m3 0h1M7 18h2m3 0h2" stroke="white" strokeWidth="2" /></svg>
                    Today&apos;s Study
                  </p>
                  <p className="flex shrink-0 items-center gap-3 text-[11px] text-[#777] sm:text-xs">Tue, 14 Oct <span aria-hidden="true" className="tracking-widest text-black">•••</span></p>
                </div>
                <h2 className="mt-7 text-[28px] font-bold leading-tight sm:text-[30px]">BIO 223</h2>
                <p className="mt-1.5 text-sm">Descriptive Statistics</p>
                <div className="mt-7 flex items-center gap-2.5 sm:mt-8">
                  <div aria-hidden="true" className="h-3 min-w-0 flex-1 overflow-hidden rounded-full bg-[#f6f1ff]"><div className="h-full w-[28%] rounded-full bg-gradient-to-r from-[#bd85ff] to-[#e5bdf7]" /></div>
                  <p className="shrink-0 text-[11px] text-[#666] sm:text-xs">3 of 5 lessons</p>
                </div>
                <div className="mt-6 sm:mt-7">
                  {[
                    { title: 'Measures of Dispersion', icon: 'book' },
                    { title: 'Measure of Central Tendency', icon: 'clock' },
                  ].map((lesson, index) => (
                    <div key={lesson.title} className={`flex items-center justify-between gap-3 py-3 ${index === 0 ? 'border-b border-[#f1f1f1]' : ''}`}>
                      <p className="flex shrink-0 items-center gap-2 text-[11px] text-[#777] sm:text-xs">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#19202b" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          {lesson.icon === 'book' ? <><rect x="3" y="4" width="4" height="16" rx="1" /><rect x="8" y="4" width="4" height="16" rx="1" /><path d="m13 5 4-1 4 15-4 1z" /></> : <><circle cx="12" cy="13" r="8" /><path d="M12 8v5l3 2M3 5l3-3m12 0 3 3" /></>}
                        </svg>
                        Next lesson
                      </p>
                      <p className="flex min-w-0 items-center gap-2 text-right text-[11px] leading-relaxed sm:gap-4 sm:text-xs"><span>{lesson.title}</span><span aria-hidden="true" className="text-xl">›</span></p>
                    </div>
                  ))}
                </div>
                <Link href="/register" className="mt-5 flex min-h-[46px] items-center gap-3 rounded-2xl bg-[#a477ff] px-5 text-sm font-semibold text-white transition-colors hover:bg-[#9060ef]">
                  <svg width="16" height="18" viewBox="0 0 16 18" fill="currentColor" aria-hidden="true"><path d="M2 1.5a1 1 0 0 1 1.5-.85l11 7.5a1 1 0 0 1 0 1.7l-11 7.5A1 1 0 0 1 2 16.5z" /></svg>
                  Continue Learning <span aria-hidden="true" className="ml-auto text-xl font-normal">→</span>
                </Link>
              </article>
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

      <section id="features" className="max-w-5xl mx-auto px-4 sm:px-6 py-16">
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

      <section id="faqs" className="max-w-4xl mx-auto px-4 sm:px-6 py-16">
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
