import type { EventData } from '../../../shared/model/event'
import { AutoComplete } from '../../../shared/ui/AutoComplete'
import { Button } from '../../../shared/ui/Button'

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
    <div className="space-y-2 text-sm font-medium">
      <p>{label}</p>
      <AutoComplete
        label={label}
        value={value}
        allowCustomValue={false}
        options={event.performances.map((band) => ({
          value: band.id,
          label: band.name,
        }))}
        placeholder="出演名で検索"
        onValueChange={onChange}
        onSelect={onChange}
      />
    </div>
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
  return (
    <fieldset className="rounded-lg border border-line p-3">
      <legend className="px-1 text-sm font-medium">
        対象の出演枠{' '}
        <span className="text-xs font-normal text-muted">
          {selected.length}組選択中
        </span>
      </legend>
      <AutoComplete
        label="対象の出演枠を検索"
        multiple={{
          selected: selected.map((id) => ({
            value: id,
            label:
              event.performances.find((band) => band.id === id)?.name ??
              '不明な出演枠',
          })),
          onRemove: (id) => onChange(selected.filter((value) => value !== id)),
        }}
        value=""
        allowCustomValue={false}
        options={event.performances
          .filter((band) => !selected.includes(band.id))
          .map((band) => ({ value: band.id, label: band.name }))}
        placeholder="出演名で検索して追加"
        onValueChange={() => {}}
        onSelect={(id) => onChange([...selected, id])}
      />
      <div className="mt-2 flex flex-wrap gap-2">
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
