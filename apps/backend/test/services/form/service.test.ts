import { describe, expect, it, vi } from 'vitest'

import { formService } from '../../../src/services/form/service'
import type {
  FormRepository,
  FormRoster,
  UpdateFormBandInput,
} from '../../../src/services/form/types'

const roster: FormRoster = {
  eventId: 'event',
  eventTitle: 'Live',
  updatedAt: '2026-10-17T00:00:00.000Z',
  bands: [{ bandId: 'a', bandName: 'A' }],
  members: [{ memberId: 'm1', memberName: '田中' }],
  memberships: [{ bandId: 'a', memberId: 'm1' }],
}
function fixture() {
  const repository = {
    get: vi.fn<FormRepository['get']>().mockResolvedValue(roster),
    save: vi
      .fn<FormRepository['save']>()
      .mockResolvedValue({ updatedAt: '2026-10-17T00:01:00.000Z' }),
  }
  return { repository, service: formService(repository) }
}

describe('form service', () => {
  it('does not write for a missing event, band, stale token or foreign member', async () => {
    const { repository, service } = fixture()
    repository.get.mockResolvedValueOnce(null)
    await expect(service.get('missing')).rejects.toMatchObject({
      code: 'event_not_found',
    })
    const cases: {
      bandId: string
      input: UpdateFormBandInput
      code: string
    }[] = [
      {
        bandId: 'foreign',
        input: { expectedUpdatedAt: roster.updatedAt, bandName: 'A' },
        code: 'band_not_found',
      },
      {
        bandId: 'a',
        input: { expectedUpdatedAt: 'stale', bandName: 'A' },
        code: 'event_save_conflict',
      },
      {
        bandId: 'a',
        input: {
          expectedUpdatedAt: roster.updatedAt,
          memberIds: ['foreign'],
          newMembers: [],
        },
        code: 'invalid_input',
      },
    ]
    for (const { bandId, input, code } of cases)
      await expect(
        service.update('event', bandId, input),
      ).rejects.toMatchObject({ code })
    expect(repository.save).not.toHaveBeenCalled()
  })

  it('keeps memberships on a name-only update and propagates a failed save', async () => {
    const { repository, service } = fixture()
    const result = await service.update('event', 'a', {
      expectedUpdatedAt: roster.updatedAt,
      bandName: 'B',
    })
    expect(result.band).toEqual({
      bandId: 'a',
      bandName: 'B',
      memberIds: ['m1'],
    })
    expect(repository.save).toHaveBeenCalledWith('event', roster.updatedAt, {
      bandId: 'a',
      bandName: 'B',
      create: false,
      newMembers: [],
    })
    repository.save.mockRejectedValueOnce(new Error('DB failed'))
    await expect(
      service.update('event', 'a', {
        expectedUpdatedAt: roster.updatedAt,
        memberIds: [],
        newMembers: [],
      }),
    ).rejects.toThrow('DB failed')
  })
})
