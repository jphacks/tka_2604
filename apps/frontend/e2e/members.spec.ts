import { expect, test } from './fixtures'

test('reuses a selected person and keeps a newly entered person with the same name separate', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026/forms')
  await page
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('掛け持ちの出演枠')
  await page.getByRole('checkbox', { name: /^佐藤（/ }).check()
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '別の出演枠を登録' }).click()
  await page
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('同名の別人の出演枠')
  await page
    .getByRole('textbox', { name: '新しいメンバー（任意）' })
    .fill('佐藤')
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'Setly ホーム' }).click()
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await page.getByRole('link', { name: '春ライブ 2026', exact: true }).click()
  await page.getByRole('button', { name: '手動追加' }).click()
  const dialog = page.getByRole('dialog', { name: '制約を手動追加' })
  await dialog
    .getByRole('button', { name: /メンバーの出演間隔を空ける/ })
    .click()
  const choices = dialog
    .getByRole('combobox', { name: '対象のメンバー' })
    .getByRole('option', { name: /^佐藤/ })
  await expect(choices).toHaveCount(2)
  await expect(choices.nth(0)).toContainText('掛け持ちの出演枠')
  await expect(choices.nth(0)).not.toContainText('同名の別人の出演枠')
  await expect(choices.nth(1)).toContainText('同名の別人の出演枠')
})
