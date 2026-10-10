import 'reflect-metadata'
import { describe, expect, it, vi } from 'vitest'
import { validate } from 'class-validator'
import { plainToInstance } from 'class-transformer'
import { NightklassAdminGuard } from './admin.guard'
import { AdminAccessDto, AdminQueryDto, AdminQuestionDto } from './admin.dto'
import { validateQuestion } from './admin.service'

const context = (user?: { id: string }) => ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) })
describe('Nightklass admin authorization', () => {
  it('rejects missing identities before looking up a grant', async () => {
    const findUnique = vi.fn()
    const guard = new NightklassAdminGuard({ nightklassAdmin: { findUnique } } as never)
    await expect(guard.canActivate(context() as never)).rejects.toThrow('administrator access required')
    expect(findUnique).not.toHaveBeenCalled()
  })
  it.each([null, { role: 'ADMIN', user: { status: 'SUSPENDED', organizationId: null } }, { role: 'OWNER', user: { status: 'ACTIVE', organizationId: 'org-1' } }])('rejects absent or invalid database grants', async grant => {
    const guard = new NightklassAdminGuard({ nightklassAdmin: { findUnique: vi.fn().mockResolvedValue(grant) } } as never)
    await expect(guard.canActivate(context({ id: 'u1' }) as never)).rejects.toThrow('administrator access required')
  })
  it('permits an active standalone account with a trusted grant', async () => {
    const guard = new NightklassAdminGuard({ nightklassAdmin: { findUnique: vi.fn().mockResolvedValue({ role: 'ADMIN', user: { status: 'ACTIVE', organizationId: null } }) } } as never)
    await expect(guard.canActivate(context({ id: 'u1' }) as never)).resolves.toBe(true)
  })
})
describe('Administrative inputs', () => {
  it('bounds pagination and rejects unknown fields', async () => {
    const invalid = plainToInstance(AdminQueryDto, { page: 0, limit: 1000, secret: 'ignored?' })
    expect((await validate(invalid, { whitelist: true, forbidNonWhitelisted: true })).length).toBe(3)
  })
  it('rejects unsupported permissions', async () => {
    expect((await validate(plainToInstance(AdminAccessDto, { role: 'SUPER_ADMIN', reason: 'Support access' }))).length).toBeGreaterThan(0)
  })
  const base = { questionText: 'Which option is correct?', questionType: 'MCQ', correctAnswer: 'A', options: [{ key: 'A', text: 'First' }, { key: 'B', text: 'Second' }] } as AdminQuestionDto
  it('accepts well-formed multiple choice', () => expect(() => validateQuestion(base)).not.toThrow())
  it.each([
    { ...base, correctAnswer: 'C' },
    { ...base, options: [{ key: 'A', text: 'First' }, { key: 'A', text: 'Second' }] },
    { ...base, questionText: '  ' },
    { ...base, questionType: 'TRUE_FALSE', correctAnswer: 'A' },
  ])('rejects inconsistent question structures', dto => expect(() => validateQuestion(dto as AdminQuestionDto)).toThrow())
})
