import { memberOptionLabel } from '../src/features/forms/model/registration'
import { expect, test } from './fixtures'
import { mockRegistrationApi } from './registration-fixture'

test('public registration adds name rows, reuses existing IDs, distinguishes same-name people and survives reload', async ({
  page,
}) => {
  const { roster, writes } = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('出演名')
  await page.getByRole('textbox', { name: '出演名 必須' }).fill('新しい出演枠')
  await page.getByRole('button', { name: 'メンバー1を削除' }).click()
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('1〜20人')
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('combobox', { name: 'メンバー1の名前' }).fill('田中')
  await expect(page.getByRole('option', { name: /田中 花/ })).toHaveCount(2)
  await page.getByRole('option', { name: /田中 花（サンセット/ }).click()
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('combobox', { name: 'メンバー2の名前' }).fill('田中 花')
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(
    page.getByRole('heading', { name: '出演登録を受け付けました' }),
  ).toBeVisible()
  expect(writes[0]).toMatchObject({
    method: 'POST',
    body: { memberIds: ['m1'], newMembers: [{ memberName: '田中 花' }] },
  })
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page
    .getByRole('combobox', { name: '更新する出演枠' })
    .selectOption('new-0')
  await expect(page.getByRole('textbox', { name: '出演名 必須' })).toHaveValue(
    '新しい出演枠',
  )
  await expect(
    page.getByText(memberOptionLabel(roster, 'm1'), { exact: true }),
  ).toBeVisible()
  await expect(
    page.getByText(memberOptionLabel(roster, 'person-1-0'), { exact: true }),
  ).toBeVisible()
})

test('updates only the chosen band, removes everyone and re-adds the same ID', async ({
  page,
}) => {
  const { roster, writes } = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  const update = page.getByRole('radio', { name: /登録内容の更新/ })
  await page.getByRole('radio', { name: /初回登録/ }).focus()
  await page.keyboard.press('ArrowRight')
  await expect(update).toBeChecked()
  await expect(page.getByRole('button', { name: '変更を保存' })).toBeDisabled()
  const band = page.getByRole('combobox', { name: '更新する出演枠' })
  await band.selectOption('a')
  await page.getByRole('textbox', { name: '出演名 必須' }).fill('変更中')
  await band.selectOption('b')
  await expect(page.getByRole('textbox', { name: '出演名 必須' })).toHaveValue(
    'ブルーノート',
  )
  await band.selectOption('a')
  await page.getByRole('button', { name: 'メンバー2を削除' }).click()
  await page.getByRole('button', { name: 'メンバー1を削除' }).click()
  expect(writes).toHaveLength(0)
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  expect(writes[0]).toMatchObject({
    method: 'PATCH',
    bandId: 'a',
    body: { memberIds: [], newMembers: [] },
  })
  expect(roster.memberships).toEqual([{ bandId: 'b', memberId: 'm1' }])
  expect(roster.members).toHaveLength(3)
  await page.reload()
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await band.selectOption('a')
  await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
  await page.getByRole('combobox', { name: 'メンバー1の名前' }).click()
  await page.getByRole('option', { name: /田中 花（ブルーノート/ }).click()
  await page.getByRole('button', { name: '変更を保存' }).click()
  await expect(
    page.getByRole('heading', { name: '登録内容を更新しました' }),
  ).toBeVisible()
  expect(writes[1].body.memberIds).toEqual(['m1'])
})

test('conflicts and failures keep input and require refresh before retry', async ({
  page,
}) => {
  const api = await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page
    .getByRole('textbox', { name: '出演名 必須' })
    .fill('保持する出演枠')
  await page.getByRole('combobox', { name: 'メンバー1の名前' }).fill('佐藤')
  api.fail(409)
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('別の変更')
  await expect(
    page.getByRole('button', { name: '出演登録を送信' }),
  ).toBeDisabled()
  await expect(
    page.getByRole('combobox', { name: 'メンバー1の名前' }),
  ).toHaveValue('佐藤')
  api.fail(0)
  await page.getByRole('button', { name: '入力を残して名簿を再取得' }).click()
  await expect(
    page.getByRole('button', { name: '出演登録を送信' }),
  ).toBeEnabled()
  api.fail(500)
  await page.getByRole('button', { name: '出演登録を送信' }).click()
  await expect(page.getByRole('alert')).toContainText('保存に失敗')
  await expect(page.getByRole('textbox', { name: '出演名 必須' })).toHaveValue(
    '保持する出演枠',
  )
  expect(api.writes).toHaveLength(0)
})

test('registration remains usable at mobile width without horizontal overflow', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await mockRegistrationApi(page)
  await page.goto('/event/public-live/forms')
  await page.getByRole('radio', { name: /登録内容の更新/ }).check()
  await page.getByRole('combobox', { name: '更新する出演枠' }).selectOption('a')
  await expect(page.getByRole('button', { name: '変更を保存' })).toBeVisible()
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true)
})

for (const width of [390, 1280]) {
  test(`registration shares header geometry with other screens and stays fixed at both scroll edges at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto('/login')
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    await expect(page).toHaveURL(/\/event$/)
    await page.evaluate(() => document.fonts.ready)
    const expectedHeader = await page.getByRole('banner').boundingBox()
    const expectedBrand = await page
      .getByRole('link', { name: 'Setly ホーム' })
      .boundingBox()
    await mockRegistrationApi(page)
    await page.goto('/event/public-live/forms')
    const header = page.getByRole('banner')
    await expect(header).toBeVisible()
    expect(await header.boundingBox()).toEqual(expectedHeader)
    expect(
      await page.getByRole('link', { name: 'Setly ホーム' }).boundingBox(),
    ).toEqual(expectedBrand)
    await expect(
      page.getByText('出演者向けフォーム', { exact: true }),
    ).toBeVisible()
    for (let row = 0; row < 4; row++)
      await page.getByRole('button', { name: 'メンバーの行を追加' }).click()
    const submit = page.getByRole('button', { name: '出演登録を送信' })
    await submit.scrollIntoViewIfNeeded()
    const content = page.getByRole('main')
    expect(await content.evaluate((node) => node.scrollTop)).toBeGreaterThan(
      500,
    )
    expect(await page.evaluate(() => window.scrollY)).toBe(0)
    await expect(submit).toBeInViewport()
    await expect(header).toBeInViewport({ ratio: 1 })
    expect((await header.boundingBox())?.y).toBe(0)
    for (const delta of [3000, -3000]) {
      await content.evaluate((node, end) => {
        node.scrollTop = end ? node.scrollHeight : 0
      }, delta > 0)
      const scrollTop = await content.evaluate((node) => node.scrollTop)
      await content.hover()
      await page.mouse.wheel(0, delta)
      // Wait for the wheel event to be processed, including scroll chaining.
      await page.evaluate(
        () =>
          new Promise<void>((resolve) => {
            requestAnimationFrame(() => requestAnimationFrame(() => resolve()))
          }),
      )
      expect(await content.evaluate((node) => node.scrollTop)).toBe(scrollTop)
      expect(await page.evaluate(() => window.scrollY)).toBe(0)
      expect((await header.boundingBox())?.y).toBe(0)
    }
    await submit.scrollIntoViewIfNeeded()
    await page.screenshot({
      path: `test-results/registration-fixed-${width}.png`,
    })
  })
}
