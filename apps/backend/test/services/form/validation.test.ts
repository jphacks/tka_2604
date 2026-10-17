import { describe, expect, it } from 'vitest'

import {
  createFormBandSchema,
  updateFormBandSchema,
} from '../../../src/services/form/validation'

const valid = {
  expectedUpdatedAt: '2026-10-17T00:00:00.000Z',
  bandName: 'A',
  memberIds: ['m1'],
  newMembers: [],
}

describe('form validation', () => {
  it('requires a member on create and permits no members on update', () => {
    expect(
      createFormBandSchema.safeParse({ ...valid, memberIds: [] }).success,
    ).toBe(false)
    expect(
      updateFormBandSchema.safeParse({
        expectedUpdatedAt: valid.expectedUpdatedAt,
        memberIds: [],
        newMembers: [],
      }).success,
    ).toBe(true)
    expect(
      createFormBandSchema.safeParse({
        ...valid,
        bandName: 'A'.repeat(80),
        memberIds: [],
        newMembers: Array.from({ length: 20 }, () => ({
          memberName: '人'.repeat(40),
        })),
      }).success,
    ).toBe(true)
  })

  it.each([
    { bandName: '' },
    { bandName: '  ' },
    { bandName: 'a'.repeat(81) },
    { memberIds: ['m1', 'm1'] },
    { memberIds: [null] },
    { newMembers: [{ memberName: ' ' }] },
    { newMembers: [{ memberName: '人'.repeat(41) }] },
    {
      memberIds: Array.from({ length: 20 }, (_, i) => `m${i}`),
      newMembers: [{ memberName: '21人目' }],
    },
    { expectedUpdatedAt: '2026-10-17' },
    { createdUserId: 'other' },
    { newMembers: [{ memberName: '人', memberId: 'forged' }] },
  ])('rejects invalid create fields: %j', (patch) => {
    expect(createFormBandSchema.safeParse({ ...valid, ...patch }).success).toBe(
      false,
    )
  })

  it.each([
    {},
    { memberIds: ['m1'] },
    { newMembers: [] },
    { bandName: null },
    { memberName: '全バンドで変更しない' },
  ])('rejects invalid partial updates: %j', (patch) => {
    expect(
      updateFormBandSchema.safeParse({
        expectedUpdatedAt: valid.expectedUpdatedAt,
        ...patch,
      }).success,
    ).toBe(false)
  })
})
