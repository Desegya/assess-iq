'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/contexts/auth-context'
import { Logo } from '@/components/ui/Logo'

interface NavItem {
  label: string
  href: string
  icon: React.ReactNode
}

const NAV: NavItem[] = [
  {
    label: 'Dashboard',
    href: '/student/dashboard',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
      </svg>
    ),
  },
  {
    label: 'My Assessments',
    href: '/student/assessments',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
      </svg>
    ),
  },
  {
    label: 'My Results',
    href: '/student/results',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
]

export function StudentSidebar() {
  const pathname = usePathname()
  const { user, logout } = useAuth()

  const initials = user?.name
    ? user.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
    : '?'

  return (
    <aside
      className="w-64 flex-shrink-0 flex flex-col h-screen sticky top-0 overflow-hidden shadow-sidebar"
      style={{ background: 'linear-gradient(180deg, #1E1145 0%, #160D38 100%)' }}
    >
      {/* ── Logo area ── */}
      <div className="px-5 py-5 border-b border-white/8"
           style={{ background: 'rgba(0,0,0,0.2)' }}>
        <Logo size="md" theme="white" />
        <p className="text-xs text-violet-300/60 mt-1 pl-0.5">Student Portal</p>
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/')
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-medium
                          transition-all duration-150 relative group
                          ${active
                            ? 'bg-white/10 text-white border-l-2 border-violet-400 pl-[14px]'
                            : 'text-white/60 hover:bg-white/5 hover:text-white/90'
                          }`}
            >
              <span className={`transition-colors ${active ? 'text-violet-300' : 'text-white/40 group-hover:text-white/70'}`}>
                {item.icon}
              </span>
              {item.label}

              {active && (
                <span className="absolute inset-0 rounded-xl bg-violet-500/5 pointer-events-none" aria-hidden="true" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* ── User footer ── */}
      <div className="px-4 py-4 border-t border-white/8" style={{ background: 'rgba(0,0,0,0.15)' }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700
                          flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
            {initials}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">{user?.name ?? 'Student'}</p>
            <p className="text-xs text-white/40 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={() => void logout()}
          className="w-full flex items-center gap-2 text-xs text-white/40 hover:text-red-400
                     transition-colors px-1 py-1.5 rounded-lg hover:bg-red-500/10"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </div>
    </aside>
  )
}
