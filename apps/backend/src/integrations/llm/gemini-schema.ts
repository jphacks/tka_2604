import { aiChatOutputJsonSchema } from '../../services/chat/contract.ts'
import type { JsonSchema } from '../../services/constraints/schema.ts'

// Gemini's JSON Schema subset does not include string length or uniqueItems.
// Nullable enums use separate alternatives so the enum contains only strings.
function forGemini(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(forGemini)
  if (typeof value !== 'object' || value === null) return value
  const object = Object.fromEntries(
    Object.entries(value)
      .filter(
        ([key]) => !['minLength', 'maxLength', 'uniqueItems'].includes(key),
      )
      .map(([key, item]) => [key, forGemini(item)]),
  )
  if (Array.isArray(object.enum) && object.enum.includes(null)) {
    const types: unknown[] = Array.isArray(object.type)
      ? object.type.filter((type) => type !== 'null')
      : [object.type]
    return {
      anyOf: [
        {
          ...object,
          type: types.length === 1 ? types[0] : types,
          enum: object.enum.filter((item) => item !== null),
        },
        { type: 'null' },
      ],
    }
  }
  return object
}

export const geminiOutputJsonSchema = forGemini(
  aiChatOutputJsonSchema,
) as JsonSchema
