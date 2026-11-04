import { freeSlots, sessionMinutes, type BusySession } from './weekly-budget'
import type { PlanSlot, PlanTopic } from './plan-builder'

const DAY = 86_400_000
const dayKey = (date: Date) => date.toISOString().slice(0, 10)
const minute = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (n: number) =>
  `${Math.floor(n / 60)}`.padStart(2, '0') + ':' + `${n % 60}`.padStart(2, '0')

export function coursePriority(
  units: number | null,
  difficulty: number | undefined,
  topics: PlanTopic[],
) {
  const measured = topics.map((t) => t.mastery).filter((value): value is number => value !== null)
  const mastery = measured.length ? measured.reduce((sum, n) => sum + n, 0) / measured.length : null
  const confidence = topics
    .map((t) => t.confidence)
    .filter((value): value is number => value !== null)
  const confidenceAverage = confidence.length
    ? confidence.reduce((sum, n) => sum + n, 0) / confidence.length
    : null
  const estimated = topics.length
    ? Math.max(
        1,
        Math.min(
          5,
          Math.round(
            topics.reduce(
              (sum, t) => sum + (t.estimatedMinutes ?? 45) / 25 + t.subtopicCount / 4,
              0,
            ) / topics.length,
          ),
        ),
      )
    : 3
  const level = difficulty ?? estimated
  const weak = mastery === null ? 1 : 1 + Math.max(-0.25, (65 - mastery) / 100)
  const confidenceBoost = confidenceAverage !== null && confidenceAverage <= 2 ? 1.2 : 1
  return {
    units: units || 3,
    assumedUnits: !units,
    difficulty: level,
    estimatedDifficulty: difficulty === undefined,
    mastery,
    weight: (units || 3) * (0.6 + level * 0.2) * weak * confidenceBoost,
  }
}

export interface TimetableWindow {
  id: string
  end: Date
  weight: number
}
export interface TimetableLimits {
  weeklyMinutes: number
  dailyMinutes: number
  maxCoursesPerDay: number
  studyDays: number[]
  schedulingStyle: 'DAILY' | 'TIMED'
  startTime: string
  endTime: string
}

// Allocate all courses together. Fixed reservations, committed study and each day's variety/effort limits
// are shared; only future unstarted work owned by this timetable is replaceable.
export function buildTimetableSlots(
  courses: TimetableWindow[],
  from: Date,
  until: Date,
  earliest: Date,
  limits: TimetableLimits,
  busy: BusySession[],
  committed: BusySession[] = [],
) {
  const allocation = new Map<string, PlanSlot[]>(courses.map((c) => [c.id, []]))
  const warnings: string[] = []
  for (let week = +from; week < +until; week += 7 * DAY) {
    const end = Math.min(week + 7 * DAY, +until)
    if (end <= +earliest) continue
    const active = courses.filter((c) => +c.end > Math.max(week, +earliest))
    if (!active.length) continue
    const committedWeek = committed.filter(
      (s) => +s.scheduledDate >= week && +s.scheduledDate < end,
    )
    const assigned = new Map(
      active.map((c) => [
        c.id,
        committedWeek
          .filter((s) => s.courseId === c.id)
          .reduce((sum, s) => sum + sessionMinutes(s), 0),
      ]),
    )
    const target = Math.floor((limits.weeklyMinutes * (end - week)) / (7 * DAY) / 15) * 15
    const blockMinutes = Math.max(15, Math.min(45, Math.floor(target / active.length / 15) * 15))
    let remaining = Math.max(
      0,
      target - committedWeek.reduce((sum, s) => sum + sessionMinutes(s), 0),
    )
    const days = []
    for (let stamp = Math.max(week, +earliest); stamp < end; stamp += DAY) {
      const date = new Date(stamp)
      if (!limits.studyDays.includes(date.getUTCDay())) continue
      const reserved = busy.filter((s) => dayKey(s.scheduledDate) === dayKey(date))
      days.push({
        date,
        busy: [...reserved],
        total: reserved.reduce((sum, s) => sum + sessionMinutes(s), 0),
        courses: new Set(reserved.map((s) => s.courseId).filter((id): id is string => !!id)),
        own: new Map(
          courses.map((course) => [
            course.id,
            reserved
              .filter((s) => s.courseId === course.id)
              .reduce((sum, s) => sum + sessionMinutes(s), 0),
          ]),
        ),
      })
    }
    while (remaining >= 15) {
      let added = false
      for (const day of [...days].sort((a, b) => a.total - b.total || +a.date - +b.date)) {
        if (day.total > limits.dailyMinutes - 15) continue
        const candidates = active
          .filter(
            (c) =>
              day.date < c.end &&
              (day.own.get(c.id) ?? 0) < 120 &&
              (day.courses.has(c.id) || day.courses.size < limits.maxCoursesPerDay),
          )
          .sort(
            (a, b) =>
              (assigned.get(a.id) ?? 0) / a.weight - (assigned.get(b.id) ?? 0) / b.weight ||
              a.id.localeCompare(b.id),
          )
        if (!candidates.length) continue
        const course = candidates[0]!
        const window =
          limits.schedulingStyle === 'TIMED'
            ? freeSlots(
                [
                  {
                    date: day.date,
                    startTime: limits.startTime,
                    endTime: limits.endTime,
                    capacityMinutes: minute(limits.endTime) - minute(limits.startTime),
                  },
                ],
                day.busy,
              )[0]
            : { date: day.date, startTime: '09:00', endTime: '10:00', capacityMinutes: 60 }
        if (!window) continue
        const duration =
          Math.floor(
            Math.min(
              blockMinutes,
              remaining,
              limits.dailyMinutes - day.total,
              120 - (day.own.get(course.id) ?? 0),
              window.capacityMinutes,
            ) / 15,
          ) * 15
        if (duration < 15) continue
        const slot = {
          ...window,
          endTime: clock(minute(window.startTime) + duration),
          capacityMinutes: duration,
        }
        allocation.get(course.id)!.push(slot)
        day.busy.push({
          scheduledDate: day.date,
          courseId: course.id,
          startTime: limits.schedulingStyle === 'TIMED' ? slot.startTime : null,
          endTime: limits.schedulingStyle === 'TIMED' ? slot.endTime : null,
          estimatedMinutes: duration,
        })
        day.total += duration
        day.own.set(course.id, (day.own.get(course.id) ?? 0) + duration)
        day.courses.add(course.id)
        assigned.set(course.id, (assigned.get(course.id) ?? 0) + duration)
        remaining -= duration
        added = true
        break
      }
      if (!added) break
    }
    if (remaining >= 15)
      warnings.push(
        `Week of ${dayKey(new Date(week))}: ${remaining} minutes could not fit around your limits and existing commitments.`,
      )
  }
  return { allocation, warnings }
}
