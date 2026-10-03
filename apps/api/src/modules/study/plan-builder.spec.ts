import { describe, expect, it } from 'vitest'
import { allocateSlots, buildPlan, learningNeed, topicWeight, type PlanSlot, type PlanTopic, type PlanWindow } from './plan-builder'

const DAY = 24 * 60 * 60 * 1000
const START = new Date('2026-10-05T00:00:00Z') // a Monday
const day = (n: number) => new Date(START.getTime() + n * DAY)

function slots(n: number, capacityMinutes = 90): PlanSlot[] {
  return Array.from({ length: n }, (_, i) => ({ date: day(i), startTime: '18:00', endTime: '19:30', capacityMinutes }))
}

function topic(id: string, overrides: Partial<PlanTopic> = {}): PlanTopic {
  return { id, name: id, estimatedMinutes: null, subtopicCount: 2, mastery: null, confidence: null, completedMinutes: 0, ...overrides }
}

const minutes = (sessions: { estimatedMinutes: number }[]) => sessions.reduce((sum, s) => sum + s.estimatedMinutes, 0)
const toMinutes = (t: string) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3))

function minutesPerDay(sessions: { scheduledDate: Date; estimatedMinutes: number }[]) {
  const byDay = new Map<string, number>()
  for (const s of sessions) byDay.set(s.scheduledDate.toISOString(), (byDay.get(s.scheduledDate.toISOString()) ?? 0) + s.estimatedMinutes)
  return [...byDay.values()]
}

describe('topicWeight / learningNeed', () => {
  it('gives weak topics more time and strong topics less', () => {
    expect(topicWeight({ mastery: 30, confidence: null })).toBe(1.3)
    expect(topicWeight({ mastery: 65, confidence: null })).toBe(1)
    expect(topicWeight({ mastery: 90, confidence: null })).toBe(0.6)
  })

  it('treats low self-confidence like a weak score when there is no quiz yet', () => {
    expect(topicWeight({ mastery: null, confidence: 2 })).toBe(1.2)
    expect(topicWeight({ mastery: null, confidence: 4 })).toBe(1)
  })

  it('sizes topics from subtopics and subtracts time already studied', () => {
    expect(learningNeed(topic('t'))).toBe(65) // 45 + 2 subtopics × 10
    expect(learningNeed(topic('t', { estimatedMinutes: 50, completedMinutes: 20 }))).toBe(30)
    expect(learningNeed(topic('t', { estimatedMinutes: 50, completedMinutes: 80 }))).toBe(0)
  })
})

describe('buildPlan', () => {
  it('schedules every topic in full, with spaced reviews and a final revision block', () => {
    const topics = ['A', 'B', 'C', 'D', 'E', 'F'].map(id => topic(id))
    const { sessions, scaledDown, unscheduledTopics } = buildPlan(topics, slots(25), { planStart: START, examDate: day(35) })

    expect(scaledDown).toBe(false)
    expect(unscheduledTopics).toEqual([])
    for (const t of topics) {
      expect(minutes(sessions.filter(s => s.topicId === t.id && s.kind === 'LEARN'))).toBe(learningNeed(t))
    }
    expect(sessions.some(s => s.kind === 'REVIEW')).toBe(true)

    const revision = sessions.filter(s => s.kind === 'REVISION')
    expect(revision).toHaveLength(Math.round(25 * 0.15))
    const lastStudy = Math.max(...sessions.filter(s => s.kind !== 'REVISION').map(s => s.scheduledDate.getTime()))
    expect(revision.every(s => s.scheduledDate.getTime() >= lastStudy)).toBe(true)
  })

  it('numbers weeks from the plan start', () => {
    const { sessions } = buildPlan([topic('A')], slots(25), { planStart: START, examDate: day(35) })
    expect(Math.min(...sessions.map(s => s.weekNumber))).toBe(1)
    expect(Math.max(...sessions.map(s => s.weekNumber))).toBe(4) // 25 consecutive days span weeks 1-4
  })

  it('weights time by mastery and revises the weakest topic first', () => {
    const topics = [topic('weak', { mastery: 30 }), topic('mid', { mastery: 65 }), topic('strong', { mastery: 90 })]
    const { sessions } = buildPlan(topics, slots(20), { planStart: START, examDate: day(30) })
    const learn = (id: string) => minutes(sessions.filter(s => s.topicId === id && s.kind === 'LEARN'))

    expect(learn('weak')).toBeGreaterThan(learn('mid'))
    expect(learn('mid')).toBeGreaterThan(learn('strong'))
    expect(sessions.find(s => s.kind === 'REVISION')?.topicId).toBe('weak')
  })

  it('shortens topics to fit instead of dropping them when time is tight', () => {
    const topics = Array.from({ length: 12 }, (_, i) => topic(`T${i}`))
    const { sessions, scaledDown, unscheduledTopics } = buildPlan(topics, slots(6, 60), { planStart: START, examDate: day(6) })

    expect(scaledDown).toBe(true)
    expect(unscheduledTopics).toEqual([])
    expect(sessions.filter(s => s.kind === 'LEARN').every(s => s.estimatedMinutes >= 20)).toBe(true)
  })

  it('uses a bigger revision block when the exam is within two weeks', () => {
    const { sessions } = buildPlan(['A', 'B', 'C'].map(id => topic(id)), slots(12, 60), { planStart: START, examDate: day(12) })
    expect(sessions.filter(s => s.kind === 'REVISION')).toHaveLength(3) // 25% of 12
  })

  it('never books more than a slot holds and avoids sub-15-minute fragments', () => {
    const topics = ['A', 'B', 'C', 'D'].map(id => topic(id, { estimatedMinutes: 50 }))
    const { sessions } = buildPlan(topics, slots(10, 60), { planStart: START, examDate: day(20) })

    expect(minutesPerDay(sessions).every(m => m <= 60)).toBe(true)
    expect(sessions.filter(s => s.kind === 'LEARN').every(s => s.estimatedMinutes >= 15)).toBe(true)
  })

  it('books extra time for a fully studied but weak topic as revision, with a note', () => {
    const weak = topic('w', { estimatedMinutes: 60, completedMinutes: 60, mastery: 30 })
    const { sessions } = buildPlan([weak], slots(10), { planStart: START, examDate: day(10) })
    const extra = sessions.find(s => s.topicId === 'w' && s.kind === 'REVIEW' && s.note?.startsWith('Extra revision'))

    expect(extra?.estimatedMinutes).toBe(18) // 60 × 1.3 − 60
  })

  it('reports every topic as unscheduled when there are no slots', () => {
    const result = buildPlan([topic('A')], [], { planStart: START, examDate: START })
    expect(result.sessions).toEqual([])
    expect(result.unscheduledTopics).toEqual(['A'])
  })
})

describe('allocateSlots', () => {
  const window = (id: string, endDay: number, weight = 3): PlanWindow => ({ id, end: day(endDay), weight: () => weight })

  function assertNoClashes(allocation: Map<string, PlanSlot[]>, capacity = 90) {
    const byDay = new Map<string, PlanSlot[]>()
    for (const list of allocation.values()) for (const s of list) byDay.set(s.date.toISOString(), [...(byDay.get(s.date.toISOString()) ?? []), s])
    for (const daySlots of byDay.values()) {
      const sorted = [...daySlots].sort((a, b) => toMinutes(a.startTime) - toMinutes(b.startTime))
      for (let i = 1; i < sorted.length; i++) expect(toMinutes(sorted[i]!.startTime)).toBeGreaterThanOrEqual(toMinutes(sorted[i - 1]!.endTime))
      expect(minutes(sorted.map(s => ({ estimatedMinutes: s.capacityMinutes })))).toBeLessThanOrEqual(capacity)
    }
  }

  it('splits a slot into back-to-back windows for two equal courses', () => {
    const allocation = allocateSlots([window('bio', 30), window('chm', 30)], slots(10))
    expect(allocation.get('bio')![0]).toMatchObject({ startTime: '18:00', endTime: '18:45', capacityMinutes: 45 })
    expect(allocation.get('chm')![0]).toMatchObject({ startTime: '18:45', endTime: '19:30', capacityMinutes: 45 })
    assertNoClashes(allocation)
  })

  it('weights the split by credit units', () => {
    const allocation = allocateSlots([window('bio', 30, 4), window('gst', 30, 2)], slots(5))
    expect(allocation.get('bio')![0]!.capacityMinutes).toBe(60)
    expect(allocation.get('gst')![0]!.capacityMinutes).toBe(30)
  })

  it('never loses minutes to rounding', () => {
    const allocation = allocateSlots([window('a', 10, 1), window('b', 10, 1), window('c', 10, 1)], slots(1, 100))
    const total = [...allocation.values()].reduce((sum, list) => sum + list[0]!.capacityMinutes, 0)
    expect(total).toBe(100)
  })

  it('rotates whole slots fairly when splitting would leave courses too little time', () => {
    const five = ['a', 'b', 'c', 'd', 'e'].map(id => window(id, 60))
    const allocation = allocateSlots(five, slots(50))
    const counts = five.map(w => allocation.get(w.id)!.length)

    expect(Math.max(...counts) - Math.min(...counts)).toBeLessThanOrEqual(1)
    expect(allocation.get('a')![0]!.capacityMinutes).toBe(90)
    assertNoClashes(allocation)
  })

  it('gives the full slot to remaining courses once a plan ends', () => {
    const allocation = allocateSlots([window('short', 3), window('long', 10)], slots(10))
    expect(allocation.get('short')).toHaveLength(3)
    expect(allocation.get('long')!.at(-1)!.capacityMinutes).toBe(90)
  })

  it('gives a course more time as its exam approaches', () => {
    const soon: PlanWindow = { id: 'soon', end: day(10), weight: d => (day(10).getTime() - d.getTime() <= 3 * DAY ? 4.5 : 3) }
    const allocation = allocateSlots([soon, window('later', 20)], slots(10))
    expect(allocation.get('soon')!.at(-1)!.capacityMinutes).toBeGreaterThan(allocation.get('soon')![0]!.capacityMinutes)
  })

  it('keeps a course’s sessions inside its own window when fed to buildPlan', () => {
    const allocation = allocateSlots([window('bio', 20), window('chm', 20)], slots(20))
    const topics = ['T1', 'T2', 'T3'].map(id => topic(id, { estimatedMinutes: 60, subtopicCount: 0 }))
    const { sessions } = buildPlan(topics, allocation.get('bio')!, { planStart: START, examDate: day(20) })

    expect(sessions.every(s => s.startTime === '18:00' && s.endTime === '18:45')).toBe(true)
    expect(Math.max(...minutesPerDay(sessions))).toBeLessThanOrEqual(45)
  })
})
