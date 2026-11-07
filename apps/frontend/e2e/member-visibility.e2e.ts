import { expect, test } from './database-fixture'

test('member names can be expanded with the keyboard', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  const summary = page
    .locator('summary[aria-label$="のメンバー全員を表示"]')
    .first()
  await summary.focus()
  await page.keyboard.press('Enter')
  await expect(summary.locator('..')).toHaveAttribute('open', '')
  await expect(summary.locator('..').getByRole('list')).toBeVisible()
})
