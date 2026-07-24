'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'

interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  _count: { documents: number; questions: number; assessments: number }
}

export default function DashboardPage() {
  const api = useApi()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load courses'))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">Your courses</h1>
          <p className="text-slate-500 text-sm mt-1">Pick a course to plan and study, or start a new one.</p>
        </div>
        <Link href="/courses/new" className="btn-primary">
          + New course
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {courses === null && !error && <p className="text-slate-500 text-sm">Loading…</p>}

      {courses?.length === 0 && (
        <div className="card p-10 text-center">
          <p className="text-slate-600 font-medium">No courses yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Create your first course to start building a study plan.</p>
          <Link href="/courses/new" className="btn-primary inline-flex">
            + New course
          </Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {courses?.map(course => (
          <Link key={course.id} href={`/courses/${course.id}`} className="card p-6 block">
            <h2 className="font-heading font-bold text-slate-900">{course.title}</h2>
            <p className="text-slate-500 text-sm mt-1">{course.subject}</p>
            {course.description && <p className="text-slate-400 text-xs mt-2 line-clamp-2">{course.description}</p>}
            <div className="flex gap-3 mt-4 text-xs text-slate-400">
              <span>{course._count.documents} document(s)</span>
              <span>{course._count.questions} question(s)</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
