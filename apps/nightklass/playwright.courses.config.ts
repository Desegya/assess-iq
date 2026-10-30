import { defineConfig } from '@playwright/test'
import base from './playwright.lessons.config'
export default defineConfig({ ...base, testMatch: 'courses.spec.ts' })
