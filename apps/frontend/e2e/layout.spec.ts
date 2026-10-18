import { expect, test } from './fixtures'

for (const width of [1280, 1600]) {
  test(`event workspace uses the viewport at ${width}px`, async ({ page }) => {
    await page.route('**/api/events/*/chat', (route) =>
      route.fulfill({ json: { reply: 'レイアウト確認用の返信です。' } }),
    )
    await page.setViewportSize({ width, height: 900 })
    await page.goto('/event/spring-live-2026')
    await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
    const schedule = page.getByRole('region', { name: '出演順', exact: true })
    const constraints = page.getByRole('region', { name: '制約', exact: true })
    const chat = page.getByRole('region', { name: 'AIチャット', exact: true })
    await expect(chat).toBeVisible()
    await expect(page.getByText(/デモ · モックデータ/)).toHaveCount(0)
    await expect(constraints).toHaveCSS('border-right-width', '1px')
    const boxes = await Promise.all([
      schedule.boundingBox(),
      constraints.boundingBox(),
      chat.boundingBox(),
    ])
    const [left, middle, right] = boxes
    if (!left || !middle || !right)
      throw new Error('Workspace panels are missing')
    expect(left.x).toBe(0)
    expect(left.x + left.width).toBeCloseTo(middle.x, 0)
    expect(middle.x + middle.width).toBeCloseTo(right.x, 0)
    expect(right.x + right.width).toBe(width)
    for (const box of [left, middle, right]) {
      expect(box.y).toBe(left.y)
      expect(box.y + box.height).toBe(900)
    }
    await expect(
      page.getByRole('heading', { name: '春ライブ 2026', level: 1 }),
    ).toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(900)
    const input = chat.getByRole('textbox', { name: 'AIへのメッセージ' })
    for (let i = 0; i < 4; i++) {
      await input.fill(`調整の相談 ${i}`)
      await chat.getByRole('button', { name: 'メッセージを送信' }).click()
      await expect(chat.getByRole('log').locator('> div')).toHaveCount(
        3 + i * 2,
      )
    }
    await expect(input).toBeInViewport()
    await expect(
      chat.getByRole('button', { name: 'メッセージを送信' }),
    ).toBeInViewport()
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(900)
    await page.screenshot({
      path: test.info().outputPath(`workspace-${width}.png`),
    })
  })
}
