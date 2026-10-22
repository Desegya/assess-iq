// Pilot load and recovery test. Usage (from apps/api, after `npm run build`):
//   DATABASE_URL=postgresql://.../nightklass_exam_test node test/load/mock-load.cjs [report.json]
// Env: LEARNERS (100), ANSWERS (60 per learner), WAEC_LEARNERS (20), RESTART (1 = kill and
// restart the API mid-exam), AI_MIN_MS/AI_MAX_MS/AI_FAILURE_RATE (stubbed marking).
// Runs the API as a separate process on a disposable database with a stubbed AI provider.
require('reflect-metadata')
const { fork } = require('node:child_process')
const { randomUUID, createHash } = require('node:crypto')
const path = require('node:path')
const fs = require('node:fs')
const { PrismaClient } = require('../../../../packages/db/generated/client')
const { hashPassword } = require('../../dist/common/passwords')

const db = new URL(process.env.DATABASE_URL || 'postgresql://invalid/invalid')
if (!/_test$/.test(db.pathname)) throw new Error('Load tests run only against a disposable *_test database')
const N = Number(process.env.LEARNERS || 100)
const ANSWERS = Number(process.env.ANSWERS || 60)
const WAEC_N = Number(process.env.WAEC_LEARNERS || 20)
const RESTART = process.env.RESTART !== '0'
const PORT = Number(process.env.PORT || 3201)
const BASE = `http://127.0.0.1:${PORT}/api/v1`
const YEAR = 2096
const run = randomUUID().slice(0, 6)
const prisma = new PrismaClient()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const pct = (xs, p) => { if (!xs.length) return null; const s = [...xs].sort((a, b) => a - b); return Math.round(s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]) }
const metrics = { errors: {}, statuses: {}, phases: {}, saveLatency: [], startLatency: [], loginLatency: [], answerLoss: 0, confirmedAnswers: 0, retries: 0, conflicts: 0, dbConnectionsMax: 0, serverMemoryMbMax: 0 }
const count = (phase, status, body) => {
  const k = `${phase}:${status}`; metrics.statuses[k] = (metrics.statuses[k] || 0) + 1
  if (status !== 200 && status !== 201 && body) {
    const m = `${k} ${typeof body === 'string' ? body.slice(0, 120) : JSON.stringify(body.message ?? body).slice(0, 120)}`
    metrics.errors[m] = (metrics.errors[m] || 0) + 1
  }
}

let server
function startServer() {
  return new Promise((resolve, reject) => {
    server = fork(path.join(__dirname, 'load-server.cjs'), [], { env: { ...process.env, PORT: String(PORT), JWT_SECRET: secrets.jwt, JWT_REFRESH_SECRET: secrets.refresh }, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] })
    server.once('message', (m) => m === 'ready' && resolve())
    server.once('exit', (code) => code && reject(new Error(`server exited ${code}`)))
  })
}
const secrets = { jwt: randomUUID() + randomUUID(), refresh: randomUUID() + randomUUID() }

async function http(method, p, token, body) {
  const t = Date.now()
  try {
    const res = await fetch(BASE + p, { method, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    const text = await res.text()
    let json; try { json = JSON.parse(text) } catch { json = text }
    return { status: res.status, body: json, ms: Date.now() - t, retryAfter: Number(res.headers.get('retry-after-short') || res.headers.get('retry-after-medium') || res.headers.get('retry-after') || 0) }
  } catch {
    return { status: 0, body: null, ms: Date.now() - t, retryAfter: 0 }
  }
}

// A classroom signs in over a short window, not in one millisecond; a 429 is retried
// after Retry-After, the way a learner would press the button again.
async function signIn(l, windowMs) {
  await sleep(Math.random() * windowMs)
  for (let tries = 0; tries < 10; tries++) {
    const res = await http('POST', '/auth/login', null, { email: l.email, password: l.password })
    count('login', res.status); metrics.loginLatency.push(res.ms)
    if (res.status === 200) return (l.token = res.body.accessToken)
    await sleep(Math.max(1, res.retryAfter || 1) * 1000)
  }
}

async function monitor(stop) {
  while (!stop.done) {
    const [{ n }] = await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM pg_stat_activity WHERE datname = current_database()`)
    metrics.dbConnectionsMax = Math.max(metrics.dbConnectionsMax, n)
    const stats = await http('GET', '/../../__load/stats').catch(() => null)
    if (stats?.status === 200) metrics.serverMemoryMbMax = Math.max(metrics.serverMemoryMbMax, stats.body.memoryMb)
    await sleep(1000)
  }
}

async function seed() {
  const t = Date.now()
  const owner = await prisma.user.create({ data: { name: 'Load owner', email: `load-owner-${run}@example.test`, passwordHash: 'x', role: 'STUDENT', status: 'ACTIVE' } })
  await prisma.examMockTemplate.upsert({
    where: { year: YEAR },
    create: { year: YEAR, title: 'Load-test JAMB form', durationMinutes: 120, englishCount: 60, otherCount: 40, instructions: 'Load-test fixture with a full 180-question form.', sourceNote: 'Load-test fixture only.', status: 'APPROVED' },
    update: { status: 'APPROVED', englishCount: 60, otherCount: 40, durationMinutes: 120 },
  })
  const subjects = [['english', 'English Language'], [`physics load ${run}`, `Physics Load ${run}`], [`chemistry load ${run}`, `Chemistry Load ${run}`], [`biology load ${run}`, `Biology Load ${run}`]]
  // Realistic sizes: ~450-character stems and ~60-character options.
  const stem = (s, i) => `${s} load question ${run}-${i}. ` + 'A learner reads a realistic examination stem describing context, data and a precise question to answer. '.repeat(4)
  for (const [key, name] of subjects)
    await prisma.examBankQuestion.createMany({
      data: Array.from({ length: 250 }, (_, i) => ({
        exam: 'JAMB', subject: name, subjectKey: key, topic: `Load topic ${i % 12}`, questionText: stem(name, i), questionType: 'MCQ',
        options: ['A', 'B', 'C', 'D'].map((k) => ({ key: k, text: `Option ${k} for item ${i}: a plausible distractor of realistic length` })),
        correctAnswer: 'A', explanation: 'Load-test explanation of moderate length. '.repeat(3), marks: 1, difficulty: 'MEDIUM', status: 'APPROVED',
        createdById: owner.id, fingerprint: createHash('sha256').update(`${run}-${key}-${i}`).digest('hex'), fingerprintVersion: 2,
      })),
    })
  const waecKey = `government load ${run}`
  const waecQuestions = []
  for (let i = 0; i < 6; i++)
    waecQuestions.push(await prisma.examBankQuestion.create({ data: { exam: 'WAEC', subject: `Government Load ${run}`, subjectKey: waecKey, topic: 'Load essays', questionText: `(a) Define democracy. (b) Explain two features. Load ${run}-${i}`, questionType: 'THEORY', options: [], correctAnswer: 'Rule by the people (4); two features with explanation (6)', explanation: 'Example answer for teachers.', marks: 10, difficulty: 'MEDIUM', status: 'APPROVED', createdById: owner.id, fingerprint: `load-waec-${run}-${i}`, fingerprintVersion: 2 } }))
  const paper = await prisma.waecPaperTemplate.create({ data: { year: YEAR, series: 'SCHOOL', subject: `Government Load ${run}`, subjectKey: waecKey, paperCode: `LOAD-${run}`, title: `Load WAEC ${run}`, durationMinutes: 60, instructions: 'Answer both essays.', sourceNote: 'Load-test fixture only.', status: 'APPROVED', sections: [{ id: 'essays', title: 'Essays', questionType: 'THEORY', count: 2, choose: 2, marks: 10 }] } })
  const password = 'Load-test-password-1!'
  const passwordHash = await hashPassword(password)
  const learners = []
  for (let i = 0; i < N + WAEC_N; i++)
    learners.push(await prisma.user.create({ data: { name: `Load learner ${i}`, email: `load-${run}-${i}@example.test`, passwordHash, role: 'STUDENT', status: 'ACTIVE', studyPathway: 'EXAM_PREPARATION', secondaryStage: 'SS3' } }))
  metrics.phases.seedMs = Date.now() - t
  return { subjects, learners, password, paper, waecSubject: `Government Load ${run}` }
}

// Mirrors the browser autosave: changed answers only, version chaining, backoff on 429/5xx/offline,
// reload-and-replay on 409. `confirmed` holds exactly what the server acknowledged.
async function saveLoop(l, attempt, answers) {
  let version = attempt.version
  const confirmed = {}
  for (const [qid, key] of answers) {
    await sleep(500 + Math.random() * 1500)
    let pending = { [qid]: key }
    for (let tries = 0; Object.keys(pending).length && tries < 30; tries++) {
      const res = await http('PATCH', `/exam-preparation/mocks/${attempt.id}/answers`, l.token, { expectedVersion: version, answers: Object.entries(pending).map(([questionId, answer]) => ({ questionId, answer })), flags: [] })
      count('save', res.status, res.body)
      if (res.status === 200) {
        metrics.saveLatency.push(res.ms)
        version = res.body.version
        Object.assign(confirmed, pending)
        pending = {}
      } else if (res.status === 409) {
        metrics.conflicts++
        const latest = await http('GET', `/exam-preparation/mocks/${attempt.id}`, l.token)
        if (latest.status !== 200 || latest.body.status !== 'IN_PROGRESS') break
        version = latest.body.version
        for (const [k, v] of Object.entries(pending)) if (latest.body.answers[k] === v) { confirmed[k] = v; delete pending[k] }
      } else {
        metrics.retries++
        if (res.status === 401) await signIn(l, 0)
        await sleep(Math.min(30000, Math.max(res.retryAfter * 1000, 2 ** Math.min(tries + 1, 5) * 250)))
      }
    }
  }
  return confirmed
}

async function main() {
  const report = process.argv[2]
  const fixture = await seed()
  await startServer()
  const stop = { done: false }
  const monitoring = monitor(stop)

  // 1. Everyone signs in from one address (a school network or carrier NAT).
  let t = Date.now()
  const jamb = fixture.learners.slice(0, N).map((u) => ({ email: u.email, password: fixture.password, id: u.id }))
  await Promise.all(jamb.map((l) => signIn(l, 20000)))
  metrics.phases.loginMs = Date.now() - t

  // 2. Concurrent onboarding (Serializable goal saves).
  t = Date.now()
  await Promise.all(jamb.map(async (l) => {
    const res = await http('PUT', '/exam-preparation/goals', l.token, { exam: 'JAMB', year: YEAR, subjects: fixture.subjects.map((s) => s[1]) })
    count('goal', res.status, res.body); l.goalId = res.body?.id
  }))
  metrics.phases.goalsMs = Date.now() - t

  // 3. Simultaneous mock starts: 180 questions each, sampled unseen-first.
  t = Date.now()
  await Promise.all(jamb.map(async (l) => {
    const res = await http('POST', '/exam-preparation/mocks', l.token, { goalId: l.goalId, requestKey: randomUUID() })
    count('start', res.status, res.body); metrics.startLatency.push(res.ms); if (res.status === 201) l.attempt = res.body
  }))
  metrics.phases.startMs = Date.now() - t

  // 4. Answering at a realistic cadence, with an API kill and restart in the middle.
  t = Date.now()
  const restart = RESTART && (async () => {
    await sleep(20000)
    const killedAt = Date.now()
    server.kill('SIGTERM')
    await new Promise((r) => server.once('exit', r))
    await sleep(3000)
    await startServer()
    metrics.phases.restartDowntimeMs = Date.now() - killedAt
  })()
  const results = await Promise.all(jamb.map(async (l) => {
    if (!l.attempt?.questions) return null
    const picks = l.attempt.questions.slice(0, ANSWERS).map((q) => [q.id, ['A', 'B', 'C', 'D'][Math.floor(Math.random() * 4)]])
    return { l, confirmed: await saveLoop(l, l.attempt, picks) }
  }))
  await restart
  metrics.phases.answeringMs = Date.now() - t

  // 5. Every acknowledged answer must be in the database.
  for (const r of results.filter(Boolean)) {
    const row = await prisma.examMockAttempt.findUnique({ where: { id: r.l.attempt.id } })
    for (const [k, v] of Object.entries(r.confirmed)) { metrics.confirmedAnswers++; if (row.answers[k] !== v) metrics.answerLoss++ }
  }

  // 6. Half submit at once; the other half expire and must be finalized by the worker alone.
  const half = Math.floor(jamb.length / 2)
  t = Date.now()
  await Promise.all(jamb.slice(0, half).filter((l) => l.attempt).map(async (l) => { const res = await http('POST', `/exam-preparation/mocks/${l.attempt.id}/submit`, l.token, {}); count('submit', res.status, res.body) }))
  metrics.phases.submitMs = Date.now() - t
  const expiring = jamb.slice(half).filter((l) => l.attempt).map((l) => l.attempt.id)
  await prisma.examMockAttempt.updateMany({ where: { id: { in: expiring } }, data: { expiresAt: new Date() } })
  t = Date.now()
  while (await prisma.examMockAttempt.count({ where: { id: { in: expiring }, status: 'IN_PROGRESS' } })) {
    if (Date.now() - t > 120000) break
    await sleep(1000)
  }
  metrics.phases.expiryFinalizeMs = Date.now() - t
  metrics.expiredStillInProgress = await prisma.examMockAttempt.count({ where: { id: { in: expiring }, status: 'IN_PROGRESS' } })

  // 7. Concurrent WAEC written submissions with slow, sometimes failing AI marking.
  const waec = fixture.learners.slice(N).map((u) => ({ email: u.email, password: fixture.password }))
  await Promise.all(waec.map(async (l) => {
    await signIn(l, 5000)
    const goal = await http('PUT', '/exam-preparation/goals', l.token, { exam: 'WAEC', year: YEAR, series: 'SCHOOL', subjects: [fixture.waecSubject] })
    const started = await http('POST', '/exam-preparation/waec-papers/start', l.token, { goalId: goal.body.id, paperId: fixture.paper.id, requestKey: randomUUID() })
    count('waec-start', started.status)
    l.attemptId = started.body?.id
    const saved = await http('PATCH', `/exam-preparation/mocks/${l.attemptId}/answers`, l.token, { expectedVersion: started.body.version, answers: started.body.questions.map((q) => ({ questionId: q.id, answer: 'Democracy is government by the people; elections and accountability are features.' })), flags: [] })
    count('waec-save', saved.status)
  }))
  t = Date.now()
  await Promise.all(waec.map(async (l) => count('waec-submit', (await http('POST', `/exam-preparation/mocks/${l.attemptId}/submit`, l.token, {})).status)))
  const ids = waec.map((l) => l.attemptId)
  while (await prisma.examMockAttempt.count({ where: { id: { in: ids }, status: 'SUBMITTED' } })) {
    if (Date.now() - t > 15 * 60000) break
    await sleep(2000)
  }
  metrics.phases.writtenMarkingMs = Date.now() - t
  const waecRows = await prisma.examMockAttempt.findMany({ where: { id: { in: ids } }, select: { status: true, result: true } })
  metrics.waec = {
    graded: waecRows.filter((r) => r.status === 'GRADED' && !r.result?.gradingFailed).length,
    gradingFailed: waecRows.filter((r) => r.result?.gradingFailed).length,
    stillSubmitted: waecRows.filter((r) => r.status === 'SUBMITTED').length,
  }
  metrics.ai = (await http('GET', '/../../__load/stats')).body

  stop.done = true
  await monitoring
  server.kill('SIGTERM')
  const summary = {
    learners: N, answersPerLearner: ANSWERS, restartTested: RESTART,
    statuses: metrics.statuses, errors: metrics.errors,
    saves: { count: metrics.saveLatency.length, p50: pct(metrics.saveLatency, 50), p95: pct(metrics.saveLatency, 95), p99: pct(metrics.saveLatency, 99), retries: metrics.retries, conflicts: metrics.conflicts },
    confirmedAnswers: metrics.confirmedAnswers, confirmedAnswerLoss: metrics.answerLoss,
    login: { p50: pct(metrics.loginLatency, 50), p95: pct(metrics.loginLatency, 95) },
    start: { p50: pct(metrics.startLatency, 50), p95: pct(metrics.startLatency, 95) },
    phases: metrics.phases, expiredStillInProgress: metrics.expiredStillInProgress,
    waec: metrics.waec, ai: metrics.ai,
    dbConnectionsMax: metrics.dbConnectionsMax, serverMemoryMbMax: metrics.serverMemoryMbMax,
  }
  console.log(JSON.stringify(summary, null, 2))
  if (report) fs.writeFileSync(report, JSON.stringify(summary, null, 2))
  await prisma.$disconnect()
}
main().catch(async (e) => { console.error(e); server?.kill('SIGTERM'); await prisma.$disconnect(); process.exit(1) })
