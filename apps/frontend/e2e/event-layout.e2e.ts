import { expect, test } from './database-fixture'

for (const width of [1600, 390]) {
  test(`edits event information and opens form management in dialogs at ${width}px`, async ({
    page,
    request,
    databaseEvent,
  }) => {
    await page.setViewportSize({ width, height: 1000 })
    const event = (await (
      await request.get(`/api/events/${databaseEvent.eventId}`)
    ).json()) as { title: string }
    const path = `/event/${databaseEvent.eventId}`
    await page.goto(path)
    await expect(page).not.toHaveURL(/\/login(?:[?#]|$)/)
    const title = page.getByRole('heading', { name: event.title, exact: true })
    await expect(title).toBeVisible()
    const actions = page.getByRole('group', { name: 'イベントの操作' })
    await expect(
      actions.getByRole('button', { name: 'CSVから追加' }),
    ).toBeVisible()
    await expect(
      actions.getByRole('button', { name: 'CSVを出力' }),
    ).toBeVisible()
    if (width === 1600) {
      const titleBox = (await title.boundingBox())!
      const actionsBox = (await actions.boundingBox())!
      expect(actionsBox.x).toBeGreaterThan(titleBox.x + titleBox.width)
      expect(
        Math.abs(
          actionsBox.y +
            actionsBox.height / 2 -
            titleBox.y -
            titleBox.height / 2,
        ),
      ).toBeLessThan(2)
    }
    await actions.getByRole('button', { name: 'フォーム管理' }).click()
    const forms = page.getByRole('dialog', { name: 'フォーム管理' })
    await expect(
      forms.getByRole('textbox', { name: '回答フォームのリンク' }),
    ).toHaveValue(new RegExp(`${path}/forms$`))
    await expect(page).toHaveURL(path)
    await forms.getByRole('button', { name: '閉じる', exact: true }).click()
    await page.getByRole('button', { name: 'ライブ情報の編集' }).click()
    const edit = page.getByRole('dialog', { name: 'ライブ情報の編集' })
    await expect(
      edit.getByRole('spinbutton', { name: '第1部の組数', exact: true }),
    ).toBeVisible()
    await edit
      .getByRole('textbox', { name: 'イベント名' })
      .fill('編集したライブ名')
    await edit.getByRole('button', { name: '変更を保存' }).click()
    await expect(edit.getByRole('status')).toContainText(
      'イベントの設定を更新しました。',
    )
    await edit.getByRole('button', { name: '閉じる', exact: true }).click()
    await expect(
      page.getByRole('heading', { name: '編集したライブ名', exact: true }),
    ).toBeVisible()
    await expect(page).toHaveURL(path)
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= window.innerWidth,
      ),
    ).toBe(true)
    await page.screenshot({
      path: test.info().outputPath(`event-toolbar-${width}.png`),
    })
  })
}
