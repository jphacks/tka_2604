import { expect, test } from './database-fixture'

test('all unassigned bands are discoverable from the initial schedule view', async ({
  page,
  request,
  databaseEvent,
}) => {
  const url = `/api/events/${databaseEvent.eventId}/schedule`
  const response = await request.get(url)
  const current = (await response.json()) as {
    updatedAt: string
    parts: { partId: string; partName: string | null; bandCount: number }[]
    bands: { bandId: string }[]
  }
  const saved = await request.post(url, {
    data: {
      expectedUpdatedAt: current.updatedAt,
      parts: current.parts,
      placements: [],
      unassignedBandIds: current.bands.map((b) => b.bandId),
    },
  })
  expect(saved.ok()).toBe(true)
  await page.goto(`/event/${databaseEvent.eventId}`)
  const link = page.getByRole('button', { name: '未配置一覧へ', exact: true })
  await expect(link).toBeInViewport()
  await link.click()
  await expect(
    page.getByRole('region', { name: '未配置', exact: true }),
  ).toBeFocused()
  await expect(
    page.getByRole('region', { name: '未配置', exact: true }),
  ).toBeInViewport()
})
