import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { courseExamDate } from './course-exam-date'
import { CoursesService } from './courses.service'

describe('optional course exam date', () => {
  const now = new Date('2026-10-30T12:00:00Z')
  it('allows setup without a date and preserves a future calendar date', () => {
    expect(courseExamDate(undefined, now)).toBeNull()
    expect(courseExamDate(null, now)).toBeNull()
    expect(courseExamDate('2027-06-15', now)?.toISOString()).toBe('2027-06-15T00:00:00.000Z')
  })
  it('rejects invalid or past dates and uses the Lagos calendar day', () => {
    for (const value of ['2027-02-30', '2026-10-30', '2025-01-01', '2027-06-15T10:00:00Z'])
      expect(() => courseExamDate(value, now)).toThrow()
    expect(() => courseExamDate('2026-10-31', new Date('2026-10-30T23:30:00Z'))).toThrow()
  })
  it('keeps both manually created courses in the learner’s full course list', async () => {
    const rows: Record<string, unknown>[] = []
    const prisma = {
      course: {
        create: vi.fn(async ({ data }) => {
          const row = { id: String(rows.length + 1), ...data }
          rows.push(row)
          return row
        }),
        findMany: vi.fn(async ({ where }) => rows.filter((row) => row.ownerId === where.ownerId)),
      },
    }
    const service = new CoursesService(prisma as never)
    const user = { id: 'learner', role: 'STUDENT', organizationId: null } as never
    await service.create({ title: 'Biology' }, user)
    await service.create({ title: 'Chemistry' }, user)
    expect((await service.findAll(user)).map((row) => row.title)).toEqual(['Biology', 'Chemistry'])
    expect(prisma.course.create).toHaveBeenCalledTimes(2)
    expect(prisma.course.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ownerId: 'learner' } }),
    )
  })

  it('can clear a saved date and does not block unrelated edits to an unchanged historical date', async () => {
    const update = vi.fn(async ({ data }) => data)
    const prisma = {
      course: {
        update,
        findFirst: vi.fn(async () => ({
          id: 'one',
          ownerId: 'learner',
          title: 'Biology',
          subject: 'Biology',
          targetExamDate: new Date('2020-01-01T00:00:00Z'),
        })),
      },
    }
    const service = new CoursesService(prisma as never)
    const user = { id: 'learner', role: 'STUDENT', organizationId: null } as never
    await service.update('one', { title: 'Biology I', targetExamDate: '2020-01-01' }, user)
    expect(update.mock.calls[0]?.[0].data).not.toHaveProperty('targetExamDate')
    await service.update('one', { targetExamDate: null }, user)
    expect(update).toHaveBeenLastCalledWith({
      where: { id: 'one' },
      data: { targetExamDate: null },
    })
  })
})
