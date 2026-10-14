import type { EventData } from '../shared/model/event'
import type {
  EventDetails,
  FormSettings,
  Submission,
} from '../shared/model/workspace'
import { mockEvent } from './eventData.ts'

export interface MockRecord {
  details: EventDetails
  data: EventData
  form: FormSettings
  submissions: Submission[]
}
export function createEmptyEvent(id: string, name: string): EventData {
  return {
    id,
    name,
    members: [],
    performances: [],
    sections: [1, 2, 3].map((part) => ({
      id: `part-${part - 1}`,
      slots: [null, null, null, null],
    })),
    unassigned: [],
    constraints: [],
    messages: [
      {
        id: `${id}-welcome`,
        role: 'assistant',
        text: '出演枠と条件を登録して、出演順を組み立てましょう。「フォーム」から出演者の回答を集められます。',
      },
    ],
  }
}
export function createForm(name: string): FormSettings {
  return {
    title: `${name} 出演登録`,
    description:
      '出演名とメンバーを登録してください。掛け持ちのある方は登録済みのメンバーを選んでください。同名の別人は新しいメンバーとして登録できます。',
    deadline: '',
    accepting: true,
    collectRequests: true,
    collectContact: true,
  }
}
export const workspaceSeed: MockRecord[] = [
  {
    details: {
      id: mockEvent.id,
      name: mockEvent.name,
      date: '2026-03-22',
      venue: '市民文化ホール',
      description: '新しい季節のはじまりに、みんなの音楽を。',
      status: 'adjusting',
    },
    data: mockEvent,
    form: createForm(mockEvent.name),
    submissions: mockEvent.performances
      .slice(0, 3)
      .map((performance, index) => ({
        id: `response-${index}`,
        source: 'form' as const,
        performanceId: performance.id,
        requests: index === 0 ? '最初の出演を希望します。' : '',
        contact: '',
        createdAt: '2026-03-01T10:00:00+09:00',
      })),
  },
  {
    details: {
      id: 'autumn-session-2026',
      name: '秋のアコースティックセッション',
      date: '2026-11-15',
      venue: 'スタジオ A',
      description: 'アコースティック編成で届ける、秋の小さなライブ。',
      status: 'planning',
    },
    data: createEmptyEvent(
      'autumn-session-2026',
      '秋のアコースティックセッション',
    ),
    form: createForm('秋のアコースティックセッション'),
    submissions: [],
  },
  {
    details: {
      id: 'winter-live-2026',
      name: 'ウィンターライブ 2026',
      date: '2026-12-20',
      venue: '大学 大ホール',
      description: '一年の締めくくりを、音楽で。',
      status: 'planning',
    },
    data: createEmptyEvent('winter-live-2026', 'ウィンターライブ 2026'),
    form: createForm('ウィンターライブ 2026'),
    submissions: [],
  },
]
