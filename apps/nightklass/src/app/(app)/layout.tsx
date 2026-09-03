'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

const NAV = [
  { href: '/dashboard', label: 'Home', icon: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4h2v4a1 1 0 001 1h4a1 1 0 001-1V10' },
  { href: '/today', label: 'Today', icon: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z' },
  { href: '/flashcards', label: 'Flashcards', icon: 'M4 6a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 4v5h5' },
  { href: '/weak-topics', label: 'Weak spots', icon: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z' },
  { href: '/gpa', label: 'GPA', icon: 'M9 7h6m-6 4h6m-6 4h3M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z' },
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

  function isActive(href: string) {
    return pathname.startsWith(href)
  }

  return (
    <div className="min-h-screen bg-brand-bg sm:flex">
      {/* Desktop sidebar */}
      <aside className="hidden sm:flex flex-col w-64 flex-shrink-0 fixed inset-y-0 left-0 bg-brand-dark">
        <div className="px-5 py-6">
          <Link href="/dashboard">
            <Logo size="sm" theme="white" />
          </Link>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {NAV.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  active
                    ? 'bg-gradient-to-r from-blue-600 to-cyan-500 text-white shadow-[0_4px_14px_rgba(37,99,235,0.35)]'
                    : 'text-slate-300 hover:bg-white/5 hover:text-white'
                }`}
              >
                <Icon d={item.icon} />
                <span className="flex-1">{item.label}</span>
                {item.href === '/flashcards' && dueCount > 0 && (
                  <span
                    className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1 rounded-full text-[11px] font-bold ${
                      active ? 'bg-white/25 text-white' : 'bg-orange-500 text-white'
                    }`}
                  >
                    {dueCount}
                  </span>
                )}
              </Link>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/10">
          <div className="flex items-center gap-3 px-2 py-2">
            <Avatar name={user?.name ?? '?'} size={34} />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">{user?.name}</p>
              <button onClick={() => void logout()} className="text-xs text-slate-400 hover:text-white transition-colors">
                Log out
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile top bar */}
      <header className="sm:hidden bg-brand-dark px-4 py-3 flex items-center justify-between sticky top-0 z-20">
        <Link href="/dashboard">
          <Logo size="sm" theme="white" />
        </Link>
        <div className="flex items-center gap-3">
          <Avatar name={user?.name ?? '?'} size={30} />
          <button onClick={() => void logout()} className="text-xs text-slate-400">
            Log out
          </button>
        </div>
      </header>

      <div className="flex-1 sm:ml-64 min-w-0">
        <main className="max-w-5xl mx-auto px-5 sm:px-8 py-6 sm:py-10 pb-24 sm:pb-10">{children}</main>
      </div>

      {/* Mobile bottom tab bar */}
      <nav className="sm:hidden fixed bottom-0 inset-x-0 bg-white border-t border-slate-200 flex items-center justify-around py-2 z-20">
        {NAV.map(item => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`relative flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl text-[11px] font-semibold ${
                active ? 'text-blue-600' : 'text-slate-400'
              }`}
            >
              <Icon d={item.icon} className="w-5 h-5" />
              {item.label}
              {item.href === '/flashcards' && dueCount > 0 && (
                <span className="absolute -top-0.5 right-1 w-2 h-2 rounded-full bg-orange-500" />
              )}
            </Link>
          )
        })}
      </nav>
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
