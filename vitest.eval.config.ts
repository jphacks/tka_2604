import { fileURLToPath } from 'node:url'

import { loadEnv } from 'vite'
import { defineConfig } from 'vitest/config'

// Evaluations against the real LLM. Kept out of vitest.config.js so that
// `npm run check` never calls paid APIs. The API key comes from the
// environment or .env.develop and is passed to the test without logging it.
const rootDir = fileURLToPath(new URL('./', import.meta.url))
const env = { ...loadEnv('develop', rootDir, ''), ...process.env }

export default defineConfig({
  test: {
    root: fileURLToPath(new URL('./apps/backend/', import.meta.url)),
    environment: 'node',
    include: ['eval/**/*.eval.ts'],
    testTimeout: 30 * 60 * 1000,
    silent: false,
    provide: {
      evalSettings: {
        apiKey: env.GOOGLE_AI_API_TOKEN ?? '',
        runs: Number(env.EVAL_RUNS ?? 3),
        concurrency: Number(env.EVAL_CONCURRENCY ?? 2),
        threshold: Number(env.EVAL_THRESHOLD ?? 0.9),
        filter: env.EVAL_FILTER ?? '',
      },
    },
  },
})
