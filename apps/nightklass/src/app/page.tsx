'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Geist, Instrument_Serif } from 'next/font/google'
import { useAuth } from '@/contexts/auth-context'

const geist = Geist({ subsets: ['latin'], display: 'swap' })

const instrumentSerif = Instrument_Serif({ subsets: ['latin'], weight: '400', display: 'swap' })

const COURSE_STEPS = [
  {
    kind: 'course',
    title: 'Start with any course',
    description: 'Add just your course title and Nightklass creates a structured outline you can build on.',
  },
  {
    kind: 'upload',
    title: 'Upload your study materials',
    description: 'Upload your syllabus, notes, slides or handouts so Nightklass can build lessons from them.',
  },
  {
    kind: 'path',
    title: 'Get a clear study path',
    description: 'Nightklass turns your course into topics, lessons, quizzes, and revision so you always know what to study next.',
  },
] as const

// Replaced by the full-frame Figma exports when they are supplied.
function CourseStepPreview({ kind }: { kind: typeof COURSE_STEPS[number]['kind'] }) {
  return (
    <div aria-hidden="true" className="relative aspect-square overflow-hidden bg-[#f2f2f2]">
      <div className="absolute -right-[18%] -top-[25%] h-[75%] w-[55%] rotate-[35deg] rounded-[70px] border-[14px] border-white/70 shadow-[inset_0_0_12px_#ccc,0_0_12px_#ddd]" />
      <div className="absolute -right-[20%] top-[10%] h-[30%] w-[70%] -rotate-[35deg] rounded-full border-[12px] border-white/60 shadow-[inset_0_0_8px_#ccc]" />
      {kind === 'upload' ? (
        <div className="absolute bottom-[-9%] left-[12%] right-[10%] top-[9%] bg-white shadow-sm">
          <div className="border-b border-[#eee] py-[5%] text-center text-[clamp(10px,1vw,14px)] font-semibold">▣ Upload files</div>
          <div className="mx-[5%] mt-[5%] rounded-xl border border-dashed border-[#e8e8e8] bg-[#fafafa] px-[5%] pb-[8%] pt-[4%] text-center">
            <svg className="mx-auto mb-[5%] w-[14%]" viewBox="0 0 32 28" fill="#ccc"><path d="M2 4a3 3 0 0 1 3-3h8l4 4h10a3 3 0 0 1 3 3v16a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3Z" /></svg>
            <p className="text-[clamp(9px,0.9vw,12px)]">Drag and drop file(s) or <span className="text-[#0098ff]">choose file(s)</span></p>
            <p className="mt-1 text-[clamp(8px,0.8vw,11px)] text-[#aaa]">Max 25MB each, Only Pdf, PNG, JPEG</p>
          </div>
          <div className="relative px-[7%] pt-[5%]">
            {['Arrays & Linked Lists', 'Sorting Algorithms', 'Introduction to Data Structure'].map((file, index) => (
              <div key={file} className={`mb-[6%] text-[clamp(9px,0.9vw,12px)] ${index > 0 ? 'blur-[1px]' : ''}`}>
                <p className="truncate">📄 {file}</p><p className="mt-1 text-[10px] text-[#999]">{index === 0 ? '✓ Completed' : 'Uploading'}</p>
                <div className="mt-2 h-1 rounded-full bg-[#eee]"><div className="h-full w-2/3 rounded-full bg-[#8fd9ff]" /></div>
              </div>
            ))}
          </div>
          <div className="pointer-events-none absolute bottom-0 left-[-7%] right-[-4%] h-[37%] rounded-t-[48px] border border-white bg-white/35 backdrop-blur-[2px]" />
        </div>
      ) : (
        <div className="absolute bottom-0 left-[11%] right-[11%] top-[12%] overflow-hidden bg-white">
          <div className="absolute inset-x-0 top-0 grid grid-cols-6 gap-4 p-1 text-center text-xl text-[#eee4ff]">
            {Array.from({ length: 36 }, (_, i) => <span key={i}>{['▣', '▤', '▰', '◆'][i % 4]}</span>)}
          </div>
          <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/80 to-white" />
          {kind === 'course' ? (
            <div className="absolute inset-x-[10%] top-[43%] text-center">
              <p className="rounded-2xl bg-[#f2f2f2] px-2 py-3 text-[clamp(10px,1vw,14px)] font-medium"><span className="mr-2 text-[#ff413d]">▣</span> CSC 201 - Data Structure</p>
              <div className="mx-auto mt-5 w-[84%] rounded-2xl bg-[#a477ff] px-2 py-3 text-[clamp(11px,1vw,14px)] font-semibold text-white">Add Course <span className="ml-2">⊕</span></div>
            </div>
          ) : (
            <div className="absolute inset-x-[7%] top-[13%]">
              <div className="mx-auto mb-[11%] flex h-8 w-8 items-center justify-center rounded-full bg-[#a477ff] text-xl text-white">✓</div>
              {[
                { title: 'Topic', detail: '12 key concept', icon: '▰', color: 'bg-purple-50 text-purple-500' },
                { title: 'Lessons', detail: '32 lessons', icon: '▤', color: 'bg-blue-50 text-blue-500' },
                { title: 'Quizzes', detail: '8 practice quizzes', icon: '?', color: 'bg-emerald-50 text-emerald-500' },
                { title: 'Revision', detail: '12 key concept', icon: '⟳', color: 'bg-amber-50 text-amber-500' },
              ].map(item => (
                <div key={item.title} className="mb-3 flex items-center gap-2 rounded-xl border border-[#f4f4f4] bg-white p-1.5">
                  <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-2xl ${item.color}`}>{item.icon}</span>
                  <div><p className="text-[clamp(10px,1vw,14px)] font-medium">{item.title}</p><p className="text-[clamp(8px,0.8vw,11px)] text-[#555]">{item.detail}</p></div><span className="ml-auto pr-1">›</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

const HOW_IT_WORKS = [
  { icon: 'book', title: 'Start with what you have', description: 'Add just your course title, syllabus, notes, or study materials. You don’t need everything ready before you begin.' },
  { icon: 'path', title: 'Know what to study next', description: 'Nightklass turns your course into a simple study plan, so you always know what to focus on each day.' },
  { icon: 'lessons', title: 'Learn and test yourself', description: 'Read lessons, ask questions, and take quizzes as you study, so you’re not just reading — you’re actually learning.' },
  { icon: 'checklist', title: 'Improve before your exam', description: 'Nightklass finds your weak areas and shows you what to revise next, helping you prepare with more confidence.' },
] as const

function HowItWorksIcon({ kind, className }: { kind: typeof HOW_IT_WORKS[number]['icon']; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 48 48" fill="none" aria-hidden="true">
      {kind === 'book' && <>
        <path d="M12 4h23a5 5 0 0 1 5 5v32H12a6 6 0 0 1-6-6V10a6 6 0 0 1 6-6Z" fill="currentColor" />
        <path d="M13 35h21M19 16h9" stroke="white" strokeWidth="4" strokeLinecap="round" />
      </>}
      {kind === 'path' && <>
        <circle cx="10" cy="10" r="6" fill="currentColor" /><circle cx="37" cy="38" r="6" fill="currentColor" />
        <path d="M21 10h9a8 8 0 0 1 0 16H16a6 6 0 0 0 0 12h9" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>}
      {kind === 'lessons' && <>
        <rect x="5" y="6" width="14" height="15" rx="4" fill="currentColor" /><rect x="5" y="27" width="14" height="15" rx="4" fill="currentColor" />
        <path d="M26 9h15M26 17h8M26 30h15M26 38h8" stroke="currentColor" strokeWidth="4" strokeLinecap="round" />
      </>}
      {kind === 'checklist' && <>
        <path d="m5 10 3 3 6-7m-9 19 3 3 6-7m-9 19 3 3 6-7" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M23 10h18M23 25h18M23 40h18" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
      </>}
    </svg>
  )
}

const FAQS = [
  {
    q: 'Do I need a syllabus to get started?',
    a: 'No. You can start with just your course title and add your syllabus or notes later.',
  },
  {
    q: 'Can I upload my lecturer’s notes and slides?',
    a: 'Yes. Upload your notes, slides, syllabus or handouts, and Nightklass can use them to build your course outline, lessons and quizzes.',
  },
  {
    q: 'How does Nightklass create my study plan?',
    a: 'Nightklass uses your course topics, available study time and chosen duration or exam date to organise daily sessions. Your plan adjusts as you study and take quizzes.',
  },
  {
    q: 'Can Nightklass test me and help me revise?',
    a: 'Yes. Take quizzes, review feedback and practise with flashcards. Nightklass tracks your weak areas and helps you focus your revision where you need it most.',
  },
]

function FaqIllustration() {
  return (
    <div className="relative aspect-[597/548] w-full overflow-hidden bg-[#faf9f7]">
      <Image
        src="/landing/faq-illustration.png"
        alt="Illustration of a hand using a pencil to review study questions"
        fill
        sizes="(min-width: 1280px) 597px, (min-width: 768px) 48vw, 100vw"
        className="object-contain"
      />
    </div>
  )
}

function LandingContent() {
  const [openFaq, setOpenFaq] = useState<number | null>(0)

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

      <section aria-labelledby="course-intro-heading" className={`${geist.className} bg-white text-black`}>
        <div className="mx-auto max-w-[1272px] border-x border-[#f1f1f1]">
          <div className="relative border-b border-[#f3ebff] px-5 pb-14 pt-20 text-center sm:px-8 sm:pb-16 sm:pt-32 lg:pb-20 lg:pt-[250px]">
            <p className="mx-auto inline-flex max-w-full items-center justify-center gap-2 rounded-2xl border border-[#f0eaff] bg-gradient-to-r from-[#f1ebff] to-white px-3 py-3 text-xs leading-relaxed sm:text-sm">
              <span aria-hidden="true" className={`${instrumentSerif.className} text-xl font-semibold`}>?</span>
              <span>I have a course. <span className="text-[#707070]">How do I start studying?</span></span>
            </p>
            <h2 id="course-intro-heading" className={`${instrumentSerif.className} mx-auto mt-3 max-w-[1000px] text-[clamp(38px,4.5vw,60px)] font-normal leading-[1.12] tracking-[-1px]`}>
              Add your course. We’ll handle the rest.
            </h2>
            <p className="mx-auto mt-6 max-w-[760px] text-sm leading-relaxed text-[#777]">
              You don’t need to have everything ready. Just tell Nightklass what you’re studying and start from there.
            </p>
            <span aria-hidden="true" className="absolute -bottom-1 -left-1 h-2 w-2 rounded-full bg-[#faf5ff]" />
            <span aria-hidden="true" className="absolute -bottom-1 -right-1 h-2 w-2 rounded-full bg-[#faf5ff]" />
          </div>
          <div className="grid grid-cols-1 gap-x-5 gap-y-10 px-5 pb-20 pt-10 sm:grid-cols-2 sm:px-8 sm:pb-28 sm:pt-14 lg:grid-cols-3 lg:px-0 lg:pb-40 lg:pt-[60px]">
            {COURSE_STEPS.map((step, index) => (
              <article key={step.kind} className={`mx-auto w-full max-w-[440px] ${index === 2 ? 'sm:col-span-2 sm:w-[calc((100%_-_20px)/2)] lg:col-span-1 lg:w-full lg:max-w-none' : 'lg:max-w-none'}`}>
                <CourseStepPreview kind={step.kind} />
                <h3 className="mt-4 text-lg font-medium leading-snug tracking-[-0.3px] sm:text-xl">{step.title}</h3>
                <p className="mt-2 text-sm leading-[1.65] text-[#767676]">{step.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" aria-labelledby="how-it-works-heading" className={`${geist.className} scroll-mt-6 bg-white text-black`}>
        <div className="mx-auto max-w-[1240px] px-5 pb-16 pt-10 sm:px-8 sm:pb-20 lg:px-[18px] lg:pb-16 lg:pt-11">
          <p className="text-xs font-medium uppercase text-[#a477ff] sm:text-sm">How it works</p>
          <h2 id="how-it-works-heading" className={`${instrumentSerif.className} mt-4 max-w-[720px] text-[clamp(38px,4.5vw,60px)] font-normal leading-[1.18] tracking-[-1px]`}>
            I want something simple that<br className="hidden lg:block" /> students understand
          </h2>
          <p className="mt-6 max-w-[780px] text-sm leading-relaxed text-[#777]">
            You don’t need to have everything ready. Just tell Nightklass what you’re studying and start from there.
          </p>
          <ol className="mt-12 grid grid-cols-1 gap-x-8 gap-y-10 sm:mt-16 sm:grid-cols-2 lg:mt-[100px] lg:grid-cols-4 lg:gap-x-10">
            {HOW_IT_WORKS.map(step => (
              <li key={step.icon} className="min-w-0">
                <div className="relative isolate h-24 overflow-hidden sm:h-32 lg:h-40">
                  <HowItWorksIcon kind={step.icon} className="absolute left-0 top-6 h-11 w-11 text-[#141a23]" />
                  <HowItWorksIcon kind={step.icon} className="absolute -right-2 -top-5 -z-10 h-36 w-36 rotate-[15deg] text-[#fafafa] sm:h-44 sm:w-44 lg:h-[180px] lg:w-[180px]" />
                </div>
                <h3 className="mt-3 text-lg font-semibold leading-snug tracking-[-0.3px] lg:mt-4 lg:text-xl">{step.title}</h3>
                <p className="mt-3 max-w-[360px] text-sm leading-[1.6] text-[#767676]">{step.description}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="faqs" aria-labelledby="faq-heading" className={`${geist.className} scroll-mt-6 bg-white text-black`}>
        <div className="mx-auto max-w-[1272px] px-5 py-16 sm:px-8 sm:py-20 lg:px-0 lg:py-[86px]">
          <p className="text-xs font-medium uppercase text-[#a477ff] sm:text-sm">FAQ</p>
          <h2 id="faq-heading" className={`${instrumentSerif.className} mt-4 text-[clamp(38px,4.5vw,60px)] font-normal leading-[1.12] tracking-[-1px]`}>
            Questions? We’ve got answers.
          </h2>
          <p className="mt-6 text-sm leading-relaxed text-[#777]">Everything you need to know before you start studying with Nightklass.</p>
          <div className="mt-10 grid items-start gap-10 md:mt-16 md:grid-cols-2 lg:gap-9">
            <div>
              {FAQS.map((faq, index) => {
                const isOpen = openFaq === index
                return (
                  <div key={faq.q} className="border-b border-[#f0f0f0]">
                    <h3>
                      <button type="button" id={`faq-question-${index}`} aria-expanded={isOpen} aria-controls={`faq-answer-${index}`} onClick={() => setOpenFaq(isOpen ? null : index)} className="flex min-h-[76px] w-full items-center justify-between gap-5 py-5 text-left text-base font-medium leading-relaxed transition-colors hover:text-[#9060ef] lg:min-h-[80px] lg:text-lg">
                        {faq.q}
                        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true" className="shrink-0"><path d="M2 10h16" />{!isOpen && <path d="M10 2v16" />}</svg>
                      </button>
                    </h3>
                    <div id={`faq-answer-${index}`} role="region" aria-labelledby={`faq-question-${index}`} hidden={!isOpen} className="max-w-[510px] pb-8 pr-6 text-sm leading-[1.6] text-[#767676]">
                      {faq.a}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="mx-auto w-full max-w-[597px]"><FaqIllustration /></div>
          </div>
        </div>
      </section>

      <section
        aria-labelledby="signup-heading"
        className={`${geist.className} px-5 py-20 text-center sm:px-8 sm:py-24 lg:py-[124px]`}
        style={{ background: 'radial-gradient(ellipse at 50% -35%, #8051ff 0%, transparent 75%), radial-gradient(ellipse at 5% 100%, #ecd4f5 0%, transparent 65%), radial-gradient(ellipse at 100% 100%, #eacff6 0%, transparent 65%), linear-gradient(180deg, #a57afa 0%, #d9bdf8 100%)' }}
      >
        <div className="mx-auto max-w-[800px]">
          <h2 id="signup-heading" className={`${instrumentSerif.className} text-[clamp(38px,4.5vw,60px)] font-normal leading-[1.13] tracking-[-0.8px] text-white`}>
            Turn your course into a plan<br className="hidden sm:block" /> that gets you exam-ready.
          </h2>
          <p className="mx-auto mt-6 max-w-[480px] text-sm leading-relaxed text-white/80">Free to start. No syllabus, school or lecturer sign-up needed.</p>
          <div className="mt-8 sm:mt-10">
            <Link href="/register" className="inline-flex min-h-[46px] items-center justify-center rounded-2xl bg-white px-5 text-sm font-semibold text-[#a477ff] transition-colors hover:bg-[#f6f1ff]">
              Start Studying Free
            </Link>
          </div>
        </div>
      </section>

      <footer className={`${geist.className} bg-white text-black`}>
        <div className="mx-auto max-w-[1272px] px-5 pt-14 sm:px-8 sm:pt-16 lg:px-0 lg:pt-20">
          <div className="grid grid-cols-2 gap-x-6 gap-y-10 pb-10 sm:grid-cols-[1.5fr_1fr_1fr] sm:gap-x-10 sm:pb-14 lg:gap-x-20">
            <div className="col-span-2 sm:col-span-1">
              <Link href="/" aria-label="NightKlass home" className="inline-flex min-h-11 items-center gap-3 text-base font-semibold tracking-[-0.4px]">
                <Image src="/landing/nightklass-logo.svg" alt="" width={35} height={35} />
                NightKlass
              </Link>
              <p className={`${instrumentSerif.className} mt-5 max-w-[330px] text-[32px] leading-[1.15] tracking-[-0.5px] sm:text-[36px]`}>A little more clarity.<br />A lot more confidence.</p>
              <p className="mt-4 max-w-[300px] text-sm leading-relaxed text-[#767676]">Your course, your pace, your path to exam day.</p>
            </div>
            <nav aria-label="Footer explore navigation">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-[#9060ef]">Explore</p>
              <a href="#how-it-works" className="flex min-h-11 w-fit items-center text-sm text-[#707070] transition-colors hover:text-[#7040ff]">How it works</a>
              <a href="#faqs" className="flex min-h-11 w-fit items-center text-sm text-[#707070] transition-colors hover:text-[#7040ff]">FAQs</a>
            </nav>
            <nav aria-label="Footer account navigation">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.08em] text-[#9060ef]">Your next step</p>
              <Link href="/register" className="flex min-h-11 w-fit items-center gap-2 text-sm font-medium transition-colors hover:text-[#7040ff]">Start studying <span aria-hidden="true">↗</span></Link>
              <Link href="/login" className="flex min-h-11 w-fit items-center text-sm text-[#707070] transition-colors hover:text-[#7040ff]">Sign in</Link>
            </nav>
          </div>
          <div className="flex flex-col gap-3 border-t border-[#eee] py-6 text-xs text-[#767676] sm:flex-row sm:items-center sm:justify-between sm:py-7">
            <p>&copy; {new Date().getFullYear()} NightKlass. All rights reserved.</p>
            <a href="#hero-heading" className="inline-flex min-h-11 w-fit items-center gap-2 transition-colors hover:text-[#7040ff]">Back to top <span aria-hidden="true">↑</span></a>
          </div>
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
