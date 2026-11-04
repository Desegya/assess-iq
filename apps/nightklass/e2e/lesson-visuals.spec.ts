import { test, expect, type Page } from '@playwright/test'

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

async function openFeedbackLesson(page: Page) {
  const lesson = {
    id: 'feedback-lesson',
    version: 1,
    mode: 'AI',
    sources: [],
    createdAt: '2026-10-30T08:00:00Z',
    content: {
      ...content,
      sections: Array.from({ length: 12 }, (_, index) => ({
        heading: `Wave property ${index + 1}`,
        body: 'A wave carries energy. '.repeat(15),
      })),
    },
  }
  await page.route('**/learning/topics/feedback-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'feedback-topic',
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
  await page.goto('/topics/feedback-topic/learn')
}

test('questions stay alongside the lesson, retain drafts on failure, and support contextual follow-ups in focus mode', async ({
  page,
}) => {
  await mockStudyFullscreen(page, 'rejected')
  const requests: any[] = []
  await page.route('**/study/courses/course/chat', (route) => {
    const data = route.request().postDataJSON()
    requests.push(data)
    if (requests.length === 1)
      return route.fulfill({
        status: 503,
        json: { message: 'Could not answer yet. Please retry.' },
      })
    return route.fulfill({
      json: {
        source: 'lesson',
        reply: 'A wave transfers energy without carrying matter along with it.',
      },
    })
  })
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  const selected = await page.evaluate(() => {
    const text = document.querySelector('#lesson-1-wave-property-1 p')!.firstChild!
    const range = document.createRange()
    range.setStart(text, 0)
    range.setEnd(text, 22)
    const selection = window.getSelection()!
    selection.removeAllRanges()
    selection.addRange(range)
    return selection.toString()
  })
  await page.getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  const panel = page.getByRole('complementary', { name: 'Ask while you study', exact: true })
  const input = panel.getByRole('textbox', { name: 'Your question', exact: true })
  await input.fill('a'.repeat(2001))
  await expect(panel.getByRole('button', { name: 'Ask', exact: true })).toBeDisabled()
  expect(requests).toHaveLength(0)
  await input.fill('How can it transfer energy without moving matter?')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(panel.getByRole('alert')).toHaveText('Could not answer yet. Please retry.')
  await expect(panel.getByRole('alert')).toBeInViewport()
  await expect(input).toHaveValue('How can it transfer energy without moving matter?')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(panel.getByRole('log')).toContainText(
    'A wave transfers energy without carrying matter',
  )
  expect(requests[1]).toMatchObject({
    topicId: 'feedback-topic',
    lessonId: 'feedback-lesson',
    selectedText: selected,
    history: [],
  })
  await input.fill('Can you show an everyday example?')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(input).toHaveValue('')
  expect(requests[2].history).toHaveLength(2)
  await input.fill('Keep this question while I read the next paragraph.')
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  await expect(input).toHaveValue('Keep this question while I read the next paragraph.')
  await expect(panel.getByRole('log')).toContainText('A wave transfers energy')
  await expect(page).toHaveURL(/\/topics\/feedback-topic\/learn$/)
})

test('questions about cited notes open inside the reference reader without closing the material', async ({
  page,
}) => {
  let sent: any
  await page.route('**/study/courses/course/chat', (route) => {
    sent = route.request().postDataJSON()
    return route.fulfill({ json: { source: 'ai', reply: 'Hertz means cycles per second.' } })
  })
  await page.route('**/learning/topics/notes-topic/lesson', (route) =>
    route.fulfill({
      json: {
        topic: {
          id: 'notes-topic',
          name: 'Frequency',
          courseId: 'course',
          courseTitle: 'Physics',
          subtopics: [],
        },
        hasMaterial: true,
        versions: [],
        lesson: {
          id: 'notes-lesson',
          version: 1,
          mode: 'MATERIAL',
          createdAt: '2026-11-04',
          content: { ...content, introduction: 'Frequency is measured in hertz [S1].' },
          sources: [
            {
              marker: 'S1',
              documentId: 'approved-notes',
              documentName: 'Lecture notes.pdf',
              excerpt: 'Frequency is measured in hertz.',
            },
          ],
        },
      },
    }),
  )
  await page.goto('/topics/notes-topic/learn')
  await page.getByRole('link', { name: 'Read reference S1', exact: true }).first().click()
  const reader = page.getByRole('dialog')
  await reader.getByRole('button', { name: 'Ask about these notes', exact: true }).click()
  const panel = reader.getByRole('complementary', { name: 'Ask while you study', exact: true })
  await panel
    .getByRole('textbox', { name: 'Your question', exact: true })
    .fill('What does hertz mean?')
  await panel.getByRole('button', { name: 'Ask', exact: true }).click()
  await expect(panel.getByRole('log')).toContainText('Hertz means cycles per second.')
  expect(sent).toMatchObject({
    topicId: 'notes-topic',
    lessonId: 'notes-lesson',
    documentId: 'approved-notes',
    selectedText: 'Frequency is measured in hertz.',
  })
  await page.keyboard.press('Escape')
  await expect(panel).toHaveCount(0)
  await expect(reader).toBeVisible()
  await expect(reader.getByLabel('Reference text')).toContainText('Frequency is measured in hertz.')
  await reader.getByRole('button', { name: 'Close reference reader', exact: true }).click()
  await expect(reader).toHaveCount(0)
  await expect(page).toHaveURL(/\/topics\/notes-topic\/learn$/)
})

test('the study question field stays above an on-screen keyboard', async ({ page }) => {
  await page.addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: window.innerHeight, offsetTop: 0 })
    Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport })
    ;(window as any).__showStudyKeyboard = () => {
      viewport.height = 400
      viewport.dispatchEvent(new Event('resize'))
    }
  })
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Ask about this topic', exact: true }).click()
  await page.evaluate(() => (window as any).__showStudyKeyboard())
  const panel = page.getByRole('complementary', { name: 'Ask while you study', exact: true })
  await expect
    .poll(async () => {
      const box = await panel.boundingBox()
      return box ? Math.round(box.y + box.height) : 9999
    })
    .toBeLessThanOrEqual(400)
  await expect(panel.getByRole('textbox', { name: 'Your question', exact: true })).toBeInViewport()
  await panel.getByRole('button', { name: 'Close study questions', exact: true }).click()
})

async function mockStudyFullscreen(page: Page, mode: 'supported' | 'rejected' | 'unsupported') {
  await page.addInitScript((mode) => {
    let fullscreen: Element | null = null
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      get: () => fullscreen,
    })
    Object.defineProperty(document, 'fullscreenEnabled', {
      configurable: true,
      get: () => mode !== 'unsupported',
    })
    Object.defineProperty(HTMLElement.prototype, 'requestFullscreen', {
      configurable: true,
      value: function (this: HTMLElement, options: FullscreenOptions) {
        ;(window as any).__focusFullscreenOptions = options
        if (mode === 'rejected') return Promise.reject(new Error('Fullscreen blocked'))
        fullscreen = this
        document.dispatchEvent(new Event('fullscreenchange'))
        return Promise.resolve()
      },
    })
    Object.defineProperty(document, 'exitFullscreen', {
      configurable: true,
      value: () => {
        fullscreen = null
        document.dispatchEvent(new Event('fullscreenchange'))
        return Promise.resolve()
      },
    })
  }, mode)
}

test('focus mode can enter and leave native desktop fullscreen', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'mobile', 'Mobile fullscreen fallback is covered separately')
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  await expect
    .poll(() => page.evaluate(() => document.fullscreenElement === document.documentElement))
    .toBe(true)
  await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click()
  await expect.poll(() => page.evaluate(() => document.fullscreenElement === null)).toBe(true)
  await expect(page.locator('header[data-app-navigation]')).toBeVisible()
})

test('focus mode hides navigation and lesson extras without losing feedback when fullscreen is blocked', async ({
  page,
}) => {
  await mockStudyFullscreen(page, 'rejected')
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click()
  const feedback = page.getByRole('textbox', { name: 'What should change', exact: true })
  await feedback.fill('Keep my feedback while I concentrate on the lesson.')
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toBeVisible()
  await expect(page.getByRole('navigation', { name: 'Main navigation', exact: true })).toBeHidden()
  await expect(
    page.getByRole('navigation', { name: 'Mobile navigation', exact: true }),
  ).toBeHidden()
  await expect(page.locator('header[data-app-navigation]')).toBeHidden()
  await expect(page.getByRole('heading', { name: '1. Wave property 1', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Regenerate', exact: true })).toBeHidden()
  await expect(page.getByRole('heading', { name: 'Watch & read more', exact: true })).toBeHidden()
  await expect(feedback).toBeHidden()
  await expect(page.getByRole('status')).toContainText('Browser fullscreen is unavailable')
  await page.keyboard.press('Escape')
  await expect(page.getByRole('button', { name: 'Enter focus mode', exact: true })).toBeFocused()
  await expect(page.locator('header[data-app-navigation]')).toBeVisible()
  await expect(feedback).toHaveValue('Keep my feedback while I concentrate on the lesson.')
  await expect(feedback).toBeVisible()
})

test('focus mode follows browser fullscreen changes and preserves quiz choices', async ({
  page,
}) => {
  await mockStudyFullscreen(page, 'supported')
  await page.route('**/study/topics/feedback-topic/quiz/history', (route) =>
    route.fulfill({ json: { recommendedDifficulty: 'MEDIUM', attempts: [] } }),
  )
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  expect(await page.evaluate(() => (window as any).__focusFullscreenOptions)).toMatchObject({
    navigationUI: 'hide',
  })
  await page.getByRole('link', { name: 'Quiz me on this', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toBeVisible()
  await page.getByRole('button', { name: /Advanced/ }).click()
  const selected = page.getByRole('button', { name: /Advanced/ })
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Exit focus mode', exact: true }).click()
  expect(await page.evaluate(() => document.fullscreenElement)).toBeNull()
  await expect(selected).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  await page.evaluate(() => document.exitFullscreen())
  await expect(page.getByRole('button', { name: 'Enter focus mode', exact: true })).toBeVisible()
  await expect(page.locator('header[data-app-navigation]')).toBeVisible()
})

test('focus mode works without fullscreen support and resets on a non-study route', async ({
  page,
}) => {
  await mockStudyFullscreen(page, 'unsupported')
  await page.route('**/api/v1/courses', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/documents?*', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/study/availability', (route) => route.fulfill({ json: [] }))
  await page.route('**/api/v1/study/courses/course/readiness', (route) =>
    route.fulfill({ json: { topics: [] } }),
  )
  await page.route('**/api/v1/study/plans/current?*', (route) =>
    route.fulfill({ status: 404, json: { message: 'No plan' } }),
  )
  await page.route('**/study/sessions/today?*', (route) =>
    route.fulfill({
      json: [
        {
          id: 'task',
          course: { id: 'course', title: 'Physics' },
          topic: null,
          kind: 'LEARN',
          status: 'NOT_STARTED',
          startTime: null,
          endTime: null,
          estimatedMinutes: 45,
          note: null,
        },
      ],
    }),
  )
  await page.route('**/study/sessions/overdue?*', (route) => route.fulfill({ json: [] }))
  await page.route('**/courses/course', (route) =>
    route.fulfill({ json: { id: 'course', title: 'Physics', subject: 'Physics', topics: [] } }),
  )
  await page.goto('/today')
  await page.getByRole('button', { name: 'Enter focus mode', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Mark complete', exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Open course & choose a topic', exact: true }).click()
  await expect(page).toHaveURL(/\/courses\/course$/)
  await expect(page.locator('header[data-app-navigation]')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Exit focus mode', exact: true })).toHaveCount(0)
})

test('regeneration shows feedback limits and request errors beside the feedback field', async ({
  page,
}) => {
  let submissions = 0
  await page.route('**/learning/topics/feedback-topic/lesson/generate', async (route) => {
    submissions++
    expect(route.request().postDataJSON().feedback).toHaveLength(1000)
    await route.fulfill({
      status: 503,
      json: { message: 'Could not regenerate. Please try again.' },
    })
  })
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Regenerate', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Lesson feedback' })
  const feedback = panel.getByRole('textbox', { name: 'What should change' })
  await feedback.fill('a'.repeat(1001))
  await expect(panel.getByText(/1,001 \/ 1,000 characters/)).toBeVisible()
  await expect(feedback).toHaveAttribute('aria-invalid', 'true')
  await expect(panel.getByRole('button', { name: 'Generate new version' })).toBeDisabled()
  expect(submissions).toBe(0)
  await feedback.fill('a'.repeat(1000))
  await panel.getByRole('button', { name: 'Generate new version' }).click()
  const error = panel.getByRole('alert')
  await expect(error).toHaveText('Could not regenerate. Please try again.')
  await expect(error).toBeInViewport()
  await expect(error).toBeFocused()
  await expect(feedback).toHaveValue('a'.repeat(1000))
  expect(submissions).toBe(1)
  await feedback.fill('More worked examples please')
  await expect(error).toHaveCount(0)
})

test('mistake reports keep errors and successful confirmation in the feedback panel', async ({
  page,
}) => {
  let attempts = 0
  await page.route('**/learning/lessons/feedback-lesson/report', (route) => {
    attempts++
    return attempts === 1
      ? route.fulfill({ status: 503, json: { message: 'Could not send report. Try again.' } })
      : route.fulfill({ json: {} })
  })
  await openFeedbackLesson(page)
  await page.getByRole('button', { name: 'Report a mistake', exact: true }).click()
  const panel = page.getByRole('region', { name: 'Lesson feedback' })
  await panel.getByRole('textbox', { name: 'Describe the mistake' }).fill('b'.repeat(1001))
  await expect(panel.getByRole('button', { name: 'Send report' })).toBeDisabled()
  await panel
    .getByRole('textbox', { name: 'Describe the mistake' })
    .fill('The frequency explanation needs a correction.')
  await panel.getByRole('button', { name: 'Send report' }).click()
  await expect(panel.getByRole('alert')).toBeInViewport()
  await expect(panel.getByRole('alert')).toHaveText('Could not send report. Try again.')
  await panel.getByRole('button', { name: 'Send report' }).click()
  await expect(panel.getByRole('status')).toContainText('Thanks, reported.')
  await expect(panel.getByRole('textbox', { name: 'What should change' })).toHaveValue(
    'The frequency explanation needs a correction.',
  )
})

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
