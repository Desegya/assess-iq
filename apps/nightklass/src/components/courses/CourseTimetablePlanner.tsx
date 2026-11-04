'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useApi } from '@/hooks/use-api'
import type { Course } from './CourseGrid'

interface Settings {
  courses: { courseId: string; difficulty?: number }[]
  schedulingStyle: 'DAILY' | 'TIMED'
  weeklyHours: number
  maxCoursesPerDay: number
  dailyMinutes: number
  weeks: number
  studyDays: number[]
  timeZone: string
  autoAdjust: boolean
  startTime: string
  endTime: string
}
interface Preview {
  canApply: boolean
  warnings: string[]
  courses: { courseId: string; title: string; weeklyMinutes: number; reason: string }[]
  days: {
    date: string
    sessions: {
      courseId: string
      courseTitle: string
      topicName: string
      estimatedMinutes: number
      startTime: string | null
      endTime: string | null
    }[]
  }[]
}
interface Current {
  id: string
  settings: Settings
  lastChange: string
  updatedAt: string
}
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function CourseTimetablePlanner({
  courses,
  onClose,
}: {
  courses: Course[]
  onClose: () => void
}) {
  const api = useApi()
  const [settings, setSettings] = useState<Settings>({
    courses: courses.map((course) => ({ courseId: course.id })),
    schedulingStyle: 'DAILY',
    weeklyHours: 8,
    maxCoursesPerDay: 2,
    dailyMinutes: 180,
    weeks: 13,
    studyDays: [1, 2, 3, 4, 5, 6],
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    autoAdjust: true,
    startTime: '18:00',
    endTime: '21:00',
  })
  const [preview, setPreview] = useState<Preview | null>(null)
  const [current, setCurrent] = useState<Current | null>(null)
  const [busy, setBusy] = useState<'preview' | 'apply' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const dirty = useRef(false)
  const errorRef = useRef<HTMLParagraphElement>(null)
  const previewRef = useRef<HTMLDivElement>(null)
  const savedRef = useRef<HTMLDivElement>(null)
  const initialIds = useRef(courses.map((course) => course.id))

  useEffect(() => {
    let active = true
    api
      .get<Current | null>('/study/timetables/current')
      .then((result) => {
        if (!active || !result?.settings || !Array.isArray(result.settings.courses)) return
        setCurrent(result)
        if (!dirty.current)
          setSettings((previous) => ({
            ...previous,
            ...result.settings,
            courses: result.settings.courses.filter((course) =>
              initialIds.current.includes(course.courseId),
            ),
          }))
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [api])
  useEffect(() => {
    if (error) errorRef.current?.focus()
  }, [error])

  function change(patch: Partial<Settings>) {
    dirty.current = true
    setSettings((previous) => ({ ...previous, ...patch }))
    setPreview(null)
    setSaved(false)
    setError(null)
  }

  async function suggest(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)
    if (!settings.courses.length || !settings.studyDays.length) {
      setError('Choose at least one course and one study day.')
      return
    }
    setBusy('preview')
    try {
      setPreview(await api.post<Preview>('/study/timetables/preview', settings))
      requestAnimationFrame(() => previewRef.current?.focus())
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not suggest your timetable. Try again.')
    } finally {
      setBusy(null)
    }
  }

  async function apply() {
    if (!preview?.canApply) return
    setBusy('apply')
    setError(null)
    try {
      setCurrent(await api.post<Current>('/study/timetables/apply', settings))
      setSaved(true)
      setPreview(null)
      requestAnimationFrame(() => savedRef.current?.focus())
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not apply your timetable. Your current plans have been kept.',
      )
    } finally {
      setBusy(null)
    }
  }

  return (
    <section
      id="combined-planner"
      aria-label="Combined study planner"
      className="card space-y-5 p-5 sm:p-6"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-bold text-slate-900">
            A study plan across your courses
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Choose a workload that fits your life. We share it across your courses using units,
            difficulty, quiz results and confidence.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          disabled={busy !== null}
          className="text-sm font-semibold text-slate-600"
        >
          Close planner
        </button>
      </div>

      {current && (
        <details className="rounded-xl bg-slate-50 p-3 text-sm">
          <summary className="cursor-pointer font-semibold text-slate-800">
            Current timetable ·{' '}
            {current.settings.autoAdjust ? 'Automatic adjustments on' : 'Manual adjustments'}
          </summary>
          <p className="mt-2 text-slate-600">{current.lastChange}</p>
          <p className="mt-1 text-xs text-slate-500">
            Updated {new Date(current.updatedAt).toLocaleString()}
          </p>
          <Link
            href="/today"
            className="mt-2 inline-flex min-h-11 items-center font-semibold text-violet-700"
          >
            See today’s tasks →
          </Link>
        </details>
      )}

      <form onSubmit={suggest} className="space-y-5">
        <fieldset disabled={busy !== null} className="space-y-4 disabled:opacity-70">
          <legend className="mb-2 text-sm font-semibold text-slate-800">Courses to include</legend>
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-3">
            {courses.map((course) => {
              const selected = settings.courses.find((choice) => choice.courseId === course.id)
              return (
                <div
                  key={course.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2 last:border-0"
                >
                  <label className="flex min-h-11 items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={!!selected}
                      onChange={(event) =>
                        change({
                          courses: event.target.checked
                            ? [...settings.courses, { courseId: course.id }]
                            : settings.courses.filter((choice) => choice.courseId !== course.id),
                        })
                      }
                    />
                    <span>
                      {course.title}
                      <span className="block text-xs text-slate-500">
                        {course.creditUnits ?? 3} units
                        {course.creditUnits == null ? ' assumed — edit course to correct' : ''}
                      </span>
                    </span>
                  </label>
                  <select
                    aria-label={`Difficulty for ${course.title}`}
                    disabled={!selected}
                    value={selected?.difficulty ?? 'AUTO'}
                    onChange={(event) =>
                      change({
                        courses: settings.courses.map((choice) =>
                          choice.courseId === course.id
                            ? {
                                courseId: choice.courseId,
                                ...(event.target.value === 'AUTO'
                                  ? {}
                                  : { difficulty: Number(event.target.value) }),
                              }
                            : choice,
                        ),
                      })
                    }
                    className="input-base !w-auto text-sm"
                  >
                    <option value="AUTO">Estimate difficulty</option>
                    <option value="1">1 · Light</option>
                    <option value="2">2 · Fairly light</option>
                    <option value="3">3 · Moderate</option>
                    <option value="4">4 · Challenging</option>
                    <option value="5">5 · Very challenging</option>
                  </select>
                </div>
              )
            })}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="text-sm text-slate-700">
              Plan style
              <select
                value={settings.schedulingStyle}
                onChange={(event) =>
                  change({ schedulingStyle: event.target.value as Settings['schedulingStyle'] })
                }
                className="input-base mt-1"
              >
                <option value="DAILY">Days only — study whenever I can</option>
                <option value="TIMED">Timed sessions within a study window</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Total hours per week across these courses
              <input
                type="number"
                min="0.5"
                max="21"
                step="0.25"
                required
                value={settings.weeklyHours}
                onChange={(event) => change({ weeklyHours: Number(event.target.value) })}
                className="input-base mt-1"
              />
            </label>
            <label className="text-sm text-slate-700">
              Maximum courses per day
              <input
                type="number"
                min="1"
                max="6"
                required
                value={settings.maxCoursesPerDay}
                onChange={(event) => change({ maxCoursesPerDay: Number(event.target.value) })}
                className="input-base mt-1"
              />
            </label>
            <label className="text-sm text-slate-700">
              Daily study limit
              <select
                value={settings.dailyMinutes}
                onChange={(event) => change({ dailyMinutes: Number(event.target.value) })}
                className="input-base mt-1"
              >
                <option value="30">30 minutes</option>
                <option value="60">1 hour</option>
                <option value="90">1½ hours</option>
                <option value="120">2 hours</option>
                <option value="150">2½ hours</option>
                <option value="180">3 hours</option>
              </select>
            </label>
            <label className="text-sm text-slate-700">
              Plan length in weeks
              <input
                type="number"
                min="1"
                max="52"
                required
                value={settings.weeks}
                onChange={(event) => change({ weeks: Number(event.target.value) })}
                className="input-base mt-1"
              />
            </label>
          </div>
          <fieldset>
            <legend className="mb-1 text-sm font-medium text-slate-700">Study days</legend>
            <div className="flex flex-wrap gap-4">
              {DAYS.map((label, day) => (
                <label key={day} className="flex min-h-11 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={settings.studyDays.includes(day)}
                    onChange={(event) =>
                      change({
                        studyDays: event.target.checked
                          ? [...settings.studyDays, day]
                          : settings.studyDays.filter((value) => value !== day),
                      })
                    }
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          {settings.schedulingStyle === 'TIMED' && (
            <div className="grid grid-cols-2 gap-4">
              <label className="text-sm text-slate-700">
                Study window starts
                <input
                  type="time"
                  min="07:00"
                  max="22:00"
                  required
                  value={settings.startTime}
                  onChange={(event) => change({ startTime: event.target.value })}
                  className="input-base mt-1"
                />
              </label>
              <label className="text-sm text-slate-700">
                Study window ends
                <input
                  type="time"
                  min="07:00"
                  max="22:00"
                  required
                  value={settings.endTime}
                  onChange={(event) => change({ endTime: event.target.value })}
                  className="input-base mt-1"
                />
              </label>
            </div>
          )}
          <label className="flex items-start gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="mt-1"
              checked={settings.autoAdjust}
              onChange={(event) => change({ autoAdjust: event.target.checked })}
            />
            <span>
              Adjust automatically as I study
              <span className="mt-1 block text-xs text-slate-500">
                Uses graded quizzes and completed tasks, including your confidence ratings. Reviews
                unfinished work when you return on a new day. Keeps your workload, chosen days and
                daily limits; today’s tasks and completed work stay in place. You can turn this off
                here and apply a new suggestion.
              </span>
            </span>
          </label>
          <button type="submit" disabled={busy !== null} className="btn-primary">
            {busy === 'preview' ? 'Planning…' : 'Preview suggested plan'}
          </button>
        </fieldset>
      </form>

      {error && (
        <p
          role="alert"
          tabIndex={-1}
          ref={errorRef}
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {saved && (
        <div
          role="status"
          tabIndex={-1}
          ref={savedRef}
          className="rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800"
        >
          Your combined timetable is ready.{' '}
          <Link href="/today" className="font-semibold underline">
            Open Today
          </Link>{' '}
          to track tasks. The new schedule starts tomorrow.
        </div>
      )}

      {preview && (
        <div
          ref={previewRef}
          tabIndex={-1}
          aria-label="Suggested timetable preview"
          className="space-y-4 border-t border-slate-200 pt-5"
        >
          <h3 className="font-semibold text-slate-900">Suggested allocation</h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr>
                  <th className="p-2">Course</th>
                  <th className="p-2">Approx. hours/week</th>
                  <th className="p-2">Why</th>
                </tr>
              </thead>
              <tbody>
                {preview.courses.map((course) => (
                  <tr key={course.courseId} className="border-t border-slate-100">
                    <td className="p-2 font-medium">{course.title}</td>
                    <td className="p-2">{(course.weeklyMinutes / 60).toFixed(1)}</td>
                    <td className="p-2 text-xs text-slate-500">{course.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.warnings.length > 0 && (
            <div role="status" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">
              <ul className="list-disc space-y-1 pl-4">
                {preview.warnings.map((warning, index) => (
                  <li key={index}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
          <details open>
            <summary className="cursor-pointer text-sm font-semibold text-slate-800">
              First 7 study days
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              {preview.days.slice(0, 7).map((day) => (
                <div key={day.date} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-semibold text-slate-800">
                    {new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                  <ul className="mt-2 space-y-2 text-sm">
                    {day.sessions.map((session, index) => (
                      <li key={index}>
                        <span className="font-medium">{session.courseTitle}</span> ·{' '}
                        {session.topicName}
                        <span className="block text-xs text-slate-500">
                          {session.startTime
                            ? `${session.startTime}–${session.endTime}`
                            : 'Anytime this day'}{' '}
                          · {session.estimatedMinutes} min
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
          <p className="text-xs text-slate-500">
            Applying replaces future plans for the selected courses. Other courses’ commitments stay
            reserved. We check your latest progress again when applying. Difficulty estimates use
            topic workload; ratings and measured quiz results help refine them.
          </p>
          <button
            type="button"
            disabled={!preview.canApply || busy !== null}
            onClick={() => void apply()}
            className="btn-primary"
          >
            {busy === 'apply' ? 'Applying…' : 'Use this study plan'}
          </button>
        </div>
      )}
    </section>
  )
}
