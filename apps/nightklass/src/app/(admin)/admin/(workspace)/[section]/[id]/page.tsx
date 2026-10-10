import { Suspense } from 'react'
import { notFound } from 'next/navigation'
import { AdminUserDetail } from '@/components/admin/AdminUserDetail'
import { AdminCourseDetail } from '@/components/admin/AdminCourseDetail'
import { AdminLessonDetail } from '@/components/admin/AdminLessonDetail'
import { AdminQuestionDetail } from '@/components/admin/AdminQuestionDetail'
export default async function AdminDetail({ params }: { params: Promise<{ section: string; id: string }> }) {
  const { section, id } = await params
  if (section === 'users') return <AdminUserDetail id={id} />
  if (section === 'courses') return <AdminCourseDetail id={id} />
  if (section === 'lessons') return <AdminLessonDetail id={id} />
  if (section === 'questions') return <Suspense fallback={<p>Loading question…</p>}><AdminQuestionDetail id={id} /></Suspense>
  notFound()
}
