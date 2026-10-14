import type {
  AtPositionConstraint,
  Constraint,
} from '../../generated/constraint'

export interface Member {
  id: string
  name: string
}

/** A performance is one band entry in the constraint schema. */
export interface Performance {
  id: string
  name: string
  memberIds: string[]
}

export interface Section {
  id: string
  slots: (string | null)[]
}

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  text: string
}

export interface EventData {
  id: string
  name: string
  members: Member[]
  performances: Performance[]
  sections: Section[]
  unassigned: string[]
  constraints: Constraint[]
  messages: ChatMessage[]
}

export function memberNames(event: EventData, performance: Performance) {
  const names = new Map(event.members.map((member) => [member.id, member.name]))
  return performance.memberIds.map((id) => names.get(id) ?? '不明なメンバー')
}

/** Schema positions and part IDs are zero based; display numbers are one based. */
export function positions(event: EventData) {
  const result = new Map<string, { position: number; part: number }>()
  let position = 0
  event.sections.forEach((section, part) => {
    section.slots.forEach((id) => {
      if (id !== null) result.set(id, { position, part })
      position += 1
    })
  })
  return result
}

export function fixedConstraints(event: EventData, bandId: string) {
  return event.constraints.filter(
    (constraint): constraint is AtPositionConstraint =>
      constraint.type === 'at_position' &&
      constraint.enabled &&
      constraint.hardness === 'hard' &&
      constraint.targets.band_id === bandId,
  )
}

export function isFixed(event: EventData, bandId: string) {
  const current = positions(event).get(bandId)?.position
  return fixedConstraints(event, bandId).some(
    (constraint) => constraint.params.position === current,
  )
}
