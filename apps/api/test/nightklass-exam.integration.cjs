require('reflect-metadata')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { NestFactory } = require('@nestjs/core')
const { PrismaClient } = require('../../../packages/db/generated/client')
const { hash } = require('bcryptjs')
if (!process.env.DATABASE_URL || new URL(process.env.DATABASE_URL).pathname !== '/nightklass_exam_test') throw new Error('Use disposable database nightklass_exam_test')
process.env.JWT_SECRET = randomUUID() + randomUUID()
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID()
process.env.OPENAI_API_KEY = ''
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
process.env.EXAM_ACCESS = 'OPEN'
process.env.API_URL = 'http://127.0.0.1:0'
const prisma = new PrismaClient()
let app, base, owner, learner, other, ownerToken, learnerToken, otherToken, material, bankQuestion, goal, practice
const suffix = randomUUID(), password = randomUUID()
async function call(path, token, body, method = body ? 'POST' : 'GET') {
  const response = await fetch(base + path, { method, headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), 'Content-Type': 'application/json' }, ...(body ? { body: JSON.stringify(body) } : {}) })
  return { status: response.status, body: await response.json() }
}
// Private files are reachable only through short-lived signed links: the link
// works, while a tampered signature, an expired link or a guessed key does not.
async function assertSignedDownload(link, keyPattern) {
  const url = new URL(link)
  assert.match(url.searchParams.get('key'), keyPattern)
  assert.equal((await fetch(url)).status, 200)
  const tampered = new URL(url); tampered.searchParams.set('sig', '0'.repeat(64))
  assert.equal((await fetch(tampered)).status, 404)
  const expired = new URL(url); expired.searchParams.set('expires', String(Math.floor(Date.now() / 1000) - 1))
  assert.equal((await fetch(expired)).status, 404)
  const traversal = new URL(url); traversal.searchParams.set('key', '../package.json')
  assert.equal((await fetch(traversal)).status, 404)
  assert.equal((await fetch(new URL('/uploads/' + url.searchParams.get('key'), url))).status, 404)
}
const admin = (path, body, method) => call('/admin/nightklass/exam-content/' + path, ownerToken, body, method)
const authored = { exam: 'JAMB', subject: 'Government', topic: `Democracy ${suffix}`, questionText: `Which choice describes representative democracy? Fixture ${suffix}`, questionType: 'MCQ', options: [{ key: 'A', text: 'Citizens elect representatives' }, { key: 'B', text: 'Power is inherited' }, { key: 'C', text: 'No elections occur' }, { key: 'D', text: 'One official owns all power' }], correctAnswer: 'A', explanation: 'Citizens elect representatives who make decisions on their behalf.', marks: 1, difficulty: 'MEDIUM' }
before(async () => {
  const passwordHash = await hash(password, 12)
  async function account(name) { return prisma.user.create({ data: { name, email: `${name}-${suffix}@example.test`, passwordHash, role: 'STUDENT', status: 'ACTIVE' } }) }
  owner = await account('teacher'); learner = await account('learner'); other = await account('other')
  await prisma.nightklassAdmin.create({ data: { userId: owner.id, role: 'OWNER' } })
  const { AppModule } = require('../dist/app.module')
  app = await NestFactory.create(AppModule, { logger: false })
  require('../dist/configure-app').configureApp(app)
  await app.listen(0, '127.0.0.1')
  base = `http://127.0.0.1:${app.getHttpServer().address().port}/api/v1`
  // Local signed download links point back at this test server.
  process.env.API_URL = `http://127.0.0.1:${app.getHttpServer().address().port}`
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
  assert.equal((await call(path, learnerToken)).body.some(m => m.id === material.id), false)
  assert.equal((await call(path, otherToken)).status, 404)
  assert.equal((await admin(`materials/${material.id}`, { status: 'APPROVED' }, 'PATCH')).status, 200)
  const published = await call(path, learnerToken)
  assert.equal(published.body.find(m => m.id === material.id).title, 'Democracy notes')
  assert.equal(published.body.find(m => m.id === material.id).createdById, undefined)
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
  assert.equal((await call('/exam-preparation/practice', otherToken, { goalId: goal.id, subjectKey: 'government', topic: authored.topic, count: 10 })).status, 404)
  const response = await call('/exam-preparation/practice', learnerToken, { goalId: goal.id, subjectKey: 'government', topic: authored.topic, count: 10 })
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
  const response = await call('/exam-preparation/practice', learnerToken, { goalId: goal.id, subjectKey: 'government', topic: authored.topic, count: 5 })
  assert.equal(response.status, 400)
  assert.ok(await prisma.question.findUnique({ where: { id: practice.questions[0].id } }))
  assert.ok(await prisma.nightklassAdminAudit.count({ where: { actorId: owner.id, resourceType: 'exam-content' } }) >= 4)
})

let mock, mockTemplate
const { createHash } = require('node:crypto')
test('mock availability reports missing reviewed content and refuses an incomplete full paper', async () => {
  const templates = await admin('mock-templates')
  const previous = templates.body.find(t => t.year === 2027)
  const response = await admin('mock-templates', { year: 2027, title: 'Integration JAMB practice mock', durationMinutes: 120, englishCount: 60, otherCount: 40, instructions: 'Answer all questions. This isolated integration fixture tests the JAMB-style mock engine.', sourceNote: 'Integration fixture based on published JAMB baseline; not a public exam-year specification.', status: 'APPROVED', expectedRevision: previous?.revision ?? 0 })
  assert.equal(response.status, 201); mockTemplate = response.body
  // Restrict this fixture's check to an exam year without any published template.
  const unconfigured = await call('/exam-preparation/goals', learnerToken, { exam: 'JAMB', year: 2028, subjects: ['English', 'Government', 'Literature in English', 'Economics'] }, 'PUT')
  const noTemplate = await call(`/exam-preparation/goals/${unconfigured.body.id}/mock-availability`, learnerToken)
  assert.equal(noTemplate.body.ready, false)
  assert.equal((await call('/exam-preparation/mocks', learnerToken, { goalId: unconfigured.body.id, requestKey: randomUUID() })).status, 400)
})
test('a complete 180-question mock freezes four subjects and idempotent start returns one active attempt', async () => {
  const data = []
  for (const subject of goal.subjects) {
    const count = subject.subjectKey === 'english' ? 60 : 40
    for (let i = 0; i < count; i++) {
      const questionText = `Integration ${suffix} ${subject.name} question ${i}: select option A.`
      data.push({ exam: 'JAMB', subject: subject.name, subjectKey: subject.subjectKey, topic: 'Integration objective', questionText, questionType: 'MCQ', options: authored.options, correctAnswer: 'A', explanation: 'Option A is the deterministic fixture answer.', marks: 1, difficulty: 'MEDIUM', status: 'APPROVED', createdById: owner.id, reviewedById: owner.id, fingerprint: createHash('sha256').update(questionText).digest('hex') })
    }
  }
  await prisma.examBankQuestion.createMany({ data })
  const availability = await call(`/exam-preparation/goals/${goal.id}/mock-availability`, learnerToken)
  assert.equal(availability.body.ready, true)
  const requestKey = randomUUID()
  const response = await call('/exam-preparation/mocks', learnerToken, { goalId: goal.id, requestKey })
  assert.equal(response.status, 201); mock = response.body
  assert.equal(mock.questions.length, 180)
  assert.equal(mock.questions.filter(q => q.subjectKey === 'english').length, 60)
  assert.ok(mock.questions.every(q => q.correctAnswer === undefined && q.explanation === undefined))
  assert.equal(mock.specification.durationMinutes, 120)
  assert.equal((await call('/exam-preparation/mocks', learnerToken, { goalId: goal.id, requestKey })).body.id, mock.id)
  assert.equal((await call('/exam-preparation/mocks', learnerToken, { goalId: goal.id, requestKey: randomUUID() })).body.id, mock.id)
  assert.equal((await call(`/exam-preparation/mocks/${mock.id}`, otherToken)).status, 404)
})
test('mock answer saves reject forged items and stale updates; resume restores confirmed answers', async () => {
  const path = `/exam-preparation/mocks/${mock.id}/answers`
  assert.equal((await call(path, learnerToken, { expectedVersion: 1, answers: [{ questionId: 'foreign-question', answer: 'A' }], flags: [] }, 'PATCH')).status, 400)
  const result = await call(path, learnerToken, { expectedVersion: 1, answers: [{ questionId: mock.questions[0].id, answer: 'A' }], flags: [mock.questions[1].id] }, 'PATCH')
  assert.equal(result.status, 200); assert.equal(result.body.version, 2)
  assert.equal((await call(path, learnerToken, { expectedVersion: 1, answers: [], flags: [] }, 'PATCH')).status, 409)
  const resumed = await call(`/exam-preparation/mocks/${mock.id}`, learnerToken)
  assert.equal(resumed.body.answers[mock.questions[0].id], 'A')
  assert.deepEqual(resumed.body.flags, [mock.questions[1].id])
})
test('concurrent mock submissions finalize one stable result and reveal keys only after submission', async () => {
  const results = await Promise.all([call(`/exam-preparation/mocks/${mock.id}/submit`, learnerToken, {}), call(`/exam-preparation/mocks/${mock.id}/submit`, learnerToken, {})])
  assert.ok(results.every(r => r.status === 201))
  assert.deepEqual(results[0].body.result, results[1].body.result)
  assert.equal(results[0].body.status, 'GRADED')
  assert.equal(results[0].body.result.subjects.reduce((sum, s) => sum + s.correct, 0), 1)
  assert.equal(results[0].body.questions[0].correctAnswer, 'A')
  assert.equal((await call(`/exam-preparation/mocks/${mock.id}/answers`, learnerToken, { expectedVersion: 2, answers: [], flags: [] }, 'PATCH')).status, 409)
  assert.equal((await prisma.examMockAttempt.findUnique({ where: { id: mock.id } })).activeKey, null)
})
test('expired mock rejects late answers and finalizes from persisted state without a browser', async () => {
  const response = await call('/exam-preparation/mocks', learnerToken, { goalId: goal.id, requestKey: randomUUID() })
  assert.equal(response.status, 201)
  const id = response.body.id
  await prisma.examMockAttempt.update({ where: { id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  assert.equal((await call(`/exam-preparation/mocks/${id}/answers`, learnerToken, { expectedVersion: 1, answers: [{ questionId: response.body.questions[0].id, answer: 'A' }], flags: [] }, 'PATCH')).status, 409)
  const { ExamMockService } = require('../dist/modules/exam-preparation/exam-mock.service')
  await app.get(ExamMockService).sweep()
  const persisted = await prisma.examMockAttempt.findUnique({ where: { id } })
  assert.equal(persisted.status, 'GRADED'); assert.equal(persisted.submissionReason, 'TIME_EXPIRED')
  assert.equal(persisted.result.practiceScore, 0)
})

let waecGoal, waecPaper, waecAttempt
const waecTopic = `WAEC government ${suffix}`
const waecSections = [{ id: 'objectives', title: 'Compulsory objectives', questionType: 'MCQ', count: 1, choose: 1, marks: 1, topic: waecTopic }, { id: 'essays', title: 'Answer one essay', questionType: 'THEORY', count: 2, choose: 1, marks: 10, topic: waecTopic }]
test('WAEC publishes subject/series paper rules and checks section coverage', async () => {
  const goalResponse = await call('/exam-preparation/goals', learnerToken, { exam: 'WAEC', year: 2027, subjects: ['Government'] }, 'PUT')
  assert.equal(goalResponse.status, 200); waecGoal = goalResponse.body
  const fields = { year: 2027, series: 'SCHOOL', subject: 'Government', paperCode: `TEST-${suffix.slice(0,8)}`, title: 'Government objectives and essays practice', durationMinutes: 60, instructions: 'Answer the objective question and select exactly one essay. Label all subparts and show your reasoning.', sourceNote: 'Isolated integration fixture; illustrative paper, not an official WAEC specification.', status: 'APPROVED', sections: waecSections, expectedRevision: 0 }
  assert.equal((await admin('waec-papers', { ...fields, sections: [{ ...waecSections[1], choose: 3 }] })).status, 400)
  const paperResponse = await admin('waec-papers', fields)
  assert.equal(paperResponse.status, 201); waecPaper = paperResponse.body
  const availability = await call(`/exam-preparation/goals/${waecGoal.id}/waec-papers`, learnerToken)
  assert.equal(availability.body.find(p => p.id === waecPaper.id).ready, false)
  assert.equal((await call('/exam-preparation/waec-papers/start', learnerToken, { goalId: waecGoal.id, paperId: waecPaper.id, requestKey: randomUUID() })).status, 400)
  assert.equal((await call(`/exam-preparation/goals/${waecGoal.id}/waec-papers`, otherToken)).status, 404)
})
test('WAEC starts frozen paper sections and validates optional choices and written saves', async () => {
  for (let i = 0; i < 3; i++) {
    const text = `WAEC fixture ${suffix} ${i}: ${i === 0 ? 'Choose option A.' : '(a) Define democracy. (b) Explain two benefits.'}`
    await prisma.examBankQuestion.create({ data: { exam: 'WAEC', subject: 'Government', subjectKey: 'government', topic: waecTopic, questionText: text, questionType: i === 0 ? 'MCQ' : 'THEORY', options: i === 0 ? authored.options : [], correctAnswer: i === 0 ? 'A' : 'A definition and two explained benefits.', explanation: i === 0 ? 'Option A is correct.' : 'Definition: 4 marks. Two explained benefits: 3 marks each.', marks: i === 0 ? 1 : 10, difficulty: 'MEDIUM', status: 'APPROVED', createdById: owner.id, reviewedById: owner.id, fingerprint: createHash('sha256').update(text).digest('hex') } })
  }
  const start = await call('/exam-preparation/waec-papers/start', learnerToken, { goalId: waecGoal.id, paperId: waecPaper.id, requestKey: randomUUID() })
  assert.equal(start.status, 201); waecAttempt = start.body
  assert.equal(waecAttempt.specification.exam, 'WAEC')
  assert.equal(waecAttempt.questions.length, 3)
  assert.ok(waecAttempt.questions.every(q => q.correctAnswer === undefined && q.explanation === undefined))
  assert.equal((await call(`/exam-preparation/mocks/${waecAttempt.id}/submit`, learnerToken, {})).status, 400)
  const essays = waecAttempt.questions.filter(q => q.questionType === 'THEORY')
  const savePath = `/exam-preparation/mocks/${waecAttempt.id}/answers`
  assert.equal((await call(savePath, learnerToken, { expectedVersion: 1, answers: [], flags: [], selectedQuestions: essays.map(q => q.id) }, 'PATCH')).status, 400)
  const objective = waecAttempt.questions.find(q => q.questionType === 'MCQ')
  const saved = await call(savePath, learnerToken, { expectedVersion: 1, answers: [{ questionId: objective.id, answer: 'A' }, { questionId: essays[0].id, answer: '(a) People elect representatives. (b) This supports accountability.' }], flags: [essays[0].id], selectedQuestions: [essays[0].id] }, 'PATCH')
  assert.equal(saved.status, 200)
  const resumed = await call(`/exam-preparation/mocks/${waecAttempt.id}`, learnerToken)
  assert.match(resumed.body.answers[essays[0].id], /accountability/)
  assert.deepEqual(resumed.body.selectedQuestions, [essays[0].id])
})
test('WAEC marking persists failures, retries from the database, and preserves rubric partial credit', async () => {
  const { AiService } = require('../dist/modules/ai/ai.service')
  const { ExamMockService } = require('../dist/modules/exam-preparation/exam-mock.service')
  const ai = app.get(AiService), original = ai.gradeWrittenAnswers
  let calls = 0
  ai.gradeWrittenAnswers = async () => { calls++; throw new Error('Deterministic provider outage') }
  try {
    const submitted = await call(`/exam-preparation/mocks/${waecAttempt.id}/submit`, learnerToken, {})
    assert.equal(submitted.status, 201)
    let pending
    for (let i = 0; i < 30; i++) { pending = await prisma.examMockAttempt.findUnique({ where: { id: waecAttempt.id } }); if (pending.gradingAttempts === 1 && !pending.gradingLeaseUntil) break; await new Promise(r => setTimeout(r, 20)) }
    assert.equal(pending.status, 'SUBMITTED')
    assert.equal(pending.result.ungradedMarks, 10)
    assert.equal(pending.result.percentage, null)
    assert.equal(calls, 1)
    assert.equal((await call(`/exam-preparation/mocks/${waecAttempt.id}/answers`, learnerToken, { expectedVersion: 2, answers: [], flags: [] }, 'PATCH')).status, 409)
    ai.gradeWrittenAnswers = async answers => { calls++; return { model: 'fixture-model', promptVersion: 'fixture-prompt', grades: answers.map(a => ({ id: a.id, score: 4.5, feedback: 'Definition is partly correct; expand the benefits.', missingPoints: ['Explain both benefits'] })) } }
    await prisma.examMockAttempt.update({ where: { id: waecAttempt.id }, data: { gradingNextAt: new Date(Date.now() - 1000) } })
    await app.get(ExamMockService).sweep()
    const finished = await call(`/exam-preparation/mocks/${waecAttempt.id}`, learnerToken)
    assert.equal(finished.body.status, 'GRADED')
    assert.equal(finished.body.result.earnedMarks, 5.5)
    assert.equal(finished.body.result.maxMarks, 11)
    assert.equal(finished.body.result.percentage, 50)
    assert.equal(finished.body.result.ungradedMarks, 0)
    assert.equal(calls, 2)
    assert.ok(finished.body.result.results.some(r => r.feedback?.includes('expand')))
    assert.match(finished.body.result.scoringNote, /not an official WAEC grade/)
  } finally { ai.gradeWrittenAnswers = original }
})
test('WAEC expiry permits incomplete optional selections and keeps the full paper denominator', async () => {
  const response = await call('/exam-preparation/waec-papers/start', learnerToken, { goalId: waecGoal.id, paperId: waecPaper.id, requestKey: randomUUID() })
  assert.equal(response.status, 201)
  await prisma.examMockAttempt.update({ where: { id: response.body.id }, data: { expiresAt: new Date(Date.now() - 1000) } })
  const result = await call(`/exam-preparation/mocks/${response.body.id}`, learnerToken)
  assert.equal(result.body.status, 'GRADED')
  assert.equal(result.body.submissionReason, 'TIME_EXPIRED')
  assert.equal(result.body.result.maxMarks, 11)
  assert.equal(result.body.result.percentage, 0)
})
test('WAEC exhausted written-marking retries preserve ungraded marks without inventing a final percentage', async () => {
  const { AiService } = require('../dist/modules/ai/ai.service')
  const { ExamMockService } = require('../dist/modules/exam-preparation/exam-mock.service')
  const ai = app.get(AiService), original = ai.gradeWrittenAnswers
  let calls = 0
  ai.gradeWrittenAnswers = async () => { calls++; throw new Error('Persistent deterministic outage') }
  try {
    // Earlier expiry releases its active key when read, allowing a fresh paper.
    const start = await call('/exam-preparation/waec-papers/start', learnerToken, { goalId: waecGoal.id, paperId: waecPaper.id, requestKey: randomUUID() })
    const id = start.body.id, essay = start.body.questions.find(q => q.questionType === 'THEORY')
    assert.equal((await call(`/exam-preparation/mocks/${id}/answers`, learnerToken, { expectedVersion: 1, answers: [{ questionId: essay.id, answer: 'A nonblank essay answer' }], flags: [], selectedQuestions: [essay.id] }, 'PATCH')).status, 200)
    assert.equal((await call(`/exam-preparation/mocks/${id}/submit`, learnerToken, {})).status, 201)
    for (let retry = 1; retry <= 3; retry++) {
      for (let poll = 0; poll < 40; poll++) { const a = await prisma.examMockAttempt.findUnique({ where: { id } }); if (a.gradingAttempts >= retry && !a.gradingLeaseUntil) break; await new Promise(r => setTimeout(r,20)) }
      if (retry < 3) { await prisma.examMockAttempt.update({ where: { id }, data: { gradingNextAt: new Date(Date.now()-1000) } }); await app.get(ExamMockService).sweep() }
    }
    const finished = await call(`/exam-preparation/mocks/${id}`, learnerToken)
    assert.equal(finished.body.status, 'GRADED')
    assert.equal(finished.body.result.gradingFailed, true)
    assert.equal(finished.body.result.ungradedMarks, 10)
    assert.equal(finished.body.result.percentage, null)
    assert.equal(calls, 3)
    await app.get(ExamMockService).sweep()
    assert.equal(calls, 3)
  } finally { ai.gradeWrittenAnswers = original }
})

let syllabus, syllabusQuestion
const syllabusCode = `GOV-${suffix.slice(0,8)}`
test('syllabus drafts are private and official provenance requires a source URL', async () => {
  const fields = { exam:'JAMB',year:2027,subject:'Government',version:Date.now()%1000000,title:`Reviewed Government syllabus ${suffix}`,provenance:'CURATED',sourceNote:'Original teacher-curated objectives for this isolated test.',objectives:[{code:syllabusCode,title:'Democratic government',description:'Explain representative democracy and political accountability.'}],expectedRevision:0 }
  // A stable per-run version within the documented input bound.
  const existing = await admin('syllabuses')
  fields.version = Math.max(0,...existing.body.filter(s=>s.exam==='JAMB'&&s.year===2027&&s.subjectKey==='government').map(s=>s.version))+1
  assert.equal((await call('/admin/nightklass/exam-content/syllabuses',learnerToken)).status,403)
  assert.equal((await admin('syllabuses',{...fields,provenance:'OFFICIAL'})).status,400)
  const response=await admin('syllabuses',fields)
  assert.equal(response.status,201);syllabus=response.body
  const coverage=await call(`/exam-preparation/goals/${goal.id}/subjects/government/coverage`,learnerToken)
  assert.notEqual(coverage.body.syllabus?.id,syllabus.id)
  assert.equal((await call('/exam-preparation/objectives/study',learnerToken,{goalId:goal.id,objectiveId:syllabus.objectives[0].id})).status,404)
})
test('reviewed syllabus publication is immutable and learner access is owner scoped',async()=>{
  assert.equal((await admin(`syllabuses/${syllabus.id}/state`,{status:'APPROVED',expectedRevision:1})).status,201)
  const coverage=await call(`/exam-preparation/goals/${goal.id}/subjects/government/coverage`,learnerToken)
  assert.equal(coverage.body.syllabus.id,syllabus.id)
  assert.equal(coverage.body.summary.total,1)
  assert.equal(coverage.body.objectives[0].practiceAccuracy,null)
  assert.equal((await call(`/exam-preparation/goals/${goal.id}/subjects/government/coverage`,otherToken)).status,404)
  const {id,exam,year,subject,version,title,provenance,sourceNote,objectives}=syllabus
  assert.equal((await admin('syllabuses',{id,exam,year,subject,version,title,provenance,sourceNote,objectives:objectives.map(({code,title,description})=>({code,title,description})),expectedRevision:2})).status,409)
})
test('objective study setup is idempotent and reviewed practice feeds objective coverage',async()=>{
  const objectiveId=syllabus.objectives[0].id
  const first=await call('/exam-preparation/objectives/study',learnerToken,{goalId:goal.id,objectiveId})
  const repeated=await call('/exam-preparation/objectives/study',learnerToken,{goalId:goal.id,objectiveId})
  assert.equal(first.status,201);assert.equal(first.body.topicId,repeated.body.topicId)
  const q=await admin('questions',{...authored,questionText:`Mapped question ${suffix}: which choice describes democracy?`,objectiveIds:[objectiveId]})
  assert.equal(q.status,201);syllabusQuestion=q.body
  assert.equal((await admin(`questions/${q.body.id}/state`,{status:'APPROVED',expectedRevision:1})).status,201)
  const practiceResult=await call('/exam-preparation/practice',learnerToken,{goalId:goal.id,subjectKey:'government',objectiveId,count:1})
  assert.equal(practiceResult.status,201);assert.equal(practiceResult.body.topicId,first.body.topicId)
  const grade=await call(`/study/topics/${first.body.topicId}/quiz/submit`,learnerToken,{answers:[{questionId:practiceResult.body.questions[0].id,selectedAnswer:'A'}]})
  assert.equal(grade.body.scorePercent,100)
  const coverage=await call(`/exam-preparation/goals/${goal.id}/subjects/government/coverage`,learnerToken)
  assert.equal(coverage.body.summary.assessed,1)
  assert.equal(coverage.body.objectives[0].practiceAccuracy,100)
  assert.equal(coverage.body.objectives[0].reviewedQuestions,1)
})
test('published corrections preserve historical keys and archive the superseded question atomically',async()=>{
  const corrected=await admin(`questions/${syllabusQuestion.id}/correction`,{status:'APPROVED',expectedRevision:2})
  assert.equal(corrected.status,201)
  assert.equal(corrected.body.supersedesId,syllabusQuestion.id)
  const edited=await admin(`questions/${corrected.body.id}`,{...authored,questionText:`Mapped question ${suffix}: which choice describes democracy?`,correctAnswer:'B',objectiveIds:[syllabus.objectives[0].id],expectedRevision:1},'PATCH')
  assert.equal(edited.status,200)
  assert.equal((await admin(`questions/${corrected.body.id}/state`,{status:'APPROVED',expectedRevision:2})).status,201)
  assert.equal((await prisma.examBankQuestion.findUnique({where:{id:syllabusQuestion.id}})).status,'ARCHIVED')
  const historical=await prisma.question.findFirst({where:{createdById:learner.id,sourceExamBankQuestionId:syllabusQuestion.id}})
  assert.equal(historical.correctAnswer,'A')
  const coverage=await call(`/exam-preparation/goals/${goal.id}/subjects/government/coverage`,learnerToken)
  assert.equal(coverage.body.objectives[0].reviewedQuestions,1)
  assert.equal(coverage.body.objectives[0].practiceAccuracy,100)
})
test('generation jobs are idempotent and commit validated drafts plus completion atomically',async()=>{
  const {AiService}=require('../dist/modules/ai/ai.service')
  const {ExamGenerationService}=require('../dist/modules/exam-preparation/exam-generation.service')
  const ai=app.get(AiService),original=ai.generateQuestions
  ai.generateQuestions=async()=>[{type:'MCQ',questionText:`Queued question ${suffix}: choose the correct option.`,options:authored.options,correctAnswer:'A',explanation:'This deterministic generated fixture has option A as its answer.'}]
  try{
    const payload={exam:'JAMB',subject:'Government',topic:'Democratic government',count:1,difficulty:'MEDIUM',questionType:'MCQ',objectiveIds:[syllabus.objectives[0].id],requestKey:randomUUID()}
    const queued=await admin('generation-jobs',payload)
    assert.equal(queued.status,201)
    assert.equal((await admin('generation-jobs',payload)).body.id,queued.body.id)
    let job
    for(let i=0;i<10;i++){await app.get(ExamGenerationService).process();job=await prisma.examGenerationJob.findUnique({where:{id:queued.body.id}});if(job.status==='SUCCEEDED')break;await new Promise(r=>setTimeout(r,50))}
    assert.equal(job.status,'SUCCEEDED')
    assert.equal(job.result.saved,1)
    const drafts=await prisma.examBankQuestion.findMany({where:{generationJobId:job.id},include:{objectiveLinks:true}})
    assert.equal(drafts.length,1);assert.equal(drafts[0].status,'DRAFT')
    assert.equal(drafts[0].objectiveLinks[0].objectiveId,syllabus.objectives[0].id)
  }finally{ai.generateQuestions=original}
})
test('mock review handles a small concurrent-read burst without changing saved results',async()=>{
  await new Promise(r=>setTimeout(r,1100))
  const started=performance.now()
  const responses=await Promise.all(Array.from({length:5},()=>call(`/exam-preparation/mocks/${mock.id}`,learnerToken)))
  assert.ok(responses.every(r=>r.status===200))
  assert.ok(responses.every(r=>JSON.stringify(r.body.result)===JSON.stringify(responses[0].body.result)))
  console.log(`Local concurrency smoke: five mock-review reads completed in ${Math.round(performance.now()-started)} ms; not a production capacity benchmark.`)
})

let calendarDraft
const calendarVersion = async (exam,year,series) => ((await prisma.examCalendar.aggregate({where:{exam,year,series},_max:{version:true}}))._max.version??0)+1
test('exam date drafts are private, owner scoped and reject invalid windows',async()=>{
  assert.equal((await call('/admin/nightklass/exam-content/calendars',learnerToken)).status,403)
  const fields={exam:'WAEC',year:2027,series:'SCHOOL',version:await calendarVersion('WAEC',2027,'SCHOOL'),title:`WAEC school timetable ${suffix}`,startDate:'2027-05-01',endDate:'2027-06-30',sourceNote:'Isolated verified calendar fixture; not real examination dates.',entries:[],expectedRevision:0}
  assert.equal((await admin('calendars',{...fields,startDate:'2027-02-29'})).status,400)
  const response=await admin('calendars',fields)
  assert.equal(response.status,201);calendarDraft=response.body
  const unpublished=await call(`/exam-preparation/goals/${waecGoal.id}/calendar`,learnerToken)
  assert.notEqual(unpublished.body.calendar?.id,calendarDraft.id)
  assert.equal((await call(`/exam-preparation/goals/${waecGoal.id}/calendar`,otherToken)).status,404)
})
test('WAEC CSV upload imports draft rows and publication filters papers to selected subjects',async()=>{
  const csv='subject,paperCode,title,date,startTime,endTime,notes\nGovernment,GOV2,Government essay,2027-05-20,09:00,11:00,Verified fixture\nPhysics,PHY1,Physics objective,2027-05-21,09:00,10:00,Not selected\nGovernment,GOV1,Government objective,2027-05-22,,,Time to be confirmed'
  const data=new FormData();data.set('file',new Blob([csv],{type:'text/csv'}),'waec-timetable.csv');data.set('expectedRevision',String(calendarDraft.revision))
  const upload=await fetch(base+`/admin/nightklass/exam-content/calendars/${calendarDraft.id}/upload`,{method:'POST',headers:{Authorization:`Bearer ${ownerToken}`},body:data})
  assert.equal(upload.status,201);calendarDraft=await upload.json()
  assert.equal(calendarDraft.importedRows,3)
  assert.equal(calendarDraft.status,'DRAFT')
  assert.equal((await admin(`calendars/${calendarDraft.id}/state`,{status:'APPROVED',expectedRevision:1})).status,409)
  assert.equal((await admin(`calendars/${calendarDraft.id}/state`,{status:'APPROVED',expectedRevision:calendarDraft.revision})).status,201)
  const published=await call(`/exam-preparation/goals/${waecGoal.id}/calendar`,learnerToken)
  assert.equal(published.body.calendar.id,calendarDraft.id)
  assert.equal(published.body.papers.length,2)
  assert.ok(published.body.papers.every(p=>p.subject==='Government'))
  assert.equal(published.body.deadlines[0].date,'2027-05-20')
  assert.equal(published.body.deadlines[0].source,'PAPER_DATE')
  await assertSignedDownload(published.body.calendar.fileUrl,/exam-timetables\/.+\.csv/)
  assert.match(published.body.note,/Africa\/Lagos/)
  assert.equal((await admin('calendars',{id:calendarDraft.id,exam:'WAEC',year:2027,series:'SCHOOL',version:calendarDraft.version,title:calendarDraft.title,startDate:'2027-05-02',endDate:'2027-06-30',sourceNote:calendarDraft.sourceNote,entries:[],expectedRevision:calendarDraft.revision+1})).status,409)
})
test('published JAMB start dates are general windows and can supply a study-plan deadline',async()=>{
  const calendar=await admin('calendars',{exam:'JAMB',year:2027,series:'GENERAL',version:await calendarVersion('JAMB',2027,'GENERAL'),title:`JAMB window ${suffix}`,startDate:'2027-08-01',endDate:'2027-08-15',sourceNote:'Isolated examination-window fixture, not an assigned candidate sitting.',entries:[],expectedRevision:0})
  assert.equal(calendar.status,201)
  assert.equal((await admin(`calendars/${calendar.body.id}/state`,{status:'APPROVED',expectedRevision:1})).status,201)
  const published=await call(`/exam-preparation/goals/${goal.id}/calendar`,learnerToken)
  assert.equal(published.body.calendar.startDate,'2027-08-01')
  assert.match(published.body.note,/personal sitting/)
  const course=goal.subjects.find(s=>s.subjectKey==='government')
  const availability=await call('/study/availability',learnerToken,{slots:[{dayOfWeek:1,startTime:'18:00',endTime:'19:00'},{dayOfWeek:3,startTime:'18:00',endTime:'19:00'}]})
  assert.equal(availability.status,201)
  const plan=await call('/study/plans/generate',learnerToken,{goalId:goal.id,courseId:course.courseId})
  assert.equal(plan.status,201)
  assert.equal(plan.body.examDate.slice(0,10),'2027-08-01')
  const explicit=await call('/study/plans/generate',learnerToken,{goalId:goal.id,courseId:course.courseId,weeks:5})
  assert.equal(explicit.status,201)
  assert.equal(explicit.body.planType,'DURATION')
})
test('WAEC series selection isolates calendars and mock paper availability',async()=>{
  const changed=await call('/exam-preparation/goals',learnerToken,{exam:'WAEC',year:2027,series:'PRIVATE_SECOND',subjects:['Government']},'PUT')
  assert.equal(changed.status,200)
  const result=await call(`/exam-preparation/goals/${waecGoal.id}/calendar`,learnerToken)
  assert.notEqual(result.body.calendar?.series,'SCHOOL')
  const papers=await call(`/exam-preparation/goals/${waecGoal.id}/waec-papers`,learnerToken)
  assert.ok(papers.body.every(p=>p.series==='PRIVATE_SECOND'))
  assert.equal((await call('/exam-preparation/waec-papers/start',learnerToken,{goalId:waecGoal.id,paperId:waecPaper.id,requestKey:randomUUID()})).status,404)
  assert.equal((await call('/exam-preparation/goals',learnerToken,{exam:'JAMB',year:2027,series:'SCHOOL',subjects:['English','Government','Economics','Literature in English']},'PUT')).status,400)
})

test('WAEC PDF uploads retain the original timetable for admin review', async()=>{
  const created=await admin('calendars',{exam:'WAEC',year:2027,series:'PRIVATE_FIRST',version:await calendarVersion('WAEC',2027,'PRIVATE_FIRST'),title:`PDF timetable ${suffix}`,startDate:'2027-01-01',sourceNote:'Isolated original PDF fixture for upload verification.',entries:[],expectedRevision:0})
  assert.equal(created.status,201)
  const stream='BT /F1 12 Tf 50 750 Td (WAEC timetable fixture) Tj ET'
  const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`]
  let pdf='%PDF-1.4\n';const offsets=[0]
  objects.forEach((object,i)=>{offsets.push(Buffer.byteLength(pdf));pdf+=`${i+1} 0 obj\n${object}\nendobj\n`})
  const xref=Buffer.byteLength(pdf)
  pdf+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`
  const data=new FormData();data.set('file',new Blob([pdf],{type:'application/pdf'}),'original-waec.pdf');data.set('expectedRevision','1')
  const {AiService}=require('../dist/modules/ai/ai.service')
  const ai=app.get(AiService), original=ai.extractExamTimetable
  ai.extractExamTimetable=async()=>({entries:[{subject:'Government',paperCode:'GOV2',title:'Government essay',date:'2027-01-20',startTime:'09:00',endTime:'11:00',notes:''}],warnings:[]})
  const response=await fetch(base+`/admin/nightklass/exam-content/calendars/${created.body.id}/upload`,{method:'POST',headers:{Authorization:`Bearer ${ownerToken}`},body:data})
  ai.extractExamTimetable=original
  assert.equal(response.status,201)
  const uploaded=await response.json()
  assert.equal(uploaded.fileName,'original-waec.pdf');assert.equal(uploaded.status,'DRAFT');assert.equal(uploaded.importedRows,1,uploaded.extractionWarning)
  assert.equal(uploaded.entries[0].date,'2027-01-20');assert.equal(uploaded.startDate,'2027-01-20');assert.equal(uploaded.endDate,'2027-01-20')
  const saved=await prisma.examCalendar.findUnique({where:{id:created.body.id}})
  assert.equal(saved.entries[0].startTime,'09:00')
  ai.extractExamTimetable=async()=>{throw new Error('fixture provider unavailable')}
  const retryData=new FormData();retryData.set('file',new Blob([pdf],{type:'application/pdf'}),'replacement.pdf');retryData.set('expectedRevision',String(uploaded.revision))
  let retry
  try { retry=await fetch(base+`/admin/nightklass/exam-content/calendars/${created.body.id}/upload`,{method:'POST',headers:{Authorization:`Bearer ${ownerToken}`},body:retryData}) } finally { ai.extractExamTimetable=original }
  assert.equal(retry.status,201)
  const failedExtraction=await retry.json()
  assert.match(failedExtraction.extractionWarning,/Original PDF saved/)
  assert.equal(failedExtraction.entries.length,0)
  assert.equal(failedExtraction.fileName,'replacement.pdf')
  assert.equal(failedExtraction.status,'DRAFT')

  const source=await admin(`calendars/${created.body.id}/file`,undefined,'GET')
  assert.equal(source.status,200);await assertSignedDownload(source.body.url,/exam-timetables\/.+\.pdf/)
  assert.equal((await call(`/admin/nightklass/exam-content/calendars/${created.body.id}/file`,learnerToken)).status,403)
})
