import type { ChatResponse } from '../../../../../backend/src/services/chat/types'
import { describeConstraint } from '../../../shared/model/constraints'
import type { EventData } from './types'

export type ChatReorder = NonNullable<ChatResponse['reorder']> & {
  reply: string
}

// Places the proposal into the current sections. Unassigned bands and section
// capacity stay as they are; the BE only moves bands that were placed.
export function applyChatReorder(
  event: EventData,
  reorder: ChatReorder,
): EventData {
  if (event.updatedAt !== reorder.expectedUpdatedAt)
    throw new Error(
      '提案後にイベントが更新されました。最新の状態でもう一度相談してください。',
    )
  const sectionIds = new Set(event.sections.map((section) => section.id))
  const bandIds = new Set(event.performances.map((band) => band.id))
  if (
    reorder.placements.some(
      (p) => !sectionIds.has(p.partId) || !bandIds.has(p.bandId),
    )
  )
    throw new Error('並べ替え案の出演枠・部が現在のイベントと一致しません。')
  return {
    ...event,
    sections: event.sections.map((section) => {
      const bands = reorder.placements
        .filter((p) => p.partId === section.id)
        .toSorted((a, b) => a.order - b.order)
        .map((p) => p.bandId)
      return {
        ...section,
        slots: Array.from(
          { length: Math.max(section.slots.length, bands.length) },
          (_, index) => bands[index] ?? null,
        ),
      }
    }),
  }
}

export interface ReorderChange {
  constraintId: string
  text: string
  priority: 'high' | 'mid' | 'low' | null
  explanations: string[]
}

// Hard violations block nothing by themselves; the user decides after reading
// them. Soft changes are split into newly unmet and newly met.
export function summarizeChatReorder(event: EventData, reorder: ChatReorder) {
  const change = (
    result: ChatReorder['results'][number],
  ): ReorderChange | null => {
    const constraint = event.constraints.find(
      (item) => item.constraint_id === result.constraintId,
    )
    return constraint
      ? {
          constraintId: result.constraintId,
          text: describeConstraint(constraint, event),
          priority: result.priority,
          explanations: result.explanations,
        }
      : null
  }
  const pick = (test: (result: ChatReorder['results'][number]) => boolean) =>
    reorder.results.filter(test).flatMap((result) => change(result) ?? [])
  return {
    hardViolations: pick(
      (r) => r.hardness === 'hard' && r.violations.length > 0,
    ),
    softNewlyUnmet: pick(
      (r) =>
        r.hardness === 'soft' && r.before !== 'unmet' && r.after === 'unmet',
    ),
    softNewlyMet: pick(
      (r) => r.hardness === 'soft' && r.before === 'unmet' && r.after === 'met',
    ),
  }
}
