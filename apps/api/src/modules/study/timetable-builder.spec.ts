import { describe, expect, it } from 'vitest'
import { buildTimetableSlots, coursePriority, type TimetableLimits } from './timetable-builder'
import type { PlanTopic } from './plan-builder'

const start = new Date('2026-11-09T00:00:00Z')
const day = (n: number) => new Date(+start + n * 86_400_000)
const limits: TimetableLimits = {
  weeklyMinutes: 480,
  dailyMinutes: 180,
  maxCoursesPerDay: 2,
  studyDays: [1, 2, 3, 4, 5, 6],
  schedulingStyle: 'DAILY',
  startTime: '18:00',
  endTime: '21:00',
}
const topic = (mastery: number | null, confidence: number | null = null): PlanTopic => ({
  id: 'topic',
  name: 'Topic',
  estimatedMinutes: 60,
  subtopicCount: 2,
  mastery,
  confidence,
  completedMinutes: 0,
})

describe('combined timetable allocation', () => {
  it('gives more attention to higher-unit, harder courses and weaker measured performance', () => {
    expect(coursePriority(4, 5, [topic(null)]).weight).toBeGreaterThan(
      coursePriority(2, 2, [topic(null)]).weight,
    )
    expect(coursePriority(3, 3, [topic(30)]).weight).toBeGreaterThan(
      coursePriority(3, 3, [topic(90)]).weight,
    )
    expect(coursePriority(3, 3, [topic(null, 1)]).weight).toBeGreaterThan(
      coursePriority(3, 3, [topic(null, 4)]).weight,
    )
    expect(coursePriority(null, undefined, []).assumedUnits).toBe(true)
    expect(coursePriority(3, undefined, []).mastery).toBeNull()
  })

  it('allocates a shared weekly budget across all courses while respecting daily variety and effort', () => {
    const result = buildTimetableSlots(
      [
        { id: 'heavy', end: day(14), weight: 6 },
        { id: 'light', end: day(14), weight: 2 },
        { id: 'medium', end: day(14), weight: 3 },
      ],
      start,
      day(14),
      start,
      limits,
      [],
    )
    expect(result.warnings).toEqual([])
    const minutes = (id: string) =>
      result.allocation.get(id)!.reduce((sum, s) => sum + s.capacityMinutes, 0)
    expect(minutes('heavy')).toBeGreaterThan(minutes('light'))
    expect(
      [...result.allocation.values()].flat().reduce((sum, s) => sum + s.capacityMinutes, 0),
    ).toBe(960)
    for (let n = 0; n < 14; n++) {
      const active = [...result.allocation].filter(([, slots]) =>
        slots.some((slot) => +slot.date === +day(n)),
      )
      expect(active.length).toBeLessThanOrEqual(2)
      expect(
        active
          .flatMap(([, slots]) => slots.filter((slot) => +slot.date === +day(n)))
          .reduce((sum, slot) => sum + slot.capacityMinutes, 0),
      ).toBeLessThanOrEqual(180)
    }
  })

  it('respects a custom daily course limit and preserves committed work when adapting', () => {
    const committed = [
      {
        courseId: 'biology',
        scheduledDate: start,
        startTime: null,
        endTime: null,
        estimatedMinutes: 60,
      },
    ]
    const result = buildTimetableSlots(
      [
        { id: 'biology', end: day(7), weight: 3 },
        { id: 'chemistry', end: day(7), weight: 3 },
      ],
      start,
      day(7),
      day(1),
      { ...limits, maxCoursesPerDay: 1 },
      committed,
      committed,
    )
    expect(
      [...result.allocation.values()].flat().reduce((sum, s) => sum + s.capacityMinutes, 0),
    ).toBe(420)
    for (let n = 1; n < 7; n++)
      expect(
        [...result.allocation.values()].filter((slots) =>
          slots.some((slot) => +slot.date === +day(n)),
        ).length,
      ).toBeLessThanOrEqual(1)
    expect([...result.allocation.values()].flat().every((slot) => slot.date >= day(1))).toBe(true)
  })

  it('does not overlap fixed reservations or timed course blocks and leaves breaks', () => {
    const result = buildTimetableSlots(
      [
        { id: 'a', end: day(7), weight: 3 },
        { id: 'b', end: day(7), weight: 3 },
      ],
      start,
      day(7),
      start,
      { ...limits, schedulingStyle: 'TIMED' },
      [
        {
          courseId: 'other',
          scheduledDate: start,
          startTime: '18:30',
          endTime: '19:30',
          estimatedMinutes: 60,
        },
      ],
    )
    for (let n = 0; n < 7; n++) {
      const slots = [...result.allocation.values()]
        .flat()
        .filter((s) => +s.date === +day(n))
        .sort((a, b) => a.startTime.localeCompare(b.startTime))
      for (let i = 1; i < slots.length; i++)
        expect(slots[i]!.startTime >= slots[i - 1]!.endTime).toBe(true)
      if (n === 0)
        expect(slots.every((s) => s.endTime <= '18:15' || s.startTime >= '19:45')).toBe(true)
    }
  })

  it('reports insufficient capacity instead of exceeding workload or daily course limits', () => {
    const result = buildTimetableSlots(
      [{ id: 'a', end: day(7), weight: 3 }],
      start,
      day(7),
      start,
      { ...limits, studyDays: [1], dailyMinutes: 60 },
      [],
    )
    expect(result.warnings).toHaveLength(1)
    expect(result.allocation.get('a')!.reduce((sum, s) => sum + s.capacityMinutes, 0)).toBe(60)
  })

  it('uses shorter blocks when a modest budget must cover many courses', () => {
    const courses = Array.from({ length: 20 }, (_, index) => ({ id: `course-${index}`, end: day(7), weight: 3 }))
    const result = buildTimetableSlots(courses, start, day(7), start, { ...limits, maxCoursesPerDay: 4 }, [])
    expect(result.warnings).toEqual([])
    expect([...result.allocation.values()].every(slots => slots.length > 0)).toBe(true)
    expect([...result.allocation.values()].flat().reduce((sum, slot) => sum + slot.capacityMinutes, 0)).toBe(480)
  })
})
