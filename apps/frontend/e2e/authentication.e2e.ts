import { randomBytes, randomUUID } from 'node:crypto'

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

test.use({ storageState: { cookies: [], origins: [] } })

async function login(page: Page, userId: string, password: string) {
  await page
    .getByRole('textbox', { name: 'ログインID', exact: true })
    .fill(userId)
  await page.getByLabel('パスワード', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'ログイン', exact: true }).click()
}

test('login failure, protected return URL, session restoration and server-side logout', async ({
  page,
  context,
  playwright,
  baseURL,
}) => {
  const password = process.env.SETLY_E2E_PASSWORD
  if (!password || !baseURL)
    throw new Error('E2E authentication setup is missing.')
  await page.goto('/event/demo-event/settings')
  await expect(page).toHaveURL(/\/login$/)
  await page.screenshot({
    path: test.info().outputPath('login-desktop.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({
    path: test.info().outputPath('login-mobile.png'),
    fullPage: true,
  })
  await page.setViewportSize({ width: 1600, height: 1000 })
  await login(page, 'demo-owner', 'incorrect-test-password')
  await expect(page.getByRole('alert')).toContainText(
    'ログインIDまたはパスワード',
  )
  await expect(page).toHaveURL(/\/login$/)
  await login(page, 'demo-owner', password)
  await expect(page).toHaveURL(/\/event\/demo-event\/settings$/)
  await expect(page.getByRole('textbox', { name: 'イベント名' })).toHaveValue(
    'デモライブ',
  )
  await page.reload()
  await expect(page.getByRole('textbox', { name: 'イベント名' })).toHaveValue(
    'デモライブ',
  )
  const cookie = (await context.cookies()).find(
    (item) => item.name === 'setly_session',
  )
  expect(cookie).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' })
  expect(await page.evaluate(() => document.cookie)).not.toContain(
    'setly_session',
  )
  const replay = await playwright.request.newContext({
    baseURL,
    storageState: await context.storageState(),
  })
  try {
    expect((await replay.get('/api/events')).status()).toBe(200)
    await page.getByRole('button', { name: 'ログアウト', exact: true }).click()
    await expect(page).toHaveURL(/\/login$/)
    expect((await replay.get('/api/events')).status()).toBe(401)
    await page.reload()
    await expect(
      page.getByRole('button', { name: 'ログイン', exact: true }),
    ).toBeVisible()
    await page.goto('/event/demo-event')
    await expect(page).toHaveURL(/\/login$/)
  } finally {
    await replay.dispose()
  }
})

test('registration isolates ownership, protects API docs, and keeps participant forms public', async ({
  page,
  playwright,
  baseURL,
}) => {
  if (!baseURL) throw new Error('E2E baseURL is missing.')
  const origin = new URL(baseURL).origin
  const userId = `e2e_${randomUUID().replaceAll('-', '')}`
  const password = randomBytes(32).toString('base64url')
  const anonymous = await playwright.request.newContext({ baseURL })
  const participant = await playwright.chromium.launch()
  let eventId: string | undefined
  try {
    expect((await anonymous.get('/api/events')).status()).toBe(401)
    expect((await anonymous.get('/api/openapi.json')).status()).toBe(401)
    expect((await anonymous.get('/api/docs')).status()).toBe(401)
    for (const rejectedOrigin of [
      'https://untrusted.example',
      'null',
      undefined,
    ]) {
      const response = await anonymous.post('/api/auth/login', {
        ...(rejectedOrigin ? { headers: { Origin: rejectedOrigin } } : {}),
        data: { userId: 'demo-owner', password: 'incorrect-test-password' },
      })
      expect(response.status()).toBe(403)
    }
    expect((await anonymous.get('/api/auth/session')).status()).toBe(401)
    await page.goto('/login')
    await page.getByRole('button', { name: 'アカウントを作成する' }).click()
    await page
      .getByRole('textbox', { name: 'ログインID', exact: true })
      .fill(userId)
    await page.getByLabel('パスワード', { exact: true }).fill(password)
    await page.getByLabel('パスワード（確認）', { exact: true }).fill(password)
    await page.getByRole('button', { name: '新規登録', exact: true }).click()
    await expect(page).toHaveURL(/\/event$/)
    await expect(
      page.getByRole('heading', { name: 'マイイベント' }),
    ).toBeVisible()
    await expect(page.getByText('デモライブ', { exact: true })).toHaveCount(0)
    expect((await page.request.get('/api/events/demo-event')).status()).toBe(
      404,
    )
    expect((await page.request.get('/api/docs')).status()).toBe(200)

    for (const rejectedOrigin of [
      'https://untrusted.example',
      'null',
      undefined,
    ]) {
      const rejected = await page.request.post('/api/events', {
        ...(rejectedOrigin ? { headers: { Origin: rejectedOrigin } } : {}),
        data: { title: 'must not be saved' },
      })
      expect(rejected.status()).toBe(403)
    }
    expect(await (await page.request.get('/api/events')).json()).toEqual({
      events: [],
    })
    const created = await page.request.post('/api/events', {
      headers: { Origin: origin },
      data: { title: '認証と公開フォームの確認' },
    })
    expect(created.status()).toBe(201)
    eventId = ((await created.json()) as { eventId: string }).eventId
    expect((await anonymous.get(`/api/events/${eventId}`)).status()).toBe(401)
    expect((await anonymous.get(`/api/events/${eventId}/form`)).status()).toBe(
      200,
    )
    const form = await participant.newPage({ baseURL })
    await form.goto(`/event/${eventId}/forms`)
    await expect(form.getByText('出演者向けフォーム')).toBeVisible()
    await form
      .getByRole('textbox', { name: 'バンド名 必須' })
      .fill('公開フォームのバンド')
    await form
      .getByRole('textbox', { name: 'メンバー1の名前' })
      .fill('公開フォームの出演者')
    await form.getByRole('button', { name: '出演登録を送信' }).click()
    await expect(
      form.getByRole('heading', { name: '出演登録を受け付けました' }),
    ).toBeVisible()
    await form.reload()
    await expect(form.getByText('出演者向けフォーム')).toBeVisible()
    await expect(
      form.getByRole('button', { name: 'ログイン', exact: true }),
    ).toHaveCount(0)
  } finally {
    if (eventId)
      await page.request.delete(`/api/events/${eventId}`, {
        headers: { Origin: origin },
      })
    await anonymous.dispose()
    await participant.close()
  }
})
