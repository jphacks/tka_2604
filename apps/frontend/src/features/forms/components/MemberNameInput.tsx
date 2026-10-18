import {
  type FocusEvent,
  type KeyboardEvent,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react'

import { Input } from '../../../shared/ui/Input'
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
  const listId = useId()
  const wrapper = useRef<HTMLDivElement>(null)
  const composing = useRef(false)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
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
  const visible = suggestions
  const activeIndex = visible.findIndex(
    (member) => member.memberId === activeId,
  )
  const active = visible[activeIndex]

  function choose(memberId: string, fromKeyboard = false) {
    if (
      disabled ||
      excludedIds.includes(memberId) ||
      !roster.members.some((member) => member.memberId === memberId)
    )
      return
    onSelect(memberId, fromKeyboard)
    setOpen(false)
    setActiveId(null)
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (
      event.key === 'Enter' &&
      (composing.current ||
        event.nativeEvent.isComposing ||
        event.nativeEvent.keyCode === 229)
    )
      return
    if (event.key === 'ArrowDown' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveId(
        visible[Math.min(activeIndex + 1, visible.length - 1)].memberId,
      )
    } else if (event.key === 'ArrowUp' && suggestions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveId(
        visible[
          Math.max(activeIndex < 0 ? visible.length - 1 : activeIndex - 1, 0)
        ].memberId,
      )
    } else if (event.key === 'Enter' && open) {
      event.preventDefault()
      if (active) choose(active.memberId, true)
      else setOpen(false)
    } else if (event.key === 'Escape' && open) {
      event.preventDefault()
      setOpen(false)
      setActiveId(null)
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    if (
      event.relatedTarget instanceof Node &&
      event.currentTarget.contains(event.relatedTarget)
    )
      return
    setOpen(false)
    setActiveId(null)
  }

  const descriptionId = `${listId}-description`
  const listVisible = open && !disabled
  return (
    <div ref={wrapper} onBlur={handleBlur}>
      <div className="relative">
        <Input
          role="combobox"
          aria-label={label}
          aria-autocomplete="list"
          aria-controls={listId}
          aria-expanded={listVisible}
          aria-activedescendant={
            listVisible && active ? `${listId}-${active.memberId}` : undefined
          }
          aria-describedby={descriptionId}
          value={inputValue}
          onChange={(event) => {
            onValueChange(event.target.value)
            setActiveId(null)
            setOpen(true)
          }}
          onFocus={() => {
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
          onCompositionStart={() => {
            composing.current = true
          }}
          onCompositionEnd={() => {
            composing.current = false
          }}
          maxLength={40}
          placeholder="名前を入力"
          className="h-10 w-full text-sm"
          autoComplete="off"
          disabled={disabled}
        />
        <div
          hidden={!listVisible}
          className="absolute inset-x-0 top-full z-30 mt-1.5"
        >
          <ul
            id={listId}
            role="listbox"
            aria-label={`${label}の候補`}
            className="max-h-60 overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-[0_4px_16px_rgba(15,23,42,0.18)] ring-1 ring-black/5"
          >
            {suggestions.length === 0 ? (
              <li className="px-3 py-2 text-xs text-muted">
                一致する登録済みメンバーはいません。この名前で新しく登録できます。
              </li>
            ) : (
              visible.map((member) => (
                <li
                  id={`${listId}-${member.memberId}`}
                  key={member.memberId}
                  role="option"
                  aria-selected={activeId === member.memberId}
                  className={`min-h-10 cursor-pointer px-3 py-2 text-sm ${activeId === member.memberId ? 'bg-blue-50 text-blue-900' : 'text-ink hover:bg-slate-50'}`}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(member.memberId)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      choose(member.memberId, true)
                    }
                  }}
                >
                  {memberOptionLabel(roster, member.memberId)}
                </li>
              ))
            )}
          </ul>
        </div>
      </div>
      <p id={descriptionId} className="mt-2 text-xs leading-5 text-muted">
        候補を選ばず送信すると、新しいメンバーとして登録します。
      </p>
    </div>
  )
}
