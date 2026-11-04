import { describe, expect, it } from 'vitest'
import { buildPlan } from './plan-builder'
import {
  freeSlots,
  weeklyBudgetSlots,
  type BudgetPreferences,
  type BusySession,
} from './weekly-budget'

const start = new Date('2026-11-02T00:00:00Z') // Monday
const day = (n: number) => new Date(start.getTime() + n * 86400000)
const preferences: BudgetPreferences = {
  studyPreference: 'EVENINGS',
  avoidWorkHours: true,
  workStart: '09:00',
  workEnd: '17:00',
}
const minutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3))

describe('weekly study budgets', () => {
  it('spreads the requested hours over days, outside work with a commute buffer', () => {
    const { slots, shortages } = weeklyBudgetSlots(start, day(14), 240, preferences, [])
    expect(shortages).toEqual([])
    for (const week of [0, 7]) {
      const sessions = slots.filter((s) => s.date >= day(week) && s.date < day(week + 7))
      expect(sessions.reduce((sum, s) => sum + s.capacityMinutes, 0)).toBe(240)
      expect(new Set(sessions.map((s) => s.date.toISOString())).size).toBe(4)
    }
    expect(
      slots.every((s) => s.startTime >= '18:00' && s.endTime <= '22:00' && s.capacityMinutes <= 60),
    ).toBe(true)
  })

  it('preserves other course reservations with breaks and a daily workload limit', () => {
    const busy: BusySession[] = Array.from({ length: 7 }, (_, i) => ({
      scheduledDate: day(i),
      startTime: '18:00',
      endTime: '20:00',
    }))
    const { slots, shortages } = weeklyBudgetSlots(start, day(7), 420, preferences, busy)
    expect(shortages).toEqual([])
    for (const slot of slots) {
      const other = busy.find((s) => s.scheduledDate.getTime() === slot.date.getTime())!
      expect(slot.endTime <= '17:45' || slot.startTime >= '20:15').toBe(true)
      expect(
        slot.capacityMinutes + minutes(other.endTime) - minutes(other.startTime),
      ).toBeLessThanOrEqual(180)
    }
  })

  it('uses weekends only and reports an impossible budget instead of overbooking', () => {
    const result = weeklyBudgetSlots(
      start,
      day(7),
      300,
      { ...preferences, studyPreference: 'WEEKENDS' },
      [],
    )
    expect(result.shortages).toHaveLength(1)
    expect(result.slots.every((s) => [0, 6].includes(s.date.getUTCDay()))).toBe(true)
    expect(result.slots.reduce((sum, s) => sum + s.capacityMinutes, 0)).toBe(240)
  })

  it('supports flexible daytime study while respecting custom work hours', () => {
    const { slots } = weeklyBudgetSlots(
      start,
      day(7),
      240,
      { ...preferences, studyPreference: 'FLEXIBLE', workStart: '12:00', workEnd: '20:00' },
      [],
    )
    expect(slots.every((s) => s.endTime <= '11:00' || s.startTime >= '21:00')).toBe(true)
    const unrestricted = weeklyBudgetSlots(
      start,
      day(7),
      60,
      { ...preferences, studyPreference: 'FLEXIBLE', avoidWorkHours: false },
      [],
    )
    expect(unrestricted.slots[0]?.startTime).toBe('09:00')
  })

  it('does not reset the current week budget when adapting or reschedule elapsed days', () => {
    const committed = [{ scheduledDate: start, startTime: '18:00', endTime: '19:00' }]
    const { slots, shortages } = weeklyBudgetSlots(
      start,
      day(10),
      240,
      preferences,
      committed,
      day(2),
      committed,
    )
    expect(shortages).toEqual([])
    expect(slots.every((s) => s.date >= day(2))).toBe(true)
    expect(
      slots.filter((s) => s.date < day(7)).reduce((sum, s) => sum + s.capacityMinutes, 0),
    ).toBe(180)
    expect(
      slots.filter((s) => s.date >= day(7)).reduce((sum, s) => sum + s.capacityMinutes, 0),
    ).toBe(90)
  })

  it('keeps regular practice throughout the plan and records actual non-overlapping times', () => {
    const { slots } = weeklyBudgetSlots(start, day(28), 240, preferences, [])
    const built = buildPlan(
      [
        {
          id: 't',
          name: 'Cells',
          estimatedMinutes: 45,
          subtopicCount: 0,
          mastery: null,
          confidence: null,
          completedMinutes: 0,
        },
      ],
      slots,
      { planStart: start, examDate: day(28), fillPractice: true },
    )
    expect(built.sessions.reduce((sum, s) => sum + s.estimatedMinutes, 0)).toBe(960)
    expect(built.sessions.some((s) => s.note === 'Weekly practice and recall')).toBe(true)
    for (const session of built.sessions)
      expect(minutes(session.endTime) - minutes(session.startTime)).toBe(session.estimatedMinutes)
    for (let i = 1; i < built.sessions.length; i++) {
      const before = built.sessions[i - 1]!
      const after = built.sessions[i]!
      if (+before.scheduledDate === +after.scheduledDate)
        expect(after.startTime >= before.endTime).toBe(true)
    }
  })

  it('subtracts reserved budget sessions from exact-time windows without exceeding capacity', () => {
    const slots = freeSlots(
      [{ date: start, startTime: '18:00', endTime: '22:00', capacityMinutes: 120 }],
      [{ scheduledDate: start, startTime: '19:00', endTime: '20:00' }],
    )
    expect(slots).toEqual([
      { date: start, startTime: '18:00', endTime: '18:45', capacityMinutes: 45 },
      { date: start, startTime: '20:15', endTime: '21:30', capacityMinutes: 75 },
    ])
  })
})
