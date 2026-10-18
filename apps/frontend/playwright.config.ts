import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  forbidOnly: Boolean(process.env.CI),
  outputDir: './test-results/api',
  testMatch: '**/*.e2e.ts',
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5175',
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'npm --prefix ../.. run dev:backend -- --port 8789 --persist-to .wrangler/e2e-api',
      url: 'http://127.0.0.1:8789/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5175 --strictPort',
      env: { API_PROXY_TARGET: 'http://127.0.0.1:8789' },
      url: 'http://127.0.0.1:5175',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
})
