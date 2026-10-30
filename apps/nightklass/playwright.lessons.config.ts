import { defineConfig } from '@playwright/test'
import base from './playwright.config'

// These UI checks mock API responses and require neither a database nor paid AI calls.
const { webServer: _databaseServers, ...settings } = base
export default defineConfig({
  ...settings,
  testMatch: 'lesson-visuals.spec.ts',
  webServer: [
    {
      command: 'npm exec -- next dev -p 3102 -H 127.0.0.1',
      url: 'http://127.0.0.1:3102/login',
      reuseExistingServer: false,
      timeout: 120000,
      env: { NEXT_PUBLIC_API_URL: 'http://127.0.0.1:3101/api/v1' },
    },
  ],
})
