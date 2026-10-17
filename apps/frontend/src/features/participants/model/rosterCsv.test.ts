import { describe, expect, it } from 'vitest'

import {
  decodeCsv,
  parseRosterCsv,
  planRosterImport,
  rosterTemplate,
} from './rosterCsv'

const header = '曲名,メンバー1,メンバー2,メンバー3\n'

function errorOf(csv: string) {
  const result = parseRosterCsv(csv)
  return 'error' in result ? result.error : ''
}

describe('parseRosterCsv', () => {
  it('reads one band per row and ignores blank cells and surrounding spaces', () => {
    const result = parseRosterCsv(
      `\uFEFF${header}時の歌/手嶌葵, 佐藤 ,田中,\r\nソロギター,鈴木,,\n\n`,
    )

    expect(result).toEqual({
      rows: [
        { line: 2, name: '時の歌/手嶌葵', members: ['佐藤', '田中'] },
        { line: 3, name: 'ソロギター', members: ['鈴木'] },
      ],
    })
  })

  it('handles quoted cells with commas, quotes and line breaks', () => {
    const result = parseRosterCsv(`${header}"Hello, World","A ""B""","C\nD"\n`)

    expect(result).toEqual({
      rows: [{ line: 2, name: 'Hello, World', members: ['A "B"', 'C\nD'] }],
    })
  })

  it('reads its own template, including a shared member', () => {
    const result = parseRosterCsv(rosterTemplate())
    const rows = 'rows' in result ? result.rows : []

    expect(rows).toHaveLength(2)
    expect(planRosterImport(rows, []).shared).toEqual(['田中'])
  })

  it('rejects a file without the roster header', () => {
    const error = errorOf('バンド名,メンバー1\n曲A,佐藤\n')

    expect(error).toContain('1行目')
    expect(error).toContain('雛形をダウンロード')
  })

  it.each([
    [`${header}曲A,,,\n`, '2行目: メンバーを1名以上'],
    [`${header},佐藤,,\n`, '2行目: 出演名'],
    [`${header}曲A,佐藤、田中,,\n`, '2行目: 名前に「、」「,」'],
    [`${header}`, '出演枠が1行もありません'],
  ])('reports the line of an invalid row', (csv, message) => {
    expect(errorOf(csv)).toContain(message)
  })
})

describe('decodeCsv', () => {
  it('reads UTF-8 and falls back to Shift_JIS', () => {
    const utf8 = new TextEncoder().encode('曲名,メンバー1').buffer
    // 「曲名」をShift_JISで表したバイト列
    const sjis = new Uint8Array([0x8b, 0xc8, 0x96, 0xbc]).buffer

    expect(decodeCsv(utf8)).toBe('曲名,メンバー1')
    expect(decodeCsv(sjis)).toBe('曲名')
  })
})

describe('planRosterImport', () => {
  const rows = [
    { line: 2, name: '曲A', members: ['佐藤', '田中'] },
    { line: 3, name: '曲B', members: ['田中', '鈴木'] },
    { line: 4, name: '曲C', members: ['田中', '山本'] },
  ]

  it('counts bands, people and shared members, reusing registered names', () => {
    const plan = planRosterImport(rows, [
      { id: 'm1', name: '佐藤' },
      { id: 'm2', name: '高橋' },
    ])

    expect(plan).toMatchObject({
      bands: 3,
      people: 4,
      shared: ['田中'],
      matched: ['佐藤'],
      added: ['田中', '鈴木', '山本'],
      ambiguous: [],
    })
  })

  it('does not guess when a name matches several registered people', () => {
    const plan = planRosterImport(rows, [
      { id: 'm1', name: '佐藤' },
      { id: 'm2', name: '佐藤' },
    ])

    expect(plan.ambiguous).toEqual(['佐藤'])
  })
})
