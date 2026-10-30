'use client'

import { DeleteCourseButton } from './DeleteCourseButton'
import Link from 'next/link'
import { ProgressRing } from '@/components/ui/ProgressRing'
import { Icon } from '@/components/product/Icon'

export interface Course {
  id: string
  title: string
  subject: string
  description: string | null
  courseCode: string | null
  level: number | null
  semester: 'FIRST' | 'SECOND' | null
  isCarryover?: boolean
  _count: { documents: number; questions: number; assessments: number }
}
const SEMESTER_LABEL = { FIRST: 'First semester', SECOND: 'Second semester' } as const
export interface CourseProgress {
  courseId: string
  topicsTotal: number
  topicsCompleted: number
  percent: number
}

export function CourseGrid({
  courses,
  progressByCourse,
  onDeleted,
}: {
  courses: Course[]
  progressByCourse: Map<string, CourseProgress>
  onDeleted: (id: string) => void
}) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {courses.map((course) => {
        const p = progressByCourse.get(course.id)
        return (
          <article
            key={course.id}
            aria-label={course.title}
            className="flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-[#eae6ef] bg-white"
          >
            <Link
              href={`/courses/${course.id}`}
              className="group flex min-w-0 flex-col flex-1 p-5 transition-colors hover:border-[#bca0e6] sm:p-6"
            >
              <div className="mb-5 flex items-center justify-between gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#f3edff] text-[#7545cf]">
                  <Icon name="book" />
                </span>
                {course.courseCode ? (
                  <span className="text-xs font-medium text-violet-700">{course.courseCode}</span>
                ) : (
                  <span className="text-xs text-slate-400">Personal course</span>
                )}
              </div>
              <h2 className="text-lg font-semibold leading-snug tracking-tight text-slate-900">
                {course.title}
              </h2>
              {course.subject !== course.title && (
                <p className="mt-1 text-sm text-slate-500">{course.subject}</p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5">
                {course.level && (
                  <span className="badge bg-slate-100 text-slate-600">{course.level}L</span>
                )}
                {course.semester && (
                  <span className="badge bg-slate-100 text-slate-600">
                    {SEMESTER_LABEL[course.semester]}
                  </span>
                )}
                {course.isCarryover && (
                  <span className="badge bg-amber-50 text-amber-700">Carryover</span>
                )}
              </div>
              {course.description && (
                <p className="mt-3 line-clamp-2 text-xs leading-relaxed text-slate-500">
                  {course.description}
                </p>
              )}
              <div className="mt-auto pt-5">
                {p && p.topicsTotal > 0 && (
                  <div className="mb-4 flex items-center gap-3">
                    <ProgressRing percent={p.percent} size={36} strokeWidth={3} />
                    <p className="text-xs text-slate-500">
                      {p.topicsCompleted} of {p.topicsTotal} topics complete
                    </p>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-3 border-t border-[#f0ebf5] pt-4 text-xs text-slate-500">
                  <span>{course._count.documents} documents</span>
                  <span>{course._count.questions} questions</span>
                  <Icon
                    name="arrow"
                    className="ml-auto h-4 w-4 text-violet-700 transition-transform group-hover:translate-x-1"
                  />
                </div>
              </div>
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-3 border-t border-[#f0ebf5] px-5 py-2 sm:px-6">
              <Link
                href={`/courses/${course.id}?edit=1`}
                className="inline-flex min-h-11 items-center text-sm font-medium text-violet-700 hover:underline"
                aria-label={`Edit ${course.title}`}
              >
                Edit course
              </Link>
              <DeleteCourseButton course={course} onDeleted={() => onDeleted(course.id)} />
            </div>
          </article>
        )
      })}
      <Link
        href="/courses/new"
        className="flex min-h-[220px] flex-col items-center justify-center rounded-[20px] border border-dashed border-[#d8c6f0] bg-[#faf7ff] p-6 text-center transition-colors hover:bg-[#f3edff]"
      >
        <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-[#eee4fc] text-violet-700">
          <Icon name="plus" />
        </span>
        <span className="text-sm font-medium text-[#51405f]">Add another course</span>
        <span className="mt-2 text-xs text-slate-500">Start with just a title.</span>
      </Link>
    </div>
  )
}
