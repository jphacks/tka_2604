import { z } from 'zod'

const settings = {
  title: z.string().trim().min(1, 'イベント名を入力してください。'),
  date: z.iso.date().nullable().optional(),
  venue: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
}

export const createEventSchema = z.strictObject({
  ...settings,
  bandCounts: z.array(z.number().int().min(1).max(20)).min(1).max(8).optional(),
})
export const updateEventSchema = z
  .strictObject({
    ...settings,
    title: settings.title.optional(),
    status: z.enum(['planning', 'adjusting', 'confirmed']).optional(),
    expectedUpdatedAt: z.iso.datetime(),
  })
  .refine(
    (input) => Object.keys(input).some((key) => key !== 'expectedUpdatedAt'),
    {
      message: '更新する項目を指定してください。',
    },
  )
