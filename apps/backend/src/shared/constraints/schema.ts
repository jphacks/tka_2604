import { z } from 'zod'

import atPosition from '../../../../schema/at_position.schema.json' with { type: 'json' }
import before from '../../../../schema/before.schema.json' with { type: 'json' }
import common from '../../../../schema/common.schema.json' with { type: 'json' }
import constraint from '../../../../schema/constraint.schema.json' with { type: 'json' }
import count from '../../../../schema/count.schema.json' with { type: 'json' }
import inRange from '../../../../schema/in_range.schema.json' with { type: 'json' }
import minGapBands from '../../../../schema/min_gap_bands.schema.json' with { type: 'json' }
import minGapMember from '../../../../schema/min_gap_member.schema.json' with { type: 'json' }
import type { Constraint } from '../../generated/constraint'

const documents: Record<string, unknown> = {
  'constraint.schema.json': constraint,
  'common.schema.json': common,
  'at_position.schema.json': atPosition,
  'before.schema.json': before,
  'count.schema.json': count,
  'in_range.schema.json': inRange,
  'min_gap_bands.schema.json': minGapBands,
  'min_gap_member.schema.json': minGapMember,
}

// Zod accepts local references; expand the canonical files' cross-file references first.
function resolve(value: unknown, file: string): unknown {
  if (Array.isArray(value)) return value.map((item) => resolve(item, file))
  if (value === null || typeof value !== 'object') return value
  const object = value as Record<string, unknown>
  if (typeof object.$ref === 'string') {
    const [referencedFile, pointer = ''] = object.$ref.split('#')
    const targetFile = referencedFile || file
    let target: unknown = documents[targetFile]
    for (const segment of pointer.split('/').slice(1)) {
      const key = segment.replace(/~1/g, '/').replace(/~0/g, '~')
      if (!target || typeof target !== 'object' || !(key in target))
        throw new Error(`Unknown constraint schema reference: ${object.$ref}`)
      target = (target as Record<string, unknown>)[key]
    }
    if (target === undefined)
      throw new Error(`Unknown constraint schema: ${targetFile}`)
    return resolve(target, targetFile)
  }
  return Object.fromEntries(
    Object.entries(object).map(([key, item]) => [key, resolve(item, file)]),
  )
}

export type JsonSchema = z.core.JSONSchema.JSONSchema

export const constraintJsonSchema = resolve(
  constraint,
  'constraint.schema.json',
) as JsonSchema

const schema = z.fromJSONSchema(constraintJsonSchema)

export function validateConstraint(value: unknown): value is Constraint {
  return schema.safeParse(value).success
}
