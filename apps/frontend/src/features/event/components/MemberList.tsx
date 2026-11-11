import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

export function MemberList({ names }: { names: string[] }) {
  const tooltipId = useId()
  const [target, setTarget] = useState<HTMLElement | null>(null)
  const hideTimer = useRef<number | undefined>(undefined)
  const [position, setPosition] = useState<{
    left: number
    width: number
    arrowLeft: number
    top?: number
    bottom?: number
  } | null>(null)
  useEffect(() => {
    if (!target) return
    const timer = window.setTimeout(() => {
      if (target.scrollWidth <= target.clientWidth) return
      const rect = target.getBoundingClientRect()
      const width = Math.min(
        360,
        target.scrollWidth + 18,
        window.innerWidth - 16,
      )
      const center = rect.left + rect.width / 2
      const left = Math.max(
        8,
        Math.min(center - width / 2, window.innerWidth - width - 8),
      )
      setPosition({
        left,
        width,
        arrowLeft: Math.max(10, Math.min(center - left, width - 10)),
        ...(rect.bottom > window.innerHeight / 2
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
      })
    }, 500)
    const close = () => {
      window.clearTimeout(hideTimer.current)
      setTarget(null)
      setPosition(null)
    }
    const dismiss = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', dismiss)
    return () => {
      window.clearTimeout(timer)
      window.clearTimeout(hideTimer.current)
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', dismiss)
    }
  }, [target])
  function keepOpen() {
    window.clearTimeout(hideTimer.current)
  }
  function leave() {
    keepOpen()
    if (!position) {
      setTarget(null)
      return
    }
    hideTimer.current = window.setTimeout(() => {
      setTarget(null)
      setPosition(null)
    }, 150)
  }
  if (!names.length) return <span className="text-xs text-muted">登録なし</span>
  const memberNames = names.join('・')
  return (
    <>
      <span
        aria-describedby={position ? tooltipId : undefined}
        onPointerEnter={(event) => {
          keepOpen()
          const element = event.currentTarget
          if (element.scrollWidth > element.clientWidth) setTarget(element)
        }}
        onPointerLeave={leave}
        className="min-w-0 truncate text-[13px] leading-4 text-ink"
      >
        {memberNames}
      </span>
      {position &&
        createPortal(
          <div
            id={tooltipId}
            role="tooltip"
            style={{
              left: position.left,
              width: position.width,
              top: position.top,
              bottom: position.bottom,
            }}
            onPointerEnter={keepOpen}
            onPointerLeave={leave}
            className="fixed z-50 cursor-text rounded border border-black/20 bg-[#303030] px-2 py-1 text-xs leading-5 break-all whitespace-normal text-white shadow-sm select-text"
          >
            <span
              aria-hidden="true"
              style={{ left: position.arrowLeft }}
              className={`absolute -translate-x-1/2 border-x-[5px] border-x-transparent ${position.bottom !== undefined ? 'top-full border-t-[5px] border-t-[#303030]' : 'bottom-full border-b-[5px] border-b-[#303030]'}`}
            />
            {memberNames}
          </div>,
          document.body,
        )}
    </>
  )
}
