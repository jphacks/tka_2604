import { defineConfig } from '@playwright/test'

const envFile = process.env.SOLVER_E2E_ENV_FILE
const state = process.env.SOLVER_E2E_STATE
const token = process.env.SOLVER_E2E_TOKEN
if (!envFile || !state || !token)
  throw new Error('Run npm run test:e2e:solver from the repository root.')

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/solver-flow.e2e.ts',
  outputDir: './test-results/solver',
  forbidOnly: Boolean(process.env.CI),
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: 'http://127.0.0.1:5176',
    viewport: { width: 1600, height: 1000 },
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command:
        'uv --directory ../solver run --locked uvicorn main:app --app-dir src --port 8001',
      env: { SOLVER_API_TOKEN: token },
      url: 'http://127.0.0.1:8001/health',
      reuseExistingServer: false,
    },
    {
      command:
        'npm --prefix ../.. run dev:backend -- --port 8790 --inspector-port 9240 --env-file "$SOLVER_E2E_ENV_FILE" --persist-to "$SOLVER_E2E_STATE"',
      url: 'http://127.0.0.1:8790/api/health',
      reuseExistingServer: false,
      timeout: 30000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5176 --strictPort',
      env: { VITE_DATA_SOURCE: '', API_PROXY_TARGET: 'http://127.0.0.1:8790' },
      url: 'http://127.0.0.1:5176',
      reuseExistingServer: false,
      timeout: 30000,
    },
  ],
})
