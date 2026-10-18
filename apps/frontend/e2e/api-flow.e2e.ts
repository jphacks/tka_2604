import type { Locator, Page } from '@playwright/test'

import { expect, test } from './fixtures'

test('configured part counts survive creation, cancellation, explicit saving and reload', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  let dialog = page.getByRole('dialog', { name: '新しいイベントを作成' })
  await dialog
    .getByRole('textbox', { name: 'イベント名' })
    .fill('部構成の保存確認')
  await dialog.getByRole('spinbutton', { name: '部数', exact: true }).fill('2')
  await dialog
    .getByRole('spinbutton', { name: '第1部の組数', exact: true })
    .fill('2')
  await dialog
    .getByRole('spinbutton', { name: '第2部の組数', exact: true })
    .fill('3')
  await dialog
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await expect(page).toHaveURL(/\/event\/[^/?]+$/)
  await expect(
    page.getByRole('heading', { name: '部構成の保存確認', exact: true }),
  ).toBeVisible()
  const id = new URL(page.url()).pathname.split('/').at(-1)!
  const path = `/api/events/${id}`
  const counts = async () =>
    (
      (await (await request.get(`${path}/schedule`)).json()) as {
        parts: { bandCount: number }[]
      }
    ).parts.map((part) => part.bandCount)
  try {
    expect(await counts()).toEqual([2, 3])
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    dialog = page.getByRole('dialog', { name: 'ライブ情報の編集' })
    await dialog
      .getByRole('spinbutton', { name: '第2部の組数', exact: true })
      .fill('6')
    await dialog
      .getByRole('button', { name: 'キャンセル', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: '第2部 · 0/3組', exact: true }),
    ).toBeVisible()
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    await expect(
      dialog.getByRole('spinbutton', { name: '第2部の組数', exact: true }),
    ).toHaveValue('3')
    await dialog
      .getByRole('spinbutton', { name: '第2部の組数', exact: true })
      .fill('6')
    await dialog.getByRole('button', { name: '適用', exact: true }).click()
    expect(await counts()).toEqual([2, 3])
    await autoSave(page, `${path}/schedule`, () =>
      page.getByRole('button', { name: '出演順を保存', exact: true }).click(),
    )
    await expect(
      page.getByRole('button', { name: '出演順を保存', exact: true }),
    ).toBeDisabled()
    expect(await counts()).toEqual([2, 6])
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      page.getByRole('heading', { name: '第2部 · 0/6組', exact: true }),
    ).toBeVisible()
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(
      page.getByRole('button', { name: 'ライブ情報の編集', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath('live-info-mobile.png'),
      fullPage: true,
    })
  } finally {
    await request.delete(path)
  }
})

async function autoSave(
  page: Page,
  path: string,
  action: () => Promise<unknown>,
  status = 200,
) {
  const saved = page.waitForResponse(
    (response) =>
      response.request().method() === 'POST' &&
      new URL(response.url()).pathname === path,
  )
  await action()
  expect((await saved).status()).toBe(status)
  await expect(
    page.getByRole('button', { name: 'ライブ情報の編集', exact: true }),
  ).toBeEnabled()
}
async function dragTo(page: Page, handle: Locator, target: Locator) {
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Drag target is missing')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 15,
  })
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.mouse.up()
}

test('real API: create, failed save, retry, reload, conflict and delete', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(page.getByText(/API接続 ·/)).toHaveCount(0)
  await page
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: 'イベント名' })
    .fill('RPCブラウザ確認')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await expect(page).toHaveURL(/\/event\/[^/?]+$/)
  await expect(
    page.getByRole('heading', { name: 'RPCブラウザ確認', exact: true }),
  ).toBeVisible()
  const eventId = new URL(page.url()).pathname.split('/').at(-1)!
  const apiPath = `/api/events/${eventId}`
  try {
    await page.getByRole('link', { name: '設定', exact: true }).click()
    const name = page.getByRole('textbox', { name: 'イベント名' })
    await name.fill('RPC保存確認')
    await page.route(`**${apiPath}`, async (route) => {
      if (route.request().method() === 'PATCH') {
        await route.fulfill({
          status: 503,
          contentType: 'text/html',
          body: 'unavailable',
        })
      } else await route.continue()
    })
    await page.getByRole('button', { name: '変更を保存' }).click()
    await expect(page.getByRole('alert')).toContainText('503')
    await expect(name).toHaveValue('RPC保存確認')
    await expect(page.getByText('イベントの設定を更新しました。')).toHaveCount(
      0,
    )
    await page.unroute(`**${apiPath}`)
    await page.getByRole('button', { name: '変更を保存' }).click()
    await expect(page.getByText('イベントの設定を更新しました。')).toBeVisible()
    await page.reload()
    // Authentication is still the temporary workspace session (#59).
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(name).toHaveValue('RPC保存確認')
    const revision = (await (await request.get(apiPath)).json()) as {
      updatedAt: string
    }
    const external = await request.patch(apiPath, {
      data: { title: '他の画面の更新', expectedUpdatedAt: revision.updatedAt },
    })
    expect(external.status()).toBe(200)
    await name.fill('保持する未保存の入力')
    await page.getByRole('button', { name: '変更を保存' }).click()
    await expect(page.getByRole('alert')).toContainText('再取得')
    await expect(name).toHaveValue('保持する未保存の入力')
    await expect(page.getByText('イベントの設定を更新しました。')).toHaveCount(
      0,
    )
    await page.getByRole('button', { name: '削除', exact: true }).click()
    await page.getByRole('dialog').getByRole('button', { name: /削除/ }).click()
    await expect(
      page.getByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    expect((await request.get(apiPath)).status()).toBe(404)
  } finally {
    await request.delete(apiPath)
  }
})

test('real API: roster, part names, saved history and roster registration links', async ({
  page,
}) => {
  await page.goto('/event/demo-event')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('heading', { name: 'デモライブ', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /前半 · 2\/4組/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
  ).toBeEnabled()
  await expect(
    page.getByText('保存確認用の発言', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('link', { name: '出演枠・メンバー', exact: true })
    .click()
  await expect(
    page.getByRole('cell', { name: 'バンドA', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('cell', { name: '必須で先頭にする', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: '出演枠を追加', exact: true }),
  ).toHaveAttribute('href', '/event/demo-event/forms')
  await page.screenshot({
    path: test.info().outputPath('api-roster.png'),
    fullPage: true,
  })
})

test('real API: schedule and constraints survive reload, failures and concurrent changes', async ({
  page,
  request,
}) => {
  const path = '/api/events/demo-event'
  const beforeSchedule = (await (
    await request.get(`${path}/schedule`)
  ).json()) as {
    parts: { partId: string; partName: string | null }[]
    placements: { bandId: string; partId: string; order: number }[]
    unassignedBandIds: string[]
  }
  const beforeConstraints = (await (
    await request.get(`${path}/constraints`)
  ).json()) as {
    constraints: {
      constraint: Record<string, unknown>
      sourceBandId: string | null
    }[]
  }
  try {
    await page.goto('/event/demo-event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const part = page.getByRole('region', { name: '第2部', exact: true })
    await page.route(`**${path}/schedule`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, body: 'unavailable' })
        : route.continue(),
    )
    let schedulePosts = 0
    page.on('request', (request) => {
      if (
        request.method() === 'POST' &&
        new URL(request.url()).pathname === `${path}/schedule`
      )
        schedulePosts++
    })
    await dragTo(
      page,
      page.getByRole('button', { name: 'バンドBを並べ替え', exact: true }),
      part
        .getByText('空き枠 · ここにドラッグして配置', { exact: true })
        .first(),
    )
    await expect(
      page.getByRole('button', { name: '出演順を保存', exact: true }),
    ).toBeEnabled()
    expect(
      (
        (await (await request.get(`${path}/schedule`)).json()) as {
          placements: unknown[]
        }
      ).placements,
    ).toEqual(beforeSchedule.placements)
    expect(schedulePosts).toBe(0)
    await autoSave(
      page,
      `${path}/schedule`,
      () =>
        page
          .getByRole('button', { name: '出演順を保存', exact: true })
          .click({ delay: 75 }),
      503,
    )
    await expect(page.getByRole('alert')).toContainText('503')
    await expect(
      part.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
    ).toHaveValue('2')
    await page.unroute(`**${path}/schedule`)
    await autoSave(page, `${path}/schedule`, () =>
      page
        .getByRole('button', { name: '保存を再試行', exact: true })
        .click({ delay: 75 }),
    )
    await expect(
      page.getByRole('button', { name: '保存を再試行', exact: true }),
    ).toHaveCount(0)
    const unassigned = page.getByRole('textbox', {
      name: '未配置バンドの出演順',
      exact: true,
    })
    await unassigned.fill('3')
    await autoSave(page, `${path}/schedule`, async () => {
      await unassigned.press('Enter')
      await page
        .getByRole('button', { name: '出演順を保存', exact: true })
        .click()
    })
    const handle = page.getByRole('button', {
      name: 'バンドBを並べ替え',
      exact: true,
    })
    await handle.focus()
    // The keyboard sensor attaches its listener after activation.
    await page.keyboard.press('Space', { delay: 50 })
    await expect(page.getByText('移動先：バンドB（2番）')).toHaveCount(1)
    await page.keyboard.press('ArrowDown')
    await expect(page.getByText('移動先：未配置バンド（3番）')).toHaveCount(1)
    await autoSave(page, `${path}/schedule`, async () => {
      await page.keyboard.press('Space')
      await page
        .getByRole('button', { name: '出演順を保存', exact: true })
        .click()
    })
    await expect(unassigned).toHaveValue('2')
    await expect(
      page.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
    ).toHaveValue('3')
    await unassigned.fill('')
    await autoSave(page, `${path}/schedule`, async () => {
      await unassigned.press('Enter')
      await page
        .getByRole('button', { name: '出演順を保存', exact: true })
        .click()
    })
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    const parts = page.getByRole('spinbutton', { name: '部数', exact: true })
    await parts.fill('3')
    await autoSave(page, `${path}/schedule`, async () => {
      await parts.press('Enter')
      await page
        .getByRole('button', { name: '出演順を保存', exact: true })
        .click()
    })
    const schedule = (await (await request.get(`${path}/schedule`)).json()) as {
      parts: unknown[]
      unassignedBandIds: string[]
    }
    expect(schedule.parts).toHaveLength(3)
    expect(schedule.unassignedBandIds).toEqual(['demo-band-c'])
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    const capacity = page.getByRole('spinbutton', {
      name: '第2部の組数',
      exact: true,
    })
    await capacity.fill('6')
    await capacity.press('Enter')
    await expect(
      page.getByRole('dialog', { name: 'ライブ情報の編集' }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('button', { name: '出演順を保存', exact: true }),
    ).toBeEnabled()
    await page.getByRole('button', { name: '手動追加' }).click()
    const dialog = page.getByRole('dialog', { name: '制約を手動追加' })
    await dialog.getByRole('button', { name: /出演位置を指定する/ }).click()
    await dialog
      .getByRole('combobox', { name: '位置を指定する出演枠' })
      .selectOption('demo-band-c')
    await dialog.getByRole('spinbutton', { name: '出演位置（番）' }).fill('3')
    await autoSave(page, `${path}/constraints`, () =>
      dialog.getByRole('button', { name: 'この条件を追加' }).click(),
    )
    const saved = (await (await request.get(`${path}/constraints`)).json()) as {
      updatedAt: string
      constraints: {
        constraint: Record<string, unknown>
        sourceBandId: string | null
      }[]
    }
    expect(
      saved.constraints.find(
        (item) => item.constraint.constraint_id === 'demo-constraint',
      )?.sourceBandId,
    ).toBe('demo-band-a')
    const created = saved.constraints.find(
      (item) => item.constraint.constraint_id !== 'demo-constraint',
    )!
    expect(created.sourceBandId).toBeNull()
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      part.getByRole('textbox', { name: 'バンドBの出演順', exact: true }),
    ).toHaveValue('2')
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    await expect(capacity).toHaveValue('4')
    await page.getByRole('button', { name: 'キャンセル', exact: true }).click()
    await expect(
      page.getByRole('heading', {
        name: '未配置バンドを3番にする',
        exact: true,
      }),
    ).toBeVisible()
    const external = {
      ...created.constraint,
      constraint_id: `external-${Date.now()}`,
    }
    expect(
      (
        await request.post(`${path}/constraints`, {
          data: {
            expectedUpdatedAt: saved.updatedAt,
            constraints: [
              ...saved.constraints.map((item) => item.constraint),
              external,
            ],
          },
        })
      ).status(),
    ).toBe(200)
    await autoSave(
      page,
      `${path}/constraints`,
      () =>
        page
          .getByRole('checkbox', {
            name: 'バンドAを1番にするを有効にする',
            exact: true,
          })
          .uncheck(),
      409,
    )
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(
      page.getByRole('button', { name: '保存を再試行', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('checkbox', {
        name: 'バンドAを1番にするを有効にする',
        exact: true,
      }),
    ).not.toBeChecked()
    const persisted = (await (
      await request.get(`${path}/constraints`)
    ).json()) as typeof saved
    expect(persisted.constraints).toHaveLength(3)
    page.once('dialog', (prompt) => prompt.dismiss())
    await page.getByRole('button', { name: '最新の状態を取得' }).click()
    await expect(
      page.getByRole('button', { name: '保存を再試行', exact: true }),
    ).toBeVisible()
    await page.screenshot({
      path: test.info().outputPath('api-save-conflict.png'),
      fullPage: true,
    })
    page.once('dialog', (prompt) => prompt.accept())
    await page.getByRole('button', { name: '最新の状態を取得' }).click()
    await expect(
      page.getByRole('button', { name: '保存を再試行', exact: true }),
    ).toHaveCount(0)
    await expect(
      page.getByRole('checkbox', {
        name: 'バンドAを1番にするを有効にする',
        exact: true,
      }),
    ).toBeChecked()
    await page.setViewportSize({ width: 390, height: 844 })
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(390)
    await page.screenshot({
      path: test.info().outputPath('api-mobile.png'),
      fullPage: true,
    })
  } finally {
    const current = (await (await request.get(path)).json()) as {
      updatedAt: string
    }
    const restored = await request.post(`${path}/constraints`, {
      data: {
        expectedUpdatedAt: current.updatedAt,
        constraints: beforeConstraints.constraints.map(
          (item) => item.constraint,
        ),
      },
    })
    expect(restored.status()).toBe(200)
    const revision = (await restored.json()) as { updatedAt: string }
    expect(
      (
        await request.post(`${path}/schedule`, {
          data: {
            expectedUpdatedAt: revision.updatedAt,
            parts: beforeSchedule.parts.map(({ partId, partName }) => ({
              partId,
              partName,
            })),
            placements: beforeSchedule.placements,
            unassignedBandIds: beforeSchedule.unassignedBandIds,
          },
        })
      ).status(),
    ).toBe(200)
  }
})

test('chat contract: retry uses the same ID after reopening, with no duplicate messages', async ({
  page,
  request,
}) => {
  const created = (await (
    await request.post('/api/events', {
      data: { title: '別イベントの履歴確認' },
    })
  ).json()) as { eventId: string }
  const messages: {
    messageId: string
    role: string
    text: string
    replyToMessageId: string | null
  }[] = []
  const sentIds: string[] = []
  // Browser contract test: simulate an LLM failure after the user row is saved.
  // Actual D1 history reads below are preserved; no external LLM is called.
  await page.route('**/api/events/demo-event/chat', async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch()
      const body = (await response.json()) as { messages: unknown[] }
      await route.fulfill({
        json: { ...body, messages: [...body.messages, ...messages] },
      })
      return
    }
    const input = route.request().postDataJSON() as {
      message: string
      messageId: string
    }
    sentIds.push(input.messageId)
    if (sentIds.length === 1) {
      messages.push({
        messageId: input.messageId,
        role: 'user',
        text: input.message,
        replyToMessageId: null,
      })
      await route.fulfill({
        status: 502,
        json: { error: { message: '生成に失敗しました。' } },
      })
    } else {
      messages.push({
        messageId: 'test-reply',
        role: 'assistant',
        text: '再試行した返信です。',
        replyToMessageId: input.messageId,
      })
      await route.fulfill({ json: { reply: '再試行した返信です。' } })
    }
  })
  try {
    await page.goto('/event/demo-event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await page
      .getByRole('textbox', { name: 'AIへのメッセージ' })
      .fill('再送確認の希望')
    await page.getByRole('button', { name: 'メッセージを送信' }).click()
    await expect(page.getByRole('alert')).toContainText('送信に失敗')
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(page.getByText('再送確認の希望', { exact: true })).toHaveCount(
      1,
    )
    await page.getByRole('button', { name: 'この発言を再試行' }).click()
    await expect(
      page.getByText('再試行した返信です。', { exact: true }),
    ).toBeVisible()
    expect(sentIds).toEqual([sentIds[0], sentIds[0]])
    await page.getByRole('link', { name: 'マイイベント', exact: true }).click()
    await page
      .getByRole('link', { name: '別イベントの履歴確認', exact: true })
      .click()
    await expect(
      page.getByRole('heading', { name: '別イベントの履歴確認', exact: true }),
    ).toBeVisible()
    await expect(page.getByText('再送確認の希望', { exact: true })).toHaveCount(
      0,
    )
    await page.getByRole('link', { name: 'マイイベント', exact: true }).click()
    await page.getByRole('link', { name: 'デモライブ', exact: true }).click()
    await expect(page.getByText('再送確認の希望', { exact: true })).toHaveCount(
      1,
    )
    await expect(
      page.getByText('再試行した返信です。', { exact: true }),
    ).toHaveCount(1)
    // Retrying a completed persisted message uses the real BE cache, without a model call.
    const cached = await request.post('/api/events/demo-event/chat', {
      data: { messageId: 'demo-user-message', message: '保存確認用の発言' },
    })
    expect(cached.status()).toBe(200)
    expect(await cached.json()).toEqual({ reply: '保存確認用の固定応答です。' })
  } finally {
    await request.delete(`/api/events/${created.eventId}`)
  }
})

for (const width of [1280, 1600]) {
  test(`API preserves the workspace layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.goto('/event/demo-event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const schedule = page.getByRole('region', { name: '出演順', exact: true })
    const constraints = page.getByRole('region', { name: '制約', exact: true })
    const chat = page.getByRole('region', { name: 'AIチャット', exact: true })
    await expect(schedule).toBeVisible()
    await expect(constraints).toHaveCSS('border-right-width', '1px')
    await expect(
      schedule.getByRole('button', { name: 'ライブ情報の編集', exact: true }),
    ).toBeVisible()
    await expect(
      page.getByRole('combobox', { name: 'バンドBの部', exact: true }),
    ).toHaveCount(0)
    const nav = await page
      .getByRole('navigation', { name: 'イベント内の移動' })
      .boundingBox()
    for (const panel of [schedule, constraints, chat]) {
      const box = await panel.boundingBox()
      // The navigation wrapper has a 1px bottom border.
      expect(nav?.y).toBe(64)
      expect(box?.y).toBe(nav!.y + nav!.height + 1)
      expect(box!.y + box!.height).toBe(1000)
    }
    await expect(
      schedule.getByRole('button', { name: '出演順を保存', exact: true }),
    ).toBeVisible()
    await expect(
      constraints.getByRole('button', { name: '制約を保存', exact: true }),
    ).toHaveCount(0)
    const row = await page
      .locator('[data-performance="demo-band-b"]')
      .boundingBox()
    expect(row?.height).toBe(42)
    await page.screenshot({
      path: test.info().outputPath(`api-original-layout-${width}.png`),
      fullPage: true,
    })
  })
}

test('chat proposals require confirmation and auto-save only constraints', async ({
  page,
  request,
}) => {
  const path = '/api/events/demo-event'
  const before = (await (await request.get(`${path}/constraints`)).json()) as {
    updatedAt: string
    constraints: {
      constraint: Record<string, unknown>
      sourceBandId: string | null
    }[]
  }
  let scheduleWrites = 0
  let solveCalls = 0
  page.on('request', (r) => {
    if (r.method() === 'POST') {
      const url = new URL(r.url()).pathname
      if (url === `${path}/schedule`) scheduleWrites++
      if (url === `${path}/solve`) solveCalls++
    }
  })
  const messages: {
    messageId: string
    role: string
    text: string
    replyToMessageId: string | null
  }[] = []
  await page.route(`**${path}/chat`, async (route) => {
    if (route.request().method() === 'GET') {
      const response = await route.fetch()
      const data = (await response.json()) as { messages: unknown[] }
      await route.fulfill({
        json: { ...data, messages: [...data.messages, ...messages] },
      })
    } else {
      const input = route.request().postDataJSON() as {
        messageId: string
        message: string
      }
      messages.push(
        {
          messageId: input.messageId,
          role: 'user',
          text: input.message,
          replyToMessageId: null,
        },
        {
          messageId: 'proposal-reply',
          role: 'assistant',
          text: 'AをBより前にする変更案です。',
          replyToMessageId: input.messageId,
        },
      )
      await route.fulfill({
        json: {
          reply: 'AをBより前にする変更案です。',
          proposal: {
            expectedUpdatedAt: before.updatedAt,
            actions: [
              {
                type: 'add_constraint',
                constraint: {
                  type: 'before',
                  hardness: null,
                  priority: null,
                  targets: {
                    before_band_id: 'demo-band-a',
                    after_band_id: 'demo-band-b',
                  },
                  params: {},
                },
              },
            ],
          },
        },
      })
    }
  })
  try {
    await page.goto('/event/demo-event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await page
      .getByRole('textbox', { name: 'AIへのメッセージ' })
      .fill('AをBより前にしたい')
    await page.getByRole('button', { name: 'メッセージを送信' }).click()
    const proposal = page.getByRole('region', { name: 'AIの制約変更案' })
    await expect(proposal).toBeVisible()
    expect(
      (
        (await (await request.get(`${path}/constraints`)).json()) as {
          constraints: unknown[]
        }
      ).constraints,
    ).toHaveLength(before.constraints.length)
    await expect(
      proposal.getByRole('button', { name: '確認して反映' }),
    ).toBeDisabled()
    await proposal
      .getByRole('combobox', { name: '変更案1の必須・任意' })
      .selectOption('soft')
    await expect(
      proposal.getByRole('button', { name: '確認して反映' }),
    ).toBeDisabled()
    await proposal
      .getByRole('combobox', { name: '変更案1の優先度' })
      .selectOption('mid')
    await page.route(`**${path}/constraints`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, body: 'unavailable' })
        : route.continue(),
    )
    await autoSave(
      page,
      `${path}/constraints`,
      () => proposal.getByRole('button', { name: '確認して反映' }).click(),
      503,
    )
    await expect(page.getByRole('alert')).toContainText('503')
    await expect(proposal).toBeVisible()
    await page.unroute(`**${path}/constraints`)
    await autoSave(page, `${path}/constraints`, () =>
      proposal.getByRole('button', { name: '確認して反映' }).click(),
    )
    await expect(proposal).toHaveCount(0)
    await expect(page.getByRole('log', { name: 'チャット履歴' })).toContainText(
      '制約の変更案を適用しました。',
    )
    await expect(
      page.getByRole('button', { name: 'この発言を再試行' }),
    ).toHaveCount(0)
    const saved = (await (
      await request.get(`${path}/constraints`)
    ).json()) as typeof before
    expect(saved.constraints).toHaveLength(before.constraints.length + 1)
    expect(
      saved.constraints.find((row) => row.constraint.type === 'before')
        ?.constraint,
    ).toMatchObject({
      hardness: 'soft',
      priority: 'mid',
      enabled: true,
      source_text: 'AをBより前にしたい',
    })
    expect(scheduleWrites).toBe(0)
    expect(solveCalls).toBe(0)
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      page.getByRole('heading', {
        name: 'バンドAをバンドBより前にする',
        exact: true,
      }),
    ).toBeVisible()
  } finally {
    const latest = (await (await request.get(path)).json()) as {
      updatedAt: string
    }
    expect(
      (
        await request.post(`${path}/constraints`, {
          data: {
            expectedUpdatedAt: latest.updatedAt,
            constraints: before.constraints.map((row) => row.constraint),
          },
        })
      ).status(),
    ).toBe(200)
  }
})

test('generation saves the displayed schedule and constraints before calling solve', async ({
  page,
  request,
}) => {
  const path = '/api/events/demo-event'
  const schedule = (await (await request.get(`${path}/schedule`)).json()) as {
    parts: { partId: string; partName: string | null; bandCount: number }[]
    placements: unknown[]
    unassignedBandIds: string[]
  }
  const constraints = (await (
    await request.get(`${path}/constraints`)
  ).json()) as { constraints: { constraint: Record<string, unknown> }[] }
  const calls: string[] = []
  page.on('request', (r) => {
    const resource = new URL(r.url()).pathname
    if (
      r.method() === 'POST' &&
      [`${path}/schedule`, `${path}/constraints`, `${path}/solve`].includes(
        resource,
      )
    )
      calls.push(resource.split('/').at(-1)!)
  })
  await page.route(`**${path}/solve`, async (route) => {
    const savedSchedule = (await (
      await request.get(`${path}/schedule`)
    ).json()) as { updatedAt: string; unassignedBandIds: string[] }
    const savedConstraints = (await (
      await request.get(`${path}/constraints`)
    ).json()) as {
      updatedAt: string
      constraints: { constraint: { enabled: boolean } }[]
    }
    expect(route.request().postDataJSON()).toEqual({
      expectedUpdatedAt: savedConstraints.updatedAt,
      parts: [
        { partId: 'demo-part-1', bandCount: 5 },
        { partId: 'demo-part-2', bandCount: 7 },
      ],
    })
    expect(savedSchedule.updatedAt).toBe(savedConstraints.updatedAt)
    expect(savedSchedule.unassignedBandIds).toContain('demo-band-b')
    expect(
      savedConstraints.constraints.every((row) => !row.constraint.enabled),
    ).toBe(true)
    await route.fulfill({
      json: {
        result: {
          eventId: 'demo-event',
          status: 'unknown',
          placements: null,
          unassignedBandIds: null,
          constraintResults: null,
        },
        schedule: null,
      },
    })
  })
  try {
    await page.goto('/event/demo-event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const order = page.getByRole('textbox', {
      name: 'バンドBの出演順',
      exact: true,
    })
    await order.fill('')
    await order.press('Enter')
    await page
      .getByRole('button', { name: 'ライブ情報の編集', exact: true })
      .click()
    const dialog = page.getByRole('dialog', { name: 'ライブ情報の編集' })
    for (const [part, count] of [
      [1, 5],
      [2, 7],
    ]) {
      const capacity = dialog.getByRole('spinbutton', {
        name: `第${part}部の組数`,
        exact: true,
      })
      await capacity.fill(String(count))
      await expect(capacity).toHaveValue(String(count))
    }
    await dialog.getByRole('button', { name: '適用', exact: true }).click()
    await expect(dialog).toHaveCount(0)
    expect(
      (
        (await (await request.get(`${path}/schedule`)).json()) as {
          unassignedBandIds: string[]
        }
      ).unassignedBandIds,
    ).not.toContain('demo-band-b')
    await autoSave(page, `${path}/constraints`, () =>
      page
        .getByRole('checkbox', {
          name: 'バンドAを1番にするを有効にする',
          exact: true,
        })
        .uncheck(),
    )
    expect(
      (
        (await (await request.get(`${path}/schedule`)).json()) as {
          unassignedBandIds: string[]
        }
      ).unassignedBandIds,
    ).not.toContain('demo-band-b')
    calls.length = 0
    await page.route(`**${path}/schedule`, (route) =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 503, body: 'unavailable' })
        : route.continue(),
    )
    await page.getByRole('button', { name: '自動生成', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('503')
    expect(calls).toEqual(['schedule'])
    await page.unroute(`**${path}/schedule`)
    calls.length = 0
    await page.getByRole('button', { name: '自動生成', exact: true }).click()
    await expect(
      page.getByRole('status').filter({ hasText: '探索が完了していません' }),
    ).toBeVisible()
    expect(calls).toEqual(['schedule', 'constraints', 'solve'])
    await expect(order).toHaveValue('')
  } finally {
    const latest = (await (await request.get(path)).json()) as {
      updatedAt: string
    }
    const restored = await request.post(`${path}/constraints`, {
      data: {
        expectedUpdatedAt: latest.updatedAt,
        constraints: constraints.constraints.map((row) => row.constraint),
      },
    })
    expect(restored.status()).toBe(200)
    const revision = (await restored.json()) as { updatedAt: string }
    expect(
      (
        await request.post(`${path}/schedule`, {
          data: {
            expectedUpdatedAt: revision.updatedAt,
            parts: schedule.parts.map(({ partId, partName, bandCount }) => ({
              partId,
              partName,
              bandCount,
            })),
            placements: schedule.placements,
            unassignedBandIds: schedule.unassignedBandIds,
          },
        })
      ).status(),
    ).toBe(200)
  }
})
