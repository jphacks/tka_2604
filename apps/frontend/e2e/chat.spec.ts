import { expect, test } from './fixtures'

test.beforeEach(async ({ page }) => {
  // Persistence is covered by backend tests against D1. UI tests must not call
  // the real Gemini API or require a matching persisted demo event.
  await page.route('**/api/events/*/chat', (route) =>
    route.fulfill({ json: { reply: 'AIからの返信です。' } }),
  )
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
})

test('sends the API payload, blocks repeated sends and displays its reply', async ({
  page,
}) => {
  let release!: () => void
  const waiting = new Promise<void>((resolve) => {
    release = resolve
  })
  let requests = 0
  await page.route('**/api/events/*/chat', async (route) => {
    requests++
    expect(route.request().postDataJSON()).toEqual({
      message: '出演間隔を空けたい',
      messageId: expect.any(String),
    })
    await waiting
    await route.fulfill({ json: { reply: 'AIからの返信です。' } })
  })
  const chat = page.getByRole('region', { name: 'AIチャット', exact: true })
  const input = chat.getByRole('textbox', { name: 'AIへのメッセージ' })
  const send = chat.getByRole('button', { name: 'メッセージを送信' })
  await input.fill('出演間隔を空けたい')
  await input.press('Control+Enter')
  await expect(chat.getByLabel('返信を準備中')).toBeVisible()
  await expect(send).toBeDisabled()
  await input.press('Control+Enter')
  release()
  await expect(chat.getByText('AIからの返信です。')).toBeVisible()
  await expect(chat.getByRole('log').locator('> div')).toHaveCount(3)
  expect(requests).toBe(1)
  await expect(input).toHaveValue('')
})

test('restores the draft after an API failure and allows a retry', async ({
  page,
}) => {
  await page.route(
    '**/api/events/*/chat',
    (route) =>
      route.fulfill({
        status: 500,
        json: { error: 'チャットの応答に失敗しました。' },
      }),
    { times: 1 },
  )
  const chat = page.getByRole('region', { name: 'AIチャット', exact: true })
  const input = chat.getByRole('textbox', { name: 'AIへのメッセージ' })
  const send = chat.getByRole('button', { name: 'メッセージを送信' })
  await input.fill('もう一度送る')
  await send.click()
  await expect(page.getByRole('alert')).toHaveText(/送信に失敗しました/)
  await expect(input).toHaveValue('もう一度送る')
  await expect(chat.getByRole('log').locator('> div')).toHaveCount(2)
  await expect(send).toBeEnabled()
  await page.getByRole('button', { name: '通知を閉じる' }).click()
  await send.click()
  await expect(chat.getByText('AIからの返信です。')).toBeVisible()
})
