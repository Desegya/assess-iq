import 'reflect-metadata'
import { describe, it, expect, vi } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { UserRole } from '@assessiq/types'
import { normalizeSubjects } from './exam-goal.rules'
import { SaveExamGoalDto } from './exam-goal.dto'
import { UpdateProfileDto } from '../users/dto/update-profile.dto'
import { ExamPreparationService } from './exam-preparation.service'
import { UsersService } from '../users/users.service'
import { describeCourse } from '../courses/describe-course'

const learner = { id: 'learner', organizationId: null, role: UserRole.STUDENT, email: 'learner@example.test' }
const options = { whitelist: true, forbidNonWhitelisted: true }

describe('Secondary learner profiles', () => {
  it('accepts a school leaver without university level, department or semester', async () => {
    const dto = plainToInstance(UpdateProfileDto, { studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SCHOOL_LEAVER', institutionType: 'SECONDARY_SCHOOL', country: 'Nigeria' })
    expect(await validate(dto, options)).toHaveLength(0)
  })
  it('requires a secondary stage and continues requiring tertiary fields on legacy requests', async () => {
    const secondary = plainToInstance(UpdateProfileDto, { studyPathway: 'EXAM_PREPARATION', country: 'Nigeria', institutionType: 'SECONDARY_SCHOOL' })
    expect((await validate(secondary, options)).map(e => e.property)).toContain('secondaryStage')
    const legacy = plainToInstance(UpdateProfileDto, { country: 'Nigeria', institutionType: 'UNIVERSITY' })
    expect((await validate(legacy, options)).map(e => e.property)).toEqual(expect.arrayContaining(['programme', 'currentLevel', 'currentSemester']))
  })
  it('preserves tertiary academic data when selecting exam preparation', async () => {
    const update = vi.fn().mockResolvedValue({})
    const service = new UsersService({ user: { findUniqueOrThrow: vi.fn().mockResolvedValue({ profileCompletedAt: new Date(), institutionType: 'UNIVERSITY' }), update } } as never)
    await service.updateProfile({ studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SS3', country: 'Nigeria', institutionType: 'SECONDARY_SCHOOL' } as never, learner)
    const data = update.mock.calls[0]![0].data
    expect(data).not.toHaveProperty('programme')
    expect(data).not.toHaveProperty('currentLevel')
    expect(data).not.toHaveProperty('institution')
    expect(data.institutionType).toBe('UNIVERSITY')
  })
})

describe('Exam goals and subject identity', () => {
  it('accepts arts and commercial combinations, not just science', () => {
    expect(normalizeSubjects('JAMB', ['Use of English', 'Government', 'Literature in English', 'Economics'])).toHaveLength(4)
    expect(normalizeSubjects('JAMB', ['English', 'Commerce', 'Financial Accounting', 'Mathematics'])).toHaveLength(4)
    expect(normalizeSubjects('WAEC', [' French ', 'Hausa', 'Music']).map(s => s.name)).toEqual(['French', 'Hausa', 'Music'])
  })
  it('normalizes aliases to reuse shared learning and rejects duplicate subjects', () => {
    expect(normalizeSubjects('WAEC', ['English Language', 'General Mathematics']).map(s => s.key)).toEqual(['english', 'mathematics'])
    expect(() => normalizeSubjects('WAEC', ['Use of English', 'English'])).toThrow('only once')
    expect(() => normalizeSubjects('WAEC', ['  '])).toThrow('subject name')
  })
  it('rejects incomplete JAMB combinations and missing English', () => {
    expect(() => normalizeSubjects('JAMB', ['English', 'Government'])).toThrow('three other subjects')
    expect(() => normalizeSubjects('JAMB', ['Biology', 'Physics', 'Chemistry', 'Mathematics'])).toThrow('Use of English')
  })
  it('validates bounded input and rejects injected ownership', async () => {
    const dto = plainToInstance(SaveExamGoalDto, { exam: 'OTHER', year: 2025, subjects: Array(21).fill('Biology'), studentId: 'another-user' })
    expect((await validate(dto, options)).map(e => e.property)).toEqual(expect.arrayContaining(['exam', 'year', 'subjects', 'studentId']))
  })
  it('rejects institutional accounts before any database access', async () => {
    const prisma = { examGoal: { findMany: vi.fn() } }
    const service = new ExamPreparationService(prisma as never)
    expect(() => service.list({ ...learner, organizationId: 'institution' })).toThrow('standalone')
    expect(prisma.examGoal.findMany).not.toHaveBeenCalled()
  })
  it('scopes listing to the authenticated learner', () => {
    const findMany = vi.fn().mockResolvedValue([])
    new ExamPreparationService({ examGoal: { findMany } } as never).list(learner)
    expect(findMany.mock.calls[0]![0].where).toEqual({ studentId: learner.id })
  })
  it('reuses courses by owner/subject and updates only the current goal inside a transaction', async () => {
    const tx = {
      examGoal: { upsert: vi.fn().mockResolvedValue({ id: 'goal-1' }), findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 'goal-1' }) },
      course: { upsert: vi.fn().mockResolvedValue({ id: 'course-1' }) },
      examGoalSubject: { deleteMany: vi.fn(), createMany: vi.fn() },
    }
    const transaction = vi.fn(async (callback: (value: typeof tx) => unknown) => callback(tx))
    await new ExamPreparationService({ $transaction: transaction } as never).save({ exam: 'WAEC', year: 2027, subjects: ['English', 'Government'] } as never, learner)
    expect(tx.course.upsert.mock.calls[0]![0].where).toEqual({ ownerId_examSubjectKey: { ownerId: 'learner', examSubjectKey: 'english' } })
    expect(tx.examGoalSubject.deleteMany).toHaveBeenCalledWith({ where: { goalId: 'goal-1' } })
    expect(transaction.mock.calls[0]![1]).toEqual({ isolationLevel: 'Serializable' })
  })
  it('returns retryable conflicts instead of silently accepting concurrent overwrites', async () => {
    const service = new ExamPreparationService({ $transaction: vi.fn().mockRejectedValue({ code: 'P2034' }) } as never)
    await expect(service.save({ exam: 'WAEC', year: 2027, subjects: ['History'] } as never, learner)).rejects.toThrow('save again')
  })
  it('provides secondary context to the learning engine while preserving tertiary descriptions', () => {
    expect(describeCourse({ title: 'Government', subject: 'Government', examSubjectKey: 'government' })).toContain('senior secondary')
    expect(describeCourse({ title: 'Biochemistry', subject: 'Biochemistry', level: 200 })).toContain('university course')
  })
})
