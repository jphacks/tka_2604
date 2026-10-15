import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    projects: [
      {
        extends: './apps/frontend/vite.config.ts',
        root: fileURLToPath(new URL('./apps/frontend/', import.meta.url)),
        test: {
          name: 'frontend',
          environment: 'jsdom',
          include: ['src/**/*.{test,spec}.{ts,tsx}'],
          setupFiles: ['src/test/setup.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
      {
        root: fileURLToPath(new URL('./apps/backend/', import.meta.url)),
        test: {
          name: 'backend',
          environment: 'node',
          include: ['test/**/*.{test,spec}.ts'],
          clearMocks: true,
          restoreMocks: true,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: './coverage',
      include: ['apps/frontend/src/**/*.{ts,tsx}', 'apps/backend/src/**/*.ts'],
      exclude: [
        '**/*.{test,spec}.{ts,tsx}',
        '**/test/**',
        '**/*.d.ts',
        'apps/frontend/src/main.tsx',
      ],
    },
  },
})
