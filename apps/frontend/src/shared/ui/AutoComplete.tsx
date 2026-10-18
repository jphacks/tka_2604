import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useId,
  useRef,
  useState,
} from 'react'

import { Icon } from './Icon'
import { Input } from './Input'

export interface AutoCompleteOption {
  value: string
  label: string
}

interface AutoCompleteProps {
  value: string
  label: string
  multiple?: {
    selected: readonly AutoCompleteOption[]
    onRemove: (value: string) => void
  }
  selectedLabel?: string
  allowCustomValue?: boolean
  options: readonly AutoCompleteOption[]
  disabled?: boolean
  placeholder?: string
  maxLength?: number
  className?: string
  description?: ReactNode
  emptyMessage?: ReactNode
  onValueChange: (value: string) => void
  onSelect: (value: string, fromKeyboard: boolean) => void
}

// In selection-only mode, value is an option ID; search text never changes the selection.
// Custom input mode lets the caller manage search and the displayed value.
export function AutoComplete({
  value,
  label,
  options,
  selectedLabel,
  multiple,
  allowCustomValue = false,
  disabled = false,
  placeholder,
  maxLength,
  className = 'h-10 w-full text-sm',
  description,
  emptyMessage = '一致する候補がありません。',
  onValueChange,
  onSelect,
}: AutoCompleteProps) {
  const listId = useId()
  const composing = useRef(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const [query, setQuery] = useState('')
  const inputValue = allowCustomValue ? value : query
  const visibleOptions = allowCustomValue
    ? options
    : options.filter((option) =>
        option.label
          .toLocaleLowerCase()
          .includes(query.trim().toLocaleLowerCase()),
      )
  const [confirmedValue, setConfirmedValue] = useState<string | null>(null)
  const chipLabel =
    selectedLabel ??
    (!allowCustomValue
      ? options.find((option) => option.value === value)?.label
      : undefined) ??
    (allowCustomValue && confirmedValue === value ? value : undefined)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)
  const activeIndex = visibleOptions.findIndex(
    (option) => option.value === activeId,
  )
  const active = visibleOptions[activeIndex]

  function choose(value: string, fromKeyboard = false) {
    if (disabled || !options.some((option) => option.value === value)) return
    setConfirmedValue(options.find((option) => option.value === value)!.label)
    setQuery('')
    onSelect(value, fromKeyboard)
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
    if (event.key === 'ArrowDown' && visibleOptions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveId(
        visibleOptions[Math.min(activeIndex + 1, visibleOptions.length - 1)]
          .value,
      )
    } else if (event.key === 'ArrowUp' && visibleOptions.length) {
      event.preventDefault()
      setOpen(true)
      setActiveId(
        visibleOptions[
          Math.max(
            activeIndex < 0 ? visibleOptions.length - 1 : activeIndex - 1,
            0,
          )
        ].value,
      )
    } else if (event.key === 'Enter') {
      event.preventDefault()
      if (open && active) choose(active.value, true)
      else if (allowCustomValue && value.trim()) {
        const name = value.trim()
        setConfirmedValue(name)
        onValueChange(name)
        setOpen(false)
        setActiveId(null)
      }
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
  const listVisible = open && !disabled && !chipLabel
  return (
    <div onBlur={handleBlur}>
      <div className="relative">
        {chipLabel ? (
          <div
            className={`flex items-center rounded-md border border-[#cbd9ed] bg-white px-2.5 ${className}`}
          >
            <span className="inline-flex min-w-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-900">
              <span className="truncate">{chipLabel}</span>
              <button
                type="button"
                aria-label={`${label}の選択を解除`}
                disabled={disabled}
                className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
                onClick={() => {
                  setConfirmedValue(null)
                  setActiveId(null)
                  setOpen(false)
                  setQuery('')
                  onValueChange('')
                  requestAnimationFrame(() => inputRef.current?.focus())
                }}
              >
                <Icon name="close" />
              </button>
            </span>
          </div>
        ) : (
          <div
            className={
              multiple
                ? 'flex min-h-10 w-full flex-wrap items-center gap-2 rounded-md border border-[#cbd9ed] bg-white px-2.5 py-1.5 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/50 focus-within:ring-offset-2'
                : undefined
            }
          >
            {multiple?.selected.map((option) => (
              <span
                key={option.value}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full bg-blue-50 px-3 py-1 text-sm text-blue-900"
              >
                <span className="truncate">{option.label}</span>
                <button
                  type="button"
                  aria-label={`${option.label}の選択を解除`}
                  disabled={disabled}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full hover:bg-blue-100 focus-visible:outline-2 focus-visible:outline-brand disabled:opacity-50"
                  onClick={() => {
                    multiple.onRemove(option.value)
                    inputRef.current?.focus()
                  }}
                >
                  <Icon name="close" />
                </button>
              </span>
            ))}
            <Input
              ref={inputRef}
              role="combobox"
              aria-label={label}
              aria-autocomplete="list"
              aria-controls={listId}
              aria-expanded={listVisible}
              aria-activedescendant={
                listVisible && active ? `${listId}-${active.value}` : undefined
              }
              aria-describedby={description ? descriptionId : undefined}
              value={inputValue}
              onChange={(event) => {
                if (allowCustomValue) onValueChange(event.target.value)
                else setQuery(event.target.value)
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
              maxLength={maxLength}
              placeholder={placeholder}
              className={
                multiple
                  ? 'min-w-32 flex-1 border-0 bg-transparent text-sm focus:outline-none focus-visible:ring-0 focus-visible:ring-offset-0'
                  : className
              }
              autoComplete="off"
              disabled={disabled}
            />
          </div>
        )}
        {!chipLabel && (
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
              {visibleOptions.length === 0 ? (
                <li className="px-3 py-2 text-xs text-muted">{emptyMessage}</li>
              ) : (
                visibleOptions.map((option) => (
                  <li
                    id={`${listId}-${option.value}`}
                    key={option.value}
                    role="option"
                    aria-selected={activeId === option.value}
                    className={`min-h-10 cursor-pointer px-3 py-2 text-sm ${activeId === option.value ? 'bg-blue-50 text-blue-900' : 'text-ink hover:bg-slate-50'}`}
                    onPointerDown={(event) => event.preventDefault()}
                    onClick={() => choose(option.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault()
                        choose(option.value, true)
                      }
                    }}
                  >
                    {option.label}
                  </li>
                ))
              )}
            </ul>
          </div>
        )}
      </div>
      {description && (
        <p id={descriptionId} className="mt-2 text-xs leading-5 text-muted">
          {description}
        </p>
      )}
    </div>
  )
}
