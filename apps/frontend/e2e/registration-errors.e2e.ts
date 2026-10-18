import { expect, test } from './fixtures'
import { mockRegistrationApi } from './registration-fixture'

test('public registration adds name rows, reuses existing IDs, distinguishes same-name people and survives reload', async ({
  page,
}) => {
  const { writes } = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('バンド名')
  await page
    .getByRole('textbox', { name: 'バンド名 必須' })
    .fill('新しいバンド')
  await page.getByRole('button', { name: 'メンバー1を削除' }).click()
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('1〜20人')
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('button', { name: '名簿から選ぶ' }).click()
  const select = page.getByRole('combobox', { name: 'メンバー1を名簿から選択' })
  await expect(select.getByRole('option', { name: /田中 花/ })).toHaveCount(2)
  await select.selectOption('m1')
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('textbox', { name: 'メンバー2の名前' }).fill('田中 花')
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  expect(writes[0]).toMatchObject({
    method: 'POST',
    body: { memberIds: ['m1'], newMembers: [{ memberName: '田中 花' }] },
  })
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新するバンド' })
    .selectOption('new-0')
  await expect(
    page.getByRole('textbox', { name: 'バンド名 必須' }),
  ).toHaveValue('新しいバンド')
  await expect(
    page.getByRole('combobox', { name: 'メンバー1を名簿から選択' }),
  ).toHaveValue('m1')
  await expect(
    page.getByRole('combobox', { name: 'メンバー2を名簿から選択' }),
  ).toHaveValue('person-1-0')
})

test('updates only the chosen band, removes everyone and re-adds the same ID', async ({
  page,
}) => {
  const { roster, writes } = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  const update = page.getByRole('radio', { name: /登録内容の更新/ })
  await page.getByRole('radio', { name: /初回登録/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(update).toBeChecked()
  await expect(page.getByRole('button', { name: '変更を保存' })).toBeDisabled()
  const band = page.getByRole('combobox', { name: '更新するバンド' })
  await band.selectOption('a')
  await page.getByRole('textbox', { name: 'バンド名 必須' }).fill('変更中')
  await band.selectOption('b')
  await expect(
    page.getByRole('textbox', { name: 'バンド名 必須' }),
  ).toHaveValue('ブルーノート')
  await band.selectOption('a')
  await page.getByRole('button', { name: 'メンバー2を削除' }).click()
  await page.getByRole('button', { name: 'メンバー1を削除' }).click()
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  expect(writes[0]).toMatchObject({
    method: 'PATCH',
    bandId: 'a',
    body: { memberIds: [], newMembers: [] },
  })
  expect(roster.memberships).toEqual([{ bandId: 'b', memberId: 'm1' }])
  expect(roster.members).toHaveLength(3)
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await band.selectOption('a')
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('button', { name: '名簿から選ぶ' }).click()
  await page
    .getByRole('combobox', { name: 'メンバー1を名簿から選択' })
    .selectOption('m1')
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  expect(writes[1].body.memberIds).toEqual(['m1'])
})

test('conflicts and failures keep input and require refresh before retry', async ({
  page,
}) => {
  const api = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page
    .getByRole('textbox', { name: 'バンド名 必須' })
    .fill('保持するバンド')
  await page.getByRole('textbox', { name: 'メンバー1の名前' }).fill('佐藤')
  api.fail(409)
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('別の変更')
  await expect(
    page.getByRole('button', { name: '出演登録を送信' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('textbox', { name: 'メンバー1の名前' }),
  ).toHaveValue('佐藤')
  api.fail(0)
  await page.getByRole('button', { name: '入力を残して名簿を再取得' }).click()
  await expect(
    page.getByRole('button', { name: '出演登録を送信' }),
  ).toBeEnabled()
  api.fail(500)
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗')
  await expect(
    page.getByRole('textbox', { name: 'バンド名 必須' }),
  ).toHaveValue('保持するバンド')
  expect(api.writes).toHaveLength(0)
})

test('registration remains usable at mobile width without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page.getByRole('combobox', { name: '更新するバンド' }).selectOption('a')
  await expect(page.getByRole('button', { name: '変更を保存' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})
