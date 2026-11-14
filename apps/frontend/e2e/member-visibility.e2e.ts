import { expect, test } from './database-fixture'

test('member names stay on one line with the full names in a tooltip', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
  await expect(
    page
      .getByRole('region', { name: '出演順の表' })
      .getByText('紹介', { exact: true }),
  ).toHaveCount(0)
  const members = page.locator('[data-performance] span.truncate').first()
  await expect(members).toBeVisible()
  await expect(members).toHaveClass(/truncate/)
  const names = await members.textContent()
  expect(names).toBeTruthy()
  await members.evaluate((element) => {
    element.style.width = '30px'
  })
  await members.hover()
  await expect(page.getByRole('tooltip')).toHaveText(names!)
  const tooltip = page.getByRole('tooltip')
  await tooltip.hover()
  await expect(tooltip).toBeVisible()
  await tooltip.click({ clickCount: 3 })
  await expect
    .poll(() => page.evaluate(() => window.getSelection()?.toString().trim()))
    .toBe(names!.trim())
  await page.mouse.move(0, 0)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await members.evaluate((element) => {
    element.style.width = `${element.scrollWidth}px`
  })
  await members.hover()
  await page.waitForTimeout(600)
  await expect(page.getByRole('tooltip')).toHaveCount(0)
  await expect(page.locator('[data-performance] details')).toHaveCount(0)
})
