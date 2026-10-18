import { expect, test } from './fixtures'

test('events have no status controls and remain searchable and editable', async ({
  page,
  request,
}) => {
  const ids: string[] = []
  try {
    for (const [title, venue] of [
      ['状態削除確認ライブ', '検索確認ホール'],
      ['別のライブ', '別の会場'],
    ]) {
      const response = await request.post('/api/events', {
        data: { title, venue },
      })
      expect(response.status()).toBe(201)
      const body = (await response.json()) as { eventId: string }
      expect(body).not.toHaveProperty('status')
      ids.push(body.eventId)
    }
    await page.goto('/event')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      page.getByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    for (const label of ['すべて', '準備中', '調整中', '確定']) {
      await expect(
        page.getByRole('button', { name: label, exact: true }),
      ).toHaveCount(0)
    }
    await expect(page.getByText(/^(準備中|調整中|確定)$/)).toHaveCount(0)
    const search = page.getByRole('textbox', { name: 'イベントを検索' })
    await search.fill('状態削除確認')
    await expect(
      page.getByRole('heading', { name: '状態削除確認ライブ' }),
    ).toBeVisible()
    await expect(page.getByRole('heading', { name: '別のライブ' })).toHaveCount(
      0,
    )
    await search.fill('検索確認ホール')
    await expect(
      page.getByRole('heading', { name: '状態削除確認ライブ' }),
    ).toBeVisible()
    await search.fill('存在しないイベント')
    await expect(
      page.getByText('条件に一致するイベントがありません'),
    ).toBeVisible()
    await search.fill('')
    await expect(
      page.getByRole('heading', { name: '別のライブ' }),
    ).toBeVisible()
    await search.fill('状態削除確認')
    await page.screenshot({
      path: test.info().outputPath('events-without-status.png'),
      fullPage: true,
    })
    await page.getByRole('link', { name: '設定', exact: true }).click()
    await expect(page.getByRole('textbox', { name: 'イベント名' })).toHaveValue(
      '状態削除確認ライブ',
    )
    await expect(page.getByLabel('ステータス')).toHaveCount(0)
    await page
      .getByRole('textbox', { name: '会場', exact: true })
      .fill('更新した会場')
    await page.getByRole('button', { name: '変更を保存' }).click()
    await expect(page.getByText('イベントの設定を更新しました。')).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      page.getByRole('textbox', { name: '会場', exact: true }),
    ).toHaveValue('更新した会場')
    await expect(page.getByLabel('ステータス')).toHaveCount(0)
    await page.screenshot({
      path: test.info().outputPath('settings-without-status.png'),
      fullPage: true,
    })
  } finally {
    for (const id of ids) await request.delete(`/api/events/${id}`)
  }
})
