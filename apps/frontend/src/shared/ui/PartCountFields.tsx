import { useState } from 'react'

import { Input } from './Input'

export function PartCountFields({
  counts,
  onChange,
}: {
  counts: number[]
  onChange: (counts: number[]) => void
}) {
  const [partCount, setPartCount] = useState<string | null>(null)
  return (
    <div className="space-y-3">
      <label className="block text-xs font-medium">
        部数
        <Input
          type="number"
          required
          min={1}
          max={8}
          step={1}
          aria-label="部数"
          value={partCount ?? counts.length}
          onChange={(event) => {
            const text = event.target.value
            setPartCount(text)
            const count = Number(text)
            if (Number.isInteger(count) && count >= 1 && count <= 8)
              onChange(
                Array.from({ length: count }, (_, index) => counts[index] ?? 4),
              )
          }}
          className="mt-2 w-full"
        />
      </label>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {counts.map((count, index) => (
          <label key={index} className="block text-xs font-medium">
            第{index + 1}部のバンド数
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
