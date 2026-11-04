import { afterEach, describe, expect, it, vi } from 'vitest'
import { TimetableService } from './timetable.service'
import type { TimetableDto } from './dto/timetable.dto'

const settings: TimetableDto = {
  courses: [{ courseId: 'biology' }, { courseId: 'chemistry' }],
  schedulingStyle: 'DAILY',
  weeklyHours: 8,
  dailyMinutes: 180,
  maxCoursesPerDay: 2,
  weeks: 2,
  studyDays: [1, 2, 3, 4, 5, 6],
  timeZone: 'Africa/Lagos',
  autoAdjust: true,
}
const user = { id: 'learner', organizationId: null, role: 'STUDENT' } as never

function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-08T12:00:00Z'))
  const plans: any[] = []
  const courses = settings.courses.map((c) => ({
    id: c.courseId,
    title: c.courseId,
    creditUnits: 3,
    targetExamDate: null,
  }))
  let scores: Record<string, number> = {}
  const db: any = {
    course: { findMany: vi.fn().mockResolvedValue(courses) },
    topic: {
      findMany: vi.fn(async (query: any) => [
        {
          id: `${query.where.courseId}-topic`,
          name: 'Introduction',
          estimatedMinutes: 60,
          subTopics: [],
        },
      ]),
    },
    topicMastery: {
      findMany: vi.fn(async (query: any) =>
        query.where.topicId.in
          .filter((id: string) => scores[id] !== undefined)
          .map((id: string) => ({ topicId: id, quizAverage: scores[id] })),
      ),
    },
    studySession: {
      findMany: vi.fn().mockResolvedValue([]),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      createMany: vi.fn(),
    },
    studyPlan: {
      findFirst: vi.fn(
        async (query: any) =>
          [...plans]
            .reverse()
            .find(
              (p) =>
                p.status === 'ACTIVE' &&
                (!query.where.courseId || p.courseId === query.where.courseId),
            ) ?? null,
      ),
      findMany: vi.fn(async (query: any) =>
        plans.filter(
          (p) =>
            p.status === 'ACTIVE' &&
            (!query.where.timetableId ||
              typeof query.where.timetableId !== 'string' ||
              p.timetableId === query.where.timetableId),
        ),
      ),
      count: vi.fn().mockResolvedValue(0),
      updateMany: vi.fn(async () => undefined),
      create: vi.fn(async ({ data }: any) => {
        const plan = {
          ...data,
          id: `plan-${plans.length}`,
          status: 'ACTIVE',
          createdAt: new Date(),
          updatedAt: new Date(),
          course: courses.find((c) => c.id === data.courseId),
        }
        plans.push(plan)
        return plan
      }),
      update: vi.fn(async ({ where, data }: any) =>
        Object.assign(
          plans.find((p) => p.id === where.id),
          data,
          { updatedAt: new Date() },
        ),
      ),
    },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: any) => unknown) => callback(db)),
  }
  return {
    db,
    plans,
    service: new TimetableService(db),
    setScores: (next: Record<string, number>) => {
      scores = next
    },
  }
}
afterEach(() => vi.useRealTimers())

describe('combined timetable service', () => {
  it('previews without replacing any plan and applies all selected courses together', async () => {
    const { db, plans, service } = setup()
    const preview = await service.preview(settings, user)
    expect(preview.canApply).toBe(true)
    expect(preview.courses).toHaveLength(2)
    expect(db.studyPlan.create).not.toHaveBeenCalled()
    expect(db.studyPlan.updateMany).not.toHaveBeenCalled()
    const saved = await service.apply(settings, user)
    expect(saved!.courses).toHaveLength(2)
    expect(plans[0].timetableId).toBe(plans[1].timetableId)
    expect(plans.every((p) => p.schedulingPreferences.timetable.maxCoursesPerDay === 2)).toBe(true)
    expect(
      plans
        .flatMap((p) => p.sessions.create)
        .every((s) => s.startTime === null && s.endTime === null),
    ).toBe(true)
    expect(db.$transaction).toHaveBeenCalledOnce()
  })

  it('rejects an impossible replacement before abandoning current plans', async () => {
    const { db, service } = setup()
    const restricted = { ...settings, dailyMinutes: 30, studyDays: [1] }
    expect((await service.preview(restricted, user)).canApply).toBe(false)
    await expect(service.apply(restricted, user)).rejects.toThrow('could not fit')
    expect(db.studyPlan.updateMany).not.toHaveBeenCalled()
    expect(db.studyPlan.create).not.toHaveBeenCalled()
  })

  it('carries today’s existing tasks into replacement plans without resetting completion', async () => {
    const { db, plans, service } = setup()
    plans.push({ id: 'old-biology-plan', courseId: 'biology', status: 'ACTIVE' })
    await service.apply(settings, user)
    const transfer = db.studySession.updateMany.mock.calls.find(
      ([query]: any) => query.where.courseId === 'biology',
    )[0]
    expect(transfer.where).toMatchObject({
      studyPlanId: { in: ['old-biology-plan'] },
      scheduledDate: { gte: new Date('2026-11-08'), lt: new Date('2026-11-09') },
      status: { in: ['NOT_STARTED', 'IN_PROGRESS', 'COMPLETED'] },
    })
    expect(transfer.data).toEqual({ studyPlanId: 'plan-1' })
  })

  it('keeps course-level study blocks when an outline has not been added yet', async () => {
    const { db, service } = setup()
    db.topic.findMany.mockResolvedValue([])
    const preview = await service.preview(settings, user)
    expect(preview.canApply).toBe(true)
    expect(preview.warnings.join(' ')).toContain('no outline yet')
    expect(preview.days.length).toBeGreaterThan(0)
  })

  it('rejects inaccessible courses and invalid timed windows', async () => {
    const { db, service } = setup()
    await expect(
      service.preview(
        { ...settings, schedulingStyle: 'TIMED', startTime: '21:00', endTime: '18:00' },
        user,
      ),
    ).rejects.toThrow('study window')
    db.course.findMany.mockResolvedValue([])
    await expect(service.preview(settings, user)).rejects.toThrow('unavailable')
  })

  it('automatically shifts future effort toward weaker courses without changing saved limits', async () => {
    const { db, plans, service, setScores } = setup()
    await service.apply(settings, user)
    const before = plans.find((p) => p.courseId === 'biology').weeklyMinutes
    setScores({ 'biology-topic': 20, 'chemistry-topic': 90 })
    expect(await service.afterStudy('biology', user, 'Quiz performance updated')).toBe(true)
    expect(plans.find((p) => p.courseId === 'biology').weeklyMinutes).toBeGreaterThan(before)
    expect(plans.every((p) => p.schedulingPreferences.timetable.weeklyHours === 8)).toBe(true)
    expect(
      db.studySession.deleteMany.mock.calls.every(
        ([query]: any) => query.where.status === 'NOT_STARTED',
      ),
    ).toBe(true)
    expect(plans[0].changeLog.at(-1).reason).toContain('Quiz performance updated')
  })

  it('honours automatic-adjustment opt-out and reviews at most once on a new study day', async () => {
    const { db, service } = setup()
    await service.apply({ ...settings, autoAdjust: false }, user)
    expect(await service.afterStudy('biology', user, 'Quiz')).toBe(false)
    expect(db.studySession.deleteMany).not.toHaveBeenCalled()
    for (const plan of await db.studyPlan.findMany({ where: {} }))
      plan.schedulingPreferences.timetable.autoAdjust = true
    await service.refreshDue(user)
    expect(db.studySession.deleteMany).not.toHaveBeenCalled()
    vi.setSystemTime(new Date('2026-11-09T12:00:00Z'))
    await service.refreshDue(user)
    const calls = db.studySession.deleteMany.mock.calls.length
    expect(calls).toBeGreaterThan(0)
    await service.refreshDue(user)
    expect(db.studySession.deleteMany.mock.calls).toHaveLength(calls)
  })
})
