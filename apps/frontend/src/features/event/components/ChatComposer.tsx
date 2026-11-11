import { useLayoutEffect, useRef, useState } from 'react'

export function ChatComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  active,
}: {
  value: string
  onChange: (value: string) => void
  onSubmit: () => void
  disabled: boolean
  active: boolean
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const [focused, setFocused] = useState(false)
  useLayoutEffect(() => {
    const field = ref.current
    if (!field) return
    function resize() {
      if (!field) return
      field.style.height = '48px'
      if (focused)
        field.style.height = `${Math.min(144, Math.max(48, field.scrollHeight))}px`
    }
    resize()
    let width = field.clientWidth
    if (typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => {
      if (field.clientWidth !== width) {
        width = field.clientWidth
        resize()
      }
    })
    observer.observe(field)
    return () => observer.disconnect()
  }, [value, focused, active])
  return (
    <textarea
      ref={ref}
      aria-label="AIへのメッセージ"
      placeholder="要望や調整したいことを入力…"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      disabled={disabled}
      maxLength={1000}
      rows={2}
      wrap="soft"
      onKeyDown={(event) => {
        if (
          event.key === 'Enter' &&
          (event.ctrlKey || event.metaKey) &&
          !event.nativeEvent.isComposing
        ) {
          event.preventDefault()
          onSubmit()
        }
      }}
      className="block w-full min-w-0 resize-none overflow-y-auto bg-transparent p-0 text-[13px] leading-6 break-all placeholder:text-muted focus-visible:ring-0 disabled:opacity-60"
    />
  )
}
