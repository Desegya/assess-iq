'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AuthGuard } from '@/components/auth/AuthGuard'
import { Brand } from '@/components/product/Brand'
import { ProductTheme } from '@/components/product/ProductTheme'
import { Icon as ProductIcon } from '@/components/product/Icon'
import { Avatar } from '@/components/ui/Avatar'
import { useAuth } from '@/contexts/auth-context'
import { useApi } from '@/hooks/use-api'

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

const ICONS = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4h2v4a1 1 0 001 1h4a1 1 0 001-1V10',
  courses: 'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  today: 'M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z',
  weak: 'M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z',
  flashcards: 'M4 6a2 2 0 012-2h9l5 5v9a2 2 0 01-2 2H6a2 2 0 01-2-2V6z M14 4v5h5',
  gpa: 'M9 7h6m-6 4h6m-6 4h3M5 3h14a1 1 0 011 1v16a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z',
  profile: 'M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z',
}

// Grouped per docs/nightklass/02-onboarding-and-curriculum.md §18 — only pages that exist are listed
const NAV_SECTIONS = [
  {
    label: 'Main',
    items: [
      { href: '/dashboard', label: 'Home', icon: ICONS.home },
      { href: '/courses', label: 'My Courses', icon: ICONS.courses },
      { href: '/today', label: 'Today', icon: ICONS.today },
    ],
  },
  {
    label: 'Learning',
    items: [
      { href: '/weak-topics', label: 'Weak Areas', icon: ICONS.weak },
      { href: '/flashcards', label: 'Flashcards', icon: ICONS.flashcards },
    ],
  },
  {
    label: 'Progress',
    items: [{ href: '/gpa', label: 'GPA / Grades', icon: ICONS.gpa }],
  },
  {
    label: 'Account',
    items: [{ href: '/onboarding', label: 'Profile', icon: ICONS.profile }],
  },
]

// The mobile tab bar has room for five; GPA moves to the top bar
const MOBILE_NAV = [
  { href: '/dashboard', label: 'Home', icon: ICONS.home },
  { href: '/courses', label: 'Courses', icon: ICONS.courses },
  { href: '/today', label: 'Today', icon: ICONS.today },
  { href: '/weak-topics', label: 'Weak', icon: ICONS.weak },
  { href: '/flashcards', label: 'Cards', icon: ICONS.flashcards },
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
    return pathname === href || pathname.startsWith(`${href}/`)
  }

  return (
    <div className="min-h-dvh bg-[#fcfbfe] lg:flex">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-[#eae6ef] bg-white lg:flex">
        <Link href="/dashboard" className="mx-6 mb-8 mt-8 inline-flex min-h-11 items-center" aria-label="NightKlass home"><Brand /></Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {NAV_SECTIONS.map(section => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.14em] text-[#8c8197]">{section.label}</p>
              <div className="space-y-1">
                {section.items.map(item => {
                  const active = isActive(item.href)
                  return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${active ? 'bg-[#f0e7ff] text-[#7545cf]' : 'text-[#716778] hover:bg-[#faf7ff] hover:text-[#7545cf]'}`}>
                    <Icon d={item.icon} /><span className="flex-1">{item.label}</span>
                    {item.href === '/flashcards' && dueCount > 0 && <span className="rounded-lg bg-[#7545cf] px-1.5 py-0.5 text-[11px] text-white">{dueCount}</span>}
                  </Link>
                })}
              </div>
            </div>
          ))}
        </nav>
        <div className="mx-4 mb-5 rounded-2xl border border-[#eee5fa] bg-[#faf7ff] p-4">
          <p className="product-display !text-[26px]">One topic at a time.</p>
          <p className="mt-1 text-xs leading-relaxed text-[#797080]">Small study sessions add up.</p>
          <Link href="/today" className="mt-3 inline-flex min-h-11 items-center gap-2 text-xs font-semibold text-violet-700">See today’s plan <ProductIcon name="arrow" className="h-4 w-4" /></Link>
        </div>
        <div className="flex items-center gap-3 border-t border-[#eae6ef] p-5">
          <Avatar name={user?.name ?? '?'} size={36} />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium">{user?.name}</p><p className="text-xs text-[#797080]">Your study space</p></div>
          <button onClick={() => void logout()} aria-label="Log out" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#797080] hover:bg-[#f3edff]"><ProductIcon name="logout" /></button>
        </div>
      </aside>
      <div className="min-w-0 flex-1 lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#eae6ef] bg-white/95 px-4 backdrop-blur-sm sm:px-8">
          <Link href="/dashboard" className="lg:hidden" aria-label="NightKlass home"><Brand /></Link>
          <p className="hidden text-xs font-medium uppercase tracking-[.12em] text-[#8c8197] lg:block">Your personal study coach</p>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link href="/gpa" aria-label="GPA calculator" aria-current={isActive('/gpa') ? 'page' : undefined} className="flex h-11 items-center gap-2 rounded-xl px-2 text-xs font-medium text-[#716778] hover:bg-[#f3edff]"><ProductIcon name="chart" className="h-4 w-4" /><span className="hidden sm:inline">GPA & grades</span></Link>
            <Link href="/onboarding" aria-label="Academic profile" className="flex h-11 w-11 items-center justify-center"><Avatar name={user?.name ?? '?'} size={32} /></Link>
            <button onClick={() => void logout()} aria-label="Log out" className="flex h-11 w-11 items-center justify-center rounded-xl text-[#797080] hover:bg-[#f3edff] lg:hidden"><ProductIcon name="logout" /></button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="mx-auto max-w-[1200px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-7 sm:px-8 sm:pt-10 lg:px-10 lg:pb-12">{children}</main>
      </div>
      <nav aria-label="Mobile navigation" className="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-[#eae6ef] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden">
        {MOBILE_NAV.map(item => {
          const active = isActive(item.href)
          return <Link key={item.href} href={item.href} aria-current={active ? 'page' : undefined} className={`relative flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${active ? 'text-[#7545cf]' : 'text-[#797080]'}`}>
            <span className={`flex h-8 w-12 items-center justify-center rounded-xl ${active ? 'bg-[#f0e7ff]' : ''}`}><Icon d={item.icon} /></span>{item.label}
            {item.href === '/flashcards' && dueCount > 0 && <span aria-label={`${dueCount} cards due`} className="absolute right-[30%] top-3 h-2 w-2 rounded-full bg-[#7545cf]" />}
          </Link>
        })}
      </nav>
    </div>
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProductTheme>
      <AuthGuard>
        <AppShell>{children}</AppShell>
      </AuthGuard>
    </ProductTheme>
  )
}
