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

interface Progress {
  currentStreak: number
  longestStreak: number
  last30Days: { date: string; completedCount: number }[]
  courses: { courseId: string; topicsTotal: number; topicsCompleted: number; percent: number }[]
}

export default function DashboardPage() {
  const api = useApi()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load courses'))
    api.get<Progress>('/study/progress').then(setProgress).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress?.courses.map(c => [c.courseId, c]) ?? [])

  return (
    <div>
      {/* Decorative background blobs — purely visual, sits behind the header */}
      <div className="relative">
        <div
          className="absolute -top-16 -left-10 w-56 h-56 bg-indigo-200 rounded-full opacity-30 blur-3xl pointer-events-none"
          aria-hidden="true"
        />
        <div
          className="absolute -top-10 right-0 w-40 h-40 bg-amber-200 rounded-full opacity-25 blur-3xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="relative flex items-center justify-between mb-6 flex-wrap gap-4">
          <div>
            <h1 className="font-heading text-2xl font-bold text-slate-900">Your courses</h1>
            <p className="text-slate-500 text-sm mt-1">Pick a course to plan and study, or start a new one.</p>
          </div>
          <div className="flex items-center gap-3">
            {progress && (
              <div
                className={`flex items-center gap-2 rounded-xl px-4 py-2 border ${
                  progress.currentStreak > 0
                    ? 'bg-amber-50 border-amber-100'
                    : 'bg-slate-50 border-slate-200'
                }`}
              >
                <span className={`text-lg ${progress.currentStreak > 0 ? 'animate-bounce' : ''}`}>🔥</span>
                <span
                  className={`text-sm font-semibold ${
                    progress.currentStreak > 0 ? 'text-amber-800' : 'text-slate-500'
                  }`}
                >
                  {progress.currentStreak > 0 ? `${progress.currentStreak}-day streak` : 'Start your streak today'}
                </span>
              </div>
            )}
            <Link href="/courses/new" className="btn-primary">
              + New course
            </Link>
          </div>
        </div>
      </div>

      {progress && (
        <div className="card p-5 mb-6 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last 30 days</p>
            {progress.longestStreak > 0 && (
              <p className="text-xs text-slate-400">Best streak: {progress.longestStreak} day(s)</p>
            )}
          </div>
          <div className="flex gap-1">
            {progress.last30Days.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.completedCount} session(s)`}
                className={`flex-1 h-6 rounded-sm animate-scale-in ${
                  d.completedCount === 0
                    ? 'bg-slate-100'
                    : d.completedCount === 1
                      ? 'bg-indigo-200'
                      : 'bg-indigo-500'
                }`}
                style={{ animationDelay: `${i * 12}ms` }}
              />
            ))}
          </div>
          {progress.last30Days.every(d => d.completedCount === 0) && (
            <p className="text-xs text-slate-400 mt-3">
              Complete a study session to light this up — head to <Link href="/today" className="text-indigo-600 font-medium">Today</Link>.
            </p>
          )}
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-6">{error}</div>}

      {courses === null && !error && <p className="text-slate-500 text-sm">Loading…</p>}

      {courses?.length === 0 && (
        <div className="card p-10 text-center animate-fade-in">
          <p className="text-slate-600 font-medium">No courses yet</p>
          <p className="text-slate-400 text-sm mt-1 mb-4">Create your first course to start building a study plan.</p>
          <Link href="/courses/new" className="btn-primary inline-flex">
            + New course
          </Link>
        </div>
      )}

      <div className="grid sm:grid-cols-2 gap-4">
        {courses?.map((course, i) => {
          const p = progressByCourse.get(course.id)
          return (
            <Link
              key={course.id}
              href={`/courses/${course.id}`}
              className="card p-6 block animate-slide-up"
              style={{ animationDelay: `${i * 75}ms` }}
            >
              <h2 className="font-heading font-bold text-slate-900">{course.title}</h2>
              <p className="text-slate-500 text-sm mt-1">{course.subject}</p>
              {course.description && <p className="text-slate-400 text-xs mt-2 line-clamp-2">{course.description}</p>}
              {p && p.topicsTotal > 0 && (
                <div className="mt-4">
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Progress</span>
                    <span>
                      {p.topicsCompleted}/{p.topicsTotal} topics
                    </span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-500 rounded-full transition-all duration-700 ease-out"
                      style={{ width: `${p.percent}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="flex gap-3 mt-4 text-xs text-slate-400">
                <span>{course._count.documents} document(s)</span>
                <span>{course._count.questions} question(s)</span>
              </div>
            </Link>
          )
        })}

        {courses && courses.length > 0 && (
          <Link
            href="/courses/new"
            className="rounded-2xl border-2 border-dashed border-slate-200 p-6 flex flex-col items-center
                       justify-center text-center text-slate-400 hover:border-indigo-300 hover:text-indigo-500
                       hover:bg-indigo-50/40 transition-all duration-200 animate-slide-up min-h-[140px]"
            style={{ animationDelay: `${courses.length * 75}ms` }}
          >
            <span className="text-2xl mb-1">+</span>
            <span className="text-sm font-medium">Add another course</span>
          </Link>
        )}
      </div>
    </div>
  )
}
