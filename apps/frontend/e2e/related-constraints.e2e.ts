import { expect, test } from './database-fixture'

test('band details expose related constraints and preselect the band for additions', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page
    .getByRole('button', { name: /の詳細$/ })
    .first()
    .click()
  const details = page.getByRole('dialog')
  await expect(
    details.getByRole('heading', { name: /関連する制約/ }),
  ).toBeVisible()
  await details.getByRole('button', { name: '手動追加', exact: true }).click()
  const form = page.getByRole('dialog', { name: '制約を手動追加', exact: true })
  await expect(form).toBeVisible()
  await expect(form.getByText('推奨', { exact: true })).toHaveCount(0)
  await expect(
    form.getByRole('button', { name: '追加する', exact: true }),
  ).toBeVisible()
})
