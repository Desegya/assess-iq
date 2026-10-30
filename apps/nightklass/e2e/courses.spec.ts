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
