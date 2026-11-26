// KwikEval core flows and access rules against a real API and PostgreSQL.
// Requires the disposable kwikeval_test database (migrated). Never run against production.
require('reflect-metadata')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { NestFactory } = require('@nestjs/core')
const { PrismaClient } = require('../../../packages/db/generated/client')
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/kwikeval_test') throw new Error('Use disposable database kwikeval_test')
process.env.JWT_SECRET = randomUUID() + randomUUID()
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID()
process.env.OPENAI_API_KEY = 'test-only-not-a-real-key'
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
process.env.KWIKEVAL_URL = 'https://kwikeval.test'

const prisma = new PrismaClient()
const suffix = randomUUID().slice(0, 8)
const PASSWORD = 'Integration-pass-1!'
const sent = []
let app, base

const sleep = ms => new Promise(r => setTimeout(r, ms))
async function call(path, token, body, method = body ? 'POST' : 'GET') {
  // Stay under the real 10-per-second anonymous burst limit instead of loosening it for tests.
  if (!token) await sleep(120)
  const res = await fetch(base + path, {
    method,
    headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  const text = await res.text()
  let parsed; try { parsed = JSON.parse(text) } catch { parsed = text }
  return { status: res.status, body: parsed }
}
const expectStatus = (r, status) => assert.equal(r.status, status, JSON.stringify(r.body))

async function lecturer(tag, domain = 'uni.test') {
  const r = await call('/auth/register-lecturer', null, { name: `Dr ${tag}`, email: `${tag}-${suffix}@${domain}`, password: PASSWORD, institution: 'Test University' })
  expectStatus(r, 201)
  return r.body.accessToken
}
async function student(tag, domain = 'st.uni.test', { confirm = true } = {}) {
  const email = `${tag}-${suffix}@${domain}`
  const r = await call('/auth/register-student', null, { name: tag, email, password: PASSWORD, app: 'kwikeval' })
  expectStatus(r, 201)
  if (confirm) {
    const message = sent.findLast(m => m.to === email)
    assert.ok(message, `no confirmation email for ${email}`)
    assert.match(message.subject, /KwikEval/)
    const token = decodeURIComponent(message.text.match(/https:\/\/kwikeval\.test\/verify-email#token=([\w%-]+)/)[1])
    expectStatus(await call('/auth/verify-email', null, { token }), 200)
  }
  return { email, token: r.body.accessToken }
}
async function classWithQuiz(L, { policy = 'OPEN_LINK', domains, questions } = {}) {
  const course = await call('/courses', L, { title: `Class ${randomUUID().slice(0, 4)}`, subject: 'Biology' })
  expectStatus(course, 201)
  const access = await call(`/classes/${course.body.id}/access`, L, { joinPolicy: policy, ...(domains ? { allowedEmailDomains: domains } : {}) }, 'PATCH')
  expectStatus(access, 200)
  const imported = await call('/questions/bulk', L, {
    courseId: course.body.id,
    questions: questions ?? [
      { questionText: 'Chlorophyll is green.', questionType: 'TRUE_FALSE', correctAnswer: 'true', difficulty: 'EASY' },
      { questionText: 'Where does photosynthesis happen?', questionType: 'MCQ', options: [{ key: 'A', text: 'Chloroplast' }, { key: 'B', text: 'Nucleus' }], correctAnswer: 'a', difficulty: 'EASY' },
      { questionText: 'Explain the Calvin cycle.', questionType: 'THEORY', correctAnswer: 'Carbon fixation in the stroma.', difficulty: 'HARD' },
    ],
  })
  expectStatus(imported, 201)
  const quiz = await call('/assessments', L, { title: 'Quiz', courseId: course.body.id, durationMinutes: 10 })
  expectStatus(quiz, 201)
  expectStatus(await call(`/assessments/${quiz.body.id}/questions`, L, { questionIds: imported.body.questions.map(q => q.id) }), 201)
  expectStatus(await call(`/assessments/${quiz.body.id}/publish`, L, {}, 'PATCH'), 200)
  return { courseId: course.body.id, code: access.body.joinCode, quizId: quiz.body.id, questions: imported.body.questions }
}
const sees = async (S, quizId) => (await call('/assessments', S)).body.some(a => a.id === quizId)

before(async () => {
  const { AppModule } = require('../dist/app.module')
  app = await NestFactory.create(AppModule, { logger: false })
  require('../dist/configure-app').configureApp(app)
  app.get(require('../dist/modules/email/email.service').EmailService).deliver = async message => { sent.push(message) }
  await app.listen(0, '127.0.0.1')
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`
}, { timeout: 60000 })
after(async () => {
  if (app) await app.close()
  await prisma.$disconnect()
})

test('a lecturer runs a quiz end to end: import, publish, students sit it, marking', async () => {
  const L = await lecturer('flow')
  const { code, quizId, questions } = await classWithQuiz(L)
  const S = await student('flow-student', 'mail.test', { confirm: false })
  expectStatus(await call(`/classes/join/${code}`, S.token, {}), 200)

  const attempt = await call('/attempts', S.token, { assessmentId: quizId })
  expectStatus(attempt, 201)
  assert.ok(!JSON.stringify(attempt.body).includes('correctAnswer'), 'answer key leaked into the attempt')
  assert.equal(typeof attempt.body.deadline, 'string')

  const byType = Object.fromEntries(questions.map(q => [q.questionType, q]))
  for (const [q, body] of [
    [byType.TRUE_FALSE, { selectedAnswer: 'True' }],
    [byType.MCQ, { selectedAnswer: 'B' }],
    [byType.THEORY, { textAnswer: 'Carbon dioxide is fixed into sugar.' }],
  ]) expectStatus(await call(`/attempts/${attempt.body.id}/answers`, S.token, { questionId: q.id, ...body }), 201)
  expectStatus(await call(`/attempts/${attempt.body.id}/answers`, S.token, { questionId: 'not-on-this-quiz', selectedAnswer: 'A' }), 400)

  const submitted = await call(`/attempts/${attempt.body.id}/submit`, S.token, {})
  expectStatus(submitted, 201)
  assert.equal(submitted.body.status, 'SUBMITTED', 'written answer must leave the attempt awaiting marks')
  assert.equal(submitted.body.score, 1)
  expectStatus(await call(`/attempts/${attempt.body.id}/submit`, S.token, {}), 400)
  expectStatus(await call('/attempts', S.token, { assessmentId: quizId }), 409)

  const review = await call(`/attempts/${attempt.body.id}`, L)
  const written = review.body.answers.find(a => a.questionId === byType.THEORY.id)
  expectStatus(await call(`/attempts/${attempt.body.id}/grade`, L, { grades: [{ answerId: written.id, score: 5 }] }, 'PATCH'), 400)
  const graded = await call(`/attempts/${attempt.body.id}/grade`, L, { grades: [{ answerId: written.id, score: 1 }] }, 'PATCH')
  expectStatus(graded, 200)
  assert.equal(graded.body.status, 'GRADED')
  assert.equal(Math.round(graded.body.percentageScore), 67)
})

test('students never get the answer key or question bank', async () => {
  const L = await lecturer('keys')
  const { code, quizId } = await classWithQuiz(L)
  const S = await student('keys-student', 'mail.test', { confirm: false })
  expectStatus(await call(`/classes/join/${code}`, S.token, {}), 200)
  expectStatus(await call(`/assessments/${quizId}`, S.token), 403)
  expectStatus(await call('/questions', S.token), 403)
})

test('a bad row rejects the whole imported paper with a reason', async () => {
  const L = await lecturer('import')
  const r = await call('/questions/bulk', L, { questions: [
    { questionText: 'Fine row', questionType: 'TRUE_FALSE', correctAnswer: 'False', difficulty: 'EASY' },
    { questionText: 'Bad row', questionType: 'MCQ', options: [{ key: 'A', text: 'x' }, { key: 'B', text: 'y' }], correctAnswer: 'D', difficulty: 'EASY' },
  ] })
  expectStatus(r, 400)
  assert.match(JSON.stringify(r.body), /Question 2/)
  assert.equal((await call('/questions', L)).body.length, 0)
})

test('school-email rule: confirmed school address in, anything else out', async () => {
  const L = await lecturer('domain')
  const { code, quizId, courseId } = await classWithQuiz(L, { policy: 'EMAIL_DOMAIN', domains: ['@UNI.test'] })
  const settings = await call(`/classes/${courseId}/access`, L)
  assert.deepEqual(settings.body.allowedEmailDomains, ['uni.test'])
  assert.equal(settings.body.suggestedDomain, 'uni.test')

  const preview = await call(`/classes/join/${code}`)
  expectStatus(preview, 200)
  assert.equal(preview.body.allowedEmailDomains[0], 'uni.test')
  assert.ok(!('allowedEmails' in preview.body))

  const unconfirmed = await student('domain-a', 'st.uni.test', { confirm: false })
  assert.equal((await call(`/classes/join/${code}`, unconfirmed.token, {})).body.code, 'EMAIL_NOT_VERIFIED')

  const member = await student('domain-b', 'st.uni.test')
  const joined = await call(`/classes/join/${code}`, member.token, {})
  expectStatus(joined, 200)
  assert.equal(joined.body.status, 'ACTIVE')
  assert.ok(await sees(member.token, quizId))

  for (const domain of ['mail.test', 'fakeuni.test']) {
    const outsider = await student(`domain-${domain}`, domain)
    const r = await call(`/classes/join/${code}`, outsider.token, {})
    expectStatus(r, 403)
    assert.equal(r.body.code, 'DOMAIN_MISMATCH')
    assert.ok(!(await sees(outsider.token, quizId)))
    expectStatus(await call('/attempts', outsider.token, { assessmentId: quizId }), 404)
  }
  expectStatus(await call(`/classes/join/${code}`, L, {}), 403)
})

test('domain rule cannot be saved without a valid domain', async () => {
  const L = await lecturer('nodomain')
  const course = await call('/courses', L, { title: 'Empty', subject: 'Biology' })
  expectStatus(await call(`/classes/${course.body.id}/access`, L, { joinPolicy: 'EMAIL_DOMAIN', allowedEmailDomains: [] }, 'PATCH'), 400)
  expectStatus(await call(`/classes/${course.body.id}/access`, L, { allowedEmailDomains: ['not a domain'] }, 'PATCH'), 400)
})

test('approval, email-list and open-link rules', async () => {
  const L = await lecturer('rules')
  const { code, quizId, courseId } = await classWithQuiz(L, { policy: 'APPROVAL' })

  const asker = await student('rules-asker', 'mail.test')
  assert.equal((await call(`/classes/join/${code}`, asker.token, {})).body.status, 'PENDING')
  assert.ok(!(await sees(asker.token, quizId)))
  const roster = await call(`/classes/${courseId}/students`, L)
  const row = roster.body.find(e => e.student.email === asker.email)
  assert.equal(row.student.emailVerified, true)
  expectStatus(await call(`/classes/${courseId}/students/${row.id}`, L, { status: 'ACTIVE' }, 'PATCH'), 200)
  assert.ok(await sees(asker.token, quizId))

  await call(`/classes/${courseId}/access`, L, { joinPolicy: 'EMAIL_LIST' }, 'PATCH')
  const listed = await student('rules-listed', 'mail.test')
  assert.equal((await call(`/classes/join/${code}`, listed.token, {})).body.code, 'NOT_ON_LIST')
  expectStatus(await call(`/classes/${courseId}/emails`, L, { emails: [listed.email.toUpperCase()] }), 200)
  assert.equal((await call(`/classes/join/${code}`, listed.token, {})).body.status, 'ACTIVE')

  await call(`/classes/${courseId}/access`, L, { joinPolicy: 'OPEN_LINK' }, 'PATCH')
  const anyone = await student('rules-anyone', 'mail.test', { confirm: false })
  assert.equal((await call(`/classes/join/${code}`, anyone.token, {})).body.status, 'ACTIVE')
})

test('closing, removing and replacing the class link', async () => {
  const L = await lecturer('close')
  const { code, quizId, courseId } = await classWithQuiz(L)
  const member = await student('close-member', 'mail.test', { confirm: false })
  await call(`/classes/join/${code}`, member.token, {})

  await call(`/classes/${courseId}/access`, L, { joiningOpen: false }, 'PATCH')
  const late = await student('close-late', 'mail.test', { confirm: false })
  assert.equal((await call(`/classes/join/${code}`, late.token, {})).body.code, 'CLOSED')
  await call(`/classes/${courseId}/access`, L, { joiningOpen: true }, 'PATCH')

  const row = (await call(`/classes/${courseId}/students`, L)).body.find(e => e.student.email === member.email)
  await call(`/classes/${courseId}/students/${row.id}`, L, { status: 'REMOVED' }, 'PATCH')
  assert.ok(!(await sees(member.token, quizId)))
  assert.equal((await call(`/classes/join/${code}`, member.token, {})).body.code, 'REMOVED')

  const reset = await call(`/classes/${courseId}/access/reset-link`, L, {})
  assert.notEqual(reset.body.joinCode, code)
  expectStatus(await call(`/classes/join/${code}`), 404)
  expectStatus(await call(`/classes/join/${reset.body.joinCode}`), 200)
})

test('lecturers are isolated from each other', async () => {
  const L = await lecturer('mine')
  const other = await lecturer('theirs', 'other.test')
  const { code, quizId, courseId } = await classWithQuiz(L)
  const S = await student('mine-student', 'mail.test', { confirm: false })
  await call(`/classes/join/${code}`, S.token, {})
  const attempt = await call('/attempts', S.token, { assessmentId: quizId })
  await call(`/attempts/${attempt.body.id}/submit`, S.token, {})

  expectStatus(await call(`/classes/${courseId}/access`, other), 404)
  expectStatus(await call(`/classes/${courseId}/students`, other), 404)
  expectStatus(await call(`/assessments/${quizId}`, other), 404)
  expectStatus(await call(`/attempts/${attempt.body.id}`, other), 404)
  expectStatus(await call(`/attempts?assessmentId=${quizId}`, other), 404)
  expectStatus(await call(`/attempts/${attempt.body.id}/grade`, other, { grades: [] }, 'PATCH'), 404)
  expectStatus(await call('/analytics/platform', L), 403)
})

test('the server enforces the time limit and auto-submits', async () => {
  const L = await lecturer('timer')
  const { code, quizId, questions } = await classWithQuiz(L)
  const S = await student('timer-student', 'mail.test', { confirm: false })
  await call(`/classes/join/${code}`, S.token, {})
  const attempt = await call('/attempts', S.token, { assessmentId: quizId })
  // Ten-minute quiz started eleven minutes ago: past the deadline and the 30s grace
  await prisma.attempt.update({ where: { id: attempt.body.id }, data: { startedAt: new Date(Date.now() - 11 * 60_000) } })

  const late = await call(`/attempts/${attempt.body.id}/answers`, S.token, { questionId: questions[0].id, selectedAnswer: 'True' })
  expectStatus(late, 400)
  assert.match(late.body.message, /Time is up/)
  const after = await call(`/attempts/${attempt.body.id}`, S.token)
  assert.equal(after.body.status, 'GRADED', 'nothing answered, so nothing awaits marking')
})

test('KwikEval account emails link to KwikEval', async () => {
  const S = await student('mail-student', 'mail.test', { confirm: false })
  expectStatus(await call('/auth/forgot-password', null, { email: S.email, app: 'kwikeval' }), 200)
  const reset = sent.findLast(m => m.to === S.email)
  assert.match(reset.subject, /KwikEval/)
  assert.match(reset.text, /https:\/\/kwikeval\.test\/reset-password#token=/)
})
