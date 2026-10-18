import { useState } from 'react'

export function useNumberField(
  value: number | null,
  onCommit: (value: number | null) => void,
  min: number,
  max: number,
  allowEmpty = false,
) {
  const [draft, setDraft] = useState<string | null>(null)
  const [invalid, setInvalid] = useState(false)
  function commit() {
    if (draft === null) return
    if (allowEmpty && draft.trim() === '') {
      onCommit(null)
      setDraft(null)
      setInvalid(false)
      return
    }
    const number = Number(draft)
    if (
      !draft.trim() ||
      !Number.isInteger(number) ||
      number < min ||
      number > max
    ) {
      setInvalid(true)
      return
    }
    onCommit(number)
    setDraft(null)
    setInvalid(false)
  }
  function cancel() {
    setDraft(null)
    setInvalid(false)
  }
  return {
    value: draft ?? (value === null ? '' : String(value)),
    invalid,
    commit,
    cancel,
    change: (text: string) => {
      setDraft(text)
      setInvalid(false)
    },
    errorMessage: `${min}〜${max}の整数${allowEmpty ? '／空欄可' : ''}`,
  }
}
