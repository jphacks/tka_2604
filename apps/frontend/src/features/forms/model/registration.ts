import type {
  CreateFormBandInput,
  FormRoster,
  SavedFormBand,
} from '../repositories/types'

export type RegistrationMode = 'create' | 'update'
export interface MemberRow {
  key: string
  kind: 'new' | 'existing'
  value: string
}
export interface RegistrationDraft {
  bandId: string
  bandName: string
  rows: MemberRow[]
}
export function newMemberRow(kind: MemberRow['kind'] = 'new'): MemberRow {
  return { key: crypto.randomUUID(), kind, value: '' }
}
export function emptyRegistration(): RegistrationDraft {
  return { bandId: '', bandName: '', rows: [newMemberRow()] }
}
export function selectBand(
  roster: FormRoster,
  bandId: string,
): RegistrationDraft {
  return {
    bandId,
    bandName:
      roster.bands.find((band) => band.bandId === bandId)?.bandName ?? '',
    rows: roster.memberships
      .filter((item) => item.bandId === bandId)
      .map((item) => ({
        key: crypto.randomUUID(),
        kind: 'existing',
        value: item.memberId,
      })),
  }
}
export function memberOptionLabel(roster: FormRoster, memberId: string) {
  const member = roster.members.find((item) => item.memberId === memberId)
  const bands = roster.bands
    .filter((band) =>
      roster.memberships.some(
        (item) => item.bandId === band.bandId && item.memberId === memberId,
      ),
    )
    .map((band) => band.bandName)
  const sameName =
    roster.members.filter((item) => item.memberName === member?.memberName)
      .length > 1
  const identifier = sameName ? ` / ID: ${memberId.slice(-8)}` : ''
  return `${member?.memberName ?? '不明なメンバー'}（${bands.join('・') || '所属なし'}${identifier}）`
}
export function registrationInput(
  mode: RegistrationMode,
  draft: RegistrationDraft,
  roster: FormRoster,
): CreateFormBandInput {
  if (
    mode === 'update' &&
    !roster.bands.some((band) => band.bandId === draft.bandId)
  )
    throw new Error('更新するバンドを選んでください。')
  const bandName = draft.bandName.trim()
  if (!bandName || bandName.length > 80)
    throw new Error('バンド名を1〜80文字で入力してください。')
  if (draft.rows.length < (mode === 'create' ? 1 : 0) || draft.rows.length > 20)
    throw new Error(
      mode === 'create'
        ? 'メンバーを1〜20人で登録してください。'
        : 'メンバーは20人まで登録できます。',
    )
  const memberIds: string[] = []
  const newMembers: { memberName: string }[] = []
  for (const row of draft.rows) {
    if (row.kind === 'new') {
      const memberName = row.value.trim()
      if (!memberName || memberName.length > 40)
        throw new Error(
          '新しいメンバーの名前を1〜40文字で入力してください。空の行は削除してください。',
        )
      newMembers.push({ memberName })
    } else {
      if (!roster.members.some((member) => member.memberId === row.value))
        throw new Error('登録済みのメンバーを選んでください。')
      if (memberIds.includes(row.value))
        throw new Error('同じメンバーが重複しています。')
      memberIds.push(row.value)
    }
  }
  return {
    expectedUpdatedAt: roster.updatedAt,
    bandName,
    memberIds,
    newMembers,
  }
}
export function applySavedBand(
  roster: FormRoster,
  saved: SavedFormBand,
): FormRoster {
  return {
    ...roster,
    updatedAt: saved.updatedAt,
    bands: [
      ...roster.bands.filter((band) => band.bandId !== saved.band.bandId),
      {
        bandId: saved.band.bandId,
        bandName: saved.band.bandName,
        description: saved.band.description,
      },
    ],
    members: [
      ...roster.members.filter(
        (member) =>
          !saved.members.some((item) => item.memberId === member.memberId),
      ),
      ...saved.members,
    ],
    memberships: [
      ...roster.memberships.filter((item) => item.bandId !== saved.band.bandId),
      ...saved.band.memberIds.map((memberId) => ({
        bandId: saved.band.bandId,
        memberId,
      })),
    ],
  }
}
