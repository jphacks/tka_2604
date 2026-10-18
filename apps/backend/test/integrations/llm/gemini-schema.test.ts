import { Ajv2020 } from 'ajv/dist/2020.js'
import { describe, expect, it } from 'vitest'

import { geminiOutputJsonSchema } from '../../../src/integrations/llm/gemini-schema.ts'
import { proposedConstraintSchema } from '../../../src/services/chat/contract.ts'
import { approval } from '../../services/chat/fixtures.ts'

const validate = new Ajv2020({ strict: false }).compile(geminiOutputJsonSchema)

describe('Gemini response JSON Schema', () => {
  it.each([
    { hardness: null, priority: null },
    { hardness: 'hard', priority: null },
    { hardness: 'soft', priority: 'high' },
    { hardness: 'soft', priority: null },
  ])('allows nullable proposal settings: %j', (settings) => {
    const output = { ...approval(), placements: [] }
    Object.assign(output.actions[0].constraint, settings)
    expect(validate(output), JSON.stringify(validate.errors)).toBe(true)
  })

  it('rejects enum values outside the existing contract', () => {
    const output = approval()
    Object.assign(output.actions[0].constraint, { hardness: 'mandatory' })
    expect(validate(output)).toBe(false)
  })

  it('removes unsupported keywords and nullable enums without relaxing runtime validation', () => {
    function inspect(value: unknown) {
      if (Array.isArray(value)) return value.forEach(inspect)
      if (typeof value !== 'object' || value === null) return
      const schema = value as Record<string, unknown>
      expect(schema).not.toHaveProperty('uniqueItems')
      expect(schema).not.toHaveProperty('minLength')
      expect(schema).not.toHaveProperty('maxLength')
      if (Array.isArray(schema.enum)) expect(schema.enum).not.toContain(null)
      Object.values(schema).forEach(inspect)
    }
    inspect(geminiOutputJsonSchema)
    const constraint = {
      ...approval().actions[0].constraint,
      targets: { band_ids: ['band-a', 'band-a'] },
    }
    expect(proposedConstraintSchema.safeParse(constraint).success).toBe(false)
  })
})
