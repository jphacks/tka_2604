import { describe, expect, it } from 'vitest'

import type { FormRoster } from '../repositories/types'
import { findMemberSuggestions } from './memberSuggestions'

const members: FormRoster['members'] = [
  { memberId: '1', memberName: '田中 花' },
  { memberId: '2', memberName: '中村 蓮' },
  { memberId: '3', memberName: '鈴木' },
  { memberId: '4', memberName: '田中 花' },
]

describe('findMemberSuggestions', () => {
  it('returns substring matches in roster order and preserves duplicate names', () => {
    expect(findMemberSuggestions(members, '中', [])).toEqual([
      members[0],
      members[1],
      members[3],
    ])
    expect(findMemberSuggestions(members, '田中', [])).toEqual([
      members[0],
      members[3],
    ])
  })

  it.each(['', ' ', '　'])(
    'returns no suggestions for blank query %j',
    (query) => {
      expect(findMemberSuggestions(members, query, [])).toEqual([])
    },
  )

  it('trims only the ends and does not normalize spelling or internal spaces', () => {
    expect(findMemberSuggestions(members, ' 田中 ', [])).toEqual([
      members[0],
      members[3],
    ])
    expect(findMemberSuggestions(members, '田中花', [])).toEqual([])
    expect(findMemberSuggestions(members, 'たなか', [])).toEqual([])
  })

  it('excludes selected IDs without mutating the roster', () => {
    const original = [...members]
    expect(findMemberSuggestions(members, '田中', ['1'])).toEqual([members[3]])
    expect(members).toEqual(original)
  })
})
