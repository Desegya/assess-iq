import type { PlanSlot } from './plan-builder'
import { sessionMinutes, type BusySession } from './weekly-budget'

const DAY = 86_400_000
const key = (date: Date) => date.toISOString().slice(0, 10)

// Virtual block times are used only by the topic builder; daily sessions are saved with null times.
export function dailyTimetableSlots(
  from: Date,
  until: Date,
  weeklyMinutes: number,
  studyDays: number[],
  busy: BusySession[],
  earliest = from,
  committed: BusySession[] = [],
  courseId = '',
) {
  const slots: PlanSlot[] = []
  const shortages: string[] = []
  for (let week = +from; week < +until; week += 7 * DAY) {
    const end = Math.min(week + 7 * DAY, +until)
    if (end <= +earliest) continue
    const target = Math.floor((weeklyMinutes * (end - week)) / (7 * DAY) / 15) * 15
    const already = committed
      .filter((s) => +s.scheduledDate >= week && +s.scheduledDate < end)
      .reduce((sum, s) => sum + sessionMinutes(s), 0)
    let remaining = Math.max(0, target - already)
    const days = []
    for (let day = Math.max(week, +earliest); day < end; day += DAY) {
      const date = new Date(day)
      if (!studyDays.includes(date.getUTCDay())) continue
      const reserved = busy.filter((s) => key(s.scheduledDate) === key(date))
      days.push({
        date,
        total: reserved.reduce((sum, s) => sum + sessionMinutes(s), 0),
        own: reserved
          .filter((s) => s.courseId === courseId)
          .reduce((sum, s) => sum + sessionMinutes(s), 0),
        courses: new Set(reserved.map((s) => s.courseId).filter((id): id is string => !!id)),
        added: 0,
      })
    }
    // Prefer lighter days; cap variety as well as effort so a day does not become a list of every course.
    while (remaining >= 15) {
      const candidate = days
        .filter(
          (d) =>
            d.own + d.added < 120 &&
            d.total + d.added <= 165 &&
            (d.courses.has(courseId) || d.courses.size < 2),
        )
        .sort((a, b) => a.total + a.added - (b.total + b.added) || +a.date - +b.date)[0]
      if (!candidate) break
      const duration =
        Math.floor(
          Math.min(
            60,
            remaining,
            120 - candidate.own - candidate.added,
            180 - candidate.total - candidate.added,
          ) / 15,
        ) * 15
      if (duration < 15) break
      slots.push({
        date: candidate.date,
        startTime: '09:00',
        endTime: '10:00',
        capacityMinutes: duration,
      })
      candidate.added += duration
      candidate.courses.add(courseId)
      remaining -= duration
    }
    if (remaining >= 15)
      shortages.push(
        `${key(new Date(week))}: ${((target - remaining) / 60).toFixed(1)} of ${(target / 60).toFixed(1)} hours fit`,
      )
  }
  return { slots: slots.sort((a, b) => +a.date - +b.date), shortages }
}
