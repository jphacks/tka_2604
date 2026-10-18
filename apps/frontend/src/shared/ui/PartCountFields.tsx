import { useId, useState } from 'react'

import { Icon } from './Icon'
import { Input } from './Input'

const MAX_PARTS = 8

export function PartCountFields({
  counts,
  onChange,
}: {
  counts: number[]
  onChange: (counts: number[]) => void
}) {
  const [partCount, setPartCount] = useState<string | null>(null)
  const inputId = useId()
  const resize = (count: number) =>
    onChange(Array.from({ length: count }, (_, index) => counts[index] ?? 4))
  const step = (delta: number) => {
    const count = counts.length + delta
    if (count < 1 || count > MAX_PARTS) return
    setPartCount(null)
    resize(count)
  }
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="text-xs font-medium">
          <label htmlFor={inputId}>部数</label>
          <div className="relative mt-2">
            <Input
              type="number"
              required
              min={1}
              max={MAX_PARTS}
              step={1}
              id={inputId}
              aria-label="部数"
              value={partCount ?? counts.length}
              onChange={(event) => {
                const text = event.target.value
                setPartCount(text)
                const count = Number(text)
                if (Number.isInteger(count) && count >= 1 && count <= MAX_PARTS)
                  resize(count)
              }}
              className="w-full pr-8"
            />
            <div className="absolute inset-y-px right-px flex w-6 flex-col overflow-hidden rounded-r-md border-l border-[#cbd9ed]">
              <StepButton
                label="部数を増やす"
                direction="up"
                disabled={counts.length >= MAX_PARTS}
                onClick={() => step(1)}
              />
              <StepButton
                label="部数を減らす"
                direction="down"
                disabled={counts.length <= 1}
                onClick={() => step(-1)}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map((count, index) => (
          <label key={index} className="block text-xs font-medium">
            第{index + 1}部の組数
            <Input
              type="number"
              required
              min={1}
              max={20}
              step={1}
              aria-label={`第${index + 1}部の組数`}
              value={count || ''}
              onChange={(event) =>
                onChange(
                  counts.map((current, i) =>
                    i === index ? Number(event.target.value) : current,
                  ),
                )
              }
              className="mt-2 w-full"
            />
          </label>
        ))}
      </div>
    </div>
  )
}

function StepButton({
  label,
  direction,
  disabled,
  onClick,
}: {
  label: string
  direction: 'up' | 'down'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className="flex flex-1 items-center justify-center bg-white text-muted transition-colors not-last:border-b not-last:border-[#cbd9ed] hover:bg-wash hover:text-brand disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white"
    >
      <Icon
        name="chevron"
        className={`size-3 ${direction === 'up' ? '-rotate-90' : 'rotate-90'}`}
      />
    </button>
  )
}
