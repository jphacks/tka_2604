import type { PointerEvent as ReactPointerEvent } from 'react'
import { useEffect, useState } from 'react'

export type ColumnWidths = { constraints: number; chat: number }
export type ColumnHandle = keyof ColumnWidths

const MIN_SIDE = 240
const MIN_SCHEDULE = 480
const STORAGE_KEY = 'setly:event-columns'
export const defaultColumnWidths: ColumnWidths = { constraints: 300, chat: 320 }

const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), Math.max(min, max))

/**
 * deltaは境界の移動量（右が正）。constraintsの境界は出演順と制約の間で、
 * 出演順の幅が増減を吸収する。chatの境界は制約とAIチャットの間で、2列の合計幅を保つ。
 */
export function resizeColumns(
  widths: ColumnWidths,
  handle: ColumnHandle,
  delta: number,
  containerWidth: number,
): ColumnWidths {
  if (handle === 'constraints')
    return {
      ...widths,
      constraints: clamp(
        widths.constraints - delta,
        MIN_SIDE,
        containerWidth - MIN_SCHEDULE - widths.chat,
      ),
    }
  const total = widths.constraints + widths.chat
  const chat = clamp(widths.chat - delta, MIN_SIDE, total - MIN_SIDE)
  return { constraints: total - chat, chat }
}

function loadWidths(): ColumnWidths {
  try {
    const saved = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? 'null',
    ) as Partial<Record<ColumnHandle, unknown>> | null
    if (
      typeof saved?.constraints === 'number' &&
      typeof saved.chat === 'number'
    )
      return {
        constraints: Math.max(saved.constraints, MIN_SIDE),
        chat: Math.max(saved.chat, MIN_SIDE),
      }
  } catch {
    // 保存値が読めなくても既定幅で表示する
  }
  return defaultColumnWidths
}

/** つまみは3列のgridの直下に置くので、親要素の幅を列全体の幅として使う */
const containerWidthOf = (handle: HTMLElement) =>
  handle.parentElement?.clientWidth ?? Infinity

export function useColumnResize() {
  const [widths, setWidths] = useState(loadWidths)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (dragging) return
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
    } catch {
      // 保存できなくても操作は続けられる
    }
  }, [widths, dragging])

  const resize = (handle: ColumnHandle, delta: number, element: HTMLElement) =>
    setWidths((current) =>
      resizeColumns(current, handle, delta, containerWidthOf(element)),
    )

  const startDrag =
    (handle: ColumnHandle) => (event: ReactPointerEvent<HTMLElement>) => {
      if (event.button !== 0) return
      event.preventDefault()
      const startX = event.clientX
      const start = widths
      const containerWidth = containerWidthOf(event.currentTarget)
      const { body } = document
      const previous = {
        cursor: body.style.cursor,
        select: body.style.userSelect,
      }
      body.style.cursor = 'col-resize'
      body.style.userSelect = 'none'
      setDragging(true)
      const move = (moveEvent: PointerEvent) =>
        setWidths(
          resizeColumns(
            start,
            handle,
            moveEvent.clientX - startX,
            containerWidth,
          ),
        )
      const end = () => {
        body.style.cursor = previous.cursor
        body.style.userSelect = previous.select
        setDragging(false)
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', end)
        window.removeEventListener('pointercancel', end)
      }
      window.addEventListener('pointermove', move)
      window.addEventListener('pointerup', end)
      window.addEventListener('pointercancel', end)
    }

  return {
    widths,
    dragging,
    resize,
    startDrag,
    reset: () => setWidths(defaultColumnWidths),
  }
}
