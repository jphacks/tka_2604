import { expect, test } from './fixtures'

test('keyboard handle supports cancel and commit while keeping focus and fixed rows', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：VPS（3番）')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(handle).toBeFocused()
  await page.keyboard.press('Space')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：VPS（3番）')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(handle).toBeFocused()
  await expect(
    page.getByRole('textbox', { name: '気分上々↑↑の出演順', exact: true }),
  ).toHaveValue('1')
  await expect(
    page.getByRole('button', { name: '気分上々↑↑を並べ替え', exact: true }),
  ).toBeDisabled()
})

test('invalid capacity has a short error and keeps the existing section size', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const capacity = page.getByRole('textbox', {
    name: '第1部の組数',
    exact: true,
  })
  await capacity.fill('21')
  await capacity.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('1〜20の整数')
  await expect(capacity).toHaveAccessibleDescription('1〜20の整数')
  await expect(
    page.getByRole('heading', { name: '第1部 · 4/4組', exact: true }),
  ).toBeVisible()
  await capacity.press('Escape')
  await expect(capacity).toHaveValue('4')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
