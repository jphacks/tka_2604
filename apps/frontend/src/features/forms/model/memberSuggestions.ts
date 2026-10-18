import type { FormRoster } from '../repositories/types'

export function findMemberSuggestions(
  members: FormRoster['members'],
  query: string,
  excludedIds: readonly string[],
) {
  const search = query.trim()
  if (!search) return []
  const excluded = new Set(excludedIds)
  return members.filter(
    (member) =>
      !excluded.has(member.memberId) && member.memberName.includes(search),
  )
}
