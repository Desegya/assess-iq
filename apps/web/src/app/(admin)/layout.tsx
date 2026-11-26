import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell, ICONS, type NavSection } from '@/components/layout/AppShell'

const SECTIONS: NavSection[] = [
  { label: 'Platform', items: [{ href: '/admin/dashboard', label: 'Overview', icon: ICONS.chart }] },
]

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={['SUPER_ADMIN']}>
      <AppShell home="/admin/dashboard" tagline="KwikEval platform" roleLabel="Platform admin" sections={SECTIONS}>
        {children}
      </AppShell>
    </AuthGuard>
  )
}
