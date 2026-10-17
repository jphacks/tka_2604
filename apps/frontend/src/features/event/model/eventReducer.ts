import type { Constraint } from '../../../generated/constraint'
import { validateConstraint } from '../../../shared/model/constraints'
import {
  type ChatMessage,
  type EventData,
  fixedConstraints,
  positions,
} from '../../../shared/model/event'
import {
  movePerformance,
  resizeSchedule,
  setPerformanceOrder,
} from './schedule'
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
  | { type: 'loaded'; event: EventData }
  | {
      type: 'performances-updated'
      event: Pick<EventData, 'members' | 'performances'>
    }
  | { type: 'notice'; message: string; error?: boolean }
  | { type: 'move'; id: string; target: MoveTarget }
  | { type: 'order'; id: string; value: number | null }
  | { type: 'resize'; count: number; sectionId?: string }
  | { type: 'fixed'; id: string; fixed: boolean }
  | { type: 'constraint-save'; constraint: Constraint }
  | { type: 'constraint-update'; id: string; patch: ConstraintPatch }
  | { type: 'constraint-delete'; id: string }
  | { type: 'message'; message: ChatMessage }

export const initialState: EventState = { event: null, notice: '', error: '' }

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
    notice,
    error: '',
  })
  const fail = (error: string) => ({ ...state, error, notice: '' })
  switch (action.type) {
    case 'performances-updated':
      return success(
        {
          ...event,
          members: action.event.members,
          performances: action.event.performances,
        },
        '出演枠を更新しました。',
      )
    case 'move':
    case 'order':
    case 'resize': {
      const result =
        action.type === 'move'
          ? movePerformance(event, action.id, action.target)
          : action.type === 'order'
            ? setPerformanceOrder(event, action.id, action.value)
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
    case 'message':
      return success({
        ...event,
        messages: [...event.messages, action.message],
      })
  }
}
