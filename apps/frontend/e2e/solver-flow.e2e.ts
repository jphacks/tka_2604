import type { APIRequestContext, Page } from '@playwright/test'

import type { Constraint } from '../src/generated/constraint'
import type { SolveResponse } from '../src/shared/api/events'
import { expect, test } from './fixtures'

const path = '/api/events/demo-event'
type Schedule = NonNullable<SolveResponse['schedule']>
const fixed: Constraint = {
  schema_version: '1.0.0',
  constraint_id: 'demo-constraint',
  event_id: 'demo-event',
  type: 'at_position',
  hardness: 'hard',
  priority: null,
  enabled: true,
  targets: { band_id: 'demo-band-a' },
  params: { position: 0 },
}
async function schedule(request: APIRequestContext): Promise<Schedule> {
  const response = await request.get(`${path}/schedule`)
  expect(response.status()).toBe(200)
  return response.json() as Promise<Schedule>
}
async function constraints(request: APIRequestContext, values: Constraint[]) {
  const current = await schedule(request)
  const response = await request.post(`${path}/constraints`, {
    data: { expectedUpdatedAt: current.updatedAt, constraints: values },
  })
  expect(response.status()).toBe(200)
}
async function open(page: Page) {
  await page.goto('/event/demo-event')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('button', { name: '自動生成', exact: true }),
  ).toBeEnabled()
}
async function generate(page: Page) {
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === `${path}/solve`,
  )
  await page.getByRole('button', { name: '自動生成', exact: true }).click()
  const solved = await response
  expect(solved.status()).toBe(200)
  return solved.json() as Promise<SolveResponse>
}

test.beforeEach(async ({ request }) => {
  await constraints(request, [fixed])
  const current = await schedule(request)
  const response = await request.post(`${path}/schedule`, {
    data: {
      expectedUpdatedAt: current.updatedAt,
      parts: [
        { partId: 'demo-part-1', partName: '前半', bandCount: 4 },
        { partId: 'demo-part-2', partName: null, bandCount: 4 },
      ],
      placements: [
        { bandId: 'demo-band-a', partId: 'demo-part-1', order: 0 },
        { bandId: 'demo-band-b', partId: 'demo-part-1', order: 1 },
      ],
      unassignedBandIds: ['demo-band-c'],
    },
  })
  expect(response.status()).toBe(200)
})

for (const counts of [
  [2, 1],
  [1, 1],
  [2, 3],
]) {
  test(`real Solver preserves configured counts ${counts.join('/')} through generation and reload`, async ({
    page,
    request,
  }) => {
    await open(page)
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    const dialog = page.getByRole('dialog', { name: 'ライブ情報の編集' })
    for (const [index, count] of counts.entries())
      await dialog
        .getByRole('spinbutton', {
          name: `第${index + 1}部の組数`,
          exact: true,
        })
        .fill(String(count))
    await dialog.getByRole('button', { name: '適用', exact: true }).click()
    const body = await generate(page)
    expect(body.result.status).toBe(
      counts[0] + counts[1] < 3 ? 'partial' : 'optimal',
    )
    const saved = await schedule(request)
    expect(saved.parts.map((part) => part.bandCount)).toEqual(counts)
    expect(saved.placements).toHaveLength(Math.min(3, counts[0] + counts[1]))
    for (const part of saved.parts)
      expect(
        saved.placements.filter((item) => item.partId === part.partId).length,
      ).toBeLessThanOrEqual(part.bandCount)
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    for (const [index, count] of counts.entries())
      await expect(
        dialog.getByRole('spinbutton', {
          name: `第${index + 1}部の組数`,
          exact: true,
        }),
      ).toHaveValue(String(count))
  })
}

test('real Solver: generate, enforce fixed/soft constraints, persist and regenerate only on request', async ({
  page,
  request,
}) => {
  await constraints(request, [
    fixed,
    {
      ...fixed,
      constraint_id: 'soft-first',
      hardness: 'soft',
      priority: 'high',
      targets: { band_id: 'demo-band-b' },
    },
  ])
  await open(page)
  const calls: string[] = []
  page.on('request', (r) => {
    if (r.method() === 'POST')
      calls.push(new URL(r.url()).pathname.split('/').at(-1)!)
  })
  // Hold the browser request to inspect busy state, then forward to the real BE/Solver.
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${path}/solve`, async (route) => {
    await waiting
    await route.continue()
  })
  const response = page.waitForResponse(
    (r) => new URL(r.url()).pathname === `${path}/solve`,
  )
  await page.getByRole('button', { name: '自動生成', exact: true }).click()
  await expect(
    page.getByRole('button', {
      name: '計算中…',
      exact: true,
      includeHidden: true,
    }),
  ).toBeDisabled()
  const order = page.getByRole('textbox', {
    name: 'バンドBの出演順',
    exact: true,
  })
  await expect(page.locator('section[aria-label="出演順"]')).toHaveAttribute(
    'inert',
    '',
  )
  release()
  const solved = await response
  expect(solved.status()).toBe(200)
  const body = (await solved.json()) as SolveResponse
  expect(['optimal', 'feasible']).toContain(body.result.status)
  expect(body.result.constraintResults).toEqual([
    { constraintId: 'demo-constraint', status: 'met' },
    { constraintId: 'soft-first', status: 'unmet' },
  ])
  expect(calls).toEqual(['schedule', 'constraints', 'solve'])
  expect(body.schedule?.placements).toHaveLength(3)
  expect(new Set(body.schedule?.placements.map((p) => p.bandId)).size).toBe(3)
  expect(body.schedule?.unassignedBandIds).toEqual([])
  expect(await schedule(request)).toEqual(body.schedule)
  await expect(
    page.getByRole('status').filter({ hasText: '生成して保存しました' }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'バンドAの出演順', exact: true }),
  ).toHaveValue('1')
  await expect(page.getByText('未達成', { exact: true })).toBeVisible()
  await page.reload()
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('textbox', { name: '未配置バンドの出演順', exact: true }),
  ).not.toHaveValue('')
  calls.length = 0
  await order.fill('')
  await order.press('Enter')
  await expect(
    page.getByRole('button', { name: '出演順を保存', exact: true }),
  ).toBeEnabled()
  expect(calls).toEqual([])
  await page.unroute(`**${path}/solve`)
  await generate(page)
  await expect(order).not.toHaveValue('')
  expect(calls).toEqual(['schedule', 'constraints', 'solve'])
})

test('real Solver: partial placements keep every band and mark missing targets unchecked', async ({
  page,
  request,
}) => {
  await constraints(request, [
    fixed,
    {
      ...fixed,
      constraint_id: 'conflicting-first',
      targets: { band_id: 'demo-band-b' },
    },
  ])
  await open(page)
  const body = await generate(page)
  expect(body.result.status).toBe('partial')
  expect(body.schedule).not.toBeNull()
  const assigned = body.schedule!.placements.map((p) => p.bandId)
  const missing = body.schedule!.unassignedBandIds
  expect(assigned.length).toBeGreaterThan(0)
  expect(missing.length).toBeGreaterThan(0)
  expect([...assigned, ...missing].sort()).toEqual([
    'demo-band-a',
    'demo-band-b',
    'demo-band-c',
  ])
  expect(
    body.result.constraintResults?.some((c) => c.status === 'unchecked'),
  ).toBe(true)
  expect(await schedule(request)).toEqual(body.schedule)
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '一部の出演枠を配置して保存しました' }),
  ).toBeVisible()
  await expect(
    page.getByText('対象に未配置の出演枠があります', { exact: true }).first(),
  ).toBeVisible()
  for (const id of missing) {
    const name =
      id === 'demo-band-a'
        ? 'バンドA'
        : id === 'demo-band-b'
          ? 'バンドB'
          : '未配置バンド'
    await expect(
      page
        .getByRole('region', { name: '未配置', exact: true })
        .getByRole('textbox', { name: `${name}の出演順`, exact: true }),
    ).toHaveValue('')
  }
})

test('real Solver: infeasible keeps the current arrangement and constraints', async ({
  page,
  request,
}) => {
  // All three require the final position. A partial arrangement cannot reach it either.
  await constraints(
    request,
    ['a', 'b', 'c'].map((suffix) => ({
      ...fixed,
      constraint_id: `last-${suffix}`,
      targets: { band_id: `demo-band-${suffix}` },
      params: { position: 2 },
    })),
  )
  const before = await schedule(request)
  await open(page)
  const body = await generate(page)
  expect(body.result.status).toBe('infeasible')
  expect(body.schedule).toBeNull()
  await expect(
    page
      .getByRole('status')
      .filter({ hasText: '必須条件を満たす出演順がありません' }),
  ).toBeVisible()
  const after = await schedule(request)
  expect(after.placements).toEqual(before.placements)
  expect(after.unassignedBandIds).toEqual(before.unassignedBandIds)
  await expect(
    page.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
  ).toHaveValue('2')
  const savedConstraints = await request.get(`${path}/constraints`)
  const saved = (await savedConstraints.json()) as { constraints: unknown[] }
  expect(saved.constraints).toHaveLength(3)
})

test('Solver connection failure preserves the saved arrangement and allows retry', async ({
  page,
  request,
}) => {
  await open(page)
  const before = await schedule(request)
  await page.route(`**${path}/solve`, (route) =>
    route.fulfill({
      status: 503,
      json: {
        error: {
          code: 'solver_unavailable',
          message: 'Solverの呼出しまたは応答の検証に失敗しました。',
          details: [],
        },
      },
    }),
  )
  await page.getByRole('button', { name: '自動生成', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Solverの接続設定')
  const after = await schedule(request)
  expect(after.placements).toEqual(before.placements)
  expect(after.unassignedBandIds).toEqual(before.unassignedBandIds)
  await expect(
    page.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(
    page.getByRole('textbox', { name: '未配置バンドの出演順', exact: true }),
  ).toHaveValue('')
  await page.unroute(`**${path}/solve`)
  await generate(page)
  await expect(
    page.getByRole('status').filter({ hasText: '生成して保存しました' }),
  ).toBeVisible()
})
