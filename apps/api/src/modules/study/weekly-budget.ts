import type { PlanSlot } from './plan-builder'

const DAY = 86_400_000
export interface BudgetPreferences {
  studyPreference: 'EVENINGS' | 'WEEKENDS' | 'FLEXIBLE'
  avoidWorkHours: boolean
  workStart: string
  workEnd: string
  timeZone?: string
  schedulingStyle?: 'TIMED' | 'DAILY'
  studyDays?: number[]
}
export interface BusySession {
  scheduledDate: Date
  startTime: string | null
  endTime: string | null
  estimatedMinutes?: number
  courseId?: string
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))
const clock = (value: number) =>
  `${Math.floor(value / 60)}`.padStart(2, '0') + ':' + `${value % 60}`.padStart(2, '0')

// Leave a quarter-hour between courses as well as between study blocks.
export function freeSlots(
  slots: PlanSlot[],
  busy: BusySession[],
  limitDailyWorkload = false,
): PlanSlot[] {
  const available = slots.flatMap((slot) => {
    let ranges = [[minutes(slot.startTime), minutes(slot.endTime)]]
    for (const session of busy.filter(
      (s) => s.scheduledDate.toISOString().slice(0, 10) === slot.date.toISOString().slice(0, 10),
    )) {
      if (!session.startTime || !session.endTime) continue
      const start = minutes(session.startTime) - 15
      const end = minutes(session.endTime) + 15
      ranges = ranges.flatMap(([a, b]) =>
        end <= a! || start >= b!
          ? [[a!, b!]]
          : [
              [a!, Math.min(b!, start)],
              [Math.max(a!, end), b!],
            ].filter(([x, y]) => y! > x!),
      )
    }
    let remaining = slot.capacityMinutes
    return ranges.flatMap(([start, end]) => {
      const capacity = Math.min(end! - start!, remaining)
      if (capacity < 15) return []
      remaining -= capacity
      return [
        {
          date: slot.date,
          startTime: clock(start!),
          endTime: clock(start! + capacity),
          capacityMinutes: capacity,
        },
      ]
    })
  })
  if (!limitDailyWorkload) return available
  const remaining = new Map<string, number>()
  return available.flatMap((slot) => {
    const date = slot.date.toISOString().slice(0, 10)
    const capacity =
      remaining.get(date) ??
      Math.max(
        0,
        180 -
          busy
            .filter((s) => s.scheduledDate.toISOString().slice(0, 10) === date)
            .reduce((sum, s) => sum + sessionMinutes(s), 0),
      )
    const allocated = Math.min(capacity, slot.capacityMinutes)
    remaining.set(date, capacity - allocated)
    return allocated < 15
      ? []
      : [
          {
            ...slot,
            capacityMinutes: allocated,
            endTime: clock(minutes(slot.startTime) + allocated),
          },
        ]
  })
}

// Seven-day budgets start at `from`; the last partial week receives a proportional budget.
// Spread sessions across days before adding a second hour. Sleep and meal/commute buffers stay free.
export function weeklyBudgetSlots(
  from: Date,
  until: Date,
  weeklyMinutes: number,
  preferences: BudgetPreferences,
  busy: BusySession[],
  earliest = from,
  committed: BusySession[] = [],
  courseId?: string,
) {
  const slots: PlanSlot[] = []
  const shortages: string[] = []
  for (let week = from.getTime(); week < until.getTime(); week += 7 * DAY) {
    const end = Math.min(week + 7 * DAY, until.getTime())
    if (end <= earliest.getTime()) continue
    const target = Math.floor((weeklyMinutes * ((end - week) / (7 * DAY))) / 15) * 15
    const committedMinutes = committed
      .filter((s) => s.scheduledDate.getTime() >= week && s.scheduledDate.getTime() < end)
      .reduce((sum, s) => sum + sessionMinutes(s), 0)
    let remaining = Math.max(0, target - committedMinutes)
    const days: PlanSlot[][] = []
    for (let day = week; day < end; day += DAY) {
      if (day < earliest.getTime()) continue
      const date = new Date(day)
      const courses = new Set(
        busy
          .filter(
            (s) => s.scheduledDate.toISOString().slice(0, 10) === date.toISOString().slice(0, 10),
          )
          .map((s) => s.courseId)
          .filter(Boolean),
      )
      if (courseId && courses.size >= 2 && !courses.has(courseId)) continue
      const weekend = [0, 6].includes(date.getUTCDay())
      if (preferences.studyPreference === 'WEEKENDS' && !weekend) continue
      const start = preferences.studyPreference === 'EVENINGS' && !weekend ? 18 * 60 : 9 * 60
      let windows: PlanSlot[] = [
        { date, startTime: clock(start), endTime: '22:00', capacityMinutes: 22 * 60 - start },
      ]
      if (preferences.avoidWorkHours && !weekend) {
        // An hour on either side allows commuting, meals and settling in.
        windows = freeSlots(windows, [
          {
            scheduledDate: date,
            startTime: clock(Math.max(0, minutes(preferences.workStart) - 45)),
            endTime: clock(Math.min(1439, minutes(preferences.workEnd) + 45)),
          },
        ])
      }
      days.push(freeSlots(windows, busy))
    }
    const added: BusySession[] = []
    const dailyMinutes = new Map<string, number>()
    for (let pass = 0; pass < 2 && remaining >= 15; pass++) {
      for (const windows of days) {
        if (remaining < 15) break
        const window = freeSlots(windows, added)[0]
        if (!window) continue
        const key = window.date.toISOString().slice(0, 10)
        const otherMinutes = busy
          .filter((s) => s.scheduledDate.toISOString().slice(0, 10) === key)
          .reduce((sum, s) => sum + sessionMinutes(s), 0)
        // At most three hours across courses, and two hours for this course in a day.
        const duration =
          Math.floor(
            Math.min(
              60,
              remaining,
              window.capacityMinutes,
              180 - otherMinutes - (dailyMinutes.get(key) ?? 0),
            ) / 15,
          ) * 15
        if (duration < 15) continue
        const slot = {
          ...window,
          endTime: clock(minutes(window.startTime) + duration),
          capacityMinutes: duration,
        }
        slots.push(slot)
        added.push({ scheduledDate: slot.date, startTime: slot.startTime, endTime: slot.endTime })
        dailyMinutes.set(key, (dailyMinutes.get(key) ?? 0) + duration)
        remaining -= duration
      }
    }
    if (remaining >= 15)
      shortages.push(
        `${new Date(week).toISOString().slice(0, 10)}: ${((target - remaining) / 60).toFixed(1)} of ${(target / 60).toFixed(1)} hours fit`,
      )
  }
  return {
    slots: slots.sort(
      (a, b) => a.date.getTime() - b.date.getTime() || a.startTime.localeCompare(b.startTime),
    ),
    shortages,
  }
}

export function sessionMinutes(session: BusySession) {
  return (
    session.estimatedMinutes ??
    (session.startTime && session.endTime
      ? minutes(session.endTime) - minutes(session.startTime)
      : 0)
  )
}
