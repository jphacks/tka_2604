import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  outputDir: './test-results/mock',
  testMatch: '**/*.spec.ts',
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5174 --strictPort',
    env: { VITE_DATA_SOURCE: 'mock' },
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
})
