import type {
  FormRoster,
  SavedFormBand,
} from '../src/features/forms/repositories/types'
import { expect, test } from './fixtures'

test('production flow: create an event, open its form, register and update DB members from the normal screens', async ({
  page,
  request,
}) => {
  await page.goto('/login')
  await expect(page.locator('body')).not.toContainText('デモ')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .first()
    .click()
  await page
    .getByRole('textbox', { name: 'イベント名' })
    .fill('実利用の登録フロー')
  await page
    .getByRole('dialog')
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await expect(page).toHaveURL(/\/event\/[^/?]+$/)
  await expect(
    page.getByRole('heading', { name: '実利用の登録フロー', exact: true }),
  ).toBeVisible()
  const eventId = new URL(page.url()).pathname.split('/')[2]
  try {
    await page.getByRole('link', { name: 'フォーム管理', exact: true }).click()
    await expect(
      page.getByRole('textbox', { name: '回答フォームのリンク' }),
    ).toHaveValue(new RegExp(`/event/${eventId}/forms$`))
    await page.getByRole('link', { name: '回答フォームを開く' }).click()
    await page
      .getByRole('textbox', { name: '出演名 必須' })
      .fill('保存する出演枠')
    await page
      .getByRole('combobox', { name: 'メンバー1の名前' })
      .fill('実利用メンバー')
    await page.getByRole('button', { name: '出演登録を送信' }).click()
    await expect(
      page.getByRole('heading', { name: '出演登録を受け付けました' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'フォーム管理へ' }).click()
    await page.getByRole('link', { name: '出演順', exact: true }).click()
    await page
      .getByRole('button', { name: '保存する出演枠の詳細', exact: true })
      .click()
    await page
      .getByRole('dialog', { name: '保存する出演枠', exact: true })
      .getByRole('button', { name: '編集', exact: true })
      .click()
    const editDialog = page.getByRole('dialog', { name: '出演枠を編集' })
    await expect(
      editDialog.getByRole('textbox', { name: '出演名 必須' }),
    ).toHaveValue('保存する出演枠')
    await editDialog
      .getByRole('textbox', { name: '出演名 必須' })
      .fill('更新を保存する出演枠')
    await editDialog.getByRole('button', { name: '変更を保存' }).click()
    await expect(editDialog).toHaveCount(0)
    await page.reload()
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(
      page.getByRole('button', {
        name: '更新を保存する出演枠の詳細',
        exact: true,
      }),
    ).toBeVisible()
    await expect(page.locator('body')).not.toContainText('デモ')
    const roster = (await (
      await request.get(`/api/events/${eventId}/form`)
    ).json()) as FormRoster
    expect(roster.bands.map((band) => band.bandName)).toContain(
      '更新を保存する出演枠',
    )
    expect(roster.members.map((member) => member.memberName)).toContain(
      '実利用メンバー',
    )
    await page.goto(`/event/${eventId}/forms/demo`)
    await expect(page).toHaveURL(new RegExp(`/event/${eventId}/forms$`))
    await expect(
      page.getByRole('heading', { name: '実利用の登録フロー 出演登録' }),
    ).toBeVisible()
  } finally {
    await request.delete(`/api/events/${eventId}`)
  }
})

test('band descriptions persist through form creation, editing, reload and clearing in local D1', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/events', {
    data: { title: '紹介の保存確認' },
  })
  expect(created.status()).toBe(201)
  const { eventId } = (await created.json()) as { eventId: string }
  const formUrl = `/event/${eventId}/forms`
  const description = 'アップテンポなロック\n明るく盛り上がる演奏です。'
  const field = page.getByRole('textbox', { name: '紹介（任意）' })
  const readBand = async (bandId: string) => {
    const response = await request.get(`/api/events/${eventId}/form`)
    expect(response.status()).toBe(200)
    const roster = (await response.json()) as FormRoster
    return roster.bands.find((band) => band.bandId === bandId)
  }
  const submit = async (name: string, heading: string) => {
    await page.getByRole('button', { name, exact: true }).click()
    await expect(page.getByRole('heading', { name: heading })).toBeVisible()
  }
  try {
    await page.goto(formUrl)
    await page
      .getByRole('textbox', { name: '出演名 必須' })
      .fill('紹介付き出演枠')
    await page.getByRole('combobox', { name: 'メンバー1の名前' }).fill('出演者')
    await field.fill(description)
    const requestField = page.getByRole('textbox', {
      name: '制約の希望（任意）',
    })
    await requestField.fill('第2部を希望します。')
    await expect(field).toHaveAttribute('maxlength', '500')
    const savedResponse = page.waitForResponse(
      (response) =>
        response.url().endsWith(`/api/events/${eventId}/form/bands`) &&
        response.request().method() === 'POST',
    )
    await submit('出演登録を送信', '出演登録を受け付けました')
    const response = await savedResponse
    expect(response.status()).toBe(201)
    const saved = (await response.json()) as SavedFormBand
    const bandId = saved.band.bandId
    expect(saved.band.description).toBe(description)
    expect(saved.band.requestText).toBe('第2部を希望します。')
    expect((await readBand(bandId))?.requestText).toBe('第2部を希望します。')
    expect((await readBand(bandId))?.description).toBe(description)

    await page.goto(`${formUrl}?bandId=${bandId}`)
    await expect(field).toHaveValue(description)
    await expect(requestField).toHaveValue('第2部を希望します。')
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(field).toBeVisible()
    await page.screenshot({
      path: 'test-results/description-mobile.png',
      fullPage: true,
    })
    await field.fill('ジャズ中心の落ち着いた雰囲気')
    await requestField.fill('前半を希望します。')
    await submit('変更を保存', '登録内容を更新しました')
    expect((await readBand(bandId))?.description).toBe(
      'ジャズ中心の落ち着いた雰囲気',
    )
    await page.reload()
    await expect(field).toHaveValue('ジャズ中心の落ち着いた雰囲気')
    await expect(requestField).toHaveValue('前半を希望します。')

    // Editing other fields must keep the saved introduction.
    await page
      .getByRole('textbox', { name: '出演名 必須' })
      .fill('紹介を保持する出演枠')
    await submit('変更を保存', '登録内容を更新しました')
    expect((await readBand(bandId))?.description).toBe(
      'ジャズ中心の落ち着いた雰囲気',
    )
    await page.reload()
    await field.fill('   ')
    await submit('変更を保存', '登録内容を更新しました')
    expect((await readBand(bandId))?.description).toBeNull()
    expect((await readBand(bandId))?.requestText).toBe('前半を希望します。')
    await page.reload()
    await expect(field).toHaveValue('')
    await expect(requestField).toHaveValue('前半を希望します。')
    await requestField.fill('  ')
    await submit('変更を保存', '登録内容を更新しました')
    expect((await readBand(bandId))?.requestText).toBeNull()
    await page.reload()
    await expect(requestField).toHaveValue('')

    await page.getByRole('radio', { name: /初回登録/ }).check()
    await expect(field).toHaveValue('')
    await page
      .getByRole('textbox', { name: '出演名 必須' })
      .fill('紹介なし出演枠')
    await page
      .getByRole('combobox', { name: 'メンバー1の名前' })
      .fill('別の出演者')
    await submit('出演登録を送信', '出演登録を受け付けました')
    const roster = (await (
      await request.get(`/api/events/${eventId}/form`)
    ).json()) as FormRoster
    expect(
      roster.bands.find((band) => band.bandName === '紹介なし出演枠')
        ?.description,
    ).toBeNull()
  } finally {
    expect((await request.delete(`/api/events/${eventId}`)).ok()).toBe(true)
  }
})
