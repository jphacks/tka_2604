import { sql } from 'drizzle-orm'
import {
  check,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core'

// ユーザー：ログインIDとパスワードのハッシュを管理する。
export const users = sqliteTable('users', {
  // ログインID（ユーザーの主キー）
  userId: text('user_id').primaryKey().notNull(),
  // パスワードのハッシュ
  passwordHash: text('password_hash').notNull(),
})

// イベント：所有者・開催情報・編集状態を管理する。
export const events = sqliteTable(
  'events',
  {
    // イベントID
    eventId: text('event_id').primaryKey().notNull(),
    // イベント所有者のユーザーID
    createdUserId: text('created_user_id')
      .notNull()
      .references(() => users.userId),
    // イベント名
    title: text('title').notNull(),
    // 編集状態：準備中／調整中／確定
    status: text('status', { enum: ['planning', 'adjusting', 'confirmed'] })
      .notNull()
      .default('planning'),
    // 開催日（任意・YYYY-MM-DD）
    date: text('date'),
    // 会場（任意）
    venue: text('venue'),
    // イベントの説明（任意）
    description: text('description'),
    // 作成日時（UTC）
    createdAt: text('created_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    // 更新日時（UTC）。保存時の競合確認にも使う
    updatedAt: text('updated_at')
      .notNull()
      .default(sql`(strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))`),
    // 論理削除フラグ：false=有効、true=削除済み（DBでは0／1）
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

// 出演バンド：イベントに登録されたバンド。
export const bands = sqliteTable('bands', {
  // バンドID
  bandId: text('band_id').primaryKey().notNull(),
  // イベントID
  eventId: text('event_id')
    .notNull()
    .references(() => events.eventId),
  // バンド名
  bandName: text('band_name').notNull(),
})

// 出演者名簿：同名でもIDが異なれば別人として扱う。
export const members = sqliteTable('members', {
  // 出演者ID
  memberId: text('member_id').primaryKey().notNull(),
  // イベントID
  eventId: text('event_id')
    .notNull()
    .references(() => events.eventId),
  // 出演者名
  memberName: text('member_name').notNull(),
})

// バンド所属：同じ出演者を複数バンドに紐づけて掛け持ちを表す。
export const bandMembers = sqliteTable(
  'band_members',
  {
    // バンドID
    bandId: text('band_id')
      .notNull()
      .references(() => bands.bandId, { onDelete: 'cascade' }),
    // 出演者ID
    memberId: text('member_id')
      .notNull()
      .references(() => members.memberId, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.bandId, table.memberId] })],
)

// 部：イベントの区切り。各部のバンド数は配置件数から求める。
export const parts = sqliteTable(
  'parts',
  {
    // 部ID
    partId: text('part_id').primaryKey().notNull(),
    // イベントID
    eventId: text('event_id')
      .notNull()
      .references(() => events.eventId),
    // 部の表示順（0始まり）。画面では「第n部」と表示する
    sortOrder: integer('sort_order').notNull(),
    // 部の補足コメント（任意）
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

// バンド配置：どの部の何番目に出演するか。行がなければ未配置。
export const bandOrder = sqliteTable(
  'band_order',
  {
    // バンドID
    bandId: text('band_id')
      .primaryKey()
      .notNull()
      .references(() => bands.bandId, { onDelete: 'cascade' }),
    // 部ID
    partId: text('part_id')
      .notNull()
      .references(() => parts.partId),
    // 部内の出演順（0始まり）
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

// 出演順の制約：制約1件につき1行を保存する。
export const constraints = sqliteTable(
  'constraints',
  {
    // 制約ID
    constraintId: text('constraint_id').primaryKey().notNull(),
    // イベントID
    eventId: text('event_id')
      .notNull()
      .references(() => events.eventId),
    // 制約のJSON。形式の正本はapps/schema、種別もJSON内に持つ
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
