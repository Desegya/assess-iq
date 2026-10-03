'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { CourseGrid, type Course, type CourseProgress } from '@/components/courses/CourseGrid'

interface Progress {
  currentStreak: number
  longestStreak: number
  last30Days: { date: string; completedCount: number }[]
  courses: CourseProgress[]
}

interface Session {
  id: string
  startTime: string
  endTime: string
  topic: { id: string; name: string } | null
  course: { id: string; title: string }
}

function greeting() {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return 'Good morning'
  if (h >= 12 && h < 17) return 'Good afternoon'
  if (h >= 17 && h < 22) return 'Good evening'
  return 'Burning the midnight oil'
}

function StatTile({ href, label, value, icon, accent }: { href: string; label: string; value: number; icon: string; accent: string }) {
  return (
    <Link href={href} className="card p-4 flex items-center gap-3 hover:-translate-y-0.5">
      <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${accent}`}>{icon}</span>
      <div className="min-w-0">
        <p className="font-heading text-xl font-bold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const api = useApi()
  const { user } = useAuth()
  const [courses, setCourses] = useState<Course[] | null>(null)
  const [progress, setProgress] = useState<Progress | null>(null)
  const [today, setToday] = useState<Session[] | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [weakCount, setWeakCount] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    api
      .get<Course[]>('/courses')
      .then(setCourses)
      .catch(err => setError(err instanceof Error ? err.message : 'Failed to load courses'))
    api.get<Progress>('/study/progress').then(setProgress).catch(() => undefined)
    api.get<Session[]>('/study/sessions/today').then(setToday).catch(() => setToday([]))
    api.get<unknown[]>('/study/flashcards/due').then(c => setDueCount(c.length)).catch(() => undefined)
    api.get<unknown[]>('/study/topics/weak').then(c => setWeakCount(c.length)).catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress?.courses.map(c => [c.courseId, c]) ?? [])
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const streak = progress?.currentStreak ?? 0

  return (
    <div className="space-y-6">
      {/* Greeting banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-blue-600 via-blue-600 to-cyan-500 px-6 sm:px-8 py-7 sm:py-8">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full blur-2xl pointer-events-none" aria-hidden="true" />
        <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-lime-300/20 rounded-full blur-2xl pointer-events-none" aria-hidden="true" />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="font-heading text-2xl sm:text-3xl font-bold text-white">
              {greeting()}, {firstName} 👋
            </h1>
            <p className="text-blue-100 text-sm mt-1.5 max-w-md">
              {streak > 0
                ? `You're on a ${streak}-day streak — don't break the chain tonight.`
                : today && today.length > 0
                  ? `You've got ${today.length} session${today.length === 1 ? '' : 's'} lined up for today.`
                  : 'Pick a course and let\'s get a plan going.'}
            </p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {streak > 0 && (
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur rounded-xl px-3 py-2">
                <span className="text-base animate-bounce">🔥</span>
                <span className="text-sm font-bold text-white">{streak}</span>
              </div>
            )}
            <Link href="/courses/new" className="bg-white hover:bg-blue-50 text-blue-700 font-bold text-sm py-2.5 px-4 rounded-xl transition-colors">
              + New course
            </Link>
          </div>
        </div>
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatTile href="/dashboard" label="Courses" value={courses?.length ?? 0} icon="📚" accent="bg-blue-100" />
        <StatTile href="/flashcards" label="Due flashcards" value={dueCount} icon="🗂️" accent="bg-orange-100" />
        <StatTile href="/weak-topics" label="Weak spots" value={weakCount} icon="🎯" accent="bg-lime-100" />
        <StatTile href="/dashboard" label="Best streak" value={progress?.longestStreak ?? 0} icon="⚡" accent="bg-cyan-100" />
      </div>

      {/* Today strip */}
      {today && today.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-bold text-slate-800">Today's sessions</p>
            <Link href="/today" className="text-xs font-semibold text-blue-600">
              See all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {today.slice(0, 6).map(s => {
              const color = getSubjectColor(s.course.id)
              return (
                <Link
                  key={s.id}
                  href={`/courses/${s.course.id}`}
                  className={`card-accent bg-white rounded-2xl p-4 min-w-[190px] flex-shrink-0 border border-slate-100`}
                  style={{ ['--accent-color' as string]: color.hex }}
                >
                  <p className={`text-[11px] font-bold ${color.text}`}>{s.course.title}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">{s.topic?.name ?? 'Revision'}</p>
                  <p className="text-xs text-slate-400 mt-1">{s.startTime}–{s.endTime}</p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 30-day heatmap */}
      {progress && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Last 30 days</p>
          </div>
          <div className="flex gap-1">
            {progress.last30Days.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.completedCount} session(s)`}
                className={`flex-1 h-6 rounded-sm animate-scale-in hover:scale-110 transition-transform ${
                  d.completedCount === 0
                    ? 'bg-slate-100'
                    : d.completedCount === 1
                      ? 'bg-blue-200'
                      : d.completedCount === 2
                        ? 'bg-blue-400'
                        : 'bg-gradient-to-br from-blue-500 to-cyan-600'
                }`}
                style={{ animationDelay: `${i * 12}ms` }}
              />
            ))}
          </div>
          {progress.last30Days.every(d => d.completedCount === 0) && (
            <p className="text-xs text-slate-400 mt-3">
              Complete a study session to light this up — head to <Link href="/today" className="text-blue-600 font-medium">Today</Link>.
            </p>
          )}
        </div>
      )}

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
          subtitle="Create your first course to start building a study plan."
          action={
            <Link href="/courses/new" className="btn-primary inline-flex">
              + New course
            </Link>
          }
        />
      )}

      {courses && courses.length > 0 && (
        <div>
          <p className="text-sm font-bold text-slate-800 mb-2">Your courses</p>
          <CourseGrid courses={courses} progressByCourse={progressByCourse} />
        </div>
      )}
    </div>
  )
}
