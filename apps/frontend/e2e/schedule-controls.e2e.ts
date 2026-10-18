import { expect, test } from './database-fixture'

test('exports CSV only after confirmation', async ({ page, databaseEvent }) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const exportButton = page.getByRole('button', {
    name: 'CSVを出力',
    exact: true,
  })
  const downloads: string[] = []
  page.on('download', (download) =>
    downloads.push(download.suggestedFilename()),
  )
  page.once('dialog', async (dialog) => {
    expect(dialog.type()).toBe('confirm')
    expect(dialog.message()).toBe('出演順をCSVでエクスポートしますか？')
    await dialog.dismiss()
  })
  await exportButton.click()
  await expect(
    page.getByText('出演順をCSVでエクスポートしました。'),
  ).toHaveCount(0)
  expect(downloads).toEqual([])

  page.once('dialog', (dialog) => dialog.accept())
  const downloadPromise = page.waitForEvent('download')
  await exportButton.click()
  const download = await downloadPromise
  expect(download.suggestedFilename()).toMatch(/-出演順\.csv$/)
  await expect(
    page.getByText('出演順をCSVでエクスポートしました。'),
  ).toBeVisible()
  expect(downloads).toHaveLength(1)
})

test('pointer drag previews, commits and persists a reorder while preserving fixed positions', async ({
  page,
  databaseEvent,
  request,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('button', { name: 'ライブ情報の編集', exact: true }),
  ).toBeEnabled()
  const fixed = ['p1', 'p5'].map((id) =>
    page.locator(`[data-performance="${databaseEvent.bandIds[id]}"]`),
  )
  const fixedBoxes = await Promise.all(fixed.map((row) => row.boundingBox()))
  const slotTops = new Map([
    [
      '2',
      (await page
        .locator(`[data-performance="${databaseEvent.bandIds.p2}"]`)
        .boundingBox())!.y,
    ],
    [
      '4',
      (await page
        .locator(`[data-performance="${databaseEvent.bandIds.p4}"]`)
        .boundingBox())!.y,
    ],
  ])
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  for (const [targetName, expectedOrder] of [
    ['青と夏', '4'],
    ['VPS', '2'],
  ]) {
    const destinationTop = slotTops.get(expectedOrder)!
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .locator(
              `[data-performance="${databaseEvent.bandIds[targetName === '青と夏' ? 'p4' : 'p3']}"]`,
            )
            .boundingBox())!.y - destinationTop,
        ),
      )
      .toBeLessThan(0.5)
    const from = await handle.boundingBox()
    const target = await page
      .getByRole('button', { name: `${targetName}を並べ替え`, exact: true })
      .boundingBox()
    if (!from || !target) throw new Error('Drag handles are missing')
    await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2)
    await page.mouse.down()
    await page.mouse.move(
      target.x + target.width / 2,
      target.y + target.height / 2,
      { steps: 15 },
    )
    await expect(handle).toHaveAttribute('aria-pressed', 'true')
    for (let i = 0; i < fixed.length; i++) {
      await expect
        .poll(async () =>
          Math.abs((await fixed[i].boundingBox())!.y - fixedBoxes[i]!.y),
        )
        .toBeLessThan(0.5)
    }
    // The drag source's projected row must reach the drop slot before release.
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .locator(`[data-performance="${databaseEvent.bandIds.p2}"]`)
            .boundingBox())!.y - destinationTop,
        ),
      )
      .toBeLessThan(0.5)
    await page.mouse.up()
    await expect(
      page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
    ).toHaveValue(expectedOrder)
    for (let i = 0; i < fixed.length; i++) {
      await expect
        .poll(async () =>
          Math.abs((await fixed[i].boundingBox())!.y - fixedBoxes[i]!.y),
        )
        .toBeLessThan(0.5)
    }
    const saved = page.waitForResponse(
      (response) =>
        response.request().method() === 'POST' &&
        new URL(response.url()).pathname ===
          `/api/events/${databaseEvent.eventId}/schedule`,
    )
    await page
      .getByRole('button', { name: '出演順を保存', exact: true })
      .click({ delay: 75 })
    expect((await saved).status()).toBe(200)
    await expect(
      page.getByRole('button', { name: '出演順を保存', exact: true }),
    ).toBeDisabled()
    const snapshot = (await (
      await request.get(`/api/events/${databaseEvent.eventId}/schedule`)
    ).json()) as { placements: { bandId: string; order: number }[] }
    expect(
      snapshot.placements.find((row) => row.bandId === databaseEvent.bandIds.p2)
        ?.order,
    ).toBe(Number(expectedOrder) - 1)
  }
  for (const [name, order] of [
    ['気分上々↑↑', '1'],
    ['VPS', '3'],
    ['月のワルツ', '5'],
    ['青と夏', '4'],
    ['光について', '6'],
  ]) {
    await expect(
      page.getByRole('textbox', { name: `${name}の出演順`, exact: true }),
    ).toHaveValue(order)
  }
  const saved = await request.get(
    `/api/events/${databaseEvent.eventId}/schedule`,
  )
  const { placements } = (await saved.json()) as {
    placements: { bandId: string; order: number }[]
  }
  expect(
    placements.find((row) => row.bandId === databaseEvent.bandIds.p2)?.order,
  ).toBe(1)
  await page.reload()
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
})

test('keyboard order clearing refuses changes that would shift a hard fixed position', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}/schedule`
  const before = (await (await request.get(url)).json()) as {
    placements: unknown[]
  }
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const fixedSaved = page.waitForResponse(
    (response) =>
      response
        .url()
        .endsWith(`/api/events/${databaseEvent.eventId}/constraints`) &&
      response.request().method() === 'POST',
  )
  await page.getByRole('checkbox', { name: 'VPSを固定', exact: true }).check()
  expect((await fixedSaved).status()).toBe(200)
  await expect(
    page.getByRole('region', { name: '出演順', exact: true }),
  ).toHaveJSProperty('inert', false)
  const order = page.getByRole('textbox', {
    name: 'Pretenderの出演順',
    exact: true,
  })
  await order.fill('')
  await order.press('Enter')
  await expect(page.getByRole('alert')).toContainText(
    '固定枠の位置が変わります',
  )
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(
    page.getByRole('textbox', { name: 'VPSの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(order).toBeFocused()
  const after = (await (await request.get(url)).json()) as {
    placements: unknown[]
  }
  expect(after.placements).toEqual(before.placements)
})

test('keyboard handle supports cancel and commit while keeping focus and fixed rows', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await expect(handle).toBeEnabled()
  await expect(
    page.getByRole('button', { name: 'ライブ情報の編集', exact: true }),
  ).toBeEnabled()
  await handle.focus()
  await page.keyboard.press('Space', { delay: 50 })
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：VPS（3番）')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(handle).toBeFocused()
  await page.keyboard.press('Space', { delay: 50 })
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：VPS（3番）')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(handle).toBeFocused()
  await expect(
    page.getByRole('textbox', { name: '気分上々↑↑の出演順', exact: true }),
  ).toHaveValue('1')
  await expect(
    page.getByRole('button', { name: '気分上々↑↑を並べ替え', exact: true }),
  ).toBeDisabled()
})

test('live info edits are validated, cancelled or applied as one change', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page.getByRole('button', { name: 'ライブ情報の編集' }).click()
  const dialog = page.getByRole('dialog', { name: 'ライブ情報の編集' })
  const capacity = dialog.getByRole('spinbutton', {
    name: '第1部の組数',
    exact: true,
  })
  await capacity.fill('21')
  await dialog.getByRole('button', { name: '適用', exact: true }).click()
  await expect(dialog).toBeVisible()
  expect(
    await capacity.evaluate((input: HTMLInputElement) => input.validity.valid),
  ).toBe(false)
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await expect(
    page.getByRole('heading', { name: '第1部 · 4/4組', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'ライブ情報の編集' }).click()
  await expect(capacity).toHaveValue('4')
  await capacity.fill('3')
  await dialog.getByRole('button', { name: '適用', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('固定')
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  await page
    .getByRole('checkbox', { name: '月のワルツを固定', exact: true })
    .uncheck()
  await expect(
    page.getByRole('region', { name: '出演順', exact: true }),
  ).toHaveJSProperty('inert', false)
  await page.getByRole('button', { name: 'ライブ情報の編集' }).click()
  await capacity.fill('3')
  // Keep the final soft position in range while reducing the first part.
  await dialog
    .getByRole('spinbutton', { name: '第3部の組数', exact: true })
    .fill('5')
  await dialog.getByRole('button', { name: '適用', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: '第1部 · 3/3組', exact: true }),
  ).toBeVisible()
  await expect(
    page
      .getByRole('region', { name: '未配置', exact: true })
      .getByText('青と夏', { exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: '出演順を保存', exact: true }).click()
  await expect(
    page.getByRole('button', { name: '出演順を保存', exact: true }),
  ).toBeDisabled()
  await page.reload()
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('heading', { name: '第1部 · 3/3組', exact: true }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'ライブ情報の編集' }).click()
  await expect(capacity).toHaveValue('3')
  await expect(
    dialog.getByRole('spinbutton', { name: '第3部の組数', exact: true }),
  ).toHaveValue('5')
})
