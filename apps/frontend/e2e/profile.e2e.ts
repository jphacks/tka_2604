import { expect, test } from './fixtures'

test('profile edits persist across reload and a second browser; cancellation and failure retain saved values', async ({
  page,
  request,
  browser,
  baseURL,
}) => {
  const original = (await (await request.get('/api/auth/profile')).json()) as {
    displayName: string
  }
  try {
    await page.goto('/event')
    const edit = page.getByRole('button', {
      name: 'プロフィールを編集',
      exact: true,
    })
    await edit.click()
    const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' })
    await dialog
      .getByRole('textbox', { name: '表示名', exact: true })
      .fill('alice')
    await expect(dialog.getByRole('textbox')).toHaveCount(1)
    await expect(dialog.getByRole('radio')).toHaveCount(0)
    await expect(
      dialog.locator('[aria-hidden="true"]').filter({ hasText: 'A' }),
    ).toBeVisible()
    await page.route('**/api/auth/profile', async (route) => {
      if (route.request().method() === 'PATCH')
        await route.fulfill({
          status: 500,
          json: { error: { message: 'failed' } },
        })
      else await route.continue()
    })
    await dialog
      .getByRole('button', { name: '変更を保存', exact: true })
      .click()
    await expect(dialog.getByRole('alert')).toContainText(
      '保存できませんでした',
    )
    await expect(
      dialog.getByRole('textbox', { name: '表示名', exact: true }),
    ).toHaveValue('alice')
    await expect(edit).toContainText(original.displayName)
    await page.unroute('**/api/auth/profile')
    await dialog
      .getByRole('button', { name: '変更を保存', exact: true })
      .click()
    await expect(dialog).not.toBeVisible()
    await expect(edit).toContainText('alice')
    await expect(edit.locator('[aria-hidden="true"]')).toHaveText('A')
    await page.reload()
    await expect(edit).toContainText('alice')
    const context = await browser.newContext({
      baseURL,
      storageState: await request.storageState(),
    })
    try {
      const other = await context.newPage()
      await other.goto('/event')
      await expect(
        other.getByRole('button', { name: 'プロフィールを編集' }),
      ).toContainText('alice')
    } finally {
      await context.close()
    }
    await page.setViewportSize({ width: 390, height: 844 })
    await edit.click()
    await expect(dialog).toBeVisible()
    await dialog
      .getByRole('textbox', { name: '表示名', exact: true })
      .fill('保存しない変更')
    await dialog
      .getByRole('button', { name: 'キャンセル', exact: true })
      .click()
    await edit.click()
    await expect(
      dialog.getByRole('textbox', { name: '表示名', exact: true }),
    ).toHaveValue('alice')
    await expect(
      dialog.getByRole('button', { name: '変更を保存', exact: true }),
    ).toBeInViewport({ ratio: 1 })
  } finally {
    expect(
      (await request.patch('/api/auth/profile', { data: original })).status(),
    ).toBe(200)
  }
})

test('failed profile loading can be retried without offering an empty profile to overwrite', async ({
  page,
}) => {
  let fail = true
  await page.route('**/api/auth/profile', async (route) => {
    if (fail && route.request().method() === 'GET')
      await route.fulfill({ status: 500, json: {} })
    else await route.continue()
  })
  await page.goto('/event')
  await page.getByRole('button', { name: 'プロフィールを編集' }).click()
  const dialog = page.getByRole('dialog', { name: 'プロフィールを編集' })
  await expect(dialog.getByRole('alert')).toContainText('取得できませんでした')
  await expect(dialog.getByRole('button', { name: '変更を保存' })).toHaveCount(
    0,
  )
  fail = false
  await dialog.getByRole('button', { name: '再試行' }).click()
  await expect(
    dialog.getByRole('textbox', { name: '表示名', exact: true }),
  ).not.toHaveValue('')
})
