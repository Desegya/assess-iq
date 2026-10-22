import { test, expect, type Page } from '@playwright/test'

const API = 'http://127.0.0.1:3101'
let fixture: {
  learner: string
  tertiary: string
  tertiaryCourse: string
  password: string
  jambGoal: string
}
test.beforeAll(async ({ request }) => {
  fixture = await (await request.get(`${API}/__test/fixtures`)).json()
})

async function signIn(page: Page, email: string, password = fixture.password) {
  await page.goto('/login')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
}

test('mock autosave rides out throttling, server errors and going offline', async ({ page, context }) => {
  await signIn(page, fixture.learner)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto(`/exam-preparation/mocks?goal=${fixture.jambGoal}&exam=JAMB`)
  await expect(page.getByText(/not a complete UTME paper/)).toBeVisible()
  await page.getByRole('button', { name: 'Start timed mock', exact: true }).click()
  await expect(page.getByText('Text-only practice: what this mock leaves out')).toBeVisible()

  // The first two saves are throttled and then fail; the answer must still be saved.
  let injected = 0
  await page.route('**/exam-preparation/mocks/*/answers', async (route) => {
    if (injected < 2) {
      injected++
      await route.fulfill({
        status: injected === 1 ? 429 : 503,
        contentType: 'application/json',
        headers: injected === 1 ? { 'Retry-After': '1' } : {},
        body: JSON.stringify({ message: injected === 1 ? 'Too many requests' : 'Service unavailable' }),
      })
    } else await route.continue()
  })
  await page.getByRole('radio').first().check()
  await expect(page.getByRole('status')).toContainText('Server busy')
  await expect(page.getByRole('status')).toContainText('Saved at', { timeout: 30000 })
  expect(injected).toBe(2)

  // Offline: the answer is kept and saved automatically when the connection returns.
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await context.setOffline(true)
  await page.getByRole('radio').nth(1).check()
  await expect(page.getByRole('status')).toContainText('Offline', { timeout: 15000 })
  await context.setOffline(false)
  await expect(page.getByRole('status')).toContainText('Saved at', { timeout: 30000 })

  // Both answers were confirmed by the server and survive a reload.
  await page.reload()
  await page.getByRole('button', { name: 'Resume saved mock', exact: true }).click()
  await expect(page.getByRole('radio').first()).toBeChecked()
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByRole('radio').nth(1)).toBeChecked()
  await page.getByRole('button', { name: 'Review & submit', exact: true }).click()
  await page.getByRole('button', { name: 'Confirm submission', exact: true }).click()
  await expect(page.getByRole('heading', { name: /Practice estimate:/ })).toBeVisible()
  await page.getByText(/^1\. /).first().click()
  await expect(page.getByRole('button', { name: 'Report a problem with this question' }).first()).toBeVisible()
})

test('a learner resets a forgotten password from the emailed link', async ({ page, request }) => {
  const { email } = await (await request.post(`${API}/__test/accounts`)).json()
  await page.goto('/login')
  await page.getByRole('link', { name: 'Forgot password?' }).click()
  await expect(page).toHaveURL(/\/forgot-password$/)
  // next dev compiles pages on first visit and hot-reloads them; let that settle before typing.
  await page.waitForLoadState('networkidle')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByRole('button', { name: 'Send reset link', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('If an account exists')
  const mail = (await (await request.get(`${API}/__test/emails?to=${encodeURIComponent(email)}`)).json()).find(
    (m: { subject: string }) => /Reset/.test(m.subject),
  )
  const link = mail.text.match(/http\S+/)[0]
  await page.goto(link)
  await page.waitForLoadState('networkidle')
  // The token is removed from the address bar once read.
  await expect(page).toHaveURL(/\/reset-password$/)
  const newPassword = 'New-browser-password-77!'
  await page.getByLabel('New password', { exact: true }).fill(newPassword)
  await page.getByLabel('Confirm new password', { exact: true }).fill(newPassword)
  await page.getByRole('button', { name: 'Set new password', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('Your password has been reset')
  await signIn(page, email)
  await expect(page.getByText('Invalid email or password')).toBeVisible()
  await signIn(page, email, newPassword)
  await expect(page).toHaveURL(/\/dashboard$/)
})

test('registration requires acknowledging the privacy notice, which is public', async ({ page }) => {
  await page.goto('/privacy')
  await expect(page.getByRole('heading', { name: 'Privacy notice' })).toBeVisible()
  await expect(page.getByText(/OpenAI — processes text for AI features/)).toBeVisible()
  await page.goto('/register')
  const email = `browser-register-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`
  await page.getByLabel('Full name', { exact: true }).fill('Browser Registrant')
  await page.getByLabel('Email address', { exact: true }).fill(email)
  await page.getByLabel(/^Password/).fill('Registration-test-42!')
  await page.getByLabel('Confirm password', { exact: true }).fill('Registration-test-42!')
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/register$/)
  await page.getByRole('checkbox').check()
  await page.getByRole('button', { name: 'Create account', exact: true }).click()
  await expect(page).toHaveURL(/\/onboarding$/)
})

test('an existing university learner keeps their courses, flashcards and data controls', async ({ page }) => {
  await signIn(page, fixture.tertiary)
  await expect(page).toHaveURL(/\/dashboard$/)
  await page.goto('/courses')
  await expect(page.getByText(fixture.tertiaryCourse)).toBeVisible()
  await page.goto('/flashcards')
  await expect(page.getByRole('heading', { name: 'Flashcards' })).toBeVisible()
  await page.goto('/account')
  await expect(page.getByText(fixture.tertiary)).toBeVisible()
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Download my data', exact: true }).click()
  expect((await download).suggestedFilename()).toMatch(/^nightklass-data-.*\.json$/)
  await expect(page.getByRole('status')).toContainText('downloaded')
})
