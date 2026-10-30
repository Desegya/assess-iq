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
  await expect(page.getByLabel('Exam date', { exact: true })).toHaveValue('2099-06-15')
  expect(state.courses[0]?.targetExamDate).toBe('2099-06-15')
  await page.getByText('What does a study plan do?', { exact: true }).click()
  await expect(page.getByText(/It schedules your reviewed topics/)).toBeVisible()
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
