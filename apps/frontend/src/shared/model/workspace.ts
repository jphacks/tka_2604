export interface Session {
  name: string
  email: string
}
export interface EventDetails {
  id: string
  name: string
  date: string
  venue: string
  description: string
  updatedAt?: string
}
export interface EventSummary extends EventDetails {
  performanceCount: number
  assignedCount: number
  partCount: number
  responseCount: number | null
}
export type EventDraft = Omit<EventDetails, 'id' | 'updatedAt'> & {
  bandCounts?: number[]
}
/** イベント名を省略したときの名前。作成日時（日本時間）から作る。 */
export function defaultEventName(now: Date) {
  const time = new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
    timeZone: 'Asia/Tokyo',
  }).format(now)
  return `イベント ${time}`
}
const MAX_PARTS = 8
const MAX_BANDS_PER_PART = 20
/**
 * 名簿の組数を部へ均等に割り振る。前の部ほど1組多くし、
 * 1部の上限を超える場合だけ部を増やす（部数の上限まで）。
 */
export function splitBandCounts(total: number, parts: number) {
  const count = Math.min(
    MAX_PARTS,
    Math.max(parts, Math.ceil(total / MAX_BANDS_PER_PART), 1),
  )
  const base = Math.floor(total / count)
  return Array.from({ length: count }, (_, index) =>
    Math.min(
      MAX_BANDS_PER_PART,
      Math.max(1, base + (index < total % count ? 1 : 0)),
    ),
  )
}
export function formatDate(date: string) {
  if (!date) return '日程未定'
  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(`${date}T12:00:00+09:00`))
}
