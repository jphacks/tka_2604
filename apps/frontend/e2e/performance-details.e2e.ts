import type { FormRoster } from '../src/features/forms/repositories/types'
import type { SolveResponse } from '../src/shared/api/events'
import { expect, test } from './database-fixture'

test('edits and deletes a band from its schedule details dialog', async ({
  page,
  request,
  databaseEvent,
}) => {
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const details = page.getByRole('button', {
    name: 'Pretenderの詳細',
    exact: true,
  })
  await details.click()
  const dialog = page.getByRole('dialog', { name: 'Pretender', exact: true })
  await expect(dialog).toContainText('メンバー')
  await dialog.getByRole('button', { name: '編集', exact: true }).click()
  const editDialog = page.getByRole('dialog', { name: '出演枠を編集' })
  const editedName = 'Pretender (Edited)'
  await editDialog.getByPlaceholder('例：サンセット・レコード').fill(editedName)
  await editDialog.getByRole('button', { name: '変更を保存' }).click()
  await expect(editDialog).toHaveCount(0)
  await expect(page).toHaveURL(`/event/${databaseEvent.eventId}`)
  const editedDetails = page.getByRole('button', {
    name: `${editedName}の詳細`,
    exact: true,
  })
  await editedDetails.click()
  const editedDialog = page.getByRole('dialog', {
    name: editedName,
    exact: true,
  })
  await editedDialog.getByRole('button', { name: '削除', exact: true }).click()
  const confirmation = page.getByRole('dialog', {
    name: '出演枠の削除',
    exact: true,
  })
  await expect(confirmation).toContainText(editedName)
  await confirmation.getByRole('button', { name: '戻る' }).click()
  await editedDialog.getByRole('button', { name: '削除', exact: true }).click()
  await confirmation
    .getByRole('button', { name: '削除する', exact: true })
    .click()
  await expect(editedDialog).toHaveCount(0)
  await expect(editedDetails).toHaveCount(0)
  const form = (await (
    await request.get(`/api/events/${databaseEvent.eventId}/form`)
  ).json()) as FormRoster
  expect(
    form.bands.some((band) => band.bandId === databaseEvent.bandIds.p2),
  ).toBe(false)
  const schedule = (await (
    await request.get(`/api/events/${databaseEvent.eventId}/schedule`)
  ).json()) as SolveResponse['schedule']
  expect(
    schedule?.placements.some((row) => row.bandId === databaseEvent.bandIds.p2),
  ).toBe(false)
  await page.reload()
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await expect(
    page.getByRole('button', { name: `${editedName}の詳細`, exact: true }),
  ).toHaveCount(0)
})
