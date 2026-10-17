import type { PointerEvent, ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'

import { Button } from './Button'
import { Icon } from './Icon'

function isBackdrop(event: PointerEvent<HTMLDialogElement>) {
  if (event.target !== event.currentTarget) return false
  const rect = event.currentTarget.getBoundingClientRect()
  return (
    event.clientX < rect.left ||
    event.clientX > rect.right ||
    event.clientY < rect.top ||
    event.clientY > rect.bottom
  )
}

export function Dialog({
  title,
  children,
  onClose,
}: {
  title: string
  children: ReactNode
  onClose: () => void
}) {
  const titleId = useId()
  const ref = useRef<HTMLDialogElement>(null)
  const backdropPointer = useRef<number | null>(null)
  useEffect(() => {
    const opener = document.activeElement
    const dialog = ref.current
    dialog?.showModal()
    return () => {
      dialog?.close()
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus()
    }
  }, [])
  return (
    <dialog
      ref={ref}
      onPointerDown={(event) => {
        backdropPointer.current =
          event.button === 0 && isBackdrop(event) ? event.pointerId : null
      }}
      onPointerUp={(event) => {
        const dismiss =
          backdropPointer.current === event.pointerId && isBackdrop(event)
        backdropPointer.current = null
        if (dismiss) onClose()
      }}
      onPointerCancel={() => {
        backdropPointer.current = null
      }}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[560px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/25 backdrop:backdrop-blur-[2px]"
    >
      <div className="sticky top-0 z-20 flex items-center justify-between border-b border-line bg-white px-5 py-4">
        <h2 id={titleId} className="font-semibold">
          {title}
        </h2>
        <Button
          variant="ghost"
          className="px-1.5"
          aria-label="閉じる"
          onClick={onClose}
        >
          <Icon name="close" />
        </Button>
      </div>
      <div className="p-5">{children}</div>
    </dialog>
  )
}
