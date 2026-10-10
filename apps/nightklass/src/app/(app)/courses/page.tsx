'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
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
      .catch((err) => setError(err instanceof Error ? err.message : 'Failed to load courses'))
    api
      .get<{ courses: CourseProgress[] }>('/study/progress')
      .then((p) => setProgress(p.courses))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress.map((c) => [c.courseId, c]))

  return (
    <div className="space-y-6">
      <PageHeader
        title="My courses"
        description="Everything you’re studying this semester, all in one place."
        eyebrow="Your library"
        icon="book"
        action={
          <Link href="/courses/new" className="btn-primary">
            <Icon name="plus" />
            New course
          </Link>
        }
      />

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
        >
          {error}
        </div>
      )}

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
              New course
            </Link>
          }
        />
      )}

      {courses && courses.length > 0 && (
        <CourseGrid courses={courses} progressByCourse={progressByCourse} />
      )}
    </div>
  )
}
