import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import type {
  FormRoster,
  SavedFormBand,
} from '../src/features/forms/repositories/types'
import { expect, test } from './fixtures'

test('real API and local D1: registration, replacement, unlinking, re-addition and reload', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/events', {
    data: { title: '春ライブ 2026' },
  })
  expect(created.status()).toBe(201)
  const event = (await created.json()) as { eventId: string }
  const url = `/api/events/${event.eventId}/form`
  const get = async () => {
    const response = await request.get(url)
    expect(response.status()).toBe(200)
    return response.json() as Promise<FormRoster>
  }
  let roster = await get()
  const aResponse = await request.post(`${url}/bands`, {
    data: {
      expectedUpdatedAt: roster.updatedAt,
      bandName: 'サンセット・レコード',
      memberIds: [],
      newMembers: [{ memberName: '田中 花' }, { memberName: '鈴木 蓮' }],
    },
  })
  expect(aResponse.status()).toBe(201)
  const a = (await aResponse.json()) as SavedFormBand
  const bResponse = await request.post(`${url}/bands`, {
    data: {
      expectedUpdatedAt: a.updatedAt,
      bandName: 'ブルーノート',
      memberIds: [
        a.members.find((member) => member.memberName === '田中 花')!.memberId,
      ],
      newMembers: [],
    },
  })
  expect(bResponse.status()).toBe(201)
  const b = (await bResponse.json()) as SavedFormBand
  const originalShared = a.members.find(
    (member) => member.memberName === '田中 花',
  )!
  const originalRemoved = a.members.find(
    (member) => member.memberName === '鈴木 蓮',
  )!
  const shared = originalShared.memberId
  const removed = originalRemoved.memberId
  await page.goto(`/event/${event.eventId}/forms`)
  await page
    .getByRole('textbox', { name: 'バンド名 必須' })
    .fill('ミッドナイト・セッション')
  await page.getByRole('button', { name: '名簿から選ぶ' }).click()
  await page
    .getByRole('combobox', { name: 'メンバー1を名簿から選択' })
    .selectOption(shared)
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('textbox', { name: 'メンバー2の名前' }).fill('田中 花')
  const screenshotDir = process.env.CAPTURE_FORM_SCREENSHOTS
    ? path.resolve('../../docs/screenshots/issue-82')
    : null
  if (screenshotDir) {
    await mkdir(screenshotDir, { recursive: true })
    await page.setViewportSize({ width: 1280, height: 1080 })
    await page.screenshot({
      path: path.join(screenshotDir, 'registration.png'),
      fullPage: true,
    })
  }
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  roster = await get()
  const added = roster.bands.find(
    (band) => band.bandName === 'ミッドナイト・セッション',
  )!
  expect(
    roster.memberships.filter((item) => item.bandId === added.bandId),
  ).toHaveLength(2)
  expect(
    roster.members.filter((item) => item.memberName === '田中 花'),
  ).toHaveLength(2)
  const selectedRows = roster.memberships.filter(
    (item) => item.bandId === a.band.bandId,
  )
  const sharedRow =
    selectedRows.findIndex((item) => item.memberId === shared) + 1
  const replacedRow =
    selectedRows.findIndex((item) => item.memberId === removed) + 1
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新するバンド' })
    .selectOption(a.band.bandId)
  await expect(
    page.getByRole('combobox', { name: `メンバー${sharedRow}を名簿から選択` }),
  ).toHaveValue(shared)
  await page
    .getByRole('button', { name: '新しい人を入力して差し替え' })
    .nth(replacedRow - 1)
    .click()
  await page
    .getByRole('textbox', { name: `メンバー${replacedRow}の名前` })
    .fill('佐藤 凛')
  if (screenshotDir)
    await page.screenshot({
      path: path.join(screenshotDir, 'update.png'),
      fullPage: true,
    })
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  roster = await get()
  expect(roster.memberships).not.toContainEqual({
    bandId: a.band.bandId,
    memberId: removed,
  })
  expect(roster.members).toContainEqual(originalRemoved)
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新するバンド' })
    .selectOption(a.band.bandId)
  await page.getByRole('button', { name: 'メンバー2を削除' }).click()
  await page.getByRole('button', { name: 'メンバー1を削除' }).click()
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  roster = await get()
  expect(
    roster.memberships.filter((item) => item.bandId === a.band.bandId),
  ).toEqual([])
  expect(roster.memberships).toContainEqual({
    bandId: b.band.bandId,
    memberId: shared,
  })
  expect(roster.members).toContainEqual(originalShared)
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新するバンド' })
    .selectOption(a.band.bandId)
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('button', { name: '名簿から選ぶ' }).click()
  await page
    .getByRole('combobox', { name: 'メンバー1を名簿から選択' })
    .selectOption(shared)
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新するバンド' })
    .selectOption(a.band.bandId)
  await expect(
    page.getByRole('combobox', { name: 'メンバー1を名簿から選択' }),
  ).toHaveValue(shared)
  const final = await get()
  expect(final.memberships).toContainEqual({
    bandId: a.band.bandId,
    memberId: shared,
  })
  expect(final.memberships).toContainEqual({
    bandId: b.band.bandId,
    memberId: shared,
  })
})

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
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('保存するバンド')
    await page
      .getByRole('textbox', { name: 'メンバー1の名前' })
      .fill('実利用メンバー')
    await page.getByRole('button', { name: '出演登録を送信' }).click()
    await expect(
      page.getByRole('heading', { name: '出演登録を受け付けました' }),
    ).toBeVisible()
    await page.getByRole('link', { name: 'フォーム管理へ' }).click()
    await page.getByRole('link', { name: '回答・出演枠を確認' }).click()
    await expect(
      page.getByText('保存するバンド', { exact: true }),
    ).toBeVisible()
    await page
      .getByRole('link', { name: '保存するバンドを編集', exact: true })
      .click()
    await expect(
      page.getByRole('radio', { name: /登録内容の更新/ }),
    ).toBeChecked()
    await expect(
      page.getByRole('textbox', { name: 'バンド名 必須' }),
    ).toHaveValue('保存するバンド')
    await page
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('更新を保存するバンド')
    await page.getByRole('button', { name: '変更を保存' }).click()
    await expect(
      page.getByRole('heading', { name: '登録内容を更新しました' }),
    ).toBeVisible()
    await page.reload()
    await expect(
      page.getByRole('textbox', { name: 'バンド名 必須' }),
    ).toHaveValue('更新を保存するバンド')
    await expect(page.locator('body')).not.toContainText('デモ')
    const roster = (await (
      await request.get(`/api/events/${eventId}/form`)
    ).json()) as FormRoster
    expect(roster.bands.map((band) => band.bandName)).toContain(
      '更新を保存するバンド',
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
    data: { title: 'バンド紹介の保存確認' },
  })
  expect(created.status()).toBe(201)
  const { eventId } = (await created.json()) as { eventId: string }
  const formUrl = `/event/${eventId}/forms`
  const description = 'アップテンポなロック\n明るく盛り上がるバンドです。'
  const field = page.getByRole('textbox', { name: 'バンド紹介（任意）' })
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
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('紹介付きバンド')
    await page.getByRole('textbox', { name: 'メンバー1の名前' }).fill('出演者')
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
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('紹介を保持するバンド')
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
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('紹介なしバンド')
    await page
      .getByRole('textbox', { name: 'メンバー1の名前' })
      .fill('別の出演者')
    await submit('出演登録を送信', '出演登録を受け付けました')
    const roster = (await (
      await request.get(`/api/events/${eventId}/form`)
    ).json()) as FormRoster
    expect(
      roster.bands.find((band) => band.bandName === '紹介なしバンド')
        ?.description,
    ).toBeNull()
  } finally {
    expect((await request.delete(`/api/events/${eventId}`)).ok()).toBe(true)
  }
})
