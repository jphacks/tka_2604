import { expect, test } from './database-fixture'

test('pointer drag previews, commits and persists a reorder while preserving fixed positions', async ({
  page,
  databaseEvent,
  request,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('textbox', { name: '部数', exact: true }),
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

test('keyboard movement refuses changes that would shift a hard fixed position', async ({
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
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await handle.focus()
  await expect(handle).toBeFocused()
  await page.keyboard.press('Space', { delay: 50 })
  await expect(page.getByText('移動先：Pretender（2番）')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：青と夏（4番）')).toHaveCount(1)
  await page.keyboard.press('Space')
  await expect(page.getByRole('alert')).toContainText(
    '固定枠の位置が変わります',
  )
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(
    page.getByRole('textbox', { name: 'VPSの出演順', exact: true }),
  ).toHaveValue('3')
  await expect(handle).toBeFocused()
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
    page.getByRole('textbox', { name: '部数', exact: true }),
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

test('invalid capacity has a short error and keeps the existing section size', async ({
  page,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const capacity = page.getByRole('textbox', {
    name: '第1部の組数',
    exact: true,
  })
  await capacity.fill('21')
  await capacity.press('Enter')
  await expect(page.getByRole('alert')).toHaveText('1〜20の整数')
  await expect(capacity).toHaveAccessibleDescription('1〜20の整数')
  await expect(
    page.getByRole('heading', { name: '第1部 · 4/4組', exact: true }),
  ).toBeVisible()
  await capacity.press('Escape')
  await expect(capacity).toHaveValue('4')
  await expect(page.getByRole('alert')).toHaveCount(0)
})
