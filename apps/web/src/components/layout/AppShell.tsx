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
