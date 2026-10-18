export type EventStatus = 'planning' | 'adjusting' | 'confirmed'
export interface Session {
  userId: string
}
export interface EventDetails {
  id: string
  name: string
  date: string
  venue: string
  description: string
  status: EventStatus
  updatedAt?: string
}
export interface EventSummary extends EventDetails {
  performanceCount: number
  assignedCount: number
  partCount: number
  responseCount: number | null
}
export type EventDraft = Omit<EventDetails, 'id' | 'status' | 'updatedAt'> & {
  bandCounts?: number[]
}
export const statusLabels: Record<EventStatus, string> = {
  planning: '準備中',
  adjusting: '調整中',
  confirmed: '確定',
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
