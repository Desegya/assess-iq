import { AdminExamContent } from '@/components/admin/AdminExamContent'
import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AdminList } from '@/components/admin/AdminList'
import { AdminAccess } from '@/components/admin/AdminAccess'
import { AdminOperations } from '@/components/admin/AdminOperations'
export default async function AdminSection({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params
  if (section === 'exam-content') return <AdminExamContent />
  if (section === 'access') return <AdminAccess />
  if (section === 'operations') return <AdminOperations />
  if (
    ![
      'users',
      'courses',
      'lessons',
      'questions',
      'materials',
      'activity',
      'reports',
      'audit',
    ].includes(section)
  )
    notFound()
  return (
    <Suspense fallback={<p>Loading filters…</p>}>
      <AdminList section={section} />
    </Suspense>
  )
}
