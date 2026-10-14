import type { ReactNode } from 'react'
import { useEffect, useId, useRef } from 'react'

import { Button } from './Button'
import { Icon } from './Icon'

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
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={(event) => {
        event.preventDefault()
        onClose()
      }}
      aria-labelledby={titleId}
      aria-modal="true"
      className="fixed inset-0 m-auto max-h-[90dvh] w-[560px] max-w-[calc(100vw-32px)] overflow-y-auto rounded-xl border border-line bg-white p-0 text-ink shadow-xl backdrop:bg-ink/25 backdrop:backdrop-blur-[2px]"
    >
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
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
