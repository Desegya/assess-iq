// Launch-readiness security and reliability checks against a real API and PostgreSQL.
// Requires the disposable nightklass_exam_test database (migrated). Never run against production.
require('reflect-metadata')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID, createHash } = require('node:crypto')
const { NestFactory } = require('@nestjs/core')
const { PrismaClient } = require('../../../packages/db/generated/client')
const { hash } = require('bcryptjs')
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/nightklass_exam_test') throw new Error('Use disposable database nightklass_exam_test')
process.env.JWT_SECRET = randomUUID() + randomUUID()
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID()
process.env.OPENAI_API_KEY = 'test-only-not-a-real-key'
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
process.env.EXAM_ACCESS = 'OPEN'
process.env.PASSWORD_RESET_URL = 'https://nightklass.test/reset-password'
const prisma = new PrismaClient()
const suffix = randomUUID().slice(0, 8), password = randomUUID()
const sent = []
let app, base, owner, ownerToken
const YEAR = 2097
// Keys follow subjectIdentity(): trimmed, lower-cased names.
const subjects = [['english', 'English Language'], [`physics ${suffix}`, `Physics ${suffix}`], [`chemistry ${suffix}`, `Chemistry ${suffix}`], [`biology ${suffix}`, `Biology ${suffix}`]]

async function call(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  const text = await response.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: response.status, body: parsed }
}
const sleep = ms => new Promise(r => setTimeout(r, ms))
async function account(name, extra = {}) {
  return prisma.user.create({ data: { name, email: `${name}-${suffix}@example.test`, passwordHash: await hash(password, 4), role: 'STUDENT', status: 'ACTIVE', ...extra } })
}
async function login(user, pw = password) {
  // Stay under the real 10-per-second anonymous burst limit instead of loosening it for tests.
  await sleep(120)
  const r = await call('/auth/login', null, { email: user.email, password: pw })
  assert.equal(r.status, 200, JSON.stringify(r.body))
  return r.body
}
const setting = (key, value) => call('/admin/nightklass/operations/settings', ownerToken, { key, value }, 'PUT')

before(async () => {
  owner = await account('owner')
  await prisma.nightklassAdmin.create({ data: { userId: owner.id, role: 'OWNER' } })
  const { AppModule } = require('../dist/app.module')
  app = await NestFactory.create(AppModule, { logger: false })
  require('../dist/configure-app').configureApp(app)
  app.get(require('../dist/modules/email/email.service').EmailService).deliver = async message => { sent.push(message) }
  await app.listen(0, '127.0.0.1')
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`
  ownerToken = (await login(owner)).accessToken
  // JAMB fixture: a template for an unused year and enough reviewed questions per subject.
  await prisma.examMockTemplate.upsert({
    where: { year: YEAR },
    create: { year: YEAR, title: 'Security fixture mock', durationMinutes: 60, englishCount: 3, otherCount: 3, instructions: 'Isolated integration fixture; not a real exam specification.', sourceNote: 'Integration fixture only.', status: 'APPROVED' },
    update: { status: 'APPROVED', englishCount: 3, otherCount: 3, durationMinutes: 60 },
  })
  for (const [key, name] of subjects)
    for (let i = 0; i < 6; i++) {
      const text = `Security fixture ${suffix} ${key} ${i}: which option is correct?`
      await prisma.examBankQuestion.create({ data: { exam: 'JAMB', subject: name, subjectKey: key, topic: 'Fixture topic', questionText: text, questionType: 'MCQ', options: [{ key: 'A', text: `Right ${i}` }, { key: 'B', text: `Wrong ${i}a` }, { key: 'C', text: `Wrong ${i}b` }, { key: 'D', text: `Wrong ${i}c` }], correctAnswer: 'A', explanation: 'Fixture explanation.', marks: 1, difficulty: 'MEDIUM', status: 'APPROVED', createdById: owner.id, fingerprint: createHash('sha256').update(text + randomUUID()).digest('hex') } })
    }
}, { timeout: 60000 })
after(async () => {
  await prisma.runtimeSetting.deleteMany({})
  if (app) await app.close()
  await prisma.$disconnect()
})

test('health endpoints answer without authentication or diagnostics', async () => {
  const origin = new URL(base).origin
  const live = await fetch(origin + '/health'); assert.equal(live.status, 200); assert.deepEqual(await live.json(), { status: 'ok' })
  const ready = await fetch(origin + '/health/ready'); assert.equal(ready.status, 200); assert.deepEqual(await ready.json(), { status: 'ready' })
  assert.equal(live.headers.get('x-content-type-options'), 'nosniff')
  assert.match(live.headers.get('content-security-policy'), /default-src 'none'/)
})

test('learners sharing one network address keep independent rate-limit budgets', async () => {
  const learners = await Promise.all([1, 2, 3, 4, 5].map(i => account(`shared-ip-${i}`)))
  const tokens = []
  for (const l of learners) tokens.push((await login(l)).accessToken)
  // 300 requests from one address: the previous per-address limit was 100 per minute.
  const statuses = []
  for (let second = 0; second < 5; second++) {
    statuses.push(...await Promise.all(tokens.flatMap(t => Array.from({ length: 12 }, () => call('/exam-preparation/mocks', t).then(r => r.status)))))
    await sleep(1000)
  }
  assert.equal(statuses.length, 300)
  assert.deepEqual([...new Set(statuses)], [200])
})

test('anonymous credential endpoints are throttled with a readable message', async () => {
  const statuses = []
  for (let i = 0; i < 12; i++) {
    const r = await call('/auth/register', null, {})
    statuses.push(r.status)
    if (r.status === 429) assert.match(r.body.message, /Too many requests/)
    await sleep(120)
  }
  assert.deepEqual(statuses.slice(0, 10), Array(10).fill(400))
  assert.ok(statuses.slice(10).every(s => s === 429), statuses.join(','))
})

test('repeated wrong passwords lock only the targeted account, not the network', async () => {
  const victim = await account('lockout-victim'), bystander = await account('lockout-bystander')
  for (let i = 0; i < 10; i++) {
    assert.equal((await call('/auth/login', null, { email: victim.email, password: 'wrong-password' })).status, 401)
    await sleep(110)
  }
  const locked = await call('/auth/login', null, { email: victim.email, password })
  assert.equal(locked.status, 429); assert.match(locked.body.message, /reset your password/)
  await login(bystander)
  // Unknown accounts behave the same way, so lockout does not reveal registration.
  assert.equal((await call('/auth/login', null, { email: `nobody-${suffix}@example.test`, password: 'x'.repeat(8) })).status, 401)
})

test('refresh tokens are hashed, rotate within a family and reuse revokes the family', async () => {
  const user = await account('refresh')
  const first = await login(user)
  const stored = await prisma.refreshToken.findMany({ where: { userId: user.id } })
  assert.equal(stored.length, 1); assert.notEqual(stored[0].token, first.refreshToken)
  assert.equal(stored[0].token, createHash('sha256').update(first.refreshToken).digest('hex'))
  const second = (await call('/auth/refresh', null, { refreshToken: first.refreshToken })).body
  assert.ok(second.refreshToken)
  // Two tabs refreshing together: a just-rotated token is still honoured briefly.
  assert.equal((await call('/auth/refresh', null, { refreshToken: first.refreshToken })).status, 200)
  // Replayed after the grace window: treated as theft and the whole family ends.
  await prisma.refreshToken.updateMany({ where: { userId: user.id, rotatedAt: { not: null } }, data: { rotatedAt: new Date(Date.now() - 60000) } })
  assert.equal((await call('/auth/refresh', null, { refreshToken: first.refreshToken })).status, 401)
  assert.equal((await call('/auth/refresh', null, { refreshToken: second.refreshToken })).status, 401)
  assert.equal(await prisma.refreshToken.count({ where: { userId: user.id, isRevoked: false } }), 0)
})

test('logout revokes the session family', async () => {
  const user = await account('logout')
  const session = await login(user)
  assert.equal((await call('/auth/logout', session.accessToken, { refreshToken: session.refreshToken })).status, 200)
  assert.equal((await call('/auth/refresh', null, { refreshToken: session.refreshToken })).status, 401)
})

test('password reset is single-use, expires, revokes sessions and never reveals accounts', async () => {
  const user = await account('reset')
  const session = await login(user)
  const unknown = await call('/auth/forgot-password', null, { email: `missing-${suffix}@example.test` })
  const known = await call('/auth/forgot-password', null, { email: user.email.toUpperCase() })
  assert.equal(unknown.status, 200); assert.deepEqual(unknown.body, known.body)
  const mail = sent.filter(m => m.to === user.email && /Reset/.test(m.subject))
  assert.equal(mail.length, 1)
  assert.ok(!sent.some(m => m.to.startsWith('missing-')))
  const link = new URL(mail[0].text.match(/https:\S+/)[0])
  assert.equal(link.pathname, '/reset-password')
  const token = decodeURIComponent(link.hash.replace('#token=', ''))
  assert.equal((await prisma.emailToken.findFirst({ where: { userId: user.id, purpose: 'PASSWORD_RESET' } })).tokenHash, createHash('sha256').update(token).digest('hex'))
  const newPassword = randomUUID()
  assert.equal((await call('/auth/reset-password', null, { token, password: newPassword })).status, 200)
  assert.equal((await call('/auth/reset-password', null, { token, password: randomUUID() })).status, 400)
  // Existing access and refresh tokens stop working immediately.
  assert.equal((await call('/auth/me', session.accessToken)).status, 401)
  assert.equal((await call('/auth/refresh', null, { refreshToken: session.refreshToken })).status, 401)
  assert.equal((await call('/auth/login', null, { email: user.email, password })).status, 401)
  await login(user, newPassword)
  // Expired links are rejected.
  await call('/auth/forgot-password', null, { email: user.email })
  const latest = sent.filter(m => m.to === user.email && /Reset/.test(m.subject)).at(-1)
  const expiredToken = decodeURIComponent(new URL(latest.text.match(/https:\S+/)[0]).hash.replace('#token=', ''))
  await prisma.emailToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } })
  assert.equal((await call('/auth/reset-password', null, { token: expiredToken, password: randomUUID() })).status, 400)
})

test('registration sends a verification link that verifies the address once', async () => {
  const email = `verify-${suffix}@example.test`
  const created = await call('/auth/register-student', null, { name: 'Verify Learner', email, password })
  assert.equal(created.status, 201)
  const mail = sent.find(m => m.to === email && /Confirm/.test(m.subject))
  const token = decodeURIComponent(new URL(mail.text.match(/https:\S+/)[0]).hash.replace('#token=', ''))
  assert.equal((await call('/auth/verify-email', null, { token })).status, 200)
  assert.equal((await call('/auth/verify-email', null, { token })).status, 400)
  assert.ok((await prisma.user.findUnique({ where: { email } })).emailVerifiedAt)
})

test('AI quotas hold under concurrent requests, survive restarts and honour the kill switch', async () => {
  const { AiService } = require('../dist/modules/ai/ai.service')
  const { LLM_PROVIDER } = require('../dist/modules/ai/providers/llm-provider')
  const provider = app.get(LLM_PROVIDER)
  const original = { complete: provider.complete, estimate: provider.estimateCostUsd }
  let providerCalls = 0
  provider.estimateCostUsd = () => 0.004
  provider.complete = async () => { providerCalls++; await sleep(150); return { text: 'Answer', model: 'fixture', inputTokens: 100, outputTokens: 100, costUsd: 0.004 } }
  try {
    const user = await account('quota')
    assert.equal((await setting('ai.userDailyBudgetUsd', 0.01)).status, 200)
    const ai = app.get(AiService)
    const results = await Promise.allSettled(Array.from({ length: 8 }, () => ai.chat([{ role: 'user', content: 'Explain osmosis' }], 'context', { userId: user.id, relatedEntityId: 'quota-test' })))
    assert.equal(results.filter(r => r.status === 'fulfilled').length, 2)
    assert.ok(results.filter(r => r.status === 'rejected').every(r => r.reason.getStatus() === 429))
    assert.equal(providerCalls, 2)
    const logs = await prisma.aIUsageLog.findMany({ where: { userId: user.id } })
    assert.equal(logs.length, 2); assert.ok(logs.every(l => !l.pending && l.costUsd === 0.004 && l.model === 'fixture'))
    // Accounting lives in the database, so a fresh service instance (a restart) sees the same spend.
    const { AiQuotaService } = require('../dist/modules/ai/ai-quota.service')
    const restarted = new AiQuotaService(app.get(require('../dist/modules/prisma/prisma.service').PrismaService), app.get(require('../dist/modules/operations/runtime-settings.service').RuntimeSettingsService))
    await assert.rejects(restarted.reserve({ userId: user.id, action: 'ANSWER_QUESTION', estimateUsd: 0.004 }), e => e.getStatus() === 429)
    // A provider failure is recorded and does not consume the measured budget.
    const other = await account('quota-failure')
    provider.complete = async () => { providerCalls++; throw new Error('fixture outage') }
    await assert.rejects(ai.chat([{ role: 'user', content: 'x' }], 'c', { userId: other.id, relatedEntityId: 'q' }), /fixture outage/)
    const failed = await prisma.aIUsageLog.findFirst({ where: { userId: other.id } })
    assert.equal(failed.success, false); assert.equal(failed.pending, false)
    // Kill switch: no provider call is made, for anyone.
    provider.complete = async () => { providerCalls++; return { text: 'x', model: 'fixture', inputTokens: 1, outputTokens: 1, costUsd: 0 } }
    const before = providerCalls
    assert.equal((await setting('ai.paused', true)).status, 200)
    await assert.rejects(ai.chat([{ role: 'user', content: 'x' }], 'c', { userId: owner.id, relatedEntityId: 'q' }), e => e.getStatus() === 503)
    assert.equal(providerCalls, before)
    // Only owners may change switches, and every change is audited.
    const admin = await account('plain-admin'); await prisma.nightklassAdmin.create({ data: { userId: admin.id, role: 'ADMIN' } })
    assert.equal((await call('/admin/nightklass/operations/settings', (await login(admin)).accessToken, { key: 'ai.paused', value: false }, 'PUT')).status, 403)
    assert.ok(await prisma.nightklassAdminAudit.findFirst({ where: { actorId: owner.id, action: 'runtime-setting.ai.paused' } }))
    const usage = await call('/admin/nightklass/operations/ai-usage', ownerToken)
    assert.equal(usage.status, 200); assert.ok(usage.body.requests >= 3)
  } finally {
    Object.assign(provider, { complete: original.complete, estimateCostUsd: original.estimate })
    await setting('ai.paused', null); await setting('ai.userDailyBudgetUsd', null)
  }
})

async function jambLearner(name) {
  const user = await account(name, { studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SS3' })
  const token = (await login(user)).accessToken
  const goal = await call('/exam-preparation/goals', token, { exam: 'JAMB', year: YEAR, subjects: subjects.map(s => s[1]) }, 'PUT')
  assert.equal(goal.status, 200, JSON.stringify(goal.body))
  return { user, token, goal: goal.body }
}

test('the exam area is limited to the invited cohort when configured, server-side', async () => {
  const { user, token } = await jambLearner('cohort')
  assert.equal((await setting('exam.access', 'COHORT')).status, 200)
  try {
    const status = await call('/exam-preparation/access', token)
    assert.equal(status.status, 200); assert.equal(status.body.available, false)
    for (const path of ['/exam-preparation/goals', '/exam-preparation/mocks', `/exam-preparation/goals/${randomUUID()}/calendar`])
      assert.equal((await call(path, token)).status, 403, path)
    assert.equal((await call('/admin/nightklass/operations/exam-cohort', ownerToken, { email: user.email })).status, 201)
    assert.equal((await call('/exam-preparation/goals', token)).status, 200)
    assert.equal((await call('/exam-preparation/access', token)).body.available, true)
  } finally { await setting('exam.access', null) }
})

test('concurrent learners take mocks independently; saves chain, submits are idempotent', async () => {
  const learners = await Promise.all([1, 2, 3, 4, 5, 6].map(i => jambLearner(`concurrent-${i}`)))
  const attempts = await Promise.all(learners.map(l => call('/exam-preparation/mocks', l.token, { goalId: l.goal.id, requestKey: randomUUID() })))
  assert.ok(attempts.every(a => a.status === 201), JSON.stringify(attempts.map(a => a.body.message)))
  // Distinct forms: six learners do not all receive the identical question order.
  assert.ok(new Set(attempts.map(a => a.body.questions.map(q => q.id).join())).size > 1)
  await Promise.all(learners.map(async (l, i) => {
    const attempt = attempts[i].body
    let version = attempt.version
    for (const q of attempt.questions) {
      const r = await call(`/exam-preparation/mocks/${attempt.id}/answers`, l.token, { expectedVersion: version, answers: [{ questionId: q.id, answer: 'A' }], flags: [] }, 'PATCH')
      assert.equal(r.status, 200); version = r.body.version
    }
    // A stale save (e.g. a delayed retry) is rejected instead of overwriting newer answers.
    const stale = await call(`/exam-preparation/mocks/${attempt.id}/answers`, l.token, { expectedVersion: attempt.version, answers: [{ questionId: attempt.questions[0].id, answer: 'B' }], flags: [] }, 'PATCH')
    assert.equal(stale.status, 409)
    const [s1, s2] = await Promise.all([call(`/exam-preparation/mocks/${attempt.id}/submit`, l.token, {}), call(`/exam-preparation/mocks/${attempt.id}/submit`, l.token, {})])
    assert.equal(s1.status, 201); assert.equal(s2.status, 201)
    assert.equal(s1.body.status, 'GRADED'); assert.deepEqual(s1.body.result, s2.body.result)
    const total = s1.body.result.subjects.reduce((n, s) => n + s.correct, 0)
    // Every answer was 'A' in the learner's displayed order; correctness follows the frozen key mapping.
    const expected = s1.body.questions.filter(q => q.correctAnswer === 'A').length
    assert.equal(total, expected)
    // Another learner cannot read or write this attempt.
    const other = learners[(i + 1) % learners.length]
    assert.equal((await call(`/exam-preparation/mocks/${attempt.id}`, other.token)).status, 404)
  }))
})

test('the emergency brake stops new attempts while in-progress attempts can finish', async () => {
  const l = await jambLearner('brake')
  const started = await call('/exam-preparation/mocks', l.token, { goalId: l.goal.id, requestKey: randomUUID() })
  assert.equal(started.status, 201)
  assert.equal((await setting('exam.newAttemptsPaused', true)).status, 200)
  try {
    const save = await call(`/exam-preparation/mocks/${started.body.id}/answers`, l.token, { expectedVersion: started.body.version, answers: [{ questionId: started.body.questions[0].id, answer: 'A' }], flags: [] }, 'PATCH')
    assert.equal(save.status, 200)
    assert.equal((await call(`/exam-preparation/mocks/${started.body.id}/submit`, l.token, {})).status, 201)
    const blocked = await call('/exam-preparation/mocks', l.token, { goalId: l.goal.id, requestKey: randomUUID() })
    assert.equal(blocked.status, 503); assert.match(blocked.body.message, /paused/)
    assert.equal((await call(`/exam-preparation/mocks/${started.body.id}`, l.token)).body.status, 'GRADED')
  } finally { await setting('exam.newAttemptsPaused', null) }
})

async function personalData(user) {
  const course = await prisma.course.create({ data: { ownerId: user.id, title: `Tertiary Biochemistry ${suffix}`, subject: 'Biochemistry' } })
  const topic = await prisma.topic.create({ data: { courseId: course.id, name: 'Enzymes' } })
  await prisma.flashcard.create({ data: { studentId: user.id, front: 'Enzyme', back: 'Biological catalyst' } })
  await prisma.selfQuizAttempt.create({ data: { studentId: user.id, topicId: topic.id, courseId: course.id, difficulty: 'MEDIUM', scorePercent: 80, questionCount: 5, results: [] } })
  const key = `personal/${user.id}/documents/${randomUUID()}/notes.txt`
  await app.get(require('../dist/modules/storage/storage.service').StorageService).uploadBuffer(key, Buffer.from('private notes'), 'text/plain')
  await prisma.document.create({ data: { uploadedById: user.id, courseId: course.id, fileName: 'notes.txt', fileType: 'TXT', fileUrl: key, fileSizeBytes: 13, status: 'READY' } })
  return { course, key }
}

test('learners can export only their own data', async () => {
  const user = await account('export'), other = await account('export-other')
  await personalData(user); await personalData(other)
  const token = (await login(user)).accessToken
  const exported = await call('/users/me/export', token)
  assert.equal(exported.status, 200)
  assert.equal(exported.body.profile.id, user.id)
  assert.equal(exported.body.profile.passwordHash, undefined)
  assert.equal(exported.body.courses.length, 1)
  assert.ok(exported.body.flashcards.every(f => f.studentId === user.id))
  assert.ok(exported.body.documents.every(d => d.fileName === 'notes.txt'))
})

test('account deletion removes personal data, files and sessions but leaves others intact', async () => {
  const { user, token } = await jambLearner('delete-me')
  const other = await account('delete-bystander')
  const mine = await personalData(user), theirs = await personalData(other)
  const started = await call('/exam-preparation/mocks', token, { goalId: (await prisma.examGoal.findFirst({ where: { studentId: user.id } })).id, requestKey: randomUUID() })
  assert.equal(started.status, 201)
  const session = await login(user)
  assert.equal((await call('/users/me', token, { password, confirmation: 'delete' }, 'DELETE')).status, 400)
  assert.equal((await call('/users/me', token, { password: 'wrong-password', confirmation: 'DELETE MY ACCOUNT' }, 'DELETE')).status, 401)
  const deleted = await call('/users/me', token, { password, confirmation: 'DELETE MY ACCOUNT' }, 'DELETE')
  assert.equal(deleted.status, 200, JSON.stringify(deleted.body))
  const row = await prisma.user.findUnique({ where: { id: user.id } })
  assert.ok(row.deletedAt); assert.equal(row.name, 'Deleted learner'); assert.notEqual(row.email, user.email)
  for (const [model, where] of [['course', { ownerId: user.id }], ['flashcard', { studentId: user.id }], ['selfQuizAttempt', { studentId: user.id }], ['document', { uploadedById: user.id }], ['examGoal', { studentId: user.id }], ['examMockAttempt', { studentId: user.id }], ['refreshToken', { userId: user.id }]])
    assert.equal(await prisma[model].count({ where }), 0, model)
  const storage = app.get(require('../dist/modules/storage/storage.service').StorageService)
  const fs = require('node:fs'), path = require('node:path')
  assert.equal(fs.existsSync(path.join(process.cwd(), 'uploads', mine.key)), false)
  assert.equal(fs.existsSync(path.join(process.cwd(), 'uploads', theirs.key)), true)
  assert.equal(await prisma.course.count({ where: { ownerId: other.id } }), 1)
  // Every session ends and the old credentials no longer work.
  assert.equal((await call('/auth/me', token)).status, 401)
  assert.equal((await call('/auth/refresh', null, { refreshToken: session.refreshToken })).status, 401)
  assert.equal((await call('/auth/login', null, { email: user.email, password })).status, 401)
  await storage.delete(theirs.key)
})

test('institutional and administrator accounts cannot self-delete', async () => {
  const org = await prisma.organization.create({ data: { name: `Org ${suffix}`, slug: `org-${suffix}`, joinCode: `J${suffix}`.slice(0, 9), type: 'UNIVERSITY', plan: 'FREE_TRIAL' } })
  const member = await account('institutional', { organizationId: org.id })
  const token = (await login(member)).accessToken
  assert.equal((await call('/users/me/export', token)).status, 403)
  assert.equal((await call('/users/me', token, { password, confirmation: 'DELETE MY ACCOUNT' }, 'DELETE')).status, 403)
  assert.equal((await call('/users/me', ownerToken, { password, confirmation: 'DELETE MY ACCOUNT' }, 'DELETE')).status, 403)
})

test('WAEC retakes draw unseen questions first and refuse incomplete forms', async () => {
  const subject = `Literature ${suffix}`, key = subject.toLowerCase(), topic = `Poetry ${suffix}`
  const user = await account('waec-retake', { studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SS3' })
  const token = (await login(user)).accessToken
  const goal = (await call('/exam-preparation/goals', token, { exam: 'WAEC', year: YEAR, series: 'SCHOOL', subjects: [subject] }, 'PUT')).body
  const options = [{ key: 'A', text: 'Metaphor' }, { key: 'B', text: 'Simile' }, { key: 'C', text: 'Irony' }, { key: 'D', text: 'Alliteration' }]
  for (let i = 0; i < 4; i++)
    await prisma.examBankQuestion.create({ data: { exam: 'WAEC', subject, subjectKey: key, topic, questionText: `WAEC retake ${suffix} ${i}: name the device.`, questionType: 'MCQ', options, correctAnswer: 'A', explanation: 'Fixture.', marks: 1, difficulty: 'MEDIUM', status: 'APPROVED', createdById: owner.id, fingerprint: `retake-${suffix}-${i}` } })
  const paper = await prisma.waecPaperTemplate.create({ data: { year: YEAR, series: 'SCHOOL', subject, subjectKey: key, paperCode: `RT-${suffix}`, title: `Retake fixture ${suffix}`, durationMinutes: 30, instructions: 'Isolated fixture; answer both objective questions.', sourceNote: 'Integration fixture only.', status: 'APPROVED', sections: [{ id: 'obj', title: 'Objectives', questionType: 'MCQ', count: 2, choose: 2, marks: 1, topic }] } })
  const take = async () => {
    const started = await call('/exam-preparation/waec-papers/start', token, { goalId: goal.id, paperId: paper.id, requestKey: randomUUID() })
    assert.equal(started.status, 201, JSON.stringify(started.body))
    assert.equal((await call(`/exam-preparation/mocks/${started.body.id}/submit`, token, {})).status, 201)
    return started.body.questions.map(q => q.id)
  }
  const first = await take(), second = await take()
  assert.equal(new Set([...first, ...second]).size, 4, 'second form uses the two unseen questions')
  const exposures = await prisma.examQuestionExposure.findMany({ where: { studentId: user.id } })
  assert.equal(exposures.length, 4)
  // With every question seen once, a third form is still complete (least recently seen first).
  assert.equal((await take()).length, 2)
  await prisma.examBankQuestion.updateMany({ where: { subjectKey: key }, data: { status: 'ARCHIVED' } })
  const refused = await call('/exam-preparation/waec-papers/start', token, { goalId: goal.id, paperId: paper.id, requestKey: randomUUID() })
  assert.equal(refused.status, 400); assert.match(refused.body.message, /needs 2 reviewed questions/)
})

test('mocks disclose text-only limits and learners can report only questions they were shown', async () => {
  const l = await jambLearner('reporter')
  const availability = await call(`/exam-preparation/goals/${l.goal.id}/mock-availability`, l.token)
  assert.equal(availability.body.format.textOnly, true)
  assert.ok(availability.body.format.notIncluded.some(item => /passage/i.test(item)))
  const started = await call('/exam-preparation/mocks', l.token, { goalId: l.goal.id, requestKey: randomUUID() })
  assert.match(started.body.specification.format.summary, /not a complete UTME paper/)
  const shown = started.body.questions[0].id
  const unseen = await prisma.examBankQuestion.findFirst({ where: { status: 'APPROVED', id: { notIn: started.body.questions.map(q => q.id) }, exposures: { none: { studentId: l.user.id } } } })
  assert.equal((await call('/exam-preparation/question-reports', l.token, { questionId: unseen.id, reason: 'WRONG_ANSWER', details: 'Probing an unseen question' })).status, 404)
  const report = await call('/exam-preparation/question-reports', l.token, { questionId: shown, attemptId: started.body.id, reason: 'AMBIGUOUS', details: 'Two options look correct to me.' })
  assert.equal(report.status, 201); assert.equal(report.body.status, 'OPEN')
  const queue = await call('/admin/nightklass/exam-content/question-reports', ownerToken)
  const mine = queue.body.find(r => r.id === report.body.id)
  assert.ok(mine); assert.equal(mine.question.id, shown)
  assert.equal((await call(`/admin/nightklass/exam-content/question-reports/${report.body.id}`, ownerToken, { status: 'RESOLVED', resolutionNote: 'Clarified option C wording.' }, 'PATCH')).status, 200)
  assert.equal((await call('/admin/nightklass/exam-content/question-reports', l.token)).status, 403)
})
