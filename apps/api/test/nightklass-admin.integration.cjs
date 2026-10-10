require('reflect-metadata')
const { test, before, after } = require('node:test')
const assert = require('node:assert/strict')
const { randomUUID } = require('node:crypto')
const { NestFactory } = require('@nestjs/core')
const { ValidationPipe, VersioningType } = require('@nestjs/common')
const { PrismaClient } = require('../../../packages/db/generated/client')
const { hash } = require('bcryptjs')
if (
  !process.env.DATABASE_URL ||
  !new URL(process.env.DATABASE_URL).pathname.endsWith('/nightklass_admin_test')
)
  throw new Error('Use a disposable database named nightklass_admin_test')
process.env.JWT_SECRET = randomUUID() + randomUUID()
process.env.JWT_REFRESH_SECRET = randomUUID() + randomUUID()
process.env.OPENAI_API_KEY = ''
process.env.R2_ACCESS_KEY_ID = ''
process.env.R2_ENDPOINT = ''
const prisma = new PrismaClient()
const password = randomUUID(),
  suffix = randomUUID().slice(0, 8)
let app,
  base,
  owner,
  learner,
  colleague,
  institutional,
  course,
  topic,
  lesson,
  report,
  ownerToken,
  learnerToken,
  refreshToken
async function call(path, options = {}) {
  const response = await fetch(`${base}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  })
  return { status: response.status, body: await response.json() }
}
async function login(user) {
  await new Promise((resolve) => setTimeout(resolve, 600))
  const response = await call('/auth/login', {
    method: 'POST',
    body: { email: user.email, password },
  })
  assert.equal(response.status, 200)
  return response.body
}
const admin = (path, options = {}) =>
  call(`/admin/nightklass/${path}`, { token: ownerToken, ...options })
before(
  async () => {
    const passwordHash = await hash(password, 12)
    const account = (name) =>
      prisma.user.create({
        data: {
          name,
          email: `${name.toLowerCase()}-${suffix}@example.test`,
          passwordHash,
          role: 'STUDENT',
          status: 'ACTIVE',
        },
      })
    owner = await account('Owner')
    learner = await account('Learner')
    colleague = await account('Colleague')
    const org = await prisma.organization.create({
      data: {
        name: `Institution ${suffix}`,
        slug: `institution-${suffix}`,
        joinCode: suffix,
        type: 'UNIVERSITY',
      },
    })
    institutional = await prisma.user.create({
      data: {
        name: 'Institution admin',
        email: `org-${suffix}@example.test`,
        passwordHash,
        role: 'ORG_ADMIN',
        status: 'ACTIVE',
        organizationId: org.id,
      },
    })
    await prisma.nightklassAdmin.create({ data: { userId: owner.id, role: 'OWNER' } })
    course = await prisma.course.create({
      data: { title: `Biostatistics ${suffix}`, subject: 'Biostatistics', ownerId: learner.id },
    })
    topic = await prisma.topic.create({ data: { courseId: course.id, name: 'Averages' } })
    lesson = await prisma.topicLesson.create({
      data: {
        topicId: topic.id,
        version: 1,
        mode: 'AI',
        createdById: learner.id,
        sourceChunkIds: [],
        sourceDocumentIds: [],
        content: {
          introduction: 'Introduction to averages',
          sections: [{ heading: 'Mean', body: 'Sum divided by count' }],
          summary: ['A mean is an average.'],
          objectives: ['Understand averages'],
        },
      },
    })
    report = await prisma.contentReport.create({
      data: { lessonId: lesson.id, userId: learner.id, reason: 'Please clarify this formula.' },
    })
    await prisma.document.create({
      data: {
        uploadedById: learner.id,
        courseId: course.id,
        fileName: 'Notes.pdf',
        fileType: 'PDF',
        fileSizeBytes: 1024,
        fileUrl: 'private/key',
        status: 'READY',
      },
    })
    await prisma.course.create({
      data: {
        title: 'Institutional course',
        subject: 'Maths',
        organizationId: org.id,
        teacherId: institutional.id,
      },
    })
    const { AppModule } = require('../dist/app.module.js')
    app = await NestFactory.create(AppModule, { logger: ['error'] })
    app.setGlobalPrefix('api')
    app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' })
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    )
    await app.listen(0, '127.0.0.1')
    base = `${await app.getUrl()}/api/v1`
    ownerToken = (await login(owner)).accessToken
    const session = await login(learner)
    learnerToken = session.accessToken
    refreshToken = session.refreshToken
  },
  { timeout: 30000 },
)
after(async () => {
  if (app) await app.close()
  await prisma.$disconnect()
})
test('all admin modules reject unauthenticated and ungranted accounts', async () => {
  const orgToken = (await login(institutional)).accessToken
  for (const path of [
    'me',
    'overview',
    'users',
    'courses',
    'lessons',
    'questions',
    'materials',
    'reports',
    'activity',
    'audit',
    'access',
  ]) {
    assert.equal((await admin(path, { token: undefined })).status, 401, path)
    assert.equal((await admin(path, { token: learnerToken })).status, 403, path)
    assert.equal((await admin(path, { token: orgToken })).status, 403, path)
  }
})
test('lists are scoped, paginated, searchable, validated, and omit secrets', async () => {
  const users = await admin(`users?search=${suffix}&limit=2&page=1`)
  assert.equal(users.status, 200)
  assert.equal(users.body.items.length, 2)
  assert(!JSON.stringify(users.body).includes('passwordHash'))
  assert(!JSON.stringify(users.body).includes('refreshToken'))
  assert((await admin(`courses?search=${suffix}`)).body.items.some((c) => c.id === course.id))
  for (const query of ['limit=500', 'status=BOGUS', 'role=SUPER_ADMIN'])
    assert.equal((await admin(`users?${query}`)).status, 400)
  assert.equal((await admin('users/missing')).status, 404)
  assert.equal((await admin(`users/${institutional.id}`)).status, 404)
  assert(
    (await admin('materials')).body.items.every(
      (m) => !('fileUrl' in m) && !('extractedText' in m),
    ),
  )
})
test('only owners manage grants; self-revocation and administrator suspension are blocked', async () => {
  assert.equal(
    (
      await admin(`users/${colleague.id}/admin-access`, {
        method: 'PATCH',
        body: { role: 'ADMIN', reason: 'Trusted content reviewer' },
      })
    ).status,
    200,
  )
  const token = (await login(colleague)).accessToken
  assert.equal((await admin('me', { token })).status, 200)
  assert.equal(
    (
      await admin(`users/${learner.id}/admin-access`, {
        token,
        method: 'PATCH',
        body: { role: 'OWNER', reason: 'Unauthorized attempt' },
      })
    ).status,
    403,
  )
  assert.equal(
    (
      await admin(`users/${owner.id}/admin-access`, {
        method: 'PATCH',
        body: { role: 'NONE', reason: 'Own permission attempt' },
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await admin(`users/${colleague.id}/status`, {
        method: 'PATCH',
        body: { status: 'SUSPENDED', reason: 'Requires access removal' },
      })
    ).status,
    409,
  )
  assert.equal(
    (
      await admin(`users/${colleague.id}/admin-access`, {
        method: 'PATCH',
        body: { role: 'NONE', reason: 'Access no longer needed' },
      })
    ).status,
    200,
  )
  assert.equal((await admin('me', { token })).status, 403)
})
test('course and topic changes persist and remain available to the learner', async () => {
  const created = await admin(`users/${learner.id}/courses`, {
    method: 'POST',
    body: { title: 'New support course', courseCode: 'BIO101' },
  })
  assert.equal(created.status, 201)
  assert.equal((await call(`/courses/${created.body.id}`, { token: learnerToken })).status, 200)
  assert.equal((await admin(`courses/${created.body.id}`)).body.owner.name, 'Learner')
  assert.equal(
    (
      await admin(`courses/${created.body.id}`, {
        method: 'PATCH',
        body: { title: 'Updated support course' },
      })
    ).status,
    200,
  )
  const added = await admin(`courses/${course.id}/topics`, {
    method: 'POST',
    body: { name: 'Variance' },
  })
  assert.equal(added.status, 201)
  assert.equal(
    (
      await admin(`topics/${added.body.id}`, {
        method: 'PATCH',
        body: { name: 'Population variance', order: 1 },
      })
    ).status,
    200,
  )
  assert.equal(
    (
      await admin(`topics/${added.body.id}/archive`, {
        method: 'POST',
        body: { reason: 'Temporarily remove this topic' },
      })
    ).status,
    201,
  )
  assert(await prisma.topic.findUnique({ where: { id: added.body.id } }))
  assert.equal(
    (
      await admin(`topics/${added.body.id}/restore`, {
        method: 'POST',
        body: { reason: 'Ready for study again' },
      })
    ).status,
    201,
  )
  assert.equal((await prisma.topic.findUnique({ where: { id: added.body.id } })).archivedAt, null)
})
test('lesson corrections preserve originals and conflict on stale edits', async () => {
  const body = {
    introduction: 'A clearer introduction.',
    sections: [{ heading: 'Mean', body: 'Add values, then divide by their count.' }],
    summary: ['Calculate the mean.'],
    expectedVersion: 1,
    reason: 'Clarify the original explanation',
  }
  const corrected = await admin(`lessons/${lesson.id}/correct`, { method: 'POST', body })
  assert.equal(corrected.status, 201)
  assert.equal(corrected.body.version, 2)
  assert.equal(corrected.body.content.objectives[0], 'Understand averages')
  assert.equal((await admin(`lessons/${lesson.id}/correct`, { method: 'POST', body })).status, 409)
  assert.equal((await prisma.topicLesson.findUnique({ where: { id: lesson.id } })).version, 1)
  const learnerView = await call(`/learning/topics/${topic.id}/lesson`, { token: learnerToken })
  assert.equal(learnerView.status, 200)
  assert.equal(learnerView.body.lesson.version, 2)
})
test('question formats validate and graded question records cannot be edited', async () => {
  const body = {
    topicId: topic.id,
    questionText: 'Which is an average?',
    questionType: 'MCQ',
    correctAnswer: 'A',
    explanation: 'Mean is an average.',
    difficulty: 'MEDIUM',
    status: 'DRAFT',
    options: [
      { key: 'A', text: 'Mean' },
      { key: 'B', text: 'Range' },
    ],
    reason: 'Reviewed learner content',
  }
  assert.equal(
    (await admin('questions', { method: 'POST', body: { ...body, correctAnswer: 'C' } })).status,
    400,
  )
  for (const [questionType, answer] of [
    ['MCQ', 'A'],
    ['TRUE_FALSE', 'true'],
    ['SHORT_ANSWER', 'The mean'],
    ['THEORY', 'Sum values and divide by count'],
  ]) {
    const payload = {
      ...body,
      questionType,
      correctAnswer: answer,
      options: questionType === 'MCQ' ? body.options : undefined,
    }
    const result = await admin('questions', { method: 'POST', body: payload })
    assert.equal(result.status, 201)
    assert.equal(
      (
        await admin(`questions/${result.body.id}`, {
          method: 'PATCH',
          body: { ...payload, status: 'APPROVED' },
        })
      ).status,
      200,
    )
    await prisma.selfQuizAttempt.create({
      data: {
        studentId: learner.id,
        topicId: topic.id,
        courseId: course.id,
        difficulty: 'MEDIUM',
        scorePercent: 100,
        questionCount: 1,
        results: [{ questionId: result.body.id, isCorrect: true }],
      },
    })
    assert.equal(
      (await admin(`questions/${result.body.id}`, { method: 'PATCH', body: payload })).status,
      409,
    )
  }
})
test('report decisions and audit records persist', async () => {
  assert.equal(
    (
      await admin(`reports/${report.id}`, {
        method: 'PATCH',
        body: { status: 'RESOLVED', reason: 'Corrected the lesson explanation' },
      })
    ).status,
    200,
  )
  assert.equal(
    (await prisma.contentReport.findUnique({ where: { id: report.id } })).status,
    'RESOLVED',
  )
  const audit = await admin(`audit?search=${report.id}`)
  assert(
    audit.body.items.some((r) => r.action === 'REPORT_STATUS_CHANGED' && r.actorId === owner.id),
  )
  assert.equal(
    (
      await call(`/admin/nightklass/audit/${audit.body.items[0].id}`, {
        token: ownerToken,
        method: 'DELETE',
      })
    ).status,
    404,
  )
})
test('real metrics and account suspension invalidate issued tokens and refresh sessions', async () => {
  const stats = await admin('overview')
  assert.equal(stats.status, 200)
  assert(stats.body.quizAttempts >= 4)
  assert.equal(stats.body.averageQuizScore, 100)
  assert.equal(
    (
      await admin(`users/${learner.id}/status`, {
        method: 'PATCH',
        body: { status: 'SUSPENDED', reason: 'Support-requested suspension' },
      })
    ).status,
    200,
  )
  assert.equal((await call('/auth/me', { token: learnerToken })).status, 401)
  assert.equal(
    (await call('/auth/refresh', { method: 'POST', body: { refreshToken } })).status,
    401,
  )
  assert.equal(
    (
      await admin(`users/${learner.id}/status`, {
        method: 'PATCH',
        body: { status: 'ACTIVE', reason: 'Support verified restoration' },
      })
    ).status,
    200,
  )
  assert.equal((await call('/auth/me', { token: (await login(learner)).accessToken })).status, 200)
})
test('institution contracts remain unchanged and personal users cannot read other accounts', async () => {
  const token = (await login(institutional)).accessToken
  const result = await call('/courses', { token })
  assert.equal(result.status, 200)
  assert(result.body.some((c) => c.title === 'Institutional course'))
  assert(!result.body.some((c) => c.ownerId === learner.id))
  assert.equal((await call(`/users/${owner.id}`, { token: learnerToken })).status, 404)
  assert.equal((await call('/users/me/profile', { token: learnerToken })).status, 200)
})

test('all privileged mutations reject ordinary learners and unknown input fields', async () => {
  for (const [path, method] of [
    [`users/${learner.id}/status`, 'PATCH'],
    [`users/${learner.id}/admin-access`, 'PATCH'],
    [`users/${learner.id}/courses`, 'POST'],
    [`courses/${course.id}`, 'PATCH'],
    [`courses/${course.id}/topics`, 'POST'],
    [`topics/${topic.id}`, 'PATCH'],
    [`topics/${topic.id}/archive`, 'POST'],
    [`topics/${topic.id}/restore`, 'POST'],
    [`lessons/${lesson.id}/correct`, 'POST'],
    ['questions', 'POST'],
    [`reports/${report.id}`, 'PATCH'],
  ]) {
    assert.equal((await admin(path, { token: learnerToken, method, body: {} })).status, 403, path)
  }
  assert.equal(
    (await admin(`courses/${course.id}`, { method: 'PATCH', body: { ownerId: owner.id } })).status,
    400,
  )
  assert.equal(
    (
      await admin(`users/${learner.id}/admin-access`, {
        method: 'PATCH',
        body: { role: 'SUPER_ADMIN', reason: 'Invalid role attempt' },
      })
    ).status,
    400,
  )
  const registration = await call('/auth/register-student', {
    method: 'POST',
    body: {
      name: 'Unauthorized registration',
      email: `invalid-${suffix}@example.test`,
      password,
      role: 'SUPER_ADMIN',
      adminRole: 'OWNER',
    },
  })
  assert.equal(registration.status, 400)
})

test('public login rate limits are enforced and bootstrap cannot overwrite established access', async () => {
  const results = []
  for (let i = 0; i < 4; i++)
    results.push(
      (
        await call('/auth/login', {
          method: 'POST',
          body: { email: owner.email, password: 'invalid-test-password' },
        })
      ).status,
    )
  assert(results.includes(429))
  const { spawnSync } = require('node:child_process')
  const { resolve } = require('node:path')
  const bootstrap = spawnSync(
    process.execPath,
    [
      resolve(__dirname, '../../../packages/db/scripts/bootstrap-nightklass-admin.cjs'),
      owner.email,
    ],
    { env: process.env, encoding: 'utf8' },
  )
  assert.equal(bootstrap.status, 1)
  assert(bootstrap.stderr.includes('already provisioned'))
})
