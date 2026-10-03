import { defineConfig } from 'vitest/config'

// Unit tests for pure logic (no database, network or AI). Run: npm test --workspace=@assessiq/api
export default defineConfig({
  test: {
    include: ['src/**/*.spec.ts'],
    environment: 'node',
  },
})
