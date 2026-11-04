import { afterEach, describe, expect, it, vi } from 'vitest'
import { StudyService } from './study.service'

function setup() {
  vi.useFakeTimers()
  vi.setSystemTime(new Date('2026-11-01T12:00:00Z'))
  const db = {
    topic: {
      count: vi.fn().mockResolvedValue(1),
      findMany: vi
        .fn()
        .mockResolvedValue([{ id: 'topic', name: 'Cells', estimatedMinutes: 45, subTopics: [] }]),
    },
    topicMastery: { findMany: vi.fn().mockResolvedValue([]) },
    studySession: { findMany: vi.fn().mockResolvedValue([]) },
    studyAvailability: {
      findMany: vi.fn(() => {
        throw new Error('Budget plans should not require shared availability')
      }),
    },
    studyPlan: {
      count: vi.fn().mockResolvedValue(1),
      updateMany: vi.fn(),
      create: vi.fn(),
      findFirst: vi.fn().mockResolvedValue({ id: 'new-plan', sessions: [] }),
    },
    outlineRevision: { findFirst: vi.fn().mockResolvedValue(null) },
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (callback: (tx: unknown) => unknown) => callback(db)),
  }
  const service = new StudyService(
    db as never,
    {} as never,
    { findOne: vi.fn().mockResolvedValue({ title: 'Biology' }) } as never,
    {} as never,
    {} as never,
    {} as never,
  )
  return { db, service, user: { id: 'student' } as never }
}

afterEach(() => vi.useRealTimers())

describe('weekly budget plan generation', () => {
  it('saves day-by-day tasks with no clock times and defaults to a modest weekly workload', async () => {
    const { db, service, user } = setup()
    await service.generatePlan(
      { courseId: 'biology', weeks: 1, schedulingStyle: 'DAILY', studyDays: [1, 3, 5] },
      user,
    )
    const data = db.studyPlan.create.mock.calls[0]![0].data
    expect(data.weeklyMinutes).toBe(180)
    expect(data.schedulingPreferences).toMatchObject({
      schedulingStyle: 'DAILY',
      studyDays: [1, 3, 5],
    })
    expect(
      data.sessions.create.every(
        (s: { startTime: string | null; endTime: string | null }) =>
          s.startTime === null && s.endTime === null,
      ),
    ).toBe(true)
    expect(
      data.sessions.create.reduce(
        (sum: number, s: { estimatedMinutes: number }) => sum + s.estimatedMinutes,
        0,
      ),
    ).toBe(180)
    expect(db.studyAvailability.findMany).not.toHaveBeenCalled()
  })

  it('uses the learner calendar date for Today and keeps unfinished earlier tasks separate', async () => {
    const { db, service, user } = setup()
    vi.setSystemTime(new Date('2026-11-01T23:30:00Z'))
    await service.getTodaySessions(user, 'Africa/Lagos')
    expect(db.studySession.findMany.mock.calls[0]![0].where).toMatchObject({
      studentId: 'student',
      studyPlan: { status: 'ACTIVE' },
      scheduledDate: { gte: new Date('2026-11-02'), lt: new Date('2026-11-03') },
    })
    await service.getOverdueSessions(user, 'Africa/Lagos')
    expect(db.studySession.findMany.mock.calls[1]![0].where).toMatchObject({
      studentId: 'student',
      scheduledDate: { lt: new Date('2026-11-02') },
      status: { in: ['NOT_STARTED', 'IN_PROGRESS'] },
    })
  })

  it('persists course-specific preferences and regular study time without changing shared availability', async () => {
    const { db, service, user } = setup()
    await service.generatePlan(
      {
        courseId: 'biology',
        weeks: 2,
        weeklyHours: 4,
        studyPreference: 'EVENINGS',
        timeZone: 'Africa/Lagos',
      },
      user,
    )
    const data = db.studyPlan.create.mock.calls[0]![0].data
    expect(data).toMatchObject({
      weeklyMinutes: 240,
      version: 2,
      startDate: new Date('2026-11-02'),
      examDate: new Date('2026-11-16'),
      schedulingPreferences: {
        studyPreference: 'EVENINGS',
        avoidWorkHours: true,
        timeZone: 'Africa/Lagos',
      },
    })
    expect(
      data.sessions.create.reduce(
        (sum: number, s: { estimatedMinutes: number }) => sum + s.estimatedMinutes,
        0,
      ),
    ).toBe(480)
    expect(db.studyAvailability.findMany).not.toHaveBeenCalled()
    expect(db.$queryRaw).toHaveBeenCalledOnce()
  })

  it('keeps the previous plan when the requested hours cannot fit', async () => {
    const { db, service, user } = setup()
    await expect(
      service.generatePlan(
        { courseId: 'biology', weeks: 2, weeklyHours: 5, studyPreference: 'WEEKENDS' },
        user,
      ),
    ).rejects.toThrow('does not fit')
    expect(db.studyPlan.updateMany).not.toHaveBeenCalled()
    expect(db.studyPlan.create).not.toHaveBeenCalled()
  })

  it('rejects reversed work hours before writing a plan', async () => {
    const { db, service, user } = setup()
    await expect(
      service.generatePlan(
        { courseId: 'biology', weeks: 2, weeklyHours: 4, workStart: '17:00', workEnd: '09:00' },
        user,
      ),
    ).rejects.toThrow('Work end time')
    expect(db.studyPlan.create).not.toHaveBeenCalled()
  })

  it('uses the student timezone when choosing tomorrow', async () => {
    const { db, service, user } = setup()
    vi.setSystemTime(new Date('2026-11-01T23:30:00Z')) // already Monday in Lagos
    await service.generatePlan(
      { courseId: 'biology', weeks: 1, weeklyHours: 4, timeZone: 'Africa/Lagos' },
      user,
    )
    expect(db.studyPlan.create.mock.calls[0]![0].data.startDate).toEqual(new Date('2026-11-03'))
  })

  it.each(['TIMED', 'DAILY'] as const)(
    'retains the %s weekly budget and completed time when adapting around another course',
    async (schedulingStyle) => {
      const { db, service, user } = setup()
      vi.setSystemTime(new Date('2026-11-04T12:00:00Z'))
      const plan = {
        id: 'plan',
        studentId: 'student',
        courseId: 'biology',
        status: 'ACTIVE',
        startDate: new Date('2026-11-02'),
        examDate: new Date('2026-11-09'),
        weeklyMinutes: 240,
        schedulingPreferences: {
          schedulingStyle,
          studyPreference: 'EVENINGS',
          avoidWorkHours: true,
          workStart: '09:00',
          workEnd: '17:00',
        },
        changeLog: [],
      }
      const findUnique = vi.fn().mockResolvedValue(plan)
      const createMany = vi.fn()
      const update = vi.fn()
      Object.assign(db.studyPlan, { findUnique, update })
      Object.assign(db.studySession, { createMany, updateMany: vi.fn(), deleteMany: vi.fn() })
      db.studySession.findMany.mockImplementation(async (query?: unknown) =>
        query && JSON.stringify(query).includes('startTime')
          ? [
              {
                courseId: 'biology',
                scheduledDate: new Date('2026-11-02'),
                startTime: '18:00',
                endTime: '19:00',
              },
              {
                courseId: 'chemistry',
                scheduledDate: new Date('2026-11-05'),
                startTime: '18:00',
                endTime: '19:00',
              },
            ]
          : [],
      )
      await service.adaptPlan('plan', user)
      const sessions = createMany.mock.calls[0]![0].data
      expect(
        sessions.reduce(
          (sum: number, s: { estimatedMinutes: number }) => sum + s.estimatedMinutes,
          0,
        ),
      ).toBe(180)
      expect(
        sessions.every((s: { scheduledDate: Date }) => s.scheduledDate >= new Date('2026-11-05')),
      ).toBe(true)
      const thursday = sessions.filter(
        (s: { scheduledDate: Date }) => +s.scheduledDate === +new Date('2026-11-05'),
      )
      if (schedulingStyle === 'TIMED')
        expect(thursday.every((s: { startTime: string }) => s.startTime >= '19:15')).toBe(true)
      else
        expect(
          sessions.every(
            (s: { startTime: string | null; endTime: string | null }) =>
              s.startTime === null && s.endTime === null,
          ),
        ).toBe(true)
      expect(db.studyAvailability.findMany).not.toHaveBeenCalled()
      expect(update.mock.calls[0]![0].data.weeklyMinutes).toBeUndefined()
    },
  )
})
