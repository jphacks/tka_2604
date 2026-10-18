import { mkdir } from 'node:fs/promises'
import path from 'node:path'

import type { FormRoster } from '../src/features/forms/repositories/types'
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
  const dialog = page.getByRole('dialog', { name: 'バンドを削除', exact: true })
  await expect(dialog).toContainText('「Pretender」を削除しますか？')
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
  await page.reload()
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
  const dialog = page.getByRole('dialog', { name: 'バンドを削除' })
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
  const dialog = page.getByRole('dialog', { name: 'バンドを削除' })
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

test('explains constraint references and keeps the band and constraints intact', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}`
  const before = (await (await request.get(`${url}/form`)).json()) as FormRoster
  await page.goto(`/event/${databaseEvent.eventId}/performances`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('button', { name: '気分上々↑↑を削除', exact: true })
    .click()
  const dialog = page.getByRole('dialog', { name: 'バンドを削除' })
  await dialog.getByRole('button', { name: '削除する', exact: true }).click()
  await expect(dialog.getByRole('alert')).toContainText(
    '制約から参照されています',
  )
  const after = (await (await request.get(`${url}/form`)).json()) as FormRoster
  expect(after).toEqual(before)
})
