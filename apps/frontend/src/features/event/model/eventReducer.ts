import type { Constraint } from '../../../generated/constraint'
import { validateConstraint } from '../../../shared/model/constraints'
import {
  type ChatMessage,
  type EventData,
  fixedConstraints,
  positions,
} from '../../../shared/model/event'
import {
  movePersistedPerformance,
  setPersistedOrder,
} from './persistedSchedule'
import { resizeSchedule } from './schedule'
import type { MoveTarget } from './types'

export interface EventState {
  event: EventData | null
  notice: string
  error: string
}
export type ConstraintPatch = Partial<
  Pick<Constraint, 'hardness' | 'priority' | 'enabled'>
>
export type EventAction =
  | {
      type: 'schedule-configured'
      event: Pick<EventData, 'sections' | 'unassigned'>
    }
  | { type: 'loaded'; event: EventData }
  | {
      type: 'saved'
      updatedAt: string
      constraintSources?: EventData['constraintSources']
    }
  | { type: 'messages'; messages: ChatMessage[] }
  | { type: 'notice'; message: string; error?: boolean }
  | { type: 'move'; id: string; target: MoveTarget }
  | { type: 'order'; id: string; value: number | null }
  | { type: 'resize'; count: number; sectionId?: string }
  | { type: 'fixed'; id: string; fixed: boolean }
  | { type: 'constraints-replaced'; constraints: Constraint[] }
  | { type: 'constraint-save'; constraint: Constraint }
  | { type: 'constraint-update'; id: string; patch: ConstraintPatch }
  | { type: 'constraint-delete'; id: string }
  | { type: 'band-deleted'; id: string; updatedAt: string }
  | { type: 'message'; message: ChatMessage }

export const initialState: EventState = { event: null, notice: '', error: '' }

export function removeBandFromEvent(
  event: EventData,
  bandId: string,
  updatedAt: string,
): EventData {
  const generatedConstraintIds = new Set(
    Object.entries(event.constraintSources ?? {})
      .filter(([, sourceBandId]) => sourceBandId === bandId)
      .map(([constraintId]) => constraintId),
  )
  return {
    ...event,
    updatedAt,
    performances: event.performances.filter((band) => band.id !== bandId),
    sections: event.sections.map((section) => ({
      ...section,
      slots: section.slots.map((id) => (id === bandId ? null : id)),
    })),
    unassigned: event.unassigned.filter((id) => id !== bandId),
    constraints: event.constraints.filter(
      (constraint) => !generatedConstraintIds.has(constraint.constraint_id),
    ),
    constraintSources: Object.fromEntries(
      Object.entries(event.constraintSources ?? {}).filter(
        ([constraintId]) => !generatedConstraintIds.has(constraintId),
      ),
    ),
  }
}

export function eventReducer(
  state: EventState,
  action: EventAction,
): EventState {
  if (action.type === 'loaded') return { ...initialState, event: action.event }
  if (action.type === 'notice')
    return {
      ...state,
      notice: action.error ? '' : action.message,
      error: action.error ? action.message : '',
    }
  if (!state.event) return state
  const event = state.event
  const success = (next: EventData, notice = '') => ({
    event: next,
    notice: event.scheduleMode === 'dense' ? '' : notice,
    error: '',
  })
  const fail = (error: string) => ({ ...state, error, notice: '' })
  switch (action.type) {
    case 'schedule-configured':
      return success({ ...event, ...action.event })
    case 'saved':
      return {
        event: {
          ...event,
          updatedAt: action.updatedAt,
          constraintSources:
            action.constraintSources ?? event.constraintSources,
        },
        notice: state.notice,
        error: '',
      }
    case 'messages':
      return { ...state, event: { ...event, messages: action.messages } }

    case 'move':
    case 'order':
    case 'resize': {
      const result =
        action.type === 'move'
          ? movePersistedPerformance(event, action.id, action.target)
          : action.type === 'order'
            ? setPersistedOrder(event, action.id, action.value)
            : resizeSchedule(event, action.count, action.sectionId)
      return result.error ? fail(result.error) : success(result.event)
    }
    case 'fixed': {
      const active = fixedConstraints(event, action.id)
      if (!action.fixed)
        return success(
          {
            ...event,
            constraints: event.constraints.filter(
              (constraint) =>
                !active.some(
                  (fixed) => fixed.constraint_id === constraint.constraint_id,
                ),
            ),
          },
          '位置固定を解除しました。',
        )
      const position = positions(event).get(action.id)?.position
      if (position === undefined)
        return fail('出演枠を配置してから固定してください。')
      if (active.length)
        return fail(
          'この出演枠には位置指定があります。制約一覧で内容を確認してください。',
        )
      let constraintId = `fixed-${action.id}`
      let suffix = 1
      while (
        event.constraints.some(
          (constraint) => constraint.constraint_id === constraintId,
        )
      ) {
        constraintId = `fixed-${action.id}-${suffix++}`
      }
      return success(
        {
          ...event,
          constraints: [
            ...event.constraints,
            {
              schema_version: '1.0.0',
              constraint_id: constraintId,
              event_id: event.id,
              type: 'at_position',
              hardness: 'hard',
              priority: null,
              enabled: true,
              targets: { band_id: action.id },
              params: { position },
            },
          ],
        },
        '現在の位置を必須条件として固定しました。',
      )
    }
    case 'constraints-replaced':
      return success({ ...event, constraints: action.constraints })
    case 'constraint-save': {
      const error = validateConstraint(action.constraint, event)
      if (error) return fail(error)
      const exists = event.constraints.some(
        (constraint) =>
          constraint.constraint_id === action.constraint.constraint_id,
      )
      return success(
        {
          ...event,
          constraints: exists
            ? event.constraints.map((constraint) =>
                constraint.constraint_id === action.constraint.constraint_id
                  ? action.constraint
                  : constraint,
              )
            : [...event.constraints, action.constraint],
        },
        exists ? '制約を更新しました。' : '制約を追加しました。',
      )
    }
    case 'constraint-update': {
      const current = event.constraints.find(
        (constraint) => constraint.constraint_id === action.id,
      )
      if (!current) return state
      const hardness = action.patch.hardness ?? current.hardness
      const next = {
        ...current,
        ...action.patch,
        hardness,
        priority:
          hardness === 'hard'
            ? null
            : (action.patch.priority ?? current.priority ?? 'mid'),
      }
      const error = validateConstraint(next, event)
      if (error) return fail(error)
      return success({
        ...event,
        constraints: event.constraints.map((constraint) =>
          constraint.constraint_id === action.id ? next : constraint,
        ),
      })
    }
    case 'constraint-delete':
      return success(
        {
          ...event,
          constraints: event.constraints.filter(
            (constraint) => constraint.constraint_id !== action.id,
          ),
        },
        '制約を削除しました。',
      )
    case 'band-deleted':
      return success(
        removeBandFromEvent(event, action.id, action.updatedAt),
        '出演枠を削除しました。',
      )
    case 'message':
      return success({
        ...event,
        messages: event.messages.some(
          (message) => message.id === action.message.id,
        )
          ? event.messages.map((message) =>
              message.id === action.message.id ? action.message : message,
            )
          : [...event.messages, action.message],
      })
  }
}
