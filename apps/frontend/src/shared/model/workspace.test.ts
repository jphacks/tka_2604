import { describe, expect, it } from 'vitest'

import { defaultEventName } from './workspace'

describe('defaultEventName', () => {
  it('作成日時を日本時間の年月日・時刻で名前にする', () => {
    expect(defaultEventName(new Date('2026-10-19T05:07:00Z'))).toBe(
      'イベント 2026/10/19 14:07',
    )
  })

  it('UTCで前日でも日本時間の日付を使う', () => {
    expect(defaultEventName(new Date('2026-10-18T15:30:00Z'))).toBe(
      'イベント 2026/10/19 00:30',
    )
  })
})
