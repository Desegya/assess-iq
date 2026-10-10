import Link from 'next/link'
import { ProductTheme } from '@/components/product/ProductTheme'
import { Brand } from '@/components/product/Brand'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { Icon } from '@/components/product/Icon'

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductTheme>
      <div className="grid min-h-dvh bg-white lg:grid-cols-[.95fr_1.05fr]">
        <aside className="relative hidden flex-col justify-between border-r border-[#eae6ef] bg-[#f7f2ff] p-10 lg:flex xl:p-16">
          <Link href="/" className="inline-flex w-fit items-center" aria-label="NightKlass home">
            <Brand />
          </Link>
          <div className="my-12 max-w-md">
            <StudyArtwork className="mb-8 !w-[260px]" />
            <p className="mb-4 text-xs font-medium uppercase tracking-[.12em] text-violet-700">
              Your personal study coach
            </p>
            <h2 className="product-display !text-[56px]">
              A clear path from
              <br />
              course to confidence.
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-[#716778]">
              Bring your course title, notes, or syllabus. We’ll help you decide what to study,
              understand it, and remember it.
            </p>
            <div className="mt-7 flex flex-wrap gap-3 text-xs text-violet-800">
              {['Learn with clarity', 'Practise your way', 'See your progress'].map((text) => (
                <span key={text} className="flex items-center gap-1.5">
                  <Icon name="check" className="h-4 w-4" />
                  {text}
                </span>
              ))}
            </div>
          </div>
          <p className="text-xs text-[#716778]">&copy; {new Date().getFullYear()} NightKlass</p>
        </aside>
        <div className="flex min-w-0 flex-col px-5 py-7 sm:px-10 lg:px-16">
          <div className="flex items-center justify-between gap-4">
            <Link href="/" className="inline-flex lg:hidden" aria-label="NightKlass home">
              <Brand />
            </Link>
            <Link
              href="/"
              className="ml-auto inline-flex min-h-11 items-center gap-2 text-xs font-medium text-[#716778] hover:text-violet-700"
            >
              <Icon name="back" className="h-4 w-4" />
              Back to home
            </Link>
          </div>
          <main className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 sm:py-14">
            {children}
          </main>
          <p className="text-center text-xs text-[#716778]">Study at your pace. Make it yours.</p>
        </div>
      </div>
    </ProductTheme>
  )
}
