import { useMemo } from 'react'

import { AutoComplete } from '../../../shared/ui/AutoComplete'
import { findMemberSuggestions } from '../model/memberSuggestions'
import { memberOptionLabel } from '../model/registration'
import type { FormRoster } from '../repositories/types'

interface MemberNameInputProps {
  roster: FormRoster
  value: string
  label: string
  excludedIds: readonly string[]
  disabled: boolean
  onValueChange: (value: string) => void
  onSelect: (memberId: string, fromKeyboard?: boolean) => void
}

export function MemberNameInput({
  roster,
  value,
  label,
  excludedIds,
  disabled,
  onValueChange,
  onSelect,
}: MemberNameInputProps) {
  const selectedMember = roster.members.find(
    (member) => member.memberId === value,
  )
  const inputValue = selectedMember
    ? memberOptionLabel(roster, selectedMember.memberId)
    : value
  const suggestions = useMemo(() => {
    const query = selectedMember ? '' : value
    if (!query.trim()) {
      const excluded = new Set(excludedIds)
      return roster.members.filter((member) => !excluded.has(member.memberId))
    }
    return findMemberSuggestions(roster.members, query, excludedIds)
  }, [roster.members, selectedMember, value, excludedIds])
  return (
    <AutoComplete
      allowCustomValue
      value={inputValue}
      selectedLabel={selectedMember ? inputValue : undefined}
      label={label}
      options={suggestions.map((member) => ({
        value: member.memberId,
        label: memberOptionLabel(roster, member.memberId),
      }))}
      disabled={disabled}
      maxLength={40}
      placeholder="名前を入力"
      description="候補を選択するか、新しい名前をEnterで確定してください。保存すると登録されます。"
      emptyMessage="一致する登録済みメンバーはいません。この名前で新しく登録できます。"
      onValueChange={onValueChange}
      onSelect={onSelect}
    />
  )
}
