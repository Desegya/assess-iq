'use client'

import { ExamPreparationWorkspace } from '@/components/exams/ExamPreparationWorkspace'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useCourses } from '@/hooks/use-courses'
import { useApi } from '@/hooks/use-api'
import { useAuth } from '@/contexts/auth-context'
import { Icon, type IconName } from '@/components/product/Icon'
import { PageHeader } from '@/components/product/PageHeader'
import { StudyArtwork } from '@/components/product/StudyArtwork'
import { getSubjectColor } from '@/lib/subject-color'
import { SkeletonCard } from '@/components/ui/Skeleton'
import { CourseGrid, type Course, type CourseProgress } from '@/components/courses/CourseGrid'
import { profileSummary, type AcademicProfile } from '@/lib/profile'

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

function StatTile({
  href,
  label,
  value,
  icon,
  accent,
}: {
  href: string
  label: string
  value: number
  icon: IconName
  accent: string
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-[#eae6ef] bg-white p-4 flex items-center gap-3 transition-colors hover:border-violet-300"
    >
      <span
        className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${accent}`}
      >
        <Icon name={icon} />
      </span>
      <div className="min-w-0">
        <p className="text-2xl font-semibold text-slate-900 leading-none">{value}</p>
        <p className="text-xs text-slate-500 mt-1 truncate">{label}</p>
      </div>
    </Link>
  )
}

export default function DashboardPage() {
  const api = useApi()
  const { user } = useAuth()
  const { courses, error: courseError, remove: removeCourse } = useCourses()
  const [progress, setProgress] = useState<Progress | null>(null)
  const [today, setToday] = useState<Session[] | null>(null)
  const [dueCount, setDueCount] = useState(0)
  const [weakCount, setWeakCount] = useState(0)
  const [profile, setProfile] = useState<AcademicProfile | null>(null)
  const error = courseError

  useEffect(() => {
    api
      .get<AcademicProfile>('/users/me/profile')
      .then(setProfile)
      .catch(() => undefined)
    api
      .get<Progress>('/study/progress')
      .then(setProgress)
      .catch(() => undefined)
    api
      .get<Session[]>('/study/sessions/today')
      .then(setToday)
      .catch(() => setToday([]))
    api
      .get<unknown[]>('/study/flashcards/due')
      .then((c) => setDueCount(c.length))
      .catch(() => undefined)
    api
      .get<unknown[]>('/study/topics/weak')
      .then((c) => setWeakCount(c.length))
      .catch(() => undefined)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const progressByCourse = new Map(progress?.courses.map((c) => [c.courseId, c]) ?? [])
  const firstName = user?.name?.split(' ')[0] ?? 'there'
  const streak = progress?.currentStreak ?? 0
  const isNewUser = courses?.length === 0
  const hasProfile = !!profile?.profileCompletedAt

  if (profile?.studyPathway === 'EXAM_PREPARATION') return <ExamPreparationWorkspace />

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Your semester, at a glance"
        icon="spark"
        title={`${greeting()}, ${firstName}`}
        description={
          streak > 0
            ? `You're on a ${streak}-day streak. Keep a little time for yourself today.`
            : today && today.length > 0
              ? `You've got ${today.length} session${today.length === 1 ? '' : 's'} lined up for today.`
              : isNewUser && hasProfile && profile?.programme && profile.currentLevel
                ? `You're a ${profile.currentLevel}-level ${profile.programme} student. Let's set up your semester.`
                : 'A clear view of what to study, practise, and revisit.'
        }
        action={
          <Link href="/courses/new" className="btn-primary">
            <Icon name="plus" />
            New course
          </Link>
        }
      />

      {/* New user: build the semester instead of showing a wall of zeros */}
      {isNewUser && (
        <section className="relative overflow-hidden rounded-[24px] border border-[#e6d8fb] bg-[#f7f2ff] p-6 sm:p-8 lg:pr-[240px]">
          <StudyArtwork className="pointer-events-none absolute bottom-5 right-5 hidden !w-[200px] lg:block" />
          {hasProfile ? (
            <>
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Let&apos;s build your semester.
              </h2>
              <p className="text-sm font-semibold text-violet-600 mt-1">
                {profileSummary(profile!)}
              </p>
              <p className="text-sm text-slate-500 mt-3">
                We can suggest courses commonly taken in your programme. Select the ones you&apos;re
                taking this semester.
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <Link href="/courses/new?path=programme" className="btn-primary">
                  View suggested courses
                </Link>
                <Link href="/courses/new?path=manual" className="btn-secondary">
                  Add course manually
                </Link>
                <Link href="/courses/new?path=outline" className="btn-secondary">
                  Upload course outline
                </Link>
              </div>
              <p className="text-xs text-slate-400 mt-5">
                No syllabus? No problem. Nightklass can generate an editable course outline and
                study notes for you.
              </p>
            </>
          ) : (
            <>
              <h2 className="font-heading text-xl font-bold text-slate-900">
                Tell us what you study
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                Add your programme, level and semester and Nightklass will suggest your courses and
                set up your semester.
              </p>
              <div className="flex flex-wrap gap-3 mt-5">
                <Link href="/onboarding" className="btn-primary">
                  Set up my profile
                </Link>
                <Link href="/courses/new?path=manual" className="btn-secondary">
                  Add a course instead
                </Link>
              </div>
            </>
          )}
        </section>
      )}

      {/* Stat tiles */}
      {!isNewUser && (
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <StatTile
            href="/courses"
            label="Courses"
            value={courses?.length ?? 0}
            icon="book"
            accent="bg-[#f3edff] text-violet-700"
          />
          <StatTile
            href="/flashcards"
            label="Due flashcards"
            value={dueCount}
            icon="cards"
            accent="bg-[#f3edff] text-violet-700"
          />
          <StatTile
            href="/weak-topics"
            label="Weak spots"
            value={weakCount}
            icon="target"
            accent="bg-[#f3edff] text-violet-700"
          />
          <StatTile
            href="/dashboard"
            label="Best streak"
            value={progress?.longestStreak ?? 0}
            icon="flame"
            accent="bg-[#f3edff] text-violet-700"
          />
        </div>
      )}

      {/* Today strip */}
      {today && today.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="product-section-title">Today’s study</h2>
            <Link href="/today" className="text-xs font-semibold text-violet-600">
              See all →
            </Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-1 px-1">
            {today.slice(0, 6).map((s) => {
              const color = getSubjectColor(s.course.id)
              return (
                <Link
                  key={s.id}
                  href={`/courses/${s.course.id}`}
                  className={`card-accent bg-white rounded-2xl p-4 w-[240px] flex-shrink-0 border border-slate-100`}
                  style={{ ['--accent-color' as string]: color.hex }}
                >
                  <p className={`text-[11px] font-bold ${color.text}`}>{s.course.title}</p>
                  <p className="text-sm font-semibold text-slate-800 mt-0.5 truncate">
                    {s.topic?.name ?? 'Revision'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    {s.startTime}–{s.endTime}
                  </p>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* 30-day heatmap */}
      {progress && !isNewUser && (
        <div className="card p-5 animate-fade-in">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
              Last 30 days
            </p>
          </div>
          <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-[repeat(30,minmax(0,1fr))]">
            {progress.last30Days.map((d, i) => (
              <div
                key={d.date}
                title={`${d.date}: ${d.completedCount} session(s)`}
                className={`min-w-0 h-6 rounded-sm animate-scale-in hover:scale-110 transition-transform ${
                  d.completedCount === 0
                    ? 'bg-slate-100'
                    : d.completedCount === 1
                      ? 'bg-violet-200'
                      : d.completedCount === 2
                        ? 'bg-violet-400'
                        : 'bg-violet-600'
                }`}
                style={{ animationDelay: `${i * 12}ms` }}
              />
            ))}
          </div>
          {progress.last30Days.every((d) => d.completedCount === 0) && (
            <p className="text-xs text-slate-400 mt-3">
              Complete a study session to light this up — head to{' '}
              <Link href="/today" className="text-violet-600 font-medium">
                Today
              </Link>
              .
            </p>
          )}
        </div>
      )}

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

      {courses && courses.length > 0 && (
        <div>
          <h2 className="product-section-title mb-4">Your courses</h2>
          <CourseGrid courses={courses} progressByCourse={progressByCourse} onDeleted={removeCourse} />
        </div>
      )}
    </div>
  )
}
