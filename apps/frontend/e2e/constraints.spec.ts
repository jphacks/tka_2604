import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'

async function openEvent(page: Page) {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await expect(
    page.getByRole('heading', { name: '春ライブ 2026', exact: true, level: 1 }),
  ).toBeVisible()
}
async function choose(page: Page, name: RegExp) {
  await page.getByRole('button', { name: '手動追加' }).click()
  const dialog = page.getByRole('dialog', { name: '制約を手動追加' })
  await dialog.getByRole('button', { name }).click()
  return dialog
}

test('all six condition choices produce editable conditions with live evaluation', async ({
  page,
}, testInfo) => {
  await openEvent(page)
  let dialog = await choose(page, /メンバーの出演間隔を空ける/)
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await expect(dialog.getByRole('alert')).toContainText('メンバーを選んで')
  await dialog
    .getByRole('combobox', { name: '対象のメンバー' })
    .selectOption('m2')
  await dialog
    .getByRole('spinbutton', { name: '間に空ける出演枠（組以上）' })
    .fill('4')
  await dialog
    .getByRole('checkbox', { name: '同じ部の出演だけに適用する' })
    .check()
  await dialog.getByRole('button', { name: '任意', exact: true }).click()
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await expect(
    page.getByRole('heading', {
      name: '田中の出演の間に4組以上空ける（同じ部のみ）',
      exact: true,
    }),
  ).toBeVisible()

  dialog = await choose(page, /指定した出演枠の間隔を空ける/)
  await dialog.getByRole('checkbox', { name: 'Pretender', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'VPS', exact: true }).check()
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'Pretender・VPSの全組合せで間に1組以上空ける（部をまたいで適用）',
      exact: true,
    }),
  ).toBeVisible()

  dialog = await choose(page, /出演の前後関係を決める/)
  await dialog
    .getByRole('combobox', { name: '先に出演する組' })
    .selectOption('p3')
  await dialog
    .getByRole('combobox', { name: '後に出演する組' })
    .selectOption('p2')
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await expect(
    page.getByRole('heading', {
      name: 'VPSをPretenderより前にする',
      exact: true,
    }),
  ).toBeVisible()

  dialog = await choose(page, /出演位置を指定する/)
  await dialog
    .getByRole('combobox', { name: '位置を指定する出演枠' })
    .selectOption('p13')
  await dialog.getByRole('spinbutton', { name: '出演位置（番）' }).fill('6')
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  const unassignedCondition = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: '源泉掛け流しを6番にする',
      exact: true,
    }),
  })
  await expect(unassignedCondition).toContainText('未配置')

  dialog = await choose(page, /出演できる範囲・部を指定する/)
  await dialog.getByRole('checkbox', { name: '青と夏', exact: true }).check()
  await dialog.getByRole('spinbutton', { name: '開始（番）' }).fill('1')
  await dialog.getByRole('spinbutton', { name: '終了（番）' }).fill('4')
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await page
    .getByRole('button', {
      name: '青と夏を1〜4番に配置するを編集',
      exact: true,
    })
    .click()
  dialog = page.getByRole('dialog', { name: '制約を編集' })
  await dialog
    .getByRole('combobox', { name: '範囲の指定方法' })
    .selectOption('parts')
  await dialog.getByRole('checkbox', { name: '第2部', exact: true }).check()
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('article').filter({
      has: page.getByRole('heading', {
        name: '青と夏を第2部に配置する',
        exact: true,
      }),
    }),
  ).toContainText('必須条件に違反')

  dialog = await choose(page, /部ごとの出演数を決める/)
  await dialog.getByRole('checkbox', { name: 'Pretender', exact: true }).check()
  await dialog.getByRole('checkbox', { name: 'VPS', exact: true }).check()
  await dialog.getByRole('spinbutton', { name: '上限（組）' }).fill('2')
  await dialog.getByRole('button', { name: 'この条件を追加' }).click()
  await page
    .getByRole('button', {
      name: 'Pretender・VPSを各部に0〜2組配置するを編集',
      exact: true,
    })
    .click()
  dialog = page.getByRole('dialog', { name: '制約を編集' })
  await dialog
    .getByRole('combobox', { name: '出演数を数える範囲' })
    .selectOption('in_parts')
  await dialog.getByRole('checkbox', { name: '第1部', exact: true }).check()
  await dialog.getByRole('spinbutton', { name: '下限（組）' }).fill('2')
  await dialog.getByRole('button', { name: '変更を保存' }).click()
  const countCondition = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'Pretender・VPSを第1部の合計で2〜2組配置する',
      exact: true,
    }),
  })
  await expect(countCondition).toContainText('達成')
  await page.screenshot({
    path: testInfo.outputPath('conditions.png'),
    fullPage: true,
  })

  await countCondition.getByRole('button', { name: /を削除$/ }).click()
  await page
    .getByRole('dialog', { name: '制約を削除' })
    .getByRole('button', { name: '削除する' })
    .click()
  await expect(countCondition).toHaveCount(0)
  await page.getByRole('button', { name: /未達成のみ/ }).click()
  await expect(unassignedCondition).toHaveCount(0)
})

test('keyboard dragging reaches an empty slot and keeps fixed positions', async ({
  page,
}) => {
  await openEvent(page)
  const vps = page.getByRole('textbox', { name: 'VPSの出演順', exact: true })
  await vps.fill('')
  await vps.press('Enter')
  await expect(vps).toHaveValue('')
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText(/移動先：空き枠（3番）/)).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(
    page.getByRole('textbox', { name: '気分上々↑↑の出演順', exact: true }),
  ).toHaveValue('1')
})

test('position checkbox, constraint controls, and deletion guard agree', async ({
  page,
}) => {
  await openEvent(page)
  await page
    .getByRole('checkbox', { name: 'Pretenderを固定', exact: true })
    .check()
  const condition = page.getByRole('article').filter({
    has: page.getByRole('heading', {
      name: 'Pretenderを2番にする',
      exact: true,
    }),
  })
  await expect(condition).toBeVisible()
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toBeDisabled()
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: '出演枠・メンバー' })
    .click()
  await page
    .getByRole('button', { name: 'Pretenderを削除', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '出演枠を削除' })
  await dialog.getByRole('button', { name: '削除する' }).click()
  await expect(dialog.getByRole('alert')).toContainText('参照する制約')
  await dialog.getByRole('button', { name: 'キャンセル' }).click()
  await page
    .getByRole('navigation', { name: 'イベント内の移動' })
    .getByRole('link', { name: '出演順', exact: true })
    .click()
  await condition.getByRole('button', { name: '任意', exact: true }).click()
  await expect(
    condition.getByRole('combobox', { name: /の優先度$/ }),
  ).toBeVisible()
  await expect(
    page.getByRole('checkbox', { name: 'Pretenderを固定', exact: true }),
  ).not.toBeChecked()
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toBeEnabled()
  await condition.getByRole('button', { name: '必須', exact: true }).click()
  await expect(
    condition.getByRole('combobox', { name: /の優先度$/ }),
  ).toHaveCount(0)
  await expect(
    page.getByRole('checkbox', { name: 'Pretenderを固定', exact: true }),
  ).toBeChecked()
})

test('chat displays an API reply, generation is disabled and CSV downloads the current order', async ({
  page,
}) => {
  await page.route('**/api/events/*/chat', (route) =>
    route.fulfill({ json: { reply: 'テスト用の返信です。' } }),
  )
  await openEvent(page)
  await expect(
    page.getByRole('button', { name: '自動生成（準備中）' }),
  ).toBeDisabled()
  const chat = page.getByRole('region', { name: 'AIチャット' })
  await chat
    .getByRole('textbox', { name: 'AIへのメッセージ' })
    .fill('出演間隔を空けたい')
  await chat.getByRole('button', { name: 'メッセージを送信' }).click()
  await expect(chat.getByText('テスト用の返信です。')).toBeVisible()
  await expect(chat.getByRole('log').locator('> div')).toHaveCount(3)
  const download = page.waitForEvent('download')
  await page.getByRole('button', { name: 'CSVを出力' }).click()
  expect((await download).suggestedFilename()).toBe('春ライブ 2026-出演順.csv')
})

test('mobile layout and modal remain usable without page overflow', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openEvent(page)
  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390)
  const dialog = await choose(page, /出演位置を指定する/)
  await dialog
    .getByRole('combobox', { name: '位置を指定する出演枠' })
    .selectOption('p2')
  await dialog.getByRole('spinbutton', { name: '出演位置（番）' }).fill('3')
  await dialog.screenshot({
    path: testInfo.outputPath('manual-condition-mobile.png'),
  })
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('button', { name: '手動追加' })).toBeFocused()
  await page.screenshot({
    path: testInfo.outputPath('event-mobile.png'),
    fullPage: true,
  })
})
