import { useState } from 'react'

import type { EventData } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Input, Select } from '../../../shared/ui/Input'

export function BandSelect({
  event,
  value,
  label,
  onChange,
}: {
  event: EventData
  value: string
  label: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <Select
        className="block h-10 w-full"
        value={value}
        onChange={(change) => onChange(change.target.value)}
      >
        <option value="">出演枠を選んでください</option>
        {event.performances.map((band) => (
          <option key={band.id} value={band.id}>
            {band.name}
          </option>
        ))}
      </Select>
    </label>
  )
}

export function BandPicker({
  event,
  selected,
  onChange,
}: {
  event: EventData
  selected: string[]
  onChange: (ids: string[]) => void
}) {
  const [query, setQuery] = useState('')
  const bands = event.performances.filter((band) =>
    band.name.toLowerCase().includes(query.trim().toLowerCase()),
  )
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">
        対象の出演枠{' '}
        <span className="text-xs font-normal text-muted">
          {selected.length}組選択中
        </span>
      </legend>
      <Input
        aria-label="対象の出演枠を検索"
        className="mb-2 w-full"
        value={query}
        onChange={(change) => setQuery(change.target.value)}
        placeholder="出演名で検索"
      />
      <div className="mb-2 flex flex-wrap gap-2">
        <Button
          className="text-xs"
          onClick={() => onChange(event.performances.map((band) => band.id))}
        >
          すべての出演枠を選ぶ
        </Button>
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => onChange([])}
        >
          選択を解除
        </Button>
      </div>
      <div className="max-h-40 space-y-1 overflow-y-auto">
        {bands.map((band) => (
          <label
            key={band.id}
            className="flex min-h-9 items-center gap-2 rounded px-2 text-sm hover:bg-wash"
          >
            <input
              type="checkbox"
              checked={selected.includes(band.id)}
              onChange={(change) =>
                onChange(
                  change.target.checked
                    ? [...selected, band.id]
                    : selected.filter((id) => id !== band.id),
                )
              }
            />
            {band.name}
          </label>
        ))}
      </div>
      {!bands.length && (
        <p className="py-3 text-sm text-muted">
          {event.performances.length
            ? '一致する出演枠がありません。'
            : '先に出演枠を登録してください。'}
        </p>
      )}
    </fieldset>
  )
}

export function PartPicker({
  event,
  selected,
  onChange,
}: {
  event: EventData
  selected: number[]
  onChange: (ids: number[]) => void
}) {
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">対象の部</legend>
      <div className="flex flex-wrap gap-4">
        {event.sections.map((section, index) => (
          <label
            key={section.id}
            className="flex min-h-9 items-center gap-2 text-sm"
          >
            <input
              type="checkbox"
              checked={selected.includes(index)}
              onChange={(change) =>
                onChange(
                  change.target.checked
                    ? [...selected, index].sort((a, b) => a - b)
                    : selected.filter((part) => part !== index),
                )
              }
            />
            第{index + 1}部
          </label>
        ))}
      </div>
    </fieldset>
  )
}
