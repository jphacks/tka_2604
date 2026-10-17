import { useId } from 'react'

import { useNumberField } from '../hooks/useNumberField'
import { Input } from './Input'

export function NumberField({
  value,
  onCommit,
  label,
  min = 1,
  max,
  allowEmpty,
  disabled,
  className = '',
}: {
  value: number | null
  onCommit: (value: number | null) => void
  label: string
  min?: number
  max: number
  allowEmpty?: boolean
  disabled?: boolean
  className?: string
}) {
  const field = useNumberField(value, onCommit, min, max, allowEmpty)
  const errorId = useId()
  return (
    <span className="relative inline-flex">
      <Input
        type="text"
        inputMode="numeric"
        aria-label={label}
        aria-invalid={field.invalid}
        aria-describedby={field.invalid ? errorId : undefined}
        value={field.value}
        onChange={(event) => field.change(event.target.value)}
        onBlur={field.commit}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            field.commit()
          }
          if (event.key === 'Escape') field.cancel()
        }}
        disabled={disabled}
        placeholder="—"
        title={field.invalid ? field.errorMessage : undefined}
        className={`h-[29px] w-11 px-1 text-center tabular-nums ${field.invalid ? 'border-red-400 bg-red-50' : ''} ${className}`}
      />
      {field.invalid && (
        <span
          id={errorId}
          role="alert"
          className="absolute top-full left-0 z-20 mt-1 w-max max-w-48 rounded border border-red-200 bg-white px-2 py-1 text-xs text-red-600 shadow-sm"
        >
          {field.errorMessage}
        </span>
      )}
    </span>
  )
}
