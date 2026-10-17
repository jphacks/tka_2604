import { expect, test } from './fixtures'

test('backdrop dismisses edits like the close button and restores focus', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const opener = page
    .getByRole('region', { name: '出演順', exact: true })
    .getByRole('button', { name: 'Pretenderを編集', exact: true })
  await opener.click()
  const dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  const name = dialog.getByRole('textbox', { name: '出演名 必須' })
  await name.fill('保存しない名前')
  await dialog
    .getByRole('heading', { name: '出演枠を編集', exact: true })
    .click()
  await expect(dialog).toBeVisible()
  const inputBox = await name.boundingBox()
  if (!inputBox) throw new Error('Name input is missing')
  await page.mouse.move(inputBox.x + 20, inputBox.y + 15)
  await page.mouse.down()
  await page.mouse.move(5, 5)
  await page.mouse.up()
  await expect(dialog).toBeVisible()
  await page.mouse.click(5, 5)
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
  await opener.click()
  await expect(name).toHaveValue('Pretender')
  await dialog.getByRole('button', { name: '閉じる', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(opener).toBeFocused()
})

test('edits assigned and unassigned performances without losing schedule or conditions', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const schedule = page.getByRole('region', { name: '出演順', exact: true })
  await schedule
    .getByRole('button', { name: '気分上々↑↑を編集', exact: true })
    .click()
  let dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  await dialog
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('キャンセルする名前')
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await expect(
    schedule.getByRole('button', { name: '気分上々↑↑を編集', exact: true }),
  ).toBeFocused()
  await schedule
    .getByRole('button', { name: '気分上々↑↑を編集', exact: true })
    .click()
  dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  await dialog.getByRole('textbox', { name: '出演名 必須' }).fill('')
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  await expect(dialog.getByRole('alert')).toContainText('出演名を入力')
  await dialog
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('更新したバンド')
  await dialog.getByRole('checkbox', { name: /^佐藤（/ }).uncheck()
  await dialog
    .getByRole('textbox', { name: '新しいメンバー（任意）' })
    .fill('新しい出演者')
  await dialog
    .getByRole('textbox', { name: '出演に関する希望 任意' })
    .fill('第1部で演奏したい')
  await dialog
    .getByRole('textbox', { name: '連絡先メール 任意' })
    .fill('band@example.com')
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    schedule.getByRole('textbox', {
      name: '更新したバンドの出演順',
      exact: true,
    }),
  ).toHaveValue('1')
  await expect(
    schedule.getByRole('checkbox', {
      name: '更新したバンドを固定',
      exact: true,
    }),
  ).toBeChecked()
  await expect(
    page.getByRole('heading', {
      name: '更新したバンドを1番にする',
      exact: true,
    }),
  ).toBeVisible()
  await expect(schedule.locator('[data-performance="p1"]')).toContainText(
    '新しい出演者',
  )
  await expect(schedule.locator('[data-performance="p1"]')).not.toContainText(
    '佐藤',
  )

  await schedule.getByRole('button', { name: /未配置へ/ }).click()
  await schedule
    .getByRole('button', { name: '源泉掛け流しを編集', exact: true })
    .click()
  dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  await dialog
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('未配置の更新')
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    schedule.getByRole('textbox', {
      name: '未配置の更新の出演順',
      exact: true,
    }),
  ).toHaveValue('')
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: '出演枠・メンバー', exact: true })
    .click()
  await page
    .getByRole('button', { name: '更新したバンドを編集', exact: true })
    .click()
  dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  await expect(
    dialog.getByRole('textbox', { name: '出演に関する希望 任意' }),
  ).toHaveValue('第1部で演奏したい')
  await expect(
    dialog.getByRole('textbox', { name: '連絡先メール 任意' }),
  ).toHaveValue('band@example.com')
})

test('membership edits immediately reevaluate member constraints', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const schedule = page.getByRole('region', { name: '出演順', exact: true })
  await schedule
    .getByRole('button', { name: 'Pretenderを編集', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '出演枠を編集', exact: true })
  await dialog.getByRole('checkbox', { name: /^佐藤（/ }).check()
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  const condition = page.getByRole('article').filter({
    has: page.getByRole('heading', { name: /佐藤の出演の間に2組以上/ }),
  })
  await expect(condition).toContainText('未達成')
  await expect(
    page
      .getByRole('region', { name: 'AIチャット' })
      .getByRole('log')
      .locator('> div'),
  ).toHaveCount(1)
})
