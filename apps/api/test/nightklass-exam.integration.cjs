require('reflect-metadata')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { NestFactory } = require('@nestjs/core')
const { ValidationPipe, VersioningType } = require('@nestjs/common')
const { PrismaClient } = require('../../../packages/db/generated/client')
const { hash } = require('bcryptjs')
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/nightklass_exam_test') throw new Error('Use disposable database nightklass_exam_test')
process.env.JWT_SECRET = randomUUID() + randomUUID()
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID()
process.env.OPENAI_API_KEY = ''
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
const prisma = new PrismaClient()
let app, base, owner, learner, other, ownerToken, learnerToken, otherToken, material, bankQuestion, goal, practice
const suffix = randomUUID(), password = randomUUID()
async function call(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
const admin = (path, body, method) => call('/admin/nightklass/exam-content/' + path, ownerToken, body, method)
const authored = { exam: 'JAMB', subject: 'Government', topic: 'Democracy', questionText: 'Which choice describes representative democracy?', questionType: 'MCQ', options: [{ key: 'A', text: 'Citizens elect representatives' }, { key: 'B', text: 'Power is inherited' }, { key: 'C', text: 'No elections occur' }, { key: 'D', text: 'One official owns all power' }], correctAnswer: 'A', explanation: 'Citizens elect representatives who make decisions on their behalf.', marks: 1, difficulty: 'MEDIUM' }
before(async () => {
  const passwordHash = await hash(password, 12)
  async function account(name) { return prisma.user.create({ data: { name, email: `${name}-${suffix}@example.test`, passwordHash, role: 'STUDENT', status: 'ACTIVE' } }) }
  owner = await account('teacher'); learner = await account('learner'); other = await account('other')
  await prisma.nightklassAdmin.create({ data: { userId: owner.id, role: 'OWNER' } })
  const { AppModule } = require('../dist/app.module')
  app = await NestFactory.create(AppModule, { logger: false })
  app.setGlobalPrefix('api'); app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true, transformOptions: { enableImplicitConversion: true } }))
  await app.listen(0, '127.0.0.1')
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`
  for (const [user, assign] of [[owner, t => ownerToken = t], [learner, t => learnerToken = t], [other, t => otherToken = t]]) {
    const result = await call('/auth/login', null, { email: user.email, password })
    assert.equal(result.status, 200); assign(result.body.accessToken)
    await new Promise(r => setTimeout(r, 400))
  }
}, { timeout: 30000 })
after(async () => { if (app) await app.close(); await prisma.$disconnect() })

test('teacher permissions are independent of learner access', async () => {
  assert.equal((await call('/admin/nightklass/exam-content/materials', learnerToken)).status, 403)
  assert.equal((await call('/admin/nightklass/exam-content/materials')).status, 401)
})
test('secondary profile and arts goal persist without tertiary fields', async () => {
  const profile = await call('/users/me/profile', learnerToken, { studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SCHOOL_LEAVER', institutionType: 'SECONDARY_SCHOOL', country: 'Nigeria' }, 'PATCH')
  assert.equal(profile.status, 200); assert.equal(profile.body.currentLevel, null)
  const response = await call('/exam-preparation/goals', learnerToken, { exam: 'JAMB', year: 2027, subjects: ['English', 'Government', 'Literature in English', 'Economics'] }, 'PUT')
  assert.equal(response.status, 200); goal = response.body
  assert.equal(goal.subjects.length, 4)
  const repeated = await call('/exam-preparation/goals', learnerToken, { exam: 'JAMB', year: 2027, subjects: ['English Language', 'Government', 'Literature in English', 'Economics'] }, 'PUT')
  assert.equal(repeated.body.id, goal.id)
  assert.equal(await prisma.course.count({ where: { ownerId: learner.id } }), 4)
})
test('draft materials are private until teacher publication; goal ownership is enforced', async () => {
  const result = await admin('materials', { exam: 'JAMB', subject: 'Government', topic: 'Democracy', title: 'Democracy notes', body: 'Representative democracy allows citizens to elect representatives who act on their behalf.', sourceNote: 'Original teacher notes permitted for sharing' })
  assert.equal(result.status, 201); material = result.body
  const path = `/exam-preparation/goals/${goal.id}/subjects/government/materials`
  assert.deepEqual((await call(path, learnerToken)).body, [])
  assert.equal((await call(path, otherToken)).status, 404)
  assert.equal((await admin(`materials/${material.id}`, { status: 'APPROVED' }, 'PATCH')).status, 200)
  const published = await call(path, learnerToken)
  assert.equal(published.body[0].title, 'Democracy notes')
  assert.equal(published.body[0].createdById, undefined)
})
test('teacher can upload text notes through the multipart endpoint', async () => {
  const data = new FormData()
  data.set('file', new Blob(['Democracy involves elections, political participation and accountability.'], { type: 'text/plain' }), 'notes.txt')
  for (const [key, value] of Object.entries({ exam: 'WAEC', subject: 'Government', topic: 'Democracy', title: 'Uploaded teaching notes', sourceNote: 'Original material approved for sharing' })) data.set(key, value)
  const response = await fetch(base + '/admin/nightklass/exam-content/upload', { method: 'POST', headers: { Authorization: `Bearer ${ownerToken}` }, body: data })
  assert.equal(response.status, 201)
  assert.match((await response.json()).body, /accountability/)
})
test('invalid questions and injected publication state are rejected', async () => {
  assert.equal((await admin('questions', { ...authored, correctAnswer: 'Z' })).status, 400)
  assert.equal((await admin('questions', { ...authored, status: 'APPROVED' })).status, 400)
})
test('publication freezes question edits and stale reviews conflict', async () => {
  const response = await admin('questions', authored)
  assert.equal(response.status, 201); bankQuestion = response.body
  assert.equal((await admin(`questions/${bankQuestion.id}/state`, { status: 'APPROVED', expectedRevision: 1 })).status, 201)
  assert.equal((await admin(`questions/${bankQuestion.id}`, { ...authored, expectedRevision: 1 }, 'PATCH')).status, 409)
  assert.equal((await admin(`questions/${bankQuestion.id}/state`, { status: 'ARCHIVED', expectedRevision: 1 })).status, 409)
})
test('reviewed practice copies content without exposing answer keys and marks through existing feedback', async () => {
  assert.equal((await call('/exam-preparation/practice', otherToken, { goalId: goal.id, subjectKey: 'government', count: 10 })).status, 404)
  const response = await call('/exam-preparation/practice', learnerToken, { goalId: goal.id, subjectKey: 'government', count: 10 })
  assert.equal(response.status, 201); practice = response.body
  assert.equal(practice.actualCount, 1)
  assert.equal(practice.questions[0].correctAnswer, undefined)
  assert.equal(practice.questions[0].explanation, undefined)
  const result = await call(`/study/topics/${practice.topicId}/quiz/submit`, learnerToken, { answers: [{ questionId: practice.questions[0].id, selectedAnswer: 'A' }] })
  assert.equal(result.status, 201); assert.equal(result.body.scorePercent, 100)
  assert.match(result.body.results[0].explanation, /Citizens/)
})
test('archiving prevents new practice while preserving existing attempt content and audits', async () => {
  assert.equal((await admin(`questions/${bankQuestion.id}/state`, { status: 'ARCHIVED', expectedRevision: 2 })).status, 201)
  const response = await call('/exam-preparation/practice', learnerToken, { goalId: goal.id, subjectKey: 'government', count: 5 })
  assert.equal(response.status, 400)
  assert.ok(await prisma.question.findUnique({ where: { id: practice.questions[0].id } }))
  assert.ok(await prisma.nightklassAdminAudit.count({ where: { actorId: owner.id, resourceType: 'exam-content' } }) >= 4)
})
