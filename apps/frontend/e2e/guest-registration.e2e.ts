import { randomUUID } from 'node:crypto'

import { expect, test } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } })

test('guest entry, data retention, account registration and login from another browser', async ({
  page,
  browser,
  baseURL,
}) => {
  await page.goto('/')
  await expect(
    page.getByRole('button', { name: '登録せずにはじめる' }),
  ).toBeVisible()
  for (const viewport of [
    { width: 1440, height: 960 },
    { width: 390, height: 844 },
  ]) {
    await page.setViewportSize(viewport)
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(viewport.width)
    await expect(
      page.getByRole('button', { name: '登録せずにはじめる' }),
    ).toBeInViewport({ ratio: 1 })
    await page.screenshot({
      path: test.info().outputPath(`guest-home-${viewport.width}.png`),
      fullPage: true,
    })
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: '登録せずにはじめる' }).click()
  await expect(page).toHaveURL(/\/event$/)
  await expect(
    page.getByRole('button', { name: 'アカウント登録', exact: true }),
  ).toBeVisible()
  const guest = (await (
    await page.request.get('/api/auth/session')
  ).json()) as { userId: string; isRegistered: boolean }
  expect(guest.isRegistered).toBe(false)
  const created = await page.request.post('/api/events', {
    headers: { Origin: baseURL! },
    data: { title: 'ゲストから始めたライブ' },
  })
  expect(created.status()).toBe(201)
  const eventId = ((await created.json()) as { eventId: string }).eventId
  await page.goto(`/event/${eventId}`)
  await expect(
    page.getByText('ゲストから始めたライブ', { exact: true }).first(),
  ).toBeVisible()
  await page.reload()
  await expect(
    page.getByText('ゲストから始めたライブ', { exact: true }).first(),
  ).toBeVisible()
  await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
  await expect(
    page.getByRole('dialog', { name: 'ログアウトしますか？' }),
  ).toBeVisible()
  const logoutDialog = page.getByRole('dialog', {
    name: 'ログアウトしますか？',
  })
  await expect(logoutDialog).toContainText(
    'ログアウトすると、データは戻りません。',
  )
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 })
    const register = await logoutDialog
      .getByRole('button', { name: 'アカウント登録', exact: true })
      .boundingBox()
    const cancel = await logoutDialog
      .getByRole('button', { name: 'キャンセル', exact: true })
      .boundingBox()
    const logout = await logoutDialog
      .getByRole('button', { name: 'ログアウト', exact: true })
      .boundingBox()
    expect(register!.width).toBeGreaterThan(cancel!.width)
    expect(register!.y + register!.height).toBeLessThanOrEqual(cancel!.y)
    expect(cancel!.y).toBe(logout!.y)
    await expect(logoutDialog).not.toContainText('ゲスト')
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBeLessThanOrEqual(width)
  }
  await page.setViewportSize({ width: 1440, height: 960 })
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page
    .getByRole('button', { name: 'アカウント登録', exact: true })
    .click()
  const dialog = page.getByRole('dialog', {
    name: 'アカウント登録',
    exact: true,
  })
  await page.screenshot({
    path: test.info().outputPath('guest-registration-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: test.info().outputPath('guest-registration-mobile.png'),
    fullPage: true,
  })
  const userId = `g_${randomUUID().replaceAll('-', '').slice(0, 16)}`
  const password = 'test-only-guest-password'
  await dialog
    .getByRole('textbox', { name: 'ログインID', exact: true })
    .fill(userId)
  await dialog.getByLabel('パスワード', { exact: true }).fill(password)
  await dialog.getByLabel('パスワード（確認）', { exact: true }).fill(password)
  await dialog
    .getByRole('button', { name: 'アカウント登録', exact: true })
    .click()
  await expect(dialog).not.toBeVisible()
  await expect(page).toHaveURL(new RegExp(`/event/${eventId}$`))
  await expect(
    page.getByRole('button', { name: 'アカウント登録', exact: true }),
  ).toHaveCount(0)
  expect(await (await page.request.get('/api/auth/session')).json()).toEqual({
    userId: guest.userId,
    loginId: userId,
    isRegistered: true,
  })
  const other = await browser.newContext({
    baseURL,
    storageState: { cookies: [], origins: [] },
  })
  try {
    const tab = await other.newPage()
    await tab.goto('/login')
    await tab
      .getByRole('textbox', { name: 'ログインID', exact: true })
      .fill(userId)
    await tab.getByLabel('パスワード', { exact: true }).fill(password)
    await tab.getByRole('button', { name: 'ログイン', exact: true }).click()
    await expect(
      tab.getByText('ゲストから始めたライブ', { exact: true }),
    ).toBeVisible()
    await tab.goto(`/event/${eventId}`)
    await expect(
      tab.getByText('ゲストから始めたライブ', { exact: true }).first(),
    ).toBeVisible()
  } finally {
    await other.close()
  }
})
