import type { Page } from '@playwright/test'

import type {
  CreateFormBandInput,
  FormRoster,
} from '../src/features/forms/repositories/types'

// HTTP fixture for isolated form validation and failure tests.
export async function mockRegistrationApi(page: Page, eventId = 'public-live') {
  const roster: FormRoster = {
    eventId,
    eventTitle: '春ライブ 2026',
    updatedAt: '2026-10-18T00:00:00.000Z',
    bands: [
      {
        bandId: 'a',
        bandName: 'サンセット・レコード',
        description: null,
        requestText: null,
      },
      {
        bandId: 'b',
        bandName: 'ブルーノート',
        description: null,
        requestText: null,
      },
    ],
    members: [
      { memberId: 'm1', memberName: '田中 花' },
      { memberId: 'm2', memberName: '鈴木 蓮' },
      { memberId: 'm3', memberName: '田中 花' },
    ],
    memberships: [
      { bandId: 'a', memberId: 'm1' },
      { bandId: 'a', memberId: 'm2' },
      { bandId: 'b', memberId: 'm1' },
    ],
  }
  const writes: {
    method: string
    bandId: string
    body: CreateFormBandInput
  }[] = []
  let failure = 0
  await page.route(`**/api/events/${eventId}/form**`, async (route) => {
    const request = route.request()
    if (request.method() === 'GET') return route.fulfill({ json: roster })
    if (failure)
      return route.fulfill({
        status: failure,
        json: {
          error: {
            code: failure === 409 ? 'event_save_conflict' : 'internal_error',
            message:
              failure === 409
                ? '別の変更が保存されています。'
                : '保存に失敗しました。',
            details: [],
          },
        },
      })
    const body = request.postDataJSON() as CreateFormBandInput
    const bandId =
      request.method() === 'POST'
        ? `new-${writes.length}`
        : new URL(request.url()).pathname.split('/').at(-1)!
    writes.push({ method: request.method(), bandId, body })
    const members = body.newMembers.map(
      (member: { memberName: string }, index: number) => ({
        memberId: `person-${writes.length}-${index}`,
        memberName: member.memberName,
      }),
    )
    roster.members.push(...members)
    const band = {
      bandId,
      bandName: body.bandName,
      description: body.description ?? null,
      requestText: body.requestText?.trim() || null,
    }
    roster.bands = [
      ...roster.bands.filter((item) => item.bandId !== bandId),
      band,
    ]
    const memberIds: string[] = [
      ...body.memberIds,
      ...members.map((member: { memberId: string }) => member.memberId),
    ]
    roster.memberships = [
      ...roster.memberships.filter((item) => item.bandId !== bandId),
      ...memberIds.map((memberId) => ({ bandId, memberId })),
    ]
    roster.updatedAt = new Date(Date.parse(roster.updatedAt) + 1).toISOString()
    return route.fulfill({
      status: request.method() === 'POST' ? 201 : 200,
      json: {
        eventId: roster.eventId,
        updatedAt: roster.updatedAt,
        band: { ...band, memberIds },
        members: roster.members.filter((member) =>
          memberIds.includes(member.memberId),
        ),
      },
    })
  })
  return {
    roster,
    writes,
    fail: (status: number) => {
      failure = status
    },
  }
}
