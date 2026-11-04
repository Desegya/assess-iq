'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { PageHeader } from '@/components/product/PageHeader'
import { Icon } from '@/components/product/Icon'
import { CourseSetupGuide } from '@/components/courses/CourseSetupGuide'
import { CourseTimetablePlanner } from '@/components/courses/CourseTimetablePlanner'
import { useCourses } from '@/hooks/use-courses'
import { useApi } from '@/hooks/use-api'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { CourseGrid, type Course, type CourseProgress } from '@/components/courses/CourseGrid'

export default function CoursesPage() {
  const api = useApi()
  const { courses, error: courseError, reload: reloadCourses, remove: removeCourse } = useCourses()
  const [progress, setProgress] = useState<CourseProgress[]>([])
  const [plannerOpen, setPlannerOpen] = useState(false)
  const [search, setSearch] = useState('')
  const error = courseError

  useEffect(() => {
    api
      .get<{ courses: CourseProgress[] }>('/study/progress')
      .then((p) => setProgress(p.courses))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress.map((c) => [c.courseId, c]))
  const sortedCourses = [...(courses ?? [])].sort((a, b) => {
    const aCode = a.courseCode?.trim()
    const bCode = b.courseCode?.trim()
    if (!!aCode !== !!bCode) return aCode ? -1 : 1
    return (
      (aCode || a.title).localeCompare(bCode || b.title, undefined, {
        numeric: true,
        sensitivity: 'base',
      }) ||
      a.title.localeCompare(b.title, undefined, { sensitivity: 'base' }) ||
      a.id.localeCompare(b.id)
    )
  })
  const query = search.trim().toLocaleLowerCase()
  const visibleCourses = sortedCourses.filter(
    (course) =>
      !query ||
      course.title.toLocaleLowerCase().includes(query) ||
      (course.courseCode ?? '')
        .toLocaleLowerCase()
        .replace(/\s+/g, '')
        .includes(query.replace(/\s+/g, '')),
  )

  return (
    <div className="space-y-6">
      <PageHeader
        title="My courses"
        description="Everything you’re studying this semester, all in one place."
        eyebrow="Your library"
        icon="book"
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!courses?.length}
              aria-expanded={plannerOpen}
              aria-controls="combined-planner"
              onClick={() => setPlannerOpen((open) => !open)}
              className="btn-secondary"
            >
              Suggest a study plan
            </button>
            <Link href="/courses/new" className="btn-primary">
              <Icon name="plus" />
              New course
            </Link>
          </div>
        }
      />

      {plannerOpen && courses && (
        <CourseTimetablePlanner courses={sortedCourses} onClose={() => setPlannerOpen(false)} />
      )}

      {courses !== null && <CourseSetupGuide defaultOpen={courses.length === 0} />}

      {error && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3"
        >
          {error}
          <button
            type="button"
            onClick={() => void reloadCourses()}
            className="ml-3 min-h-11 underline"
          >
            Try again
          </button>
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
        <div className="space-y-3">
          <div className="flex items-end gap-2">
            <label className="block flex-1 text-sm font-medium text-slate-700">
              Search courses
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search by course code or title"
                className="input-base mt-1"
              />
            </label>
            {search && (
              <button type="button" onClick={() => setSearch('')} className="btn-secondary">
                Clear search
              </button>
            )}
          </div>
          <p className="text-xs text-slate-500">
            Sorted by course code. Courses without codes appear last, sorted by title.
          </p>
          {query && (
            <p role="status" className="text-sm text-slate-500">
              Showing {visibleCourses.length} of {courses.length} courses
            </p>
          )}
          {visibleCourses.length > 0 ? (
            <CourseGrid
              courses={visibleCourses}
              progressByCourse={progressByCourse}
              onDeleted={removeCourse}
            />
          ) : (
            <EmptyState
              illustration="empty"
              title="No courses match your search"
              subtitle="Try another course code or title."
              action={
                <button type="button" onClick={() => setSearch('')} className="btn-secondary">
                  Clear search
                </button>
              }
            />
          )}
        </div>
      )}
    </div>
  )
}
