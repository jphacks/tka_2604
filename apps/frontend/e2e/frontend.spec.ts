import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { mockRegistrationApi } from './registration-fixture'

async function login(page: Page) {
  await page.goto('/login')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('heading', { name: 'マイイベント' }),
  ).toBeVisible()
}
async function createEvent(page: Page, name: string) {
  await page
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '新しいイベントを作成' })
  await dialog.getByRole('textbox', { name: 'イベント名' }).fill(name)
  await dialog
    .getByRole('button', { name: 'イベントを作成', exact: true })
    .click()
  await expect(page.getByRole('heading', { name, exact: true })).toBeVisible()
}
async function fillPerformance(page: Page, name: string) {
  await page.getByRole('textbox', { name: '出演名 必須' }).fill(name)
  await page
    .getByRole('textbox', { name: '新しいメンバー（任意）' })
    .fill('佐藤、田中、鈴木')
}

test('mock login, event creation, manual registration, editing and schedule are connected', async ({
  page,
}) => {
  await page.goto('/')
  await expect(page).toHaveURL(/\/login$/)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('heading', { name: 'マイイベント' }),
  ).toBeVisible()
  await createEvent(page, 'UI検証ライブ')
  await page
    .getByRole('link', { name: '出演枠・メンバー', exact: true })
    .click()
  await page.getByRole('button', { name: '出演枠を追加', exact: true }).click()
  await fillPerformance(page, '手動登録した出演枠')
  await page.getByRole('button', { name: '追加する', exact: true }).click()
  await expect(
    page.getByText('手動登録した出演枠', { exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: '手動登録した出演枠を編集', exact: true })
    .click()
  await page
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('編集済みの出演枠')
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByText('編集済みの出演枠', { exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: '出演順', exact: true }).click()
  const order = page.getByRole('textbox', {
    name: '編集済みの出演枠の出演順',
    exact: true,
  })
  await order.fill('1')
  await order.press('Enter')
  await expect(order).toHaveValue('1')
  const createdId = new URL(page.url()).pathname.split('/')[2]
  await mockRegistrationApi(page, createdId)
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: 'フォーム管理', exact: true })
    .click()
  await expect(
    page.getByRole('heading', { name: '出演者フォーム', exact: true }),
  ).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: '回答フォームのリンク', exact: true }),
  ).toBeVisible()
  await page.getByRole('link', { name: '出演順', exact: true }).click()
  await expect(
    page.getByRole('textbox', {
      name: '編集済みの出演枠の出演順',
      exact: true,
    }),
  ).toHaveValue('1')
})

test('form management opens the persisted public form URL without demo settings', async ({
  page,
}) => {
  await mockRegistrationApi(page, 'spring-live-2026')
  await login(page)
  await page.getByRole('link', { name: '春ライブ 2026', exact: true }).click()
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: 'フォーム管理', exact: true })
    .click()
  await expect(
    page.getByRole('textbox', { name: '回答フォームのリンク' }),
  ).toHaveValue(/\/forms$/)
  await expect(page.getByRole('textbox', { name: 'フォーム名' })).toHaveCount(0)
  await page.getByRole('link', { name: '回答フォームを開く' }).click()
  await expect(page.getByRole('radio', { name: /初回登録/ })).toBeChecked()
  await expect(page.locator('body')).not.toContainText('デモ')
})

test('schedule edits persist during navigation and pointer dragging works', async ({
  page,
}) => {
  await login(page)
  await page.getByRole('link', { name: '春ライブ 2026', exact: true }).click()
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  const target = page.getByRole('button', {
    name: 'VPSを並べ替え',
    exact: true,
  })
  const from = await handle.boundingBox()
  const to = await target.boundingBox()
  if (!from || !to) throw new Error('Drag rows were not visible')
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
  await page.mouse.down()
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2, {
    steps: 12,
  })
  await page.mouse.up()
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(
    page.getByRole('textbox', { name: '気分上々↑↑の出演順', exact: true }),
  ).toHaveValue('1')
  const addButton = page.getByRole('button', { name: '手動追加' })
  const addPosition = await addButton.boundingBox()
  if (!addPosition) throw new Error('Add constraint button was not visible')
  // Move to the next action rather than clicking during dnd-kit's post-drop
  // click suppression. Keep this a separate pointer gesture, without a sleep.
  await page.mouse.move(
    addPosition.x + addPosition.width / 2,
    addPosition.y + addPosition.height / 2,
    { steps: 12 },
  )
  await addButton.click()
  const dialog = page.getByRole('dialog', { name: '制約を手動追加' })
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: /出演の前後関係を決める/ }).click()
  await dialog
    .getByRole('combobox', { name: '先に出演する組' })
    .selectOption('p2')
  await dialog
    .getByRole('combobox', { name: '後に出演する組' })
    .selectOption('p3')
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await expect(
    page.getByRole('button', { name: '自動生成（準備中）' }),
  ).toBeDisabled()
  await page
    .getByRole('link', { name: '出演枠・メンバー', exact: true })
    .click()
  await page.getByRole('link', { name: '出演順', exact: true }).click()
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(
    page.getByRole('heading', { name: 'PretenderをVPSより前にする' }),
  ).toBeVisible()
})

test('metadata changes, event deletion, and logout work', async ({ page }) => {
  await login(page)
  await createEvent(page, '削除するテストイベント')
  await page.getByRole('link', { name: '設定', exact: true }).click()
  await page
    .getByRole('textbox', { name: 'イベント名', exact: true })
    .fill('更新されたテストイベント')
  await page
    .getByRole('combobox', { name: 'ステータス', exact: true })
    .selectOption('confirmed')
  await page.getByRole('button', { name: '変更を保存', exact: true }).click()
  await expect(page.getByRole('status')).toContainText('設定を更新しました')
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await page.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page.getByRole('button', { name: '削除', exact: true }).click()
  await page.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: 'マイイベント' }),
  ).toBeVisible()
  await expect(
    page.getByRole('link', { name: '更新されたテストイベント', exact: true }),
  ).toHaveCount(0)
  await page.getByRole('button', { name: 'ログアウト' }).click()
  await expect(page).toHaveURL(/\/login$/)
})

test('unknown URLs and event ids display recovery links', async ({ page }) => {
  await page.goto('/missing-page')
  await expect(
    page.getByRole('heading', { name: 'ページが見つかりません' }),
  ).toBeVisible()
  await page.route('**/api/events/missing-event/form', (route) =>
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
  await page.goto('/event/missing-event/forms')
  await expect(page.getByRole('alert')).toContainText(
    'イベントが見つかりません',
  )
})
