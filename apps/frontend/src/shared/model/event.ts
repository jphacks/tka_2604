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
  requestText?: string | null
  requestStatus?:
    'pending' | 'needs_confirmation' | 'converted' | 'failed' | null
}

export interface Section {
  name?: string | null
  id: string
  slots: (string | null)[]
}

export interface ChatMessage {
  replyToMessageId?: string | null
  id: string
  role: 'user' | 'assistant'
  text: string
}

export interface EventData {
  scheduleMode?: 'dense'
  id: string
  name: string
  updatedAt?: string
  constraintSources?: Record<string, string | null>
  members: Member[]
  performances: Performance[]
  sections: Section[]
  unassigned: string[]
  constraints: Constraint[]
  messages: ChatMessage[]
}

export function memberLabel(event: EventData, member: Member) {
  const sameName = event.members.filter((item) => item.name === member.name)
  const suffix =
    sameName.length > 1
      ? ` ${sameName.findIndex((item) => item.id === member.id) + 1}`
      : ''
  const bands = event.performances
    .filter((band) => band.memberIds.includes(member.id))
    .map((band) => band.name)
  return `${member.name}${suffix}${bands.length ? `（${bands.join('・')}）` : '（出演枠なし）'}`
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

/** Persisted schedules use all registered bands as the possible position range. */
export function positionLimit(event: EventData) {
  return event.scheduleMode === 'dense'
    ? event.performances.length
    : event.sections.reduce((sum, section) => sum + section.slots.length, 0)
}
