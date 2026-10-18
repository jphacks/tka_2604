import { expect, test } from './fixtures'

test('answer-form links open the same demo roster and registration/update appear in participants', async ({
  page,
}) => {
  const apiRequests: string[] = []
  page.on('request', (request) => {
    if (request.url().includes('/api/events/')) apiRequests.push(request.url())
  })
  await page.goto('/event/spring-live-2026/performances')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await page.getByRole('link', { name: '回答フォーム', exact: true }).click()
  await expect(page).toHaveURL(/\/forms\/demo$/)
  await expect(page.getByText('デモ用フォーム', { exact: true })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: '春ライブ 2026 出演登録' }),
  ).toBeVisible()
  await page
    .getByRole('textbox', { name: 'バンド名 必須' })
    .fill('フォームの動作確認')
  await page
    .getByRole('textbox', { name: 'メンバー1の名前' })
    .fill('同名メンバー')
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page
    .getByRole('textbox', { name: 'メンバー2の名前' })
    .fill('同名メンバー')
  await page.screenshot({
    path: test.info().outputPath('demo-form.png'),
    fullPage: true,
  })
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  await page.getByRole('button', { name: '登録内容を更新する' }).click()
  await expect(
    page.getByRole('textbox', { name: 'バンド名 必須' }),
  ).toHaveValue('フォームの動作確認')
  await page
    .getByRole('textbox', { name: 'バンド名 必須' })
    .fill('更新したデモバンド')
  await page.getByRole('button', { name: 'メンバー2を削除' }).click()
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'フォーム管理へ' }).click()
  await expect(
    page.getByRole('textbox', { name: '回答フォームのリンク' }),
  ).toHaveValue(/\/forms\/demo$/)
  await page.getByRole('link', { name: '回答フォームを開く' }).click()
  await expect(page).toHaveURL(/\/forms\/demo$/)
  await expect(
    page.getByRole('heading', { name: '春ライブ 2026 出演登録' }),
  ).toBeVisible()
  await page.getByRole('link', { name: 'フォーム管理へ' }).click()
  await page.getByRole('link', { name: '回答・出演枠を確認' }).click()
  await expect(
    page.getByText('更新したデモバンド', { exact: true }),
  ).toBeVisible()
  expect(apiRequests).toEqual([])
})

test('newly created demo events can also open their answer form', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await page
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '新しいイベントを作成' })
  await dialog
    .getByRole('textbox', { name: 'イベント名' })
    .fill('新規デモライブ')
  await dialog
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: '新規デモライブ', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: 'フォーム管理', exact: true })
    .click()
  await page.getByRole('link', { name: '回答フォームを開く' }).click()
  await expect(
    page.getByRole('heading', { name: '新規デモライブ 出演登録' }),
  ).toBeVisible()
  await expect(page.getByRole('radio', { name: /初回登録/ })).toBeChecked()
})

test('the real API form still shows 404 even when a same-ID demo event exists', async ({
  page,
}) => {
  await page.route('**/api/events/spring-live-2026/form', (route) =>
    route.fulfill({
      status: 404,
      json: {
        error: {
          code: 'event_not_found',
          message: 'イベントが見つかりません。',
          details: [],
        },
      },
    }),
  )
  await page.goto('/event/spring-live-2026/forms')
  await expect(page.getByRole('alert')).toContainText(
    'イベントが見つかりません',
  )
  await expect(page.getByText('デモ用フォーム', { exact: true })).toHaveCount(0)
})
