'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'
import { Avatar } from '@/components/ui/Avatar'

/** The same app frame as Nightklass: light sidebar, sticky top bar, mobile tab bar. */

export interface NavItem {
  href: string
  label: string
  /** SVG path data (24×24, stroked) */
  icon: string
  /** Shown in the mobile tab bar (keep to five) */
  mobile?: boolean
}
export interface NavSection {
  label: string
  items: NavItem[]
}

function Icon({ d, className = 'w-5 h-5' }: { d: string; className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d={d} />
    </svg>
  )
}

const LOGOUT = 'M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1'

export function AppShell({
  home,
  tagline,
  roleLabel,
  sections,
  aside,
  children,
}: {
  home: string
  tagline: string
  roleLabel: string
  sections: NavSection[]
  /** Optional card above the account footer */
  aside?: React.ReactNode
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const { user, logout } = useAuth()
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const mobile = sections.flatMap(s => s.items).filter(i => i.mobile).slice(0, 5)

  // Sitting a test is full-screen and proctored: no navigation to wander off through
  if (/\/take$/.test(pathname)) return <>{children}</>

  return (
    <div className="min-h-dvh bg-[#fcfbfe] lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4"
      >
        Skip to content
      </a>

      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-[#eae6ef] bg-white lg:flex">
        <Link href={home} className="mx-6 mb-8 mt-8 inline-flex min-h-11 items-center" aria-label="KwikEval home">
          <Logo size="md" />
        </Link>
        <nav aria-label="Main navigation" className="flex-1 space-y-6 overflow-y-auto px-4 pb-6">
          {sections.map(section => (
            <div key={section.label}>
              <p className="mb-2 px-3 text-[10px] font-medium uppercase tracking-[.14em] text-[#716778]">
                {section.label}
              </p>
              <div className="space-y-1">
                {section.items.map(item => {
                  const active = isActive(item.href)
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors ${
                        active ? 'bg-[#f0e7ff] text-[#7545cf]' : 'text-[#716778] hover:bg-[#faf7ff] hover:text-[#7545cf]'
                      }`}
                    >
                      <Icon d={item.icon} />
                      <span className="flex-1">{item.label}</span>
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>
        {aside && <div className="mx-4 mb-5">{aside}</div>}
        <div className="flex items-center gap-3 border-t border-[#eae6ef] p-5">
          <Avatar name={user?.name ?? '?'} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium">{user?.name}</p>
            <p className="truncate text-xs text-[#6d6378]">{roleLabel}</p>
          </div>
          <button
            onClick={() => void logout()}
            aria-label="Log out"
            className="flex h-11 w-11 items-center justify-center rounded-xl text-[#6d6378] hover:bg-[#f3edff]"
          >
            <Icon d={LOGOUT} />
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1 lg:ml-[248px]">
        <header className="sticky top-0 z-20 flex min-h-[72px] items-center justify-between gap-3 border-b border-[#eae6ef] bg-white/95 px-4 backdrop-blur-sm sm:px-8">
          <Link href={home} className="lg:hidden" aria-label="KwikEval home">
            <Logo size="sm" />
          </Link>
          <p className="hidden text-xs font-medium uppercase tracking-[.12em] text-[#716778] lg:block">{tagline}</p>
          <div className="flex items-center gap-1 sm:gap-3">
            <span className="hidden max-w-[220px] truncate text-xs text-[#716778] sm:inline">{user?.email}</span>
            <Avatar name={user?.name ?? '?'} size={32} />
            <button
              onClick={() => void logout()}
              aria-label="Log out"
              className="flex h-11 w-11 items-center justify-center rounded-xl text-[#6d6378] hover:bg-[#f3edff] lg:hidden"
            >
              <Icon d={LOGOUT} />
            </button>
          </div>
        </header>
        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto max-w-[1200px] px-4 pb-[calc(112px+env(safe-area-inset-bottom))] pt-7 animate-fade-in sm:px-8 sm:pt-10 lg:px-10 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {mobile.length > 0 && (
        <nav
          aria-label="Mobile navigation"
          className="fixed inset-x-0 bottom-0 z-20 flex items-center border-t border-[#eae6ef] bg-white px-1 pb-[env(safe-area-inset-bottom)] lg:hidden"
        >
          {mobile.map(item => {
            const active = isActive(item.href)
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`flex min-h-[72px] min-w-0 flex-1 flex-col items-center justify-center gap-1 text-[11px] font-medium ${
                  active ? 'text-[#7545cf]' : 'text-[#6d6378]'
                }`}
              >
                <span className={`flex h-8 w-12 items-center justify-center rounded-xl ${active ? 'bg-[#f0e7ff]' : ''}`}>
                  <Icon d={item.icon} />
                </span>
                {item.label}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

export const ICONS = {
  home: 'M3 12l9-9 9 9M5 10v10a1 1 0 001 1h4a1 1 0 001-1v-4h2v4a1 1 0 001 1h4a1 1 0 001-1V10',
  classes:
    'M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253',
  upload: 'M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12',
  questions:
    'M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  students:
    'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z',
  tests:
    'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4',
  chart:
    'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z',
  results: 'M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z',
  join: 'M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z',
}
