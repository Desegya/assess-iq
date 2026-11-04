import { describe, expect, it } from 'vitest'
import { dailyTimetableSlots } from './daily-timetable'
import { weeklyBudgetSlots, type BusySession } from './weekly-budget'

const start = new Date('2026-11-02T00:00:00Z')
const day = (n: number) => new Date(+start + n * 86_400_000)
const allDays = [0, 1, 2, 3, 4, 5, 6]
const total = (slots: { capacityMinutes: number }[]) =>
  slots.reduce((sum, s) => sum + s.capacityMinutes, 0)

describe('daily timetable', () => {
  it('spreads a weekly workload over chosen days without needing availability', () => {
    const { slots, shortages } = dailyTimetableSlots(
      start,
      day(14),
      240,
      [1, 3, 5],
      [],
      start,
      [],
      'biology',
    )
    expect(shortages).toEqual([])
    expect(total(slots)).toBe(480)
    expect(slots.every((s) => [1, 3, 5].includes(s.date.getUTCDay()))).toBe(true)
    expect(new Set(slots.map((s) => +s.date)).size).toBe(6)
  })

  it('puts a second course on lighter days and limits each day to two courses', () => {
    const first = dailyTimetableSlots(start, day(7), 240, allDays, [], start, [], 'biology')
    const busy: BusySession[] = first.slots.map((s) => ({
      scheduledDate: s.date,
      startTime: null,
      endTime: null,
      estimatedMinutes: s.capacityMinutes,
      courseId: 'biology',
    }))
    const second = dailyTimetableSlots(start, day(7), 240, allDays, busy, start, [], 'chemistry')
    expect(second.shortages).toEqual([])
    for (const index of [4, 5, 6])
      expect(total(second.slots.filter((s) => +s.date === +day(index)))).toBe(60)
    const shared: BusySession[] = [
      ...busy,
      ...second.slots.map((s) => ({
        scheduledDate: s.date,
        startTime: null,
        endTime: null,
        estimatedMinutes: s.capacityMinutes,
        courseId: 'chemistry',
      })),
    ]
    const third = dailyTimetableSlots(start, day(7), 240, allDays, shared, start, [], 'physics')
    for (const slot of third.slots) {
      const existing = shared.filter((s) => +s.scheduledDate === +slot.date)
      expect(new Set(existing.map((s) => s.courseId)).size).toBeLessThan(2)
      expect(
        existing.reduce((sum, s) => sum + s.estimatedMinutes!, 0) +
          third.slots
            .filter((s) => +s.date === +slot.date)
            .reduce((sum, s) => sum + s.capacityMinutes, 0),
      ).toBeLessThanOrEqual(180)
    }
  })

  it('reserves effort for timed courses and reports workloads that cannot fit', () => {
    const busy = allDays.map((_, i) => ({
      scheduledDate: day(i),
      startTime: '18:00',
      endTime: '20:30',
      estimatedMinutes: 150,
      courseId: 'chemistry',
    }))
    const result = dailyTimetableSlots(start, day(7), 240, allDays, busy, start, [], 'biology')
    expect(total(result.slots)).toBe(210)
    expect(result.shortages).toHaveLength(1)
  })

  it('preserves completed effort in the current week and prorates a final partial week', () => {
    const committed = [
      {
        scheduledDate: start,
        startTime: null,
        endTime: null,
        estimatedMinutes: 60,
        courseId: 'biology',
      },
    ]
    const result = dailyTimetableSlots(
      start,
      day(10),
      240,
      allDays,
      committed,
      day(2),
      committed,
      'biology',
    )
    expect(result.shortages).toEqual([])
    expect(total(result.slots.filter((s) => s.date < day(7)))).toBe(180)
    expect(total(result.slots.filter((s) => s.date >= day(7)))).toBe(90)
    expect(result.slots.every((s) => s.date >= day(2))).toBe(true)
  })

  it('counts flexible tasks when subsequently allocating timed weekly sessions', () => {
    const busy = allDays.map((_, i) => ({
      scheduledDate: day(i),
      startTime: null,
      endTime: null,
      estimatedMinutes: 150,
      courseId: 'biology',
    }))
    const result = weeklyBudgetSlots(
      start,
      day(7),
      240,
      { studyPreference: 'EVENINGS', avoidWorkHours: false, workStart: '09:00', workEnd: '17:00' },
      busy,
      start,
      [],
      'chemistry',
    )
    expect(total(result.slots)).toBe(210)
    expect(result.shortages).toHaveLength(1)
    expect(result.slots.every((s) => s.capacityMinutes === 30)).toBe(true)
  })
})
