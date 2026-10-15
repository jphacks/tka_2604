import { useState } from 'react'

import { type EventData, memberLabel } from '../model/event'
import { Input } from './Input'

export function MemberPicker({
  event,
  selected,
  onChange,
}: {
  event: EventData
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const members = event.members.filter((member) =>
    memberLabel(event, member)
      .toLowerCase()
      .includes(query.trim().toLowerCase()),
  )
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-xs font-medium">
        登録済みのメンバーから選ぶ（{selected.length}名選択中）
      </legend>
      {event.members.length > 0 ? (
        <>
          <Input
            aria-label="登録済みのメンバーを検索"
            value={query}
            onChange={(change) => setQuery(change.target.value)}
            placeholder="名前・出演名で検索"
            className="mb-2 w-full text-xs"
          />
          <div className="max-h-40 space-y-1 overflow-y-auto">
            {members.map((member) => (
              <label
                key={member.id}
                className="flex min-h-9 items-start gap-2 rounded p-2 text-xs leading-6 hover:bg-wash"
              >
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(member.id)}
                  onChange={(change) =>
                    onChange(
                      change.target.checked
                        ? [...selected, member.id]
                        : selected.filter((id) => id !== member.id),
                    )
                  }
                />
                <span>{memberLabel(event, member)}</span>
              </label>
            ))}
            {!members.length && (
              <p className="p-2 text-xs text-muted">
                一致するメンバーがいません。
              </p>
            )}
          </div>
          {selected.length > 0 && (
            <p className="mt-2 text-xs leading-6 text-brand">
              選択中：
              {selected
                .map((id) => {
                  const member = event.members.find(
                    (member) => member.id === id,
                  )
                  return member
                    ? memberLabel(event, member).split('（')[0]
                    : '不明なメンバー'
                })
                .join('・')}
            </p>
          )}
        </>
      ) : (
        <p className="text-xs text-muted">
          登録済みのメンバーはいません。下の欄に入力してください。
        </p>
      )}
    </fieldset>
  )
}
