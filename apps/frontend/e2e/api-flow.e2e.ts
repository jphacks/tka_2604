import { expect, test } from './fixtures'

test('real API: create, failed save, retry, reload, conflict and delete', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await expect(page.getByText(/API接続 ·/)).toBeVisible()
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
    // Authentication is still the in-memory demo session (#59).
    await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
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

test('real API: roster, part names, constraints and read-only controls', async ({
  page,
}) => {
  await page.goto('/event/demo-event')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await expect(
    page.getByRole('heading', { name: 'デモライブ', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: /前半 · 2\/2組/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'バンドAの出演順', exact: true }),
  ).toBeDisabled()
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
    page.getByRole('button', { name: '出演枠を追加', exact: true }),
  ).toBeDisabled()
  await page.screenshot({
    path: test.info().outputPath('api-roster.png'),
    fullPage: true,
  })
})
