import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

const POINTS = ['Questions from your own notes', 'One link per class', 'Marks the moment they submit']

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-dvh bg-white lg:grid-cols-[.95fr_1.05fr]">
      <aside className="relative hidden flex-col justify-between border-r border-[#eae6ef] bg-[#f7f2ff] p-10 lg:flex xl:p-16">
        <Link href="/" className="inline-flex w-fit items-center" aria-label="KwikEval home">
          <Logo size="md" />
        </Link>
        <div className="my-12 max-w-md">
          <p className="mb-4 text-xs font-medium uppercase tracking-[.12em] text-violet-700">For lecturers and their students</p>
          <h2 className="product-display !text-[56px]">
            Set a test.
            <br />
            Share one link.
          </h2>
          <p className="mt-5 text-sm leading-relaxed text-[#716778]">
            Write questions, import a paper, or generate them from your notes. Students join your class with their
            school email and sit the test on any phone or laptop.
          </p>
          <div className="mt-7 flex flex-wrap gap-3 text-xs text-violet-800">
            {POINTS.map(text => (
              <span key={text} className="flex items-center gap-1.5">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {text}
              </span>
            ))}
          </div>
        </div>
        <p className="text-xs text-[#716778]">&copy; {new Date().getFullYear()} KwikEval</p>
      </aside>
      <div className="flex min-w-0 flex-col px-5 py-7 sm:px-10 lg:px-16">
        <div className="flex items-center justify-between gap-4">
          <Link href="/" className="inline-flex lg:hidden" aria-label="KwikEval home">
            <Logo size="sm" />
          </Link>
          <Link
            href="/"
            className="ml-auto inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#716778] hover:text-violet-700"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to home
          </Link>
        </div>
        <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 sm:py-14">{children}</main>
        <p className="text-center text-xs text-[#716778]">
          <Link href="/terms" className="hover:text-violet-700">Terms</Link>
          {' · '}
          <Link href="/privacy" className="hover:text-violet-700">Privacy</Link>
        </p>
      </div>
    </div>
  )
}
