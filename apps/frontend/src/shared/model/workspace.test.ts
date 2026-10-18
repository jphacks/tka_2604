import { describe, expect, it } from 'vitest'

import { defaultEventName, splitBandCounts } from './workspace'

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

describe('splitBandCounts', () => {
  it('組数を指定の部数へ均等に割り、余りは前の部に足す', () => {
    expect(splitBandCounts(20, 1)).toEqual([20])
    expect(splitBandCounts(20, 2)).toEqual([10, 10])
    expect(splitBandCounts(20, 3)).toEqual([7, 7, 6])
  })

  it('1部20組を超える場合は部を増やす', () => {
    expect(splitBandCounts(38, 1)).toEqual([19, 19])
    expect(splitBandCounts(41, 2)).toEqual([14, 14, 13])
  })

  it('組数が部数より少なくても各部1組以上にする', () => {
    expect(splitBandCounts(2, 3)).toEqual([1, 1, 1])
  })
})
