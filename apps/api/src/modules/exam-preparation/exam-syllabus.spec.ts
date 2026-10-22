import 'reflect-metadata'
import { describe, it, expect } from 'vitest'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { ExamSyllabusDto } from './exam-syllabus.dto'
const fields = {
  exam: 'JAMB',
  year: 2027,
  subject: 'Government',
  version: 1,
  title: 'Government learning objectives',
  provenance: 'CURATED',
  sourceNote: 'Original reviewed teaching objectives.',
  expectedRevision: 0,
  objectives: [{ code: 'GOV1', title: 'Democracy', description: 'Explain democratic government.' }],
}
describe('Syllabus authoring inputs', () => {
  it('accepts structured curated objectives', async () => {
    expect(
      await validate(plainToInstance(ExamSyllabusDto, fields), {
        whitelist: true,
        forbidNonWhitelisted: true,
      }),
    ).toHaveLength(0)
  })
  it('rejects unsafe source links, excessive objectives and injected reviewer identity', async () => {
    const dto = plainToInstance(ExamSyllabusDto, {
      ...fields,
      sourceUrl: 'javascript:alert(1)',
      objectives: Array(301).fill(fields.objectives[0]),
      reviewedById: 'forged',
    })
    expect(
      (await validate(dto, { whitelist: true, forbidNonWhitelisted: true })).map((e) => e.property),
    ).toEqual(expect.arrayContaining(['sourceUrl', 'objectives', 'reviewedById']))
  })
})
