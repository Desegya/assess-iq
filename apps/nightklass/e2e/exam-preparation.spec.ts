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
  // One answered question is recorded but is not enough evidence for a percentage.
  await expect(page.getByText(/Too early to tell · 1 question answered so far/)).toBeVisible()
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
  await page.getByText('Syllabuses and objectives', { exact: true }).click()
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
  // The source note is optional; leaving it blank must not block saving.
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
  // Generation sits at the top and needs only a subject; the topic is optional.
  const subjectScope = page.getByLabel('Subject', { exact: true }).first()
  // Uncommon subjects can be typed in; common ones are picked from the list.
  await subjectScope.selectOption({ label: 'Other subject…' })
  await expect(page.getByLabel('Subject name', { exact: true })).toBeVisible()
  await subjectScope.selectOption('Government')
  await expect(page.getByLabel('Subject name', { exact: true })).toHaveCount(0)
  await page.getByLabel('Topic (optional)', { exact: true }).fill('Democratic government')
  await page.getByRole('button', { name: 'Generate questions', exact: true }).click()
  await expect(page.getByText('Generating 5 questions', { exact: false })).toBeVisible()
  // One progress summary for the request, then straight to the drafts to review.
  await expect(page.getByText(/5 of 5 questions ready to review/)).toBeVisible({ timeout: 45000 })
  await page.getByRole('button', { name: 'Review drafts', exact: true }).click()
  await expect(page.getByLabel('Show questions', { exact: true })).toHaveValue('DRAFT')
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

test('teacher publishes a WAEC timetable and learners see their subject papers', async ({
  page,
}, testInfo) => {
  await login(page, true)
  await page.goto('/admin/exam-content')
  const existing = await page.request.get('/api/admin/exam-content/calendars')
  expect(existing.ok()).toBe(true)
  const calendars = await existing.json()
  const version =
    Math.max(
      0,
      ...calendars
        .filter((c: any) => c.exam === 'WAEC' && c.year === 2099 && c.series === 'SCHOOL')
        .map((c: any) => c.version),
    ) + 1
  await page.getByText('Exam dates and timetables', { exact: true }).click()
  await page.getByRole('button', { name: 'New exam calendar', exact: true }).click()
  const form = page
    .locator('form')
    .filter({ has: page.getByRole('button', { name: 'Save as draft', exact: true }) })
  const title = `Timetable ${testInfo.project.name} ${fixture.suffix}`
  await form.getByRole('combobox', { name: 'Examination', exact: true }).selectOption('WAEC')
  await form.getByLabel('Exam year', { exact: true }).fill('2099')
  // Version and title are optional (assigned automatically); the test names its calendar to find it later.
  await form.getByText('More details (optional)', { exact: true }).click()
  expect(version).toBeGreaterThan(0)
  await form.getByLabel('Calendar title', { exact: true }).fill(title)
  await form.getByLabel('Exam starts', { exact: true }).fill('2099-05-01')
  await form.getByLabel('Exam ends (optional)', { exact: true }).fill('2099-06-30')
  await form.getByRole('button', { name: 'Save as draft', exact: true }).click()
  await expect(
    page.getByText('Calendar saved as a draft. Review dates and paper rows before publishing.', {
      exact: true,
    }),
  ).toBeVisible()
  const csv =
    'subject,paperCode,title,date,startTime,endTime,notes\nGovernment,GOV2,Government essay,2099-05-20,09:00,11:00,Reviewed\nPhysics,PHY1,Physics objective,2099-05-21,09:00,10:00,Other subject'
  await form
    .getByLabel('WAEC timetable PDF or CSV', { exact: true })
    .setInputFiles({ name: 'waec.csv', mimeType: 'text/csv', buffer: Buffer.from(csv) })
  await form.getByRole('button', { name: 'Upload timetable', exact: true }).click()
  await expect(
    page.getByText('2 paper rows imported. Review before publishing.', { exact: true }),
  ).toBeVisible()
  const card = page
    .getByRole('article')
    .filter({ has: page.getByRole('heading', { name: new RegExp(title) }) })
  await card.getByRole('button', { name: 'Publish calendar', exact: true }).click()
  await expect(card).toContainText('APPROVED')
  await login(page)
  await page.goto('/exam-preparation')
  const dates = page
    .getByRole('region', { name: 'Published exam dates' })
    .filter({ has: page.getByRole('heading', { name: title, exact: true }) })
  await expect(dates).toBeVisible()
  await dates.getByText('Your subject paper dates (1)', { exact: true }).click()
  await expect(
    dates.getByText('Government · GOV2 · Government essay', { exact: true }),
  ).toBeVisible()
  await expect(dates.getByText(/Physics objective/)).toHaveCount(0)
  const href = await dates
    .getByRole('link', { name: 'View original timetable', exact: true })
    .getAttribute('href')
  const original = await page.request.get(href!)
  expect(original.status()).toBe(200)
  expect(await original.text()).toContain('Government,GOV2')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
})
