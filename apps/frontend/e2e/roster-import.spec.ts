import { expect, test } from './fixtures'

const roster =
  '曲名,メンバー1,メンバー2\n曲A,佐藤,田中\n曲B,田中,鈴木\nソロ,山本\n'

test('imports a roster CSV after a preview, treating the same name as one person', async ({
  page,
}) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('link', { name: 'ウィンターライブ 2026', exact: true })
    .click()
  await page.getByRole('link', { name: '出演枠・メンバー' }).click()
  // 上部の集計カード（表の見出しにも同じ語があるため最初の一致を使う）
  const stat = (label: string) =>
    page.getByText(label, { exact: true }).first().locator('..')

  await page.getByRole('button', { name: 'CSVを取り込む' }).click()
  const dialog = page.getByRole('dialog', { name: '名簿CSVを取り込む' })
  const paste = dialog.getByRole('textbox', { name: 'またはCSVを貼り付け' })
  await paste.fill('名前,所属\n佐藤,A\n')
  await expect(dialog.getByRole('alert')).toContainText('1行目')
  await expect(dialog.getByRole('button', { name: '登録する' })).toBeDisabled()

  await paste.fill(roster)
  await expect(
    dialog.getByRole('region', { name: '取込内容の確認' }),
  ).toContainText('3組・4人（掛け持ち1人）を登録します。')
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
  await expect(page.getByRole('row', { name: /曲B/ })).toContainText(
    '田中・鈴木',
  )
  await expect(page.getByRole('row', { name: /曲A/ })).toContainText('未配置')
})

test('downloads a template that can be imported as is', async ({ page }) => {
  await page.goto('/login')
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  await page
    .getByRole('link', { name: 'ウィンターライブ 2026', exact: true })
    .click()
  await page.getByRole('link', { name: '出演枠・メンバー' }).click()
  await page.getByRole('button', { name: 'CSVを取り込む' }).click()
  const dialog = page.getByRole('dialog', { name: '名簿CSVを取り込む' })

  const download = page.waitForEvent('download')
  await dialog.getByRole('button', { name: '雛形をダウンロード' }).click()
  const file = await download
  expect(file.suggestedFilename()).toBe('名簿の雛形.csv')
  await dialog.getByLabel('CSVファイル').setInputFiles(await file.path())

  await expect(
    dialog.getByRole('region', { name: '取込内容の確認' }),
  ).toContainText('2組・3人（掛け持ち1人）を登録します。')
})
