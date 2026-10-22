'use client'
import { createContext, useContext } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Brand } from '@/components/product/Brand'
import { Icon, type IconName } from '@/components/product/Icon'
import { adminRequest, useAdminData, type AdminIdentity } from './admin-api'
import { DataState } from './AdminUI'
import './admin.css'

const AdminContext = createContext<AdminIdentity | null>(null)
export function useAdminIdentity() {
  return useContext(AdminContext)!
}
const NAV: { href: string; label: string; icon: IconName }[] = [
  { href: '/admin', label: 'Overview', icon: 'home' },
  { href: '/admin/users', label: 'Learners', icon: 'user' },
  { href: '/admin/courses', label: 'Courses & topics', icon: 'book' },
  { href: '/admin/lessons', label: 'Lessons', icon: 'cards' },
  { href: '/admin/questions', label: 'Questions', icon: 'target' },
  { href: '/admin/exam-content', label: 'WAEC / JAMB content', icon: 'book' },
  { href: '/admin/materials', label: 'Study materials', icon: 'upload' },
  { href: '/admin/activity', label: 'Learning activity', icon: 'chart' },
  { href: '/admin/reports', label: 'Content reports', icon: 'chat' },
  { href: '/admin/audit', label: 'Audit history', icon: 'clock' },
  { href: '/admin/access', label: 'Admin access', icon: 'user' },
]
export function AdminShell({ children }: { children: React.ReactNode }) {
  const session = useAdminData<AdminIdentity>('auth')
  const path = usePathname()
  const router = useRouter()
  async function logout() {
    try {
      await adminRequest('auth', { method: 'DELETE' })
      router.replace('/admin/login')
      router.refresh()
    } catch {
      window.location.assign('/admin/login')
    }
  }
  if (!session.data)
    return (
      <div className="p-6">
        <Brand />
        <DataState {...session} />
        <Link href="/admin/login" className="btn-secondary mt-6 inline-flex items-center px-5">
          Sign in to administration
        </Link>
      </div>
    )
  return (
    <AdminContext.Provider value={session.data}>
      <div className="nk-admin min-h-dvh lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
        <a
          href="#admin-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-xl focus:bg-white focus:p-4"
        >
          Skip to content
        </a>
        <aside className="border-b border-[#eae6ef] bg-white lg:sticky lg:top-0 lg:h-dvh lg:overflow-y-auto lg:border-b-0 lg:border-r">
          <div className="flex items-center justify-between gap-4 px-5 py-5 lg:block lg:px-6 lg:py-8">
            <Link href="/admin" aria-label="Nightklass administration home">
              <Brand />
            </Link>
            <p className="mt-1 text-xs font-medium uppercase tracking-[.12em] text-violet-700">
              Administration
            </p>
          </div>
          <nav
            aria-label="Administration"
            className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:overflow-visible"
          >
            {NAV.map((item) => {
              const active =
                item.href === '/admin' ? path === item.href : path.startsWith(item.href)
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 text-sm ${active ? 'bg-[#f3edff] font-semibold text-violet-800' : 'text-[#716778] hover:bg-[#faf8fd]'}`}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </Link>
              )
            })}
          </nav>
          <div className="hidden border-t border-[#eae6ef] p-6 lg:block">
            <p className="truncate text-sm font-medium">{session.data.user.name}</p>
            <p className="mt-1 text-xs text-[#716778]">
              {session.data.role === 'OWNER' ? 'Platform owner' : 'Administrator'}
            </p>
            <button
              onClick={logout}
              className="mt-4 flex min-h-11 items-center gap-2 text-sm text-[#716778]"
            >
              <Icon name="logout" />
              Sign out
            </button>
          </div>
        </aside>
        <div className="min-w-0">
          <header className="flex items-center justify-between border-b border-[#eae6ef] px-5 py-3 sm:px-8">
            <p className="text-xs text-[#716778]">
              Nightklass operations <span className="mx-2">/</span>{' '}
              {NAV.find((i) => i.href !== '/admin' && path.startsWith(i.href))?.label ?? 'Overview'}
            </p>
            <button
              onClick={logout}
              className="flex min-h-11 items-center gap-2 text-xs font-medium text-[#716778]"
            >
              <Icon name="logout" className="h-4 w-4" />
              Sign out
            </button>
          </header>
          <main id="admin-content" className="mx-auto max-w-[1500px] px-5 py-8 sm:px-8 lg:p-10">
            {children}
          </main>
        </div>
      </div>
    </AdminContext.Provider>
  )
}
