import Link from 'next/link'
import { Logo } from '@/components/ui/Logo'

export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? ''

export function Contact() {
  return SUPPORT_EMAIL ? (
    <a className="text-violet-700 underline" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
  ) : (
    <strong>the support contact shown in the app (being set up)</strong>
  )
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      <div className="space-y-2 text-sm leading-6 text-slate-700">{children}</div>
    </section>
  )
}

export function LegalPage({ title, updated, intro, children }: { title: string; updated: string; intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-white">
      <header className="border-b border-[#eae6ef]">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-5">
          <Link href="/" aria-label="KwikEval home"><Logo size="sm" /></Link>
          <nav className="flex gap-4 text-sm text-[#716778]">
            <Link href="/terms" className="hover:text-violet-700">Terms</Link>
            <Link href="/privacy" className="hover:text-violet-700">Privacy</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-3xl space-y-8 px-4 py-10">
        <div className="space-y-2">
          <h1 className="font-heading text-3xl font-bold text-slate-900">{title}</h1>
          <p className="text-sm text-slate-500">Last updated {updated}</p>
          <div className="text-sm leading-6 text-slate-700">{intro}</div>
        </div>
        {children}
      </main>
    </div>
  )
}
