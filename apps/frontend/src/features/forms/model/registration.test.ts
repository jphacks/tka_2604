import { describe, expect, it } from 'vitest'

import type { FormRoster } from '../repositories/types'
import {
  applySavedBand,
  memberOptionLabel,
  registrationInput,
} from './registration'

const roster: FormRoster = {
  eventId: 'e',
  eventTitle: 'E',
  updatedAt: 'read',
  bands: [
    { bandId: 'a', bandName: 'A' },
    { bandId: 'b', bandName: 'B' },
  ],
  members: [
    { memberId: '1', memberName: '田中' },
    { memberId: '2', memberName: '田中' },
  ],
  memberships: [
    { bandId: 'a', memberId: '1' },
    { bandId: 'b', memberId: '1' },
  ],
}
describe('registration input and roster', () => {
  it('keeps same-name people separate and validates 20/21 people, blank rows and duplicate IDs', () => {
    const draft = {
      bandId: '',
      bandName: 'A',
      rows: Array.from({ length: 20 }, (_, i) => ({
        key: `${i}`,
        kind: 'new' as const,
        value: '田中',
      })),
    }
    expect(registrationInput('create', draft, roster).newMembers).toHaveLength(
      20,
    )
    expect(() =>
      registrationInput(
        'create',
        { ...draft, rows: [...draft.rows, draft.rows[0]] },
        roster,
      ),
    ).toThrow('1〜20人')
    expect(() =>
      registrationInput(
        'create',
        { ...draft, rows: [{ ...draft.rows[0], value: ' ' }] },
        roster,
      ),
    ).toThrow('空の行')
    expect(() =>
      registrationInput(
        'create',
        {
          ...draft,
          rows: [1, 2].map((i) => ({
            key: `${i}`,
            kind: 'existing',
            value: '1',
          })),
        },
        roster,
      ),
    ).toThrow('重複')
  })
  it('retains unlinked people and other bands after clearing a band', () => {
    const next = applySavedBand(roster, {
      eventId: 'e',
      updatedAt: 'saved',
      band: { bandId: 'a', bandName: 'A更新', memberIds: [] },
      members: [],
    })
    expect(next.members).toEqual(roster.members)
    expect(next.memberships).toEqual([{ bandId: 'b', memberId: '1' }])
    expect(next.updatedAt).toBe('saved')
    expect(memberOptionLabel(next, '1')).toBe('田中（B / ID: 1）')
    expect(memberOptionLabel(next, '2')).toBe('田中（所属なし / ID: 2）')
  })
})
