import { expect, test } from './database-fixture'

test('band details open manual add before choosing a condition and its targets', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
  await page
    .getByRole('button', { name: /の詳細$/ })
    .first()
    .click()
  const details = page.getByRole('dialog')
  await expect(
    details.getByRole('heading', { name: /関連する制約/ }),
  ).toBeVisible()
  await expect(
    details.getByRole('combobox', { name: '追加する制約の対象' }),
  ).toHaveCount(0)
  await details.getByRole('button', { name: '手動追加', exact: true }).click()
  const form = page.getByRole('dialog', { name: '制約を手動追加', exact: true })
  await expect(form).toBeVisible()
  await form.getByRole('button', { name: /出演位置を指定する/ }).click()
  await expect(
    form.getByRole('button', {
      name: '位置を指定する出演枠の選択を解除',
      exact: true,
    }),
  ).toBeVisible()
  await form.getByRole('spinbutton', { name: '出演位置（番）' }).fill('1')
  await expect(form.getByText('気分上々↑↑を1番にする')).toBeVisible()
  await expect(
    form.getByRole('button', { name: 'この条件を追加', exact: true }),
  ).toBeVisible()
})
