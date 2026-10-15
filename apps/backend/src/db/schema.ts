import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

export const users = sqliteTable('users', {
  userId: text('user_id').primaryKey().notNull(),
  passwordHash: text('password_hash').notNull(),
})

export const events = sqliteTable(
  'events',
  {
    eventId: text('event_id').primaryKey().notNull(),
    createdUserId: text('created_user_id')
      .notNull()
      .references(() => users.userId),
    title: text('title').notNull(),
    status: text('status', { enum: ['planning', 'adjusting', 'confirmed'] })
      .notNull()
      .default('planning'),
    date: text('date'),
    venue: text('venue'),
    description: text('description'),
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    isDeleted: integer('is_deleted', { mode: 'boolean' })
      .notNull()
      .default(false),
  },
  (table) => [
    check(
      'events_status',
      sql`${table.status} in ('planning', 'adjusting', 'confirmed')`,
    ),
    check('events_is_deleted', sql`${table.isDeleted} in (0, 1)`),
  ],
)

export const bands = sqliteTable('bands', {
  bandId: text('band_id').primaryKey().notNull(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.eventId),
  bandName: text('band_name').notNull(),
})

export const members = sqliteTable('members', {
  memberId: text('member_id').primaryKey().notNull(),
  eventId: text('event_id')
    .notNull()
    .references(() => events.eventId),
  memberName: text('member_name').notNull(),
})

export const bandMembers = sqliteTable(
  'band_members',
  {
    bandId: text('band_id')
      .notNull()
      .references(() => bands.bandId, { onDelete: 'cascade' }),
    memberId: text('member_id')
      .notNull()
      .references(() => members.memberId, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.bandId, table.memberId] })],
)

export const parts = sqliteTable(
  'parts',
  {
    partId: text('part_id').primaryKey().notNull(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.eventId),
    sortOrder: integer('sort_order').notNull(),
    comment: text('comment'),
  },
  (table) => [
    uniqueIndex('parts_event_sort_order').on(table.eventId, table.sortOrder),
    check(
      'parts_sort_order',
      sql`typeof(${table.sortOrder}) = 'integer' and ${table.sortOrder} >= 0`,
    ),
  ],
)

export const bandOrder = sqliteTable(
  'band_order',
  {
    bandId: text('band_id')
      .primaryKey()
      .notNull()
      .references(() => bands.bandId, { onDelete: 'cascade' }),
    partId: text('part_id')
      .notNull()
      .references(() => parts.partId),
    order: integer('order').notNull(),
  },
  (table) => [
    uniqueIndex('band_order_part_order').on(table.partId, table.order),
    check(
      'band_order_order',
      sql`typeof(${table.order}) = 'integer' and ${table.order} >= 0`,
    ),
  ],
)

export const constraints = sqliteTable(
  'constraints',
  {
    constraintId: text('constraint_id').primaryKey().notNull(),
    eventId: text('event_id')
      .notNull()
      .references(() => events.eventId),
    constraintJson: text('constraint_json').notNull(),
  },
  (table) => [
    check('constraints_valid_json', sql`json_valid(${table.constraintJson})`),
    check(
      'constraints_identity',
      sql`json_extract(${table.constraintJson}, '$.constraint_id') is ${table.constraintId} and json_extract(${table.constraintJson}, '$.event_id') is ${table.eventId}`,
    ),
  ],
)
