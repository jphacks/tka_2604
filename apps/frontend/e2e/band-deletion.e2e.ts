import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import type { FormRoster } from '../src/features/forms/repositories/types'
import type { SolveResponse } from '../src/shared/api/events'
import { expect, test } from './database-fixture'

test('confirms or cancels band deletion, retains the roster and persists assigned/unassigned deletions', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}`
  const before = (await (await request.get(`${url}/form`)).json()) as FormRoster
  const constraints = (await (
    await request.get(`${url}/constraints`)
  ).json()) as { constraints: unknown[] }
  type Schedule = NonNullable<SolveResponse['schedule']>
  const originalSchedule = (await (
    await request.get(`${url}/schedule`)
  ).json()) as Schedule
  let deletes = 0
  page.on('request', (r) => {
    if (
      r.method() === 'DELETE' &&
      new URL(r.url()).pathname.startsWith(`${url}/bands/`)
    )
      deletes++
  })
  await page.goto(`/event/${databaseEvent.eventId}/performances`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const button = page.getByRole('button', {
    name: 'Pretenderを削除',
    exact: true,
  })
  await button.click()
  const dialog = page.getByRole('dialog', { name: '出演枠を削除', exact: true })
  await expect(dialog).toContainText('「Pretender」を削除しますか？')
  await expect(dialog).toContainText('この出演枠の希望から作られた制約も削除')
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(button).toBeFocused()
  await button.click()
  await dialog.getByRole('button', { name: 'キャンセル', exact: true }).click()
  expect(deletes).toBe(0)
  expect(
    ((await (await request.get(`${url}/form`)).json()) as FormRoster).bands,
  ).toEqual(before.bands)
  if (process.env.CAPTURE_BAND_SCREENSHOTS) {
    const directory = path.resolve('../../docs/screenshots/issue-88')
    await mkdir(directory, { recursive: true })
    await page.screenshot({
      path: path.join(directory, 'participants.png'),
      fullPage: true,
    })
    await button.click()
    await dialog.screenshot({
      path: path.join(directory, 'delete-confirmation.png'),
    })
  } else await button.click()
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(button).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText(
    '「Pretender」を削除しました。',
  )
  const after = (await (await request.get(`${url}/form`)).json()) as FormRoster
  expect(after.bands).toHaveLength(before.bands.length - 1)
  expect(after.members).toEqual(before.members)
  expect(after.memberships).toEqual(
    before.memberships.filter((row) => row.bandId !== databaseEvent.bandIds.p2),
  )
  expect(
    (
      (await (await request.get(`${url}/constraints`)).json()) as {
        constraints: unknown[]
      }
    ).constraints,
  ).toEqual(constraints.constraints)
  const remainingSchedule = (await (
    await request.get(`${url}/schedule`)
  ).json()) as Schedule
  expect(remainingSchedule.placements).toEqual(
    originalSchedule.placements.filter(
      (row) => row.bandId !== databaseEvent.bandIds.p2,
    ),
  )
  const resaved = await request.post(`${url}/schedule`, {
    data: {
      expectedUpdatedAt: remainingSchedule.updatedAt,
      parts: remainingSchedule.parts.map(({ partId, partName }) => ({
        partId,
        partName,
      })),
      placements: remainingSchedule.placements,
      unassignedBandIds: remainingSchedule.unassignedBandIds,
    },
  })
  expect(resaved.status()).toBe(200)
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const deleted = originalSchedule.placements.find(
    (row) => row.bandId === databaseEvent.bandIds.p2,
  )!
  const partIndex = originalSchedule.parts.findIndex(
    (part) => part.partId === deleted.partId,
  )
  const part = page.getByRole('region', {
    name: `第${partIndex + 1}部`,
    exact: true,
  })
  await expect(
    part.locator(':scope > div').nth(deleted.order + 1),
  ).toContainText('空き枠')
  for (const placement of remainingSchedule.placements.filter(
    (row) => row.partId === deleted.partId,
  ))
    await expect(
      part.locator(':scope > div').nth(placement.order + 1),
    ).toHaveAttribute('data-performance', placement.bandId)
  await page.goto(`/event/${databaseEvent.eventId}/performances`)

  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(button).toHaveCount(0)
  const unassigned = page.getByRole('button', {
    name: '源泉掛け流しを削除',
    exact: true,
  })
  await unassigned.click()
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(unassigned).toHaveCount(0)
  expect(deletes).toBe(2)
})

test('retains the confirmation on API failure, retries, and blocks closing or duplicate submits during deletion', async ({
  page,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}/bands/${databaseEvent.bandIds.p2}`
  let deletes = 0
  let release!: () => void
  const gate = new Promise<void>((resolve) => {
    release = resolve
  })
  await page.route(`**${url}`, async (route) => {
    if (route.request().method() !== 'DELETE') return route.continue()
    deletes++
    if (deletes === 1)
      return route.fulfill({ status: 503, body: 'unavailable' })
    await gate
    await route.continue()
  })
  await page.goto(`/event/${databaseEvent.eventId}/performances`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: 'Pretenderを削除', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '出演枠を削除' })
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText('503')
  await expect(
    page.getByRole('cell', { name: 'Pretender', exact: true }),
  ).toHaveCount(1)
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog.getByRole('button', { name: '削除中…' })).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: 'キャンセル', exact: true }),
  ).toBeDisabled()
  await expect(
    dialog.getByRole('button', { name: '閉じる', exact: true }),
  ).toBeDisabled()
  await page.keyboard.press('Escape')
  await expect(dialog).toBeVisible()
  expect(deletes).toBe(2)
  release()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: 'Pretender', exact: true }),
  ).toHaveCount(0)
})

test('rejects stale confirmation, reloads explicitly and requires confirming the latest band again', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}`
  await page.goto(`/event/${databaseEvent.eventId}/performances`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: 'Pretenderを削除', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '出演枠を削除' })
  const current = (await (await request.get(url)).json()) as {
    updatedAt: string
  }
  expect(
    (
      await request.patch(url, {
        data: { title: '別画面で更新', expectedUpdatedAt: current.updatedAt },
      })
    ).status(),
  ).toBe(200)
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    'イベントが更新されました',
  )
  await expect(
    page.getByRole('cell', { name: 'Pretender', exact: true }),
  ).toHaveCount(1)
  await dialog
    .getByRole('button', { name: '最新の状態を取得', exact: true })
    .click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('link', { name: '別画面で更新', exact: true }),
  ).toBeVisible()
  await page
    .getByRole('button', { name: 'Pretenderを削除', exact: true })
    .click()
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  await expect(
    page.getByRole('cell', { name: 'Pretender', exact: true }),
  ).toHaveCount(0)
})

test('deletes a referenced band and retains the constraints after reload', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}`
  const before = (await (await request.get(`${url}/form`)).json()) as FormRoster
  const constraintsBefore = (await (
    await request.get(`${url}/constraints`)
  ).json()) as { constraints: unknown[] }
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.goto(`/event/${databaseEvent.eventId}/performances`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: '気分上々↑↑を削除', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: '出演枠を削除' })
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog).toHaveCount(0)
  const after = (await (await request.get(`${url}/form`)).json()) as FormRoster
  expect(after.bands).toEqual(
    before.bands.filter((band) => band.bandId !== databaseEvent.bandIds.p1),
  )
  const remaining = (await (
    await request.get(`${url}/constraints`)
  ).json()) as { constraints: unknown[] }
  expect(remaining.constraints).toEqual(constraintsBefore.constraints)
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('button', { name: '自動生成', exact: true }),
  ).toBeVisible()
  expect(errors).toEqual([])
})
