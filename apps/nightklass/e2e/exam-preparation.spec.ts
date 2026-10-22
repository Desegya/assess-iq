import { test, expect, type Page } from '@playwright/test'
let fixture: {
  teacher: string
  learner: string
  password: string
  jambGoal: string
  waecGoal: string
  paperTitle: string
  objectiveId: string
  suffix: string
}
test.beforeAll(async ({ request }) => {
  fixture = await (await request.get('http://127.0.0.1:3101/__test/fixtures')).json()
})
async function login(page: Page, admin = false) {
  await page.goto(admin ? '/admin/login' : '/login')
  await page
    .getByLabel(admin ? 'Email' : 'Email address', { exact: true })
    .fill(admin ? fixture.teacher : fixture.learner)
  await page.getByLabel('Password', { exact: true }).fill(fixture.password)
  await page
    .getByRole('button', { name: admin ? 'Sign in to administration' : 'Sign in', exact: true })
    .click()
  await expect(page).toHaveURL(admin ? /\/admin$/ : /\/dashboard$/)
}
test('learner uses syllabus-linked practice and sees objective evidence', async ({ page }) => {
  await login(page)
  await page.goto(`/exam-preparation/syllabus?goal=${fixture.jambGoal}&subject=government`)
  await expect(page.getByRole('heading', { name: /Browser Government Syllabus/ })).toBeVisible()
  await page.getByRole('link', { name: 'Practise topic', exact: true }).click()
  await page.getByRole('button', { name: 'Start reviewed practice', exact: true }).click()
  await page.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Submit practice', exact: true }).click()
  await expect(page.getByRole('heading', { name: '100% on graded questions' })).toBeVisible()
  await page.goto(`/exam-preparation/syllabus?goal=${fixture.jambGoal}&subject=government`)
  await expect(page.getByText(/100% practice accuracy/)).toBeVisible()
})
test('JAMB mock autosaves, resumes after refresh and submits', async ({ page }) => {
  await login(page)
  const route = `/exam-preparation/mocks?goal=${fixture.jambGoal}&exam=JAMB`
  await page.goto(route)
  await page.getByRole('button', { name: 'Start timed mock', exact: true }).click()
  await page.getByRole('radio').first().check()
  await expect(page.getByRole('status')).toContainText('Saved at')
  await page.reload()
  await page.getByRole('button', { name: 'Resume saved mock', exact: true }).click()
  await expect(page.getByRole('radio').first()).toBeChecked()
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Practice estimate:/ })).toBeVisible()
  await expect(page.getByText(/not an official JAMB result/)).toBeVisible()
})
test('WAEC optional essay saves, submits and shows practice marking', async ({ page }) => {
  await login(page)
  await page.goto(`/exam-preparation/mocks?goal=${fixture.waecGoal}&exam=WAEC`)
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: new RegExp(fixture.paperTitle) }) })
  await card.getByRole('button', { name: 'Start timed paper' }).click()
  await page.getByRole('radio').first().check()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await page.getByLabel('Answer this question', { exact: true }).check()
  await page
    .getByRole('textbox', { name: 'Written answer including working and labelled subparts' })
    .fill('(a) Citizens choose representatives. (b) Leaders answer to citizens.')
  await expect(page.getByRole('status')).toContainText('Saved at')
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'WAEC practice result', exact: true }),
  ).toBeVisible({ timeout: 30000 })
  await expect(page.getByText(/not an official WAEC grade/)).toBeVisible()
})
test('teacher publishes a curated syllabus and queues generation', async ({ page }, testInfo) => {
  await login(page, true)
  await page.goto('/admin/exam-content')
  await page.getByRole('button', { name: 'New syllabus', exact: true }).click()
  const title = `Browser ${testInfo.project.name} syllabus ${fixture.suffix}`
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save syllabus draft', exact: true }) })
  await form.getByLabel('Year', { exact: true }).fill('2099')
  await form
    .getByLabel('Subject', { exact: true })
    .fill(`History ${testInfo.project.name} ${fixture.suffix}`)
  await form.getByLabel('Title', { exact: true }).fill(title)
  await form
    .getByLabel('Source, applicability and verification note', { exact: true })
    .fill('Teacher-curated isolated browser fixture, permission granted.')
  await form
    .getByLabel('Objectives: one per line as code | topic title | what the student should learn', {
      exact: true,
    })
    .fill('HIS-01 | Historical sources | Explain primary and secondary historical sources.')
  await form.getByRole('button', { name: 'Save syllabus draft', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Syllabus saved as a draft')
  const syllabusCard = page
    .getByRole('article')
    .filter({ hasText: `History ${testInfo.project.name} ${fixture.suffix}` })
  await syllabusCard.getByRole('button', { name: 'Publish syllabus', exact: true }).click()
  await expect(syllabusCard).toContainText('APPROVED')
  const subjectScope = page.getByLabel('Subject', { exact: true }).last()
  await subjectScope.fill('Government')
  await page.getByLabel('Topic / learning objective', { exact: true }).fill('Democratic government')
  await page.getByRole('button', { name: 'Queue generation batch', exact: true }).click()
  await expect(page.getByText('Generation batch queued.', { exact: false })).toBeVisible()
  const rejected = await page.request.post('/api/admin/exam-content/generation-jobs', {
    headers: { origin: 'https://untrusted.example' },
    data: {},
  })
  expect(rejected.status()).toBe(403)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
test('secondary onboarding works without university fields and layout fits viewport', async ({
  page,
}) => {
  await login(page)
  await page.goto('/onboarding')
  await page.getByRole('button', { name: 'WAEC / JAMB preparation', exact: true }).click()
  await page.getByLabel('Your current stage', { exact: true }).selectOption('SCHOOL_LEAVER')
  await expect(page.getByLabel('Programme / department', { exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Choose my exams and subjects →', exact: true }).click()
  await expect(page).toHaveURL(/\/exam-preparation$/)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
test('syllabus objectives can be opened with the keyboard', async ({ page }) => {
  await login(page)
  await page.goto(`/exam-preparation/syllabus?goal=${fixture.jambGoal}&subject=government`)
  await page.getByRole('button', { name: 'Study objective', exact: true }).focus()
  await page.keyboard.press('Enter')
  await expect(page).toHaveURL(/\/topics\/[^/]+\/learn$/)
})
