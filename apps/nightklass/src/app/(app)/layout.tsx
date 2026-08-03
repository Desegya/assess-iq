'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Logo } from '@/components/ui/Logo'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

const NAV = [
  { href: '/dashboard', label: 'Courses' },
  { href: '/today', label: 'Today' },
  { href: '/flashcards', label: 'Flashcards' },
  { href: '/weak-topics', label: 'Weak topics' },
]

function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const api = useApi()
  const [dueCount, setDueCount] = useState(0)

  useEffect(() => {
    api
      .get<unknown[]>('/study/flashcards/due')
      .then(cards => setDueCount(cards.length))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  function navLabel(item: (typeof NAV)[number]) {
    if (item.href !== '/flashcards' || dueCount === 0) return item.label
    return (
      <span className="inline-flex items-center gap-1.5">
        {item.label}
        <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-600 text-white text-[10px] font-bold">
          {dueCount}
        </span>
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-brand-bg">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link href="/dashboard">
            <Logo size="sm" theme="dark" />
          </Link>
          <nav className="hidden sm:flex items-center gap-1">
            {NAV.map(item => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  pathname.startsWith(item.href)
                    ? 'bg-indigo-50 text-indigo-700'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                {navLabel(item)}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:inline">{user?.name}</span>
            <button onClick={() => void logout()} className="text-sm text-slate-500 hover:text-slate-800">
              Log out
            </button>
          </div>
        </div>
        <nav className="sm:hidden flex items-center gap-1 px-4 pb-3 overflow-x-auto">
          {NAV.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${
                pathname.startsWith(item.href) ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600'
              }`}
            >
              {navLabel(item)}
            </Link>
          ))}
        </nav>
      </header>
      <main className="max-w-5xl mx-auto px-6 py-8">{children}</main>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <AppShell>{children}</AppShell>
    </AuthGuard>
  )
}
