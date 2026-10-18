import { expect, it } from 'vitest'

import { eventFixture } from '../../../test/fixtures/event'
import { eventCsv } from './export'

it('exports Japanese roster, unassigned bands and fixed positions without losing CSV quoting', () => {
  const event = structuredClone(eventFixture)
  event.performances[1].name = 'テスト,"引用"\n改行'
  const csv = eventCsv(event)
  expect(csv.startsWith('\uFEFF')).toBe(true)
  expect(csv).toContain('"テスト,""引用""\n改行"')
  expect(csv).toContain('"未配置","","源泉掛け流し"')
  expect(csv).toContain(
    '"第1部","1","気分上々↑↑","佐藤・田中・鈴木・高橋","固定"',
  )
})

it('exports spreadsheet formula input as text', () => {
  const event = structuredClone(eventFixture)
  event.performances[0].name = '=1+1'
  event.members[0].name = '+formula'
  expect(eventCsv(event)).toContain('"\'=1+1"')
  expect(eventCsv(event)).toContain('"\'+formula・')
})
