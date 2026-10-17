import { z } from 'zod'

const bandName = z.string().trim().min(1).max(80)
const memberIds = z.array(z.string().min(1)).max(20)
const newMembers = z
  .array(z.strictObject({ memberName: z.string().trim().min(1).max(40) }))
  .max(20)

function membershipIssues(
  input: { memberIds?: string[]; newMembers?: { memberName: string }[] },
  ctx: z.RefinementCtx,
  minimum: number,
) {
  if ((input.memberIds === undefined) !== (input.newMembers === undefined)) {
    ctx.addIssue({
      code: 'custom',
      path: ['memberIds'],
      message: 'memberIdsとnewMembersを両方指定してください。',
    })
    return
  }
  if (!input.memberIds || !input.newMembers) return
  const count = input.memberIds.length + input.newMembers.length
  if (count < minimum || count > 20)
    ctx.addIssue({
      code: 'custom',
      path: ['memberIds'],
      message: `所属メンバーは${minimum}〜20人で指定してください。`,
    })
  if (new Set(input.memberIds).size !== input.memberIds.length)
    ctx.addIssue({
      code: 'custom',
      path: ['memberIds'],
      message: 'メンバーIDが重複しています。',
    })
}

export const createFormBandSchema = z
  .strictObject({
    expectedUpdatedAt: z.iso.datetime(),
    bandName,
    memberIds,
    newMembers,
  })
  .superRefine((input, ctx) => membershipIssues(input, ctx, 1))

export const updateFormBandSchema = z
  .strictObject({
    expectedUpdatedAt: z.iso.datetime(),
    bandName: bandName.optional(),
    memberIds: memberIds.optional(),
    newMembers: newMembers.optional(),
  })
  .superRefine((input, ctx) => {
    if (
      input.bandName === undefined &&
      input.memberIds === undefined &&
      input.newMembers === undefined
    )
      ctx.addIssue({
        code: 'custom',
        message: '更新する項目を指定してください。',
      })
    membershipIssues(input, ctx, 0)
  })
