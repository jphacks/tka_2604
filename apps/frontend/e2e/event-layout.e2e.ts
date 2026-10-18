import { expect, test } from './database-fixture'

test('keeps the event title while moving between event management pages', async ({
  page,
  request,
  databaseEvent,
}) => {
  const event = (await (
    await request.get(`/api/events/${databaseEvent.eventId}`)
  ).json()) as { title: string }
  await page.goto(`/event/${databaseEvent.eventId}`)
  await page.getByRole('button', { name: 'ワークスペースを開く' }).click()
  const navigation = page.getByRole('navigation', { name: 'イベント内の移動' })
  const eventLink = navigation.getByRole('link').first()
  await expect(eventLink).toHaveText(event.title)

  await navigation.getByRole('link', { name: 'フォーム管理' }).click()
  await expect(
    page.getByRole('heading', { name: '出演者フォーム' }),
  ).toBeVisible()
  await expect(eventLink).toHaveText(event.title)

  await navigation.getByRole('link', { name: '設定' }).click()
  await expect(
    page.getByRole('heading', { name: 'イベント設定' }),
  ).toBeVisible()
  await expect(eventLink).toHaveText(event.title)
})
