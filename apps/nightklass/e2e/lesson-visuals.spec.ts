import { test, expect } from '@playwright/test'

const user = {
  id: 'visual-learner',
  name: 'Visual Learner',
  email: 'visual@example.test',
  role: 'STUDENT',
  organizationId: null,
}
const process = {
  kind: 'process',
  sectionIndex: 0,
  title: 'From period to frequency',
  caption: 'Use $f=1/T$. The sound /ʃ/ keeps its IPA notation.',
  alt: 'Measure the period, then calculate frequency.',
  steps: [
    { label: 'Measure period', detail: 'Record $T$ in seconds.' },
    { label: 'Find frequency', detail: 'Calculate $f=1/T$ in hertz.' },
  ],
}
const content = {
  objectives: ['Explain a wave'],
  introduction: 'Waves transfer energy.',
  sections: [{ heading: 'Frequency', body: 'Frequency is the reciprocal of period: $f=1/T$.' }],
  keyTerms: [],
  workedExamples: [],
  applications: [],
  diagramIdeas: [],
  summary: ['Frequency is measured in hertz.'],
  examQuestions: [],
}

test.beforeEach(async ({ page, context }) => {
  await context.addCookies([{ name: 'nk_session', value: '1', url: 'http://127.0.0.1:3102' }])
  await page.addInitScript((user) => {
    localStorage.setItem('nightklass:user', JSON.stringify(user))
    localStorage.setItem('nightklass:refreshToken', 'fixture-refresh')
  }, user)
  await page.route('**/api/v1/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = path.endsWith('/auth/refresh')
      ? { accessToken: 'fixture-access', refreshToken: 'fixture-refresh', expiresIn: 3600 }
      : path.endsWith('/auth/me')
        ? user
        : path.endsWith('/users/me/profile')
          ? { studyPathway: 'TERTIARY' }
          : path.endsWith('/resources')
            ? { videos: [], searches: [], videosConfigured: false }
            : {}
    await route.fulfill({ json })
  })
})

test('lesson diagrams preserve formula labels and IPA on desktop and mobile', async ({
  page,
}, testInfo) => {
  const lesson = {
    id: 'visual-lesson',
    version: 1,
    mode: 'AI',
    content: { ...content, visuals: [process] },
    sources: [],
    createdAt: '2026-10-30T08:00:00Z',
  }
  await page.route('**/learning/topics/visual-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'visual-topic',
          name: 'Waves',
          courseId: 'course',
          courseTitle: 'Physics',
          subtopics: [],
        },
        hasMaterial: false,
        versions: [{ id: lesson.id, version: 1, mode: 'AI', createdAt: lesson.createdAt }],
        lesson,
      },
    }),
  )
  await page.goto('/topics/visual-topic/learn')
  const figure = page.getByRole('figure', { name: process.title })
  await expect(figure).toBeVisible()
  await expect(figure.getByRole('listitem')).toHaveCount(2)
  await expect(figure.locator('.katex').first()).toBeVisible()
  await expect(figure).toContainText('/ʃ/')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  )
  await figure.screenshot({ path: testInfo.outputPath('lesson-process.png') })
})

test('an expired illustration can refresh its saved URL without generating a new lesson', async ({
  page,
}) => {
  const visual = {
    kind: 'illustration',
    sectionIndex: 0,
    title: 'Vibrating string',
    caption: 'The string transfers energy.',
    alt: 'A string vibrating between two fixed ends.',
    steps: [],
    url: 'http://127.0.0.1:3102/expired-visual.png',
  }
  const lesson = {
    id: 'visual-lesson',
    version: 1,
    mode: 'AI',
    content: { ...content, visuals: [visual] },
    sources: [],
    createdAt: '2026-10-30T08:00:00Z',
  }
  let generated = false
  await page.route('**/learning/topics/visual-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'visual-topic',
          name: 'Waves',
          courseId: 'course',
          courseTitle: 'Physics',
          subtopics: [],
        },
        hasMaterial: false,
        versions: [],
        lesson,
      },
    }),
  )
  await page.route('**/expired-visual.png', (route) =>
    route.fulfill({ status: 403, body: 'Expired' }),
  )
  await page.route('**/saved-visual.png', (route) =>
    route.fulfill({
      contentType: 'image/png',
      body: Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a/O0AAAAASUVORK5CYII=',
        'base64',
      ),
    }),
  )
  await page.route('**/learning/lessons/visual-lesson', (route) =>
    route.fulfill({
      json: {
        ...lesson,
        content: {
          ...content,
          visuals: [{ ...visual, url: 'http://127.0.0.1:3102/saved-visual.png' }],
        },
      },
    }),
  )
  await page.route('**/lesson/generate', async (route) => {
    generated = true
    await route.abort()
  })
  await page.goto('/topics/visual-topic/learn')
  const figure = page.getByRole('figure', { name: visual.title })
  await figure.scrollIntoViewIfNeeded()
  await figure.getByRole('button', { name: 'Reload illustration' }).click()
  await expect(figure.getByRole('img', { name: visual.alt })).toBeVisible()
  expect(generated).toBe(false)
})
