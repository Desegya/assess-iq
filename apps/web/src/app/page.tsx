import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const FEATURES = [
  {
    title: 'Questions your way',
    desc: 'Write them, import a paper from a spreadsheet, or have AI draft them from your notes. Multiple choice, true/false, short answer and theory.',
  },
  {
    title: 'Nothing goes out unchecked',
    desc: 'AI questions arrive as drafts. You edit or approve each one before it can be added to a test.',
  },
  {
    title: 'One link per class',
    desc: 'Students join with a confirmed school email by default. You can switch to an email list, approve each request, or open the link.',
  },
  {
    title: 'Timed and fair',
    desc: 'The time limit is enforced by our server, not the student’s phone. Leaving the test raises warnings, and time-outs submit automatically.',
  },
  {
    title: 'Marks the moment they finish',
    desc: 'Objective questions are marked on submission. You mark written answers, and students see their score update.',
  },
  {
    title: 'Works on any phone',
    desc: 'Nothing to install. Students sit tests in the browser on whatever device they have.',
  },
]

const STEPS = [
  { n: '1', title: 'Create a class', desc: 'Choose who can join: your school’s email domain, a list, or approval.' },
  { n: '2', title: 'Share the link', desc: 'Post it in the class group chat. Students sign up with their school email.' },
  { n: '3', title: 'Build a test', desc: 'Pick questions from your bank, set the time and window, and publish.' },
  { n: '4', title: 'See results', desc: 'Scores and the spread across your class as soon as students submit.' },
]

export default function LandingPage() {
  return (
    <div className="min-h-dvh bg-[#fcfbfe]">
      <header className="sticky top-0 z-20 border-b border-[#eae6ef] bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Logo size="sm" />
          <div className="flex items-center gap-2 sm:gap-3">
            <Link href="/join" className="hidden min-h-11 items-center px-2 text-sm font-medium text-[#716778] hover:text-violet-700 sm:inline-flex">
              Join a class
            </Link>
            <Link href="/login" className="inline-flex min-h-11 items-center px-2 text-sm font-medium text-[#716778] hover:text-violet-700">
              Sign in
            </Link>
            <Link href="/register" className="btn-primary !min-h-10 !px-4 !py-2">
              Start teaching
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-20 text-center">
        <p className="mb-5 text-xs font-medium uppercase tracking-[.14em] text-violet-700">For lecturers · free in early access</p>
        <h1 className="product-display !text-[clamp(2.75rem,6vw,4.5rem)]">
          Quick, fair tests
          <br />
          for your class.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-[#716778]">
          Set a test from your own questions or notes, share one class link, and see marks the moment students finish.
          No school sign-up needed.
        </p>
        <div className="mt-9 flex flex-wrap items-center justify-center gap-3">
          <Link href="/register" className="btn-primary !px-6">
            Create a lecturer account
          </Link>
          <Link href="/join" className="btn-secondary !px-6">
            I&rsquo;m a student, join a class
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-12">
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(f => (
            <div key={f.title} className="card p-6">
              <h2 className="text-base font-semibold text-slate-900">{f.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-slate-500">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#eae6ef] bg-white">
        <div className="mx-auto max-w-5xl px-6 py-16">
          <h2 className="product-display mb-12 text-center !text-[40px]">From class link to results</h2>
          <ol className="grid gap-8 sm:grid-cols-4">
            {STEPS.map(s => (
              <li key={s.n} className="text-center">
                <span className="mx-auto mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-[#f0e7ff] font-semibold text-[#7545cf]">
                  {s.n}
                </span>
                <h3 className="text-sm font-semibold text-slate-900">{s.title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-slate-500">{s.desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="product-display !text-[40px]">Run your next quiz on KwikEval.</h2>
        <p className="mt-3 text-[#716778]">It takes a couple of minutes to set up your first class.</p>
        <Link href="/register" className="btn-primary mx-auto mt-7 inline-flex !px-8">
          Start teaching
        </Link>
      </section>

      <footer className="border-t border-[#eae6ef] py-8">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6">
          <Logo size="sm" />
          <nav className="flex gap-5 text-xs text-[#716778]">
            <Link href="/terms" className="hover:text-violet-700">Terms</Link>
            <Link href="/privacy" className="hover:text-violet-700">Privacy</Link>
            <span>&copy; {new Date().getFullYear()} KwikEval</span>
          </nav>
        </div>
      </footer>
    </div>
  )
}
