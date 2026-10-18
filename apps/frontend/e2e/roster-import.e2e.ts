import type { Page } from '@playwright/test'

import type { FormRoster } from '../src/features/forms/repositories/types'
import { expect, test } from './fixtures'

const roster =
  '曲名,紹介,メンバー1,メンバー2\n曲A,激しめのメタル,佐藤,田中\n曲B,,田中,鈴木\nソロ,,山本\n'

async function openImport(page: Page, eventId: string) {
  await page.goto(`/event/${eventId}/performances`)
  await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
  await page.getByRole('button', { name: 'CSVを取り込む' }).click()
  return page.getByRole('dialog', { name: '名簿CSVを取り込む' })
}

test('imports a roster CSV with descriptions after a preview, treating the same name as one person', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/events', {
    data: { title: 'CSV取込の確認' },
  })
  const { eventId } = (await created.json()) as { eventId: string }
  try {
    // 上部の集計カード（表の見出しにも同じ語があるため最初の一致を使う）
    const stat = (label: string) =>
      page.getByText(label, { exact: true }).first().locator('..')
    const dialog = await openImport(page, eventId)
    const paste = dialog.getByRole('textbox', { name: 'またはCSVを貼り付け' })
    await paste.fill('名前,所属\n佐藤,A\n')
    await expect(dialog.getByRole('alert')).toContainText('1行目')
    await expect(
      dialog.getByRole('button', { name: '登録する' }),
    ).toBeDisabled()

    await paste.fill(roster)
    const preview = dialog.getByRole('region', { name: '取込内容の確認' })
    await expect(preview).toContainText('3組・4人（掛け持ち1人）を登録します。')
    await expect(preview).toContainText('紹介あり：1組')
    await dialog.getByRole('button', { name: 'キャンセル' }).click()
    await expect(stat('出演枠')).toContainText('0組')

    await page.getByRole('button', { name: 'CSVを取り込む' }).click()
    await dialog.getByLabel('CSVファイル').setInputFiles({
      name: 'roster.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(roster),
    })
    await dialog.getByRole('button', { name: '3組を登録する' }).click()

    await expect(page.getByRole('status')).toContainText('3組を取り込みました')
    await expect(dialog).toBeHidden()
    await expect(stat('出演枠')).toContainText('3組')
    await expect(stat('メンバー')).toContainText('4名')
    // The API orders members by ID, so check both names regardless of order.
    const bandB = page.getByRole('row', { name: /曲B/ })
    await expect(bandB).toContainText('田中')
    await expect(bandB).toContainText('鈴木')
    await expect(page.getByRole('row', { name: /曲A/ })).toContainText(
      '激しめのメタル',
    )
    const saved = (await (
      await request.get(`/api/events/${eventId}/form`)
    ).json()) as FormRoster
    expect(
      saved.bands.map(({ bandName, description }) => [bandName, description]),
    ).toEqual(
      expect.arrayContaining([
        ['曲A', '激しめのメタル'],
        ['曲B', null],
        ['ソロ', null],
      ]),
    )
  } finally {
    await request.delete(`/api/events/${eventId}`)
  }
})

test('downloads a template that can be imported as is', async ({
  page,
  request,
}) => {
  const created = await request.post('/api/events', {
    data: { title: 'CSV雛形の確認' },
  })
  const { eventId } = (await created.json()) as { eventId: string }
  try {
    const dialog = await openImport(page, eventId)
    const download = page.waitForEvent('download')
    await dialog.getByRole('button', { name: '雛形をダウンロード' }).click()
    const file = await download
    expect(file.suggestedFilename()).toBe('名簿の雛形.csv')
    await dialog.getByLabel('CSVファイル').setInputFiles(await file.path())
    const preview = dialog.getByRole('region', { name: '取込内容の確認' })
    await expect(preview).toContainText('2組・3人（掛け持ち1人）を登録します。')
    await expect(preview).toContainText('紹介あり：2組')
  } finally {
    await request.delete(`/api/events/${eventId}`)
  }
})
