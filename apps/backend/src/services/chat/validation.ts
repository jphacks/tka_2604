import { AIChatError } from './errors.ts'
import type {
  AIChatInput,
  ConstraintProposalAction,
  ProposedConstraint,
} from './types.ts'

function unique(values: (string | number)[]) {
  return new Set(values).size === values.length
}

export function validateContext({ context }: AIChatInput) {
  const bandIds = new Set(context.bands.map((band) => band.bandId))
  const memberIds = new Set(context.members.map((member) => member.memberId))
  const partIds = new Set(context.parts.map((part) => part.partId))
  if (
    bandIds.size !== context.bands.length ||
    memberIds.size !== context.members.length ||
    partIds.size !== context.parts.length ||
    !unique(context.parts.map((part) => part.sortOrder)) ||
    !unique(context.constraints.map((item) => item.constraint_id)) ||
    !unique(context.currentPlacements.map((item) => item.bandId)) ||
    !unique(
      context.currentPlacements.map((item) =>
        JSON.stringify([item.partId, item.order]),
      ),
    ) ||
    !unique(
      context.memberships.map((item) =>
        JSON.stringify([item.bandId, item.memberId]),
      ),
    ) ||
    context.memberships.some(
      (item) => !bandIds.has(item.bandId) || !memberIds.has(item.memberId),
    ) ||
    context.currentPlacements.some(
      (item) => !bandIds.has(item.bandId) || !partIds.has(item.partId),
    )
  )
    throw new AIChatError('ai_chat_invalid_input')
}

function validConstraint(
  value: ProposedConstraint,
  context: AIChatInput['context'],
) {
  if (value.hardness === 'hard' && value.priority !== null) return false
  const bandIds = new Set(context.bands.map((band) => band.bandId))
  const partOrders = new Set(context.parts.map((part) => part.sortOrder))
  const validPosition = (position: number) => position < bandIds.size
  const validParts = (parts: number[]) =>
    parts.every((part) => partOrders.has(part))
  switch (value.type) {
    case 'min_gap_member':
      return context.members.some(
        (member) => member.memberId === value.targets.member_id,
      )
    case 'before':
      return (
        value.targets.before_band_id !== value.targets.after_band_id &&
        bandIds.has(value.targets.before_band_id) &&
        bandIds.has(value.targets.after_band_id)
      )
    case 'at_position':
      return (
        bandIds.has(value.targets.band_id) &&
        validPosition(value.params.position)
      )
    default:
      if (value.targets.band_ids.some((id) => !bandIds.has(id))) return false
      if (value.type === 'min_gap_bands') return true
      if (value.type === 'in_range') {
        return value.params.kind === 'parts'
          ? validParts(value.params.part_ids)
          : validPosition(value.params.position_from) &&
              validPosition(value.params.position_to) &&
              value.params.position_from <= value.params.position_to
      }
      return (
        value.params.min <= value.params.max &&
        (value.params.scope === 'per_part' || validParts(value.params.part_ids))
      )
  }
}

export function validateActions(
  actions: ConstraintProposalAction[],
  input: AIChatInput,
  errorCode: 'ai_chat_invalid_input' | 'ai_chat_invalid_output',
) {
  const constraintIds = new Set(
    input.context.constraints.map((item) => item.constraint_id),
  )
  const touched = new Set<string>()
  for (const action of actions) {
    if (action.type !== 'add_constraint') {
      if (
        !constraintIds.has(action.constraintId) ||
        touched.has(action.constraintId)
      )
        throw new AIChatError(errorCode)
      touched.add(action.constraintId)
    }
    if (
      action.type !== 'delete_constraint' &&
      !validConstraint(action.constraint, input.context)
    )
      throw new AIChatError(errorCode)
  }
}

export function inheritUpdateSettings(
  actions: ConstraintProposalAction[],
  input: AIChatInput,
) {
  return actions.map((action): ConstraintProposalAction => {
    if (action.type !== 'update_constraint') return action
    const pending = input.pendingProposal?.actions.find(
      (item) =>
        item.type === 'update_constraint' &&
        item.constraintId === action.constraintId,
    )
    const previous =
      pending?.type === 'update_constraint'
        ? pending.constraint
        : input.context.constraints.find(
            (item) => item.constraint_id === action.constraintId,
          )
    if (!previous) return action
    const hardness = action.constraint.hardness ?? previous.hardness
    const priority =
      hardness === 'hard'
        ? null
        : (action.constraint.priority ??
          (hardness === previous.hardness ? previous.priority : null))
    return {
      ...action,
      constraint: { ...action.constraint, hardness, priority },
    }
  })
}
