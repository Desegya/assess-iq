import { AuthGuard } from '@/components/auth/AuthGuard'
import { AppShell, ICONS, type NavSection } from '@/components/layout/AppShell'

const SECTIONS: NavSection[] = [
  {
    label: 'Teach',
    items: [
      { href: '/teacher/dashboard', label: 'Home', icon: ICONS.home, mobile: true },
      { href: '/teacher/courses', label: 'Classes', icon: ICONS.classes, mobile: true },
      { href: '/teacher/students', label: 'Students', icon: ICONS.students, mobile: true },
    ],
  },
  {
    label: 'Tests',
    items: [
      { href: '/teacher/questions', label: 'Question bank', icon: ICONS.questions },
      { href: '/teacher/documents', label: 'Notes', icon: ICONS.upload },
      { href: '/teacher/assessments', label: 'Tests', icon: ICONS.tests, mobile: true },
    ],
  },
  {
    label: 'Results',
    items: [{ href: '/teacher/analytics', label: 'Analytics', icon: ICONS.chart, mobile: true }],
  },
]

export default function TeacherLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allow={['ORG_ADMIN', 'TEACHER', 'SUPER_ADMIN']}>
      <AppShell
        home="/teacher/dashboard"
        tagline="Quick, fair tests for your class"
        roleLabel="Lecturer"
        sections={SECTIONS}
        aside={
          <div className="rounded-2xl border border-[#eee5fa] bg-[#faf7ff] p-4">
            <p className="product-display !text-[24px]">One link per class.</p>
            <p className="mt-1 text-xs leading-relaxed text-[#6d6378]">
              Students join with it, then every test you publish for that class shows up for them.
            </p>
          </div>
        }
      >
        {children}
      </AppShell>
    </AuthGuard>
  )
}
