import type { EventData } from '../model/event'

export type EventStatus = 'planning' | 'adjusting' | 'confirmed'
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
  status: EventStatus
  updatedAt?: string
}
export interface EventSummary extends EventDetails {
  performanceCount: number
  assignedCount: number
  partCount: number
  responseCount: number | null
}
export type EventDraft = Omit<EventDetails, 'id' | 'status' | 'updatedAt'>
export interface FormSettings {
  title: string
  description: string
  deadline: string
  accepting: boolean
  collectRequests: boolean
  collectContact: boolean
}
export interface PerformanceDraft {
  name: string
  memberIds: string[]
  members: string
  requests: string
  contact: string
}
export interface Submission {
  id: string
  source: 'form' | 'manual'
  performanceId: string
  requests: string
  contact: string
  createdAt: string
}
export interface RegistrationData {
  event: EventDetails
  settings: FormSettings
  submissions: Submission[]
  data: EventData
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
export function parseMembers(value: string) {
  return [
    ...new Set(
      value
        .split(/[、,，\n]/)
        .map((name) => name.trim())
        .filter(Boolean),
    ),
  ]
}
export function validatePerformance(draft: PerformanceDraft) {
  if (!draft.name.trim()) return '出演名を入力してください。'
  if (draft.name.trim().length > 80)
    return '出演名は80文字以内で入力してください。'
  const members = parseMembers(draft.members)
  if (!members.length && !draft.memberIds.length)
    return 'メンバーを1名以上入力してください。'
  if (
    members.length + draft.memberIds.length > 20 ||
    members.some((name) => name.length > 40)
  )
    return 'メンバーは20名まで、名前は40文字以内で入力してください。'
  if (draft.contact && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.contact))
    return '連絡先メールの形式を確認してください。'
  if (draft.requests.length > 1000)
    return '出演に関する希望は1000文字以内で入力してください。'
  return ''
}
