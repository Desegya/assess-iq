'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { CourseGrid, type Course, type CourseProgress } from '@/components/courses/CourseGrid'

export default function CoursesPage() {
  const api = useApi()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [progress, setProgress] = useState<CourseProgress[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load courses'))
    api
      .get<{ courses: CourseProgress[] }>('/study/progress')
      .then(p => setProgress(p.courses))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress.map(c => [c.courseId, c]))

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-heading text-2xl font-bold text-slate-900">My courses</h1>
          <p className="text-slate-500 text-sm mt-1">Everything you&apos;re studying this semester.</p>
        </div>
        <Link href="/courses/new" className="btn-primary flex-shrink-0">
          + New course
        </Link>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">{error}</div>}

      {courses === null && !error && (
        <div className="grid sm:grid-cols-2 gap-4">
          <SkeletonCard />
          <SkeletonCard />
        </div>
      )}

      {courses?.length === 0 && (
        <EmptyState
          illustration="empty"
          title="No courses yet"
          subtitle="Add a course with just its title. No syllabus or notes needed to get started."
          action={
            <Link href="/courses/new" className="btn-primary inline-flex">
              + New course
            </Link>
          }
        />
      )}

      {courses && courses.length > 0 && <CourseGrid courses={courses} progressByCourse={progressByCourse} />}
    </div>
  )
}
