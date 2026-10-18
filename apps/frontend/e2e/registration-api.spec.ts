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
  test.skip(
    !process.env.FORM_API_E2E,
    'Set FORM_API_E2E=1 with a seeded local backend on port 8787.',
  )
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
