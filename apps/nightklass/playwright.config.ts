import { defineConfig, devices } from '@playwright/test'
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 90000,
  expect: { timeout: 20000 },
  reporter: 'list',
  use: { baseURL: 'http://127.0.0.1:3102', channel: process.env.CI ? undefined : 'chrome', trace: 'retain-on-failure' },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['iPhone 13'], browserName: 'chromium' } },
  ],
  webServer: [
    {
      command: 'node apps/api/test/nightklass-browser-server.cjs',
      cwd: '../..',
      url: 'http://127.0.0.1:3101/__test/fixtures',
      reuseExistingServer: false,
      timeout: 60000,
    },
    {
      command: 'npm exec -- next dev -p 3102 -H 127.0.0.1',
      url: 'http://127.0.0.1:3102/login',
      reuseExistingServer: false,
      timeout: 120000,
      env: {
        NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101/api/v1',
        API_URL_INTERNAL: 'http://127.0.0.1:3101/api/v1',
      },
    },
  ],
})
