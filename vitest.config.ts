import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['scripts/**/*.test.mjs', 'internal/**/*.test.ts', 'packages/*/src/**/*.test.ts'],
  },
})
