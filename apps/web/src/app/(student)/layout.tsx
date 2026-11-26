import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell, type NavSection } from '@/components/layout/AppShell'
import { ICONS } from '@/components/layout/icons'
import { EmailConfirmationBanner } from '@/components/auth/EmailConfirmationBanner'

const SECTIONS: NavSection[] = [
  {
    label: 'Main',
    items: [
      { href: '/student/dashboard', label: 'Home', icon: ICONS.home, mobile: true },
      { href: '/student/classes', label: 'My classes', icon: ICONS.classes, mobile: true },
      { href: '/student/assessments', label: 'Tests', icon: ICONS.tests, mobile: true },
      { href: '/student/results', label: 'Results', icon: ICONS.results, mobile: true },
    ],
  },
]

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={['STUDENT']}>
      <AppShell home="/student/dashboard" tagline="Your tests and results" roleLabel="Student" sections={SECTIONS}>
        <EmailConfirmationBanner />
        {children}
      </AppShell>
    </AuthGuard>
  )
}
