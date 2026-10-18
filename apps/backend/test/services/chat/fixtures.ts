import type { ChatEventSnapshot } from '../../../src/services/chat/input.ts'
import type {
  AIChatInput,
  ProposedConstraint,
} from '../../../src/services/chat/types.ts'

export function input(): AIChatInput {
  return {
    context: {
      event: { title: '秋ライブ' },
      parts: [
        { partId: 'part-1', sortOrder: 0, partName: '第1部' },
        { partId: 'part-2', sortOrder: 1, partName: '第2部' },
      ],
      bands: [
        { bandId: 'band-a', bandName: 'A', description: '明るいポップス' },
        { bandId: 'band-b', bandName: 'B', description: null },
      ],
      members: [{ memberId: 'member-1', memberName: '田中' }],
      memberships: [
        { bandId: 'band-a', memberId: 'member-1' },
        { bandId: 'band-b', memberId: 'member-1' },
      ],
      constraints: [],
      currentPlacements: [{ bandId: 'band-a', partId: 'part-1', order: 0 }],
    },
    recentMessages: [],
    userMessage: 'Aを第2部にしたい',
    pendingProposal: null,
  }
}

export function proposed(): ProposedConstraint {
  return {
    type: 'in_range',
    targets: { band_ids: ['band-a'] },
    params: { kind: 'parts', part_ids: [1] },
    hardness: null,
    priority: null,
  }
}

export function approval() {
  return {
    type: 'approval_required' as const,
    message: 'Aを第2部に配置する条件を追加します。',
    actions: [{ type: 'add_constraint' as const, constraint: proposed() }],
  }
}

export function currentConstraint() {
  const constraint = proposed()
  if (constraint.type !== 'in_range') throw new Error('Unexpected fixture type')
  return {
    ...constraint,
    schema_version: '1.0.0' as const,
    constraint_id: 'constraint-1',
    event_id: 'event-1',
    hardness: 'soft' as const,
    priority: 'high' as const,
    enabled: false,
    source_text: '元の希望',
  }
}

export function snapshot(): ChatEventSnapshot {
  const state = input().context
  const eventId = 'event-1'
  const updatedAt = '2026-10-17T00:00:00.000Z'
  return {
    event: {
      eventId,
      title: state.event.title,
      status: 'planning',
      date: null,
      venue: null,
      description: null,
      createdAt: updatedAt,
      updatedAt,
    },
    schedule: {
      eventId,
      updatedAt,
      bands: state.bands.map((band) => ({
        ...band,
        requestText: null,
        requestStatus: null,
      })),
      members: state.members,
      memberships: state.memberships,
      parts: state.parts,
      placements: state.currentPlacements,
      unassignedBandIds: ['band-b'],
    },
    constraints: {
      eventId,
      updatedAt,
      constraints: [
        { constraint: currentConstraint(), sourceBandId: 'band-a' },
      ],
    },
    chat: { eventId, messages: [] },
  }
}
