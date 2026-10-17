import { expect, test } from './fixtures'

test('drag preview and committed order skip fixed rows across parts in both directions', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await page.getByRole('checkbox', { name: 'VPSを固定', exact: true }).check()
  const fixed = ['p1', 'p3', 'p5'].map((id) =>
    page.locator(`[data-performance="${id}"]`),
  )
  const fixedBoxes = await Promise.all(fixed.map((row) => row.boundingBox()))
  const slotTops = new Map([
    ['2', (await page.locator('[data-performance="p2"]').boundingBox())!.y],
    ['6', (await page.locator('[data-performance="p6"]').boundingBox())!.y],
  ])
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  for (const [targetName, expectedOrder] of [
    ['光について', '6'],
    ['青と夏', '2'],
  ]) {
    const destinationTop = slotTops.get(expectedOrder)!
    await expect
      .poll(async () =>
        Math.abs(
          (await page
            .locator(
              `[data-performance="${targetName === '光について' ? 'p6' : 'p4'}"]`,
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
          (await page.locator('[data-performance="p2"]').boundingBox())!.y -
            destinationTop,
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
})

test('keyboard movement skips fixed slots across parts', async ({ page }) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  await page.getByRole('checkbox', { name: 'VPSを固定', exact: true }).check()
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await handle.focus()
  await page.keyboard.press('Space', { delay: 50 })
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  // Wait for the initial collision measurement before sending movement keys.
  await expect(page.getByText('移動先：Pretender（2番）')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：青と夏（4番）')).toHaveCount(1)
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：光について（6番）')).toHaveCount(1)
  await page.keyboard.press('Space')
  for (const [name, order] of [
    ['Pretender', '6'],
    ['VPS', '3'],
    ['月のワルツ', '5'],
    ['青と夏', '2'],
    ['光について', '4'],
  ]) {
    await expect(
      page.getByRole('textbox', { name: `${name}の出演順`, exact: true }),
    ).toHaveValue(order)
  }
  await expect(handle).toBeFocused()
})

test('keyboard handle supports cancel and commit while keeping focus and fixed rows', async ({
  page,
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
  const handle = page.getByRole('button', {
    name: 'Pretenderを並べ替え',
    exact: true,
  })
  await handle.focus()
  await page.keyboard.press('Space')
  await expect(handle).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('ArrowDown')
  await expect(page.getByText('移動先：VPS（3番）')).toHaveCount(1)
  await page.keyboard.press('Escape')
  await expect(
    page.getByRole('textbox', { name: 'Pretenderの出演順', exact: true }),
  ).toHaveValue('2')
  await expect(handle).toBeFocused()
  await page.keyboard.press('Space')
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
}) => {
  await page.goto('/event/spring-live-2026')
  await page.getByRole('button', { name: 'デモアカウントで試す' }).click()
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
