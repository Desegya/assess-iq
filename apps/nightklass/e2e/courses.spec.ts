import { test, expect, type Page } from '@playwright/test'

const user = { id: 'course-learner', name: 'Course Learner', role: 'STUDENT', organizationId: null }
const course = (id: string, title: string) => ({
  id,
  title,
  subject: title,
  courseCode: null,
  description: null,
  level: 100,
  semester: 'FIRST',
  creditUnits: 3,
  isCarryover: false,
  targetExamDate: null as string | null,
  topics: [],
  outlineText: null,
  outlineSource: null,
  _count: { documents: 0, questions: 0, assessments: 0 },
})
type Course = ReturnType<typeof course>

test('a saved day-by-day timetable restores selected days and keeps time fields hidden', async ({
  page,
}) => {
  await setup(page, [course('biology', 'Biology')])
  await page.route('**/api/v1/study/plans/current?*', (route) =>
    route.fulfill({
      json: {
        planType: 'DURATION',
        weeks: 5,
        weeklyMinutes: 180,
        schedulingPreferences: {
          schedulingStyle: 'DAILY',
          studyDays: [1, 3, 5],
          studyPreference: 'EVENINGS',
          avoidWorkHours: true,
          workStart: '09:00',
          workEnd: '17:00',
        },
      },
    }),
  )
  await page.goto('/courses/biology')
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await expect(page.getByLabel('Day-by-day timetable (no fixed times)')).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Mon', exact: true })).toBeChecked()
  await expect(page.getByRole('checkbox', { name: 'Tue', exact: true })).not.toBeChecked()
  await expect(page.getByLabel('Work / class starts')).toBeHidden()
})

test('a daily timetable asks for days and workload without asking for clock times', async ({
  page,
}) => {
  await setup(page, [course('biology', 'Biology')])
  await page.route('**/api/v1/study/plans/generate', (route) => route.fulfill({ json: {} }))
  await page.goto('/courses/biology')
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await page.getByLabel('Day-by-day timetable (no fixed times)').check()
  await expect(page.getByLabel('Work / class starts')).toBeHidden()
  await expect(page.getByLabel('When do you prefer to study?')).toBeHidden()
  await page.getByLabel('Hours per week for this course').fill('3')
  for (const day of ['Tue', 'Thu', 'Sat'])
    await page.getByRole('checkbox', { name: day, exact: true }).uncheck()
  const request = page.waitForRequest(
    (request) => request.url().includes('/study/plans/generate') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Generate study plan', exact: true }).click()
  const payload = (await request).postDataJSON()
  expect(payload).toMatchObject({ schedulingStyle: 'DAILY', weeklyHours: 3, studyDays: [1, 3, 5] })
  expect(payload.workStart).toBeUndefined()
  await expect(page).toHaveURL(/\/courses\/biology\/plan$/)
})

test('Today lists flexible tasks, tracks completion across reloads, and shows missed work separately', async ({
  page,
}) => {
  await setup(page, [course('biology', 'Biology'), course('chemistry', 'Chemistry')])
  const sessions = [
    {
      id: 'biology-task',
      startTime: null,
      endTime: null,
      estimatedMinutes: 45,
      status: 'NOT_STARTED',
      kind: 'LEARN',
      note: null,
      topic: { id: 'cells', name: 'Cell structure' },
      course: { id: 'biology', title: 'Biology' },
    },
    {
      id: 'chemistry-task',
      startTime: null,
      endTime: null,
      estimatedMinutes: 30,
      status: 'NOT_STARTED',
      kind: 'REVIEW',
      note: null,
      topic: { id: 'atoms', name: 'Atoms' },
      course: { id: 'chemistry', title: 'Chemistry' },
    },
  ]
  await page.route('**/api/v1/study/sessions/today?*', (route) => route.fulfill({ json: sessions }))
  await page.route('**/api/v1/study/sessions/overdue?*', (route) =>
    route.fulfill({
      json: [
        { id: 'old-task', studyPlanId: 'old-plan', course: { id: 'biology', title: 'Biology' } },
      ],
    }),
  )
  await page.route('**/api/v1/study/sessions/*/complete', (route) => {
    if (route.request().url().includes('chemistry-task'))
      return route.fulfill({
        status: 503,
        json: { message: 'Could not save completion. Try again.' },
      })
    sessions[0]!.status = 'COMPLETED'
    return route.fulfill({ json: sessions[0] })
  })
  await page.goto('/today')
  await expect(page.getByText('Anytime today', { exact: false }).first()).toBeVisible()
  await expect(page.getByRole('status')).toContainText('0 of 2 tasks complete today')
  const biology = page
    .locator('.card-accent')
    .filter({ has: page.getByRole('heading', { name: 'Cell structure', exact: true }) })
  await biology.getByRole('link', { name: 'Open lesson' }).click()
  await page.goto('/today')
  await expect(page.getByRole('status')).toContainText('0 of 2 tasks complete today')
  await biology.getByRole('button', { name: 'Mark complete' }).click()
  await expect(page.getByRole('status')).toContainText('1 of 2 tasks complete today')
  await page.reload()
  await expect(page.getByRole('status')).toContainText('1 of 2 tasks complete today')
  await expect(biology.getByRole('button', { name: 'Mark complete' })).toHaveCount(0)
  const chemistry = page
    .locator('.card-accent')
    .filter({ has: page.getByRole('heading', { name: 'Atoms', exact: true }) })
  await chemistry.getByRole('button', { name: 'Mark complete' }).click()
  await expect(chemistry.getByRole('alert')).toHaveText('Could not save completion. Try again.')
  await expect(chemistry.getByRole('alert')).toBeInViewport()
  await page.getByText('Unfinished from earlier days (1)', { exact: true }).click()
  await expect(page.getByRole('link', { name: 'Review Biology plan' })).toHaveAttribute(
    'href',
    '/courses/biology/plan',
  )
  await page.route('**/api/v1/study/progress', (route) =>
    route.fulfill({ json: { courses: [], last30Days: [], currentStreak: 0, longestStreak: 0 } }),
  )
  await page.goto('/dashboard')
  await expect(page.getByText('Today’s study', { exact: true })).toBeVisible()
  await expect(page.getByText('Anytime today · 45 min · Done')).toBeVisible()
  await page.getByRole('link', { name: /Biology Cell structure Anytime today/ }).click()
  await expect(page).toHaveURL(/\/today$/)
})

test('study setup restores saved weekly hours, preferences and plan length', async ({ page }) => {
  await setup(page, [course('biology', 'Biology')])
  await page.route('**/api/v1/study/plans/current?*', (route) =>
    route.fulfill({
      json: {
        planType: 'DURATION',
        weeks: 10,
        weeklyMinutes: 180,
        schedulingPreferences: {
          studyPreference: 'WEEKENDS',
          avoidWorkHours: false,
          workStart: '08:00',
          workEnd: '16:00',
        },
      },
    }),
  )
  await page.goto('/courses/biology')
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await expect(page.getByLabel('Hours per week for this course')).toHaveValue('3')
  await expect(page.getByLabel('When do you prefer to study?')).toHaveValue('WEEKENDS')
  await expect(page.getByLabel('Keep weekday work / class hours free')).not.toBeChecked()
  await expect(page.getByRole('button', { name: '10 weeks', exact: true })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('course sections collapse and weekly budgets do not overwrite exact-time availability', async ({
  page,
}) => {
  await setup(page, [course('biology', 'Biology')])
  const availabilityWrites: string[] = []
  page.on('request', (request) => {
    if (request.method() === 'POST' && request.url().includes('/study/availability'))
      availabilityWrites.push(request.url())
  })
  await page.route('**/api/v1/study/plans/generate', (route) => route.fulfill({ json: {} }))
  await page.goto('/courses/biology')
  await expect(page.getByLabel('Lecture notes or slides')).toBeHidden()
  await expect(page.getByLabel('Hours per week for this course')).toBeHidden()
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await expect(page.getByLabel('Hours per week for this course')).toHaveValue('4')
  await expect(page.getByLabel('Mon study start time')).toBeHidden()
  await page.getByLabel('Hours per week for this course').fill('3')
  await page.getByLabel('When do you prefer to study?').selectOption('WEEKENDS')
  await page.locator('#setup > summary').click()
  await expect(page.getByLabel('Hours per week for this course')).toBeHidden()
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await expect(page.getByLabel('Hours per week for this course')).toHaveValue('3')
  const request = page.waitForRequest(
    (request) => request.url().includes('/study/plans/generate') && request.method() === 'POST',
  )
  await page.getByRole('button', { name: 'Generate study plan', exact: true }).click()
  expect((await request).postDataJSON()).toMatchObject({
    courseId: 'biology',
    weeklyHours: 3,
    studyPreference: 'WEEKENDS',
    avoidWorkHours: true,
    weeks: 13,
  })
  await expect(page).toHaveURL(/\/courses\/biology\/plan$/)
  expect(availabilityWrites).toEqual([])
})

test('course uploads remain visible after revisiting and can be opened', async ({ page }) => {
  await setup(page, [course('biology', 'Biology')])
  await page
    .context()
    .route('https://files.example.test/**', (route) =>
      route.fulfill({ contentType: 'text/html', body: 'Uploaded course file' }),
    )
  await page.route('**/api/v1/documents?*', async (route) => {
    expect(new URL(route.request().url()).searchParams.get('courseId')).toBe('biology')
    await route.fulfill({
      json: [
        {
          id: 'notes',
          fileName: 'Cell biology.pdf',
          status: 'READY',
          createdAt: '2026-10-01T12:00:00Z',
        },
      ],
    })
  })
  await page.route('**/api/v1/documents/notes/download-url', (route) =>
    route.fulfill({ json: { url: 'https://files.example.test/cell-biology.pdf' } }),
  )
  await page.goto('/courses/biology')
  await page.getByRole('button', { name: 'Study materials', exact: true }).click()
  const materials = page.getByLabel('Uploaded course materials')
  await expect(materials.getByText('Cell biology.pdf')).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'Study materials', exact: true }).click()
  await expect(materials.getByText('Cell biology.pdf')).toBeVisible()
  const popup = page.waitForEvent('popup')
  await materials.getByRole('button', { name: 'Open Cell biology.pdf' }).click()
  await expect
    .poll(() => popup.then((tab) => tab.url()))
    .toBe('https://files.example.test/cell-biology.pdf')
})

async function setup(page: Page, initial: Course[] = []) {
  const courses = [...initial]
  const created: string[] = []
  let failTitle = ''
  await page
    .context()
    .addCookies([{ name: 'nk_session', value: '1', url: 'http://127.0.0.1:3102' }])
  await page.addInitScript((user) => {
    localStorage.setItem('nightklass:user', JSON.stringify(user))
    localStorage.setItem('nightklass:refreshToken', 'test-refresh')
  }, user)
  await page.route('**/api/v1/**', async (route) => {
    const request = route.request()
    const path = new URL(request.url()).pathname.replace('/api/v1', '')
    if (path === '/courses' && request.method() === 'POST') {
      const data = request.postDataJSON()
      if (data.title === failTitle) {
        failTitle = ''
        return route.fulfill({
          status: 503,
          json: { message: 'Please retry the remaining courses' },
        })
      }
      const saved = { ...course(`course-${courses.length + 1}`, data.title), ...data }
      courses.push(saved)
      created.push(data.title)
      return route.fulfill({ json: saved })
    }
    const id = path.match(/^\/courses\/([^/]+)$/)?.[1]
    if (id) {
      const selected = courses.find((c) => c.id === id)
      if (request.method() === 'DELETE') {
        courses.splice(
          courses.findIndex((c) => c.id === id),
          1,
        )
        return route.fulfill({ json: { message: 'Deleted' } })
      }
      if (request.method() === 'PATCH' && selected) Object.assign(selected, request.postDataJSON())
      return route.fulfill({ json: selected })
    }
    if (path === '/documents/upload')
      return route.fulfill({ json: { id: 'outline-doc', status: 'READY' } })
    if (path.includes('/topics/suggest') || path.includes('/outline/document/'))
      return route.fulfill({ json: { source: 'ai', proposals: [] } })
    if (path.includes('/plans/current'))
      return route.fulfill({ status: 404, json: { message: 'No plan yet' } })
    const json =
      path === '/courses'
        ? courses
        : path === '/auth/refresh'
          ? { accessToken: 'test-access', refreshToken: 'test-refresh', expiresIn: 3600 }
          : path === '/auth/me'
            ? user
            : path === '/users/me/profile'
              ? {
                  studyPathway: 'TERTIARY',
                  currentLevel: 100,
                  currentSemester: 'FIRST',
                  profileCompletedAt: '2026-10-30',
                }
              : path === '/study/course-suggestions'
                ? {
                    courses: [
                      course('suggestion-1', 'Biology'),
                      course('suggestion-2', 'Chemistry'),
                    ],
                  }
                : path === '/study/progress'
                  ? { courses: [] }
                  : path.includes('/readiness')
                    ? { score: 0, topics: [] }
                    : []
    await route.fulfill({ json })
  })
  return {
    courses,
    created,
    failNext: (title: string) => {
      failTitle = title
    },
  }
}

async function addManual(page: Page, name: string, outline = false) {
  await page.goto(`/courses/new?path=${outline ? 'outline' : 'manual'}`)
  await page.getByLabel('Course code or title').fill(name)
  await page.getByLabel('Level', { exact: true }).selectOption('100')
  await page.getByLabel('Semester', { exact: true }).selectOption('FIRST')
  if (outline)
    await page.getByLabel('Course outline', { exact: true }).setInputFiles({
      name: 'outline.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('Cell structure and genetics'),
    })
  if (!outline) await page.getByRole('checkbox', { name: /Generate a topic outline/ }).uncheck()
  await page.getByRole('button', { name: 'Create course', exact: true }).click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}

test('manual and outline additions keep both courses visible and allow switching, editing and deletion', async ({
  page,
}) => {
  const state = await setup(page)
  await addManual(page, 'Biology')
  await addManual(page, 'Chemistry', true)
  await page.getByLabel(/Your courses/).selectOption('course-1')
  await expect(page.getByRole('heading', { name: 'Biology', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'My courses', exact: true }).last().click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await page.reload()
  await expect(page.getByRole('article')).toHaveCount(2)
  await page.getByRole('link', { name: 'Edit Biology', exact: true }).click()
  await page.getByLabel('Course title', { exact: true }).fill('Biology I')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await page.getByRole('link', { name: 'My courses', exact: true }).last().click()
  await expect(page.getByRole('article', { name: 'Biology I', exact: true })).toBeVisible()
  page.once('dialog', (dialog) => dialog.accept())
  await page.getByRole('button', { name: 'Delete Biology I', exact: true }).click()
  await expect(page.getByRole('article')).toHaveCount(1)
  await expect(page.getByRole('article', { name: 'Chemistry', exact: true })).toBeVisible()
  expect(state.courses.map((c) => c.title)).toEqual(['Chemistry'])
})

test('a partial programme addition retries only unsaved courses', async ({ page }) => {
  const state = await setup(page, [course('existing', 'Physics')])
  state.failNext('Chemistry')
  await page.goto('/courses/new?path=programme')
  await page.getByRole('button', { name: /^Add \d+ courses?$/ }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'retry' })).toContainText('retry')
  await page.getByRole('button', { name: /^Add \d+ courses?$/ }).click()
  await expect(page).toHaveURL(/\/courses$/)
  await expect(page.getByRole('article')).toHaveCount(3)
  expect(state.created).toEqual(['Biology', 'Chemistry'])
})

test('returning to a course list refreshes courses added in another tab', async ({ page }) => {
  const state = await setup(page, [course('one', 'Biology')])
  await page.goto('/courses')
  await expect(page.getByRole('article')).toHaveCount(1)
  state.courses.push(course('two', 'Chemistry'))
  await page.evaluate(() => window.dispatchEvent(new Event('focus')))
  await expect(page.getByRole('article')).toHaveCount(2)
})

test('guided example is optional and saves an optional exam date for the next step', async ({
  page,
}) => {
  const state = await setup(page)
  await page.goto('/courses/new')
  await page.getByRole('button', { name: 'Try the example course', exact: true }).click()
  await expect(page.getByLabel('Course code or title')).toHaveValue(
    'BIO 101 Introduction to Biology',
  )
  expect(state.created).toEqual([])
  await page.getByLabel('Exam date (optional)', { exact: true }).fill('2099-06-15')
  await page.getByRole('checkbox', { name: /Generate a topic outline/ }).uncheck()
  await page.getByRole('button', { name: 'Create course', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'Introduction to Biology', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Study setup', exact: true }).click()
  await expect(page.getByLabel('Exam date', { exact: true })).toHaveValue('2099-06-15')
  expect(state.courses[0]?.targetExamDate).toBe('2099-06-15')
  await page.getByText('What does a study plan do?', { exact: true }).click()
  await expect(page.getByText(/It spreads your topics and revision/)).toBeVisible()
  await page.getByRole('button', { name: 'Edit course', exact: true }).click()
  await page.getByLabel('Exam date (optional)', { exact: true }).fill('')
  await page.getByRole('button', { name: 'Save changes', exact: true }).click()
  await expect(
    page.getByRole('button', { name: 'This semester (13 weeks)', exact: true }),
  ).toHaveAttribute('aria-pressed', 'true')
  expect(state.courses[0]?.targetExamDate).toBeNull()
  await page.goto('/guide')
  await expect(
    page.getByRole('heading', { name: 'Your first course, step by step.' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Changing your courses' })).toBeVisible()
})

test('AI-assisted course creation also keeps earlier courses', async ({ page }) => {
  await setup(page, [course('existing', 'Physics')])
  await page.goto('/courses/new?path=manual')
  await page.getByLabel('Course code or title').fill('Mathematics')
  await page.getByRole('button', { name: 'Create course', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Mathematics', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'My courses', exact: true }).last().click()
  await expect(page.getByRole('article')).toHaveCount(2)
  await expect(page.getByRole('article', { name: 'Physics', exact: true })).toBeVisible()
})
