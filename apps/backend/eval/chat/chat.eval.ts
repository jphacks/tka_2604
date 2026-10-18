import { expect, inject, it } from 'vitest'

import { createGeminiChatModel } from '../../src/integrations/llm/gemini.ts'
import { AIChatError } from '../../src/services/chat/errors.ts'
import { generateAIChatResponse } from '../../src/services/chat/generate.ts'
import { type EvalCase, evalCases } from './cases.ts'

declare module 'vitest' {
  export interface ProvidedContext {
    evalSettings: {
      apiKey: string
      runs: number
      concurrency: number
      threshold: number
      filter: string
    }
  }
}

// Real Gemini calls (paid). Run with `npm run eval:chat`; not part of `npm run check`.
const {
  apiKey,
  runs: RUNS,
  concurrency: CONCURRENCY,
  threshold: THRESHOLD,
  filter: FILTER,
} = inject('evalSettings')

// transport: the request never produced an answer (quota, timeout). Counted
// apart so the score reflects the prompt, not the provider's availability.
type Run = { status: 'pass' | 'fail' | 'transport'; detail: string }
const TRANSPORT_ERRORS = new Set(['ai_chat_timeout', 'ai_chat_provider_error'])

// Retries rate limits and overloads so the eval measures the prompt, not quota.
// Only the HTTP status is recorded; provider bodies are never logged.
const statuses: number[] = []
const retryingFetch: typeof fetch = async (url, init) => {
  for (let attempt = 0; ; attempt++) {
    const response = await fetch(url, init)
    if (response.ok) return response
    statuses.push(response.status)
    if (![429, 500, 503].includes(response.status) || attempt >= 5)
      return response
    await response.body?.cancel()
    await new Promise((resolve) => setTimeout(resolve, 2000 * 2 ** attempt))
  }
}

async function runOnce(
  testCase: EvalCase,
  model: ReturnType<typeof createGeminiChatModel>,
): Promise<Run> {
  // Keep the raw model output so a rejected one can be shown.
  let raw: unknown
  const recording: typeof model = async (input) => (raw = await model(input))
  try {
    const output = await generateAIChatResponse(testCase.input, recording)
    const actions = output.actions.length
      ? ` ${JSON.stringify(output.actions)}`
      : ''
    const summary = `${output.type}: ${output.message}${actions}`
    if (!testCase.expect.includes(output.type))
      return { status: 'fail', detail: summary }
    const reason = testCase.check?.(output)
    return reason
      ? { status: 'fail', detail: `${reason} | ${summary}` }
      : { status: 'pass', detail: summary }
  } catch (error) {
    if (error instanceof AIChatError)
      return {
        status: TRANSPORT_ERRORS.has(error.code) ? 'transport' : 'fail',
        detail: `error: ${error.code}${raw === undefined ? '' : ` ${JSON.stringify(raw)}`}`,
      }
    throw error
  }
}

async function pool<T>(tasks: (() => Promise<T>)[], size: number) {
  const results: T[] = new Array<T>(tasks.length)
  let next = 0
  await Promise.all(
    Array.from({ length: size }, async () => {
      while (next < tasks.length) {
        const index = next++
        results[index] = await tasks[index]()
      }
    }),
  )
  return results
}

it('chooses the expected reply for vague requests', async () => {
  if (!apiKey) throw new Error('GOOGLE_AI_API_TOKEN is not set')
  const model = createGeminiChatModel({
    apiKey,
    fetch: retryingFetch,
    timeoutMs: 180_000,
  })
  const cases = evalCases.filter(
    (c) => !FILTER || c.name.includes(FILTER) || c.category.includes(FILTER),
  )
  const tasks = cases.flatMap((testCase) =>
    Array.from({ length: RUNS }, () => () => runOnce(testCase, model)),
  )
  const runs = await pool(tasks, CONCURRENCY)

  const count = (list: Run[], status: Run['status']) =>
    list.filter((r) => r.status === status).length
  const rows = cases.map((testCase, index) => {
    const own = runs.slice(index * RUNS, (index + 1) * RUNS)
    const passed = count(own, 'pass')
    const answered = passed + count(own, 'fail')
    return {
      line: `${answered === 0 ? '-- ' : passed === answered ? 'OK ' : 'NG '} ${passed}/${answered}  [${testCase.category}] ${testCase.name}`,
      failures: own
        .filter((r) => r.status !== 'pass')
        .map(
          (r) =>
            `- ${testCase.name}（期待: ${testCase.expect.join('|')}）→ ${r.detail}`,
        ),
    }
  })
  const passed = count(runs, 'pass')
  const answered = passed + count(runs, 'fail')
  const transport = count(runs, 'transport')
  console.log(
    [
      ...rows.map((r) => r.line),
      '',
      `通信エラーで評価できず: ${transport}/${runs.length}（HTTP ${statuses.join(',') || 'なし'}）`,
      `合計 ${passed}/${answered}（${answered ? Math.round((passed / answered) * 100) : '-'}%）`,
      '',
      '失敗した出力:',
      ...rows.flatMap((r) => r.failures),
    ].join('\n'),
  )
  expect(transport / runs.length).toBeLessThanOrEqual(0.2)
  expect(passed / answered).toBeGreaterThanOrEqual(THRESHOLD)
})
