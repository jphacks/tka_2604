import { describe, expect, it } from 'vitest'

import type { FormRoster } from '../repositories/types'
import {
  applySavedBand,
  emptyRegistration,
  memberOptionLabel,
  registrationInput,
  selectBand,
} from './registration'

const roster: FormRoster = {
  eventId: 'e',
  eventTitle: 'E',
  updatedAt: 'read',
  bands: [
    { bandId: 'a', bandName: 'A', description: null },
    { bandId: 'b', bandName: 'B', description: null },
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
      description: '',
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
  it('sends descriptions, normalizes blanks, and enforces the API length limit', () => {
    const draft = {
      ...selectBand(roster, 'a'),
      description: '  ロック\n盛り上がる曲  ',
    }
    expect(registrationInput('update', draft, roster).description).toBe(
      'ロック\n盛り上がる曲',
    )
    expect(
      registrationInput('update', { ...draft, description: '  ' }, roster)
        .description,
    ).toBeNull()
    expect(
      registrationInput(
        'update',
        { ...draft, description: 'あ'.repeat(500) },
        roster,
      ).description,
    ).toHaveLength(500)
    expect(() =>
      registrationInput(
        'update',
        { ...draft, description: 'あ'.repeat(501) },
        roster,
      ),
    ).toThrow('500文字')
  })
  it('restores the selected description and starts new registrations blank', () => {
    const data = {
      ...roster,
      bands: [{ ...roster.bands[0], description: 'ジャズ' }, roster.bands[1]],
    }
    expect(selectBand(data, 'a').description).toBe('ジャズ')
    expect(selectBand(data, 'b').description).toBe('')
    expect(emptyRegistration().description).toBe('')
  })
  it('retains unlinked people and other bands after clearing a band', () => {
    const next = applySavedBand(roster, {
      eventId: 'e',
      updatedAt: 'saved',
      band: {
        bandId: 'a',
        bandName: 'A更新',
        description: 'メタル',
        memberIds: [],
      },
      members: [],
    })
    expect(next.members).toEqual(roster.members)
    expect(next.memberships).toEqual([{ bandId: 'b', memberId: '1' }])
    expect(next.bands.find((band) => band.bandId === 'a')?.description).toBe(
      'メタル',
    )
    expect(next.updatedAt).toBe('saved')
    expect(memberOptionLabel(next, '1')).toBe('田中（B / ID: 1）')
    expect(memberOptionLabel(next, '2')).toBe('田中（所属なし / ID: 2）')
  })
})
