import { expect, test } from './database-fixture'

for (const width of [320, 390, 1280]) {
  test(`schedule stays aligned at the right scroll edge at ${width}px`, async ({
    page,
    databaseEvent,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/event/${databaseEvent.eventId}`)
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const table = page.getByRole('region', { name: '出演順の表' })
    const row = table.locator('[data-performance]').first()
    await expect(row).toBeVisible()
    await table.evaluate((element) => {
      element.scrollLeft = element.scrollWidth
    })
    await page.screenshot({
      path: testInfo.outputPath(`schedule-right-${width}.png`),
    })
    const rowBox = (await row.boundingBox())!
    const tableRight = await table.evaluate(
      (element) =>
        element.getBoundingClientRect().left +
        element.clientLeft +
        element.clientWidth,
    )
    expect(Math.abs(rowBox.x + rowBox.width - tableRight)).toBeLessThanOrEqual(
      1,
    )
    for (const heading of [
      table.getByRole('heading', { name: /^第1部 ·/ }),
      table.getByRole('heading', { name: /^未配置 ·/ }),
    ]) {
      const headerBox = (await heading.locator('..').boundingBox())!
      expect(Math.abs(headerBox.x - rowBox.x)).toBeLessThanOrEqual(1)
      expect(Math.abs(headerBox.width - rowBox.width)).toBeLessThanOrEqual(1)
    }
    const columnBox = (await table
      .getByText('紹介', { exact: true })
      .locator('..')
      .boundingBox())!
    expect(columnBox.width).toBe(rowBox.width)
  })
}

for (const width of [320, 390, 768, 1279]) {
  test(`workspace tabs fit ${width}px and preserve edits`, async ({
    page,
    request,
    databaseEvent,
  }, testInfo) => {
    const url = `/api/events/${databaseEvent.eventId}`
    const { updatedAt } = (await (await request.get(url)).json()) as {
      updatedAt: string
    }
    expect(
      (
        await request.patch(url, {
          data: {
            expectedUpdatedAt: updatedAt,
            title:
              'とても長いイベント名と折り返せない文字列' +
              'Live2026'.repeat(10),
          },
        })
      ).status(),
    ).toBe(200)
    await page.setViewportSize({ width, height: 844 })
    await page.goto(`/event/${databaseEvent.eventId}`)
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const tabs = page.getByRole('tablist', { name: 'ワークスペースの表示' })
    const schedule = page.getByRole('region', { name: '出演順', exact: true })
    const constraints = page.getByRole('region', { name: '制約', exact: true })
    const chat = page.getByRole('region', { name: 'AIチャット', exact: true })
    await expect(tabs).toBeVisible()
    await expect(schedule).toBeVisible()
    await expect(constraints).not.toBeVisible()
    await expect(chat).not.toBeVisible()
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth),
    ).toBe(width)
    expect(
      await page.evaluate(() => document.documentElement.scrollHeight),
    ).toBe(844)
    const tabsBox = (await tabs.boundingBox())!
    expect(tabsBox.y + tabsBox.height).toBe(844)
    const actionTops = []
    for (const name of [
      '出演順を保存',
      '自動生成',
      'CSVを出力',
      'ライブ情報の編集',
    ]) {
      const button = schedule.getByRole('button', { name, exact: true })
      await expect(button).toHaveCSS('white-space', 'nowrap')
      actionTops.push((await button.boundingBox())!.y)
    }
    expect(new Set(actionTops).size).toBe(1)
    const table = schedule.getByRole('region', { name: '出演順の表' })
    await table.evaluate((element) => {
      element.scrollLeft = 200
    })
    if (width < 680)
      expect(
        await table.evaluate((element) => element.scrollLeft),
      ).toBeGreaterThan(0)
    await table.evaluate((element) => {
      element.scrollLeft = 0
    })

    const order = page.getByRole('textbox', {
      name: 'Pretenderの出演順',
      exact: true,
    })
    await order.fill('1')
    await order.press('Enter')
    const notice = page
      .getByRole('alert')
      .filter({ has: page.getByRole('button', { name: '通知を閉じる' }) })
    await expect(notice).toBeVisible()
    const noticeBox = (await notice.boundingBox())!
    expect(noticeBox.y + noticeBox.height).toBeLessThanOrEqual(tabsBox.y)
    await page.getByRole('button', { name: '通知を閉じる' }).click()
    await order.fill('3')
    await order.press('Enter')
    await expect(order).toHaveValue('3')

    await tabs.getByRole('tab', { name: 'AIチャット' }).click()
    await expect(schedule).not.toBeVisible()
    await expect(chat).toBeVisible()
    const draft = page.getByRole('textbox', { name: 'AIへのメッセージ' })
    await draft.fill('後半に出演したいです')
    await page.screenshot({ path: testInfo.outputPath(`chat-${width}.png`) })
    await tabs.getByRole('tab', { name: '制約', exact: true }).click()
    await expect(constraints).toBeVisible()
    await expect(
      tabs.getByRole('tab', { name: '制約', exact: true }),
    ).toHaveAttribute('aria-selected', 'true')
    await page.screenshot({
      path: testInfo.outputPath(`constraints-${width}.png`),
    })

    await tabs.getByRole('tab', { name: 'AIチャット' }).click()
    await expect(draft).toHaveValue('後半に出演したいです')
    await tabs.getByRole('tab', { name: '出演順', exact: true }).click()
    await expect(order).toHaveValue('3')
    await expect(
      page.getByRole('button', { name: '出演順を保存' }),
    ).toBeEnabled()
    await page.screenshot({
      path: testInfo.outputPath(`workspace-${width}.png`),
    })

    await tabs
      .getByRole('tab', { name: '出演順', exact: true })
      .press('ArrowRight')
    await expect(
      tabs.getByRole('tab', { name: '制約', exact: true }),
    ).toBeFocused()
    await expect(constraints).toBeVisible()
    await tabs.getByRole('tab', { name: '制約', exact: true }).press('Tab')
    await expect(
      page.getByRole('tabpanel', { name: '制約', exact: true }),
    ).toBeFocused()
    await page.setViewportSize({ width: 1280, height: 844 })
    await expect(tabs).not.toBeVisible()
    for (const panel of [schedule, constraints, chat])
      await expect(panel).toBeVisible()
    await expect(order).toHaveValue('3')
    await expect(draft).toHaveValue('後半に出演したいです')
  })
}

for (const width of [1280, 1600, 2234]) {
  test(`workspace header borders align at ${width}px`, async ({
    page,
    databaseEvent,
  }, testInfo) => {
    await page.setViewportSize({ width, height: 900 })
    await page.goto(`/event/${databaseEvent.eventId}`)
    await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
    const headerBottoms = []
    for (const name of ['出演順', '制約', 'AIチャット']) {
      const panel = page.getByRole('region', { name, exact: true })
      const heading = panel.getByRole('heading', { name, exact: true })
      await expect(heading).toBeVisible()
      const box = (await heading.locator('../..').boundingBox())!
      headerBottoms.push(box.y + box.height)
    }
    expect(
      Math.max(...headerBottoms) - Math.min(...headerBottoms),
    ).toBeLessThanOrEqual(1)
    await page.screenshot({
      path: testInfo.outputPath(`workspace-headers-${width}.png`),
    })
  })
}
