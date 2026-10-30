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

test('references open in a readable, keyboard-accessible reader with full notes and text sizing', async ({
  page,
}, testInfo) => {
  const excerpt =
    'Sound and frequency\n\nA vowel such as /ə/ has a characteristic spectrum. Use $f=1/T$ to calculate frequency.\n\nKeep each paragraph and its original wording.'
  const fullText = `${excerpt}\n\n${'Further explanation of waves and their properties. '.repeat(100)}\n\nFinal paragraph of the original notes.`
  const lesson = {
    id: 'reading-lesson',
    version: 1,
    mode: 'COMBINED',
    content: { ...content, introduction: 'Read the source passage [S1].' },
    sources: [
      {
        marker: 'S1',
        documentId: 'original-notes',
        documentName: 'Physics lecture notes with a long descriptive title.pdf',
        excerpt,
      },
    ],
    createdAt: '2026-10-30T08:00:00Z',
  }
  await page.route('**/learning/topics/reading-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'reading-topic',
          name: 'Readable notes',
          courseId: 'course',
          courseTitle: 'Physics',
          subtopics: [],
        },
        hasMaterial: true,
        versions: [],
        lesson,
      },
    }),
  )
  await page.route('**/documents/original-notes', (route) =>
    route.fulfill({ json: { extractedText: fullText } }),
  )
  await page.goto('/topics/reading-topic/learn')
  const citation = page.getByRole('link', { name: 'Read reference S1', exact: true })
  await citation.click()
  const reader = page.getByRole('dialog', { name: lesson.sources[0]!.documentName })
  await expect(reader).toBeVisible()
  const text = reader.locator('.reading-text')
  expect(await text.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(18)
  expect(
    await text.evaluate((element) => parseFloat(getComputedStyle(element).lineHeight)),
  ).toBeGreaterThan(30)
  await expect(text).toContainText('/ə/')
  await expect(text.locator('.katex')).toBeVisible()
  await reader.getByLabel('Text size', { exact: true }).selectOption('21')
  expect(await text.evaluate((element) => parseFloat(getComputedStyle(element).fontSize))).toBe(21)
  expect(await reader.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)
  await reader.screenshot({ path: testInfo.outputPath('reference-reader.png') })
  await reader.getByRole('button', { name: 'Full document text', exact: true }).click()
  await expect(text).toContainText('Final paragraph of the original notes.')
  const readingArea = reader.getByLabel('Reference text', { exact: true })
  expect(await readingArea.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(
    true,
  )
  await reader.getByRole('button', { name: 'Cited passage', exact: true }).click()
  await expect(text).not.toContainText('Final paragraph of the original notes.')
  await page.keyboard.press('Escape')
  await expect(reader).not.toBeVisible()
  await expect(citation).toBeFocused()
  const sourceButton = page.getByRole('button', { name: /Read reference S1:/ })
  await sourceButton.click()
  await expect(reader).toBeVisible()
  await reader.getByRole('button', { name: 'Close reference reader', exact: true }).click()
  await expect(reader).not.toBeVisible()
  await expect(sourceButton).toBeFocused()
})

test('a reference reader handles removed files and failed full-note requests', async ({ page }) => {
  const lesson = {
    id: 'missing-source',
    version: 1,
    mode: 'COMBINED',
    content: { ...content, introduction: 'See [S1] and [S2].' },
    sources: [
      {
        marker: 'S1',
        documentId: 'restricted-notes',
        documentName: 'Available passage.pdf',
        excerpt: 'This saved passage is still readable.',
      },
      { marker: 'S2', documentId: null, documentName: 'Removed document', excerpt: null },
    ],
    createdAt: '2026-10-30T08:00:00Z',
  }
  await page.route('**/learning/topics/reading-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'reading-topic',
          name: 'References',
          courseId: 'course',
          courseTitle: 'Physics',
          subtopics: [],
        },
        hasMaterial: true,
        versions: [],
        lesson,
      },
    }),
  )
  await page.route('**/documents/restricted-notes', (route) =>
    route.fulfill({ status: 404, json: { message: 'Document not found' } }),
  )
  await page.goto('/topics/reading-topic/learn')
  await page.getByRole('link', { name: 'Read reference S1', exact: true }).click()
  const reader = page.getByRole('dialog')
  await reader.getByRole('button', { name: 'Full document text', exact: true }).click()
  await expect(reader.getByRole('alert')).toContainText('Document not found')
  await reader.getByRole('button', { name: 'Cited passage', exact: true }).click()
  await expect(reader).toContainText('This saved passage is still readable.')
  await page.keyboard.press('Escape')
  await page.getByRole('link', { name: 'Read reference S2', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('This source has been removed')
  await expect(page.getByRole('button', { name: 'Full document text', exact: true })).toHaveCount(0)
})
