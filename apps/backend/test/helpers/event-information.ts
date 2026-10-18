import type { createDb } from '../../src/db/index'
import {
  bandMembers,
  bandOrder,
  bands,
  chatMessages,
  constraints,
  events,
  members,
  parts,
} from '../../src/db/schema'

export async function seedEventInformation(
  db: ReturnType<typeof createDb>,
  owner = 'demo-owner',
  prefix = 'a',
) {
  const event = {
    eventId: `${prefix}-event`,
    title: 'Live',
    date: null,
    venue: null,
    description: null,
    createdAt: '2026-10-17T00:00:00.000Z',
    updatedAt: '2026-10-17T00:00:00.000Z',
  }
  await db.insert(events).values({ ...event, createdUserId: owner })
  const roster = [
    {
      bandId: `${prefix}-b2`,
      bandName: 'B',
      description: null,
      requestText: null,
      requestStatus: null,
    },
    {
      bandId: `${prefix}-b1`,
      bandName: 'A',
      description: '明るいポップス。客席を盛り上げる',
      requestText: '先頭に固定',
      requestStatus: 'converted' as const,
    },
  ]
  const people = [{ memberId: `${prefix}-m1`, memberName: '田中' }]
  const memberships = roster.map(({ bandId }) => ({
    bandId,
    memberId: people[0].memberId,
  }))
  const sections = [
    { partId: `${prefix}-p2`, partName: null, bandCount: 4, sortOrder: 1 },
    { partId: `${prefix}-p1`, partName: '昼の部', bandCount: 4, sortOrder: 0 },
  ]
  const placements = [
    { bandId: `${prefix}-b1`, partId: `${prefix}-p1`, order: 0 },
  ]
  await db
    .insert(bands)
    .values(roster.map((band) => ({ ...band, eventId: event.eventId })))
  await db
    .insert(members)
    .values(people.map((member) => ({ ...member, eventId: event.eventId })))
  await db.insert(bandMembers).values(memberships)
  await db
    .insert(parts)
    .values(sections.map((part) => ({ ...part, eventId: event.eventId })))
  await db.insert(bandOrder).values(placements)
  const constraint = {
    schema_version: '1.0.0',
    constraint_id: `${prefix}-c1`,
    event_id: event.eventId,
    type: 'at_position',
    hardness: 'hard',
    priority: null,
    enabled: true,
    source_text: '先頭に固定',
    targets: { band_id: `${prefix}-b1` },
    params: { position: 0 },
  }
  const storedConstraints = [
    { constraint, sourceBandId: `${prefix}-b1` },
    {
      constraint: {
        ...constraint,
        constraint_id: `${prefix}-c2`,
        enabled: false,
      },
      sourceBandId: null,
    },
  ]
  await db.insert(constraints).values(
    storedConstraints.map((row) => ({
      constraintId: row.constraint.constraint_id,
      eventId: event.eventId,
      constraintJson: JSON.stringify(row.constraint),
      sourceBandId: row.sourceBandId,
    })),
  )
  const messages = [
    {
      messageId: `${prefix}-u2`,
      seq: 7,
      role: 'user' as const,
      text: '続き',
      replyToMessageId: null,
      createdAt: event.createdAt,
    },
    {
      messageId: `${prefix}-u1`,
      seq: 0,
      role: 'user' as const,
      text: '先頭に固定して',
      replyToMessageId: null,
      createdAt: event.createdAt,
    },
    {
      messageId: `${prefix}-r1`,
      seq: 9,
      role: 'assistant' as const,
      text: '確認してください',
      replyToMessageId: `${prefix}-u1`,
      createdAt: event.createdAt,
    },
  ]
  for (const message of messages)
    await db.insert(chatMessages).values({ ...message, eventId: event.eventId })
  return {
    event,
    schedule: {
      eventId: event.eventId,
      updatedAt: event.updatedAt,
      bands: roster.toSorted((a, b) => a.bandId.localeCompare(b.bandId)),
      members: people,
      memberships: memberships.toSorted((a, b) =>
        a.bandId.localeCompare(b.bandId),
      ),
      parts: sections.toSorted((a, b) => a.sortOrder - b.sortOrder),
      placements,
      unassignedBandIds: [`${prefix}-b2`],
    },
    constraints: {
      eventId: event.eventId,
      updatedAt: event.updatedAt,
      constraints: storedConstraints,
    },
    chat: {
      eventId: event.eventId,
      messages: messages.toSorted((a, b) => a.seq - b.seq),
    },
  }
}
