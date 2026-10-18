import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
  KeyboardCoordinateGetter,
  UniqueIdentifier,
} from '@dnd-kit/core'
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { hasSortableData } from '@dnd-kit/sortable'
import { useRef, useState } from 'react'

const collisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args)
  // Prefer rows over the enclosing section to make drops precise.
  const rows = collisions.filter(
    ({ id }) => !String(id).startsWith('part-') && id !== 'unassigned',
  )
  return rows.length
    ? rows
    : collisions.length
      ? collisions
      : closestCenter(args)
}

export function useScheduleDnd(onMove: (id: string, overId: string) => void) {
  const [activeId, setActiveId] = useState<string | null>(null)
  const keyboardTarget = useRef<UniqueIdentifier | null>(null)
  const keyboardCoordinates: KeyboardCoordinateGetter = (
    event,
    { context },
  ) => {
    if (event.code !== 'ArrowDown' && event.code !== 'ArrowUp') return undefined
    event.preventDefault()
    const { active, over, droppableContainers, droppableRects } = context
    if (!active || !hasSortableData(active)) return undefined
    const items = active.data.current.sortable.items
    const current = items.indexOf(
      keyboardTarget.current ?? over?.id ?? active.id,
    )
    const direction = event.code === 'ArrowDown' ? 1 : -1
    for (
      let i = current + direction;
      i >= 0 && i < items.length;
      i += direction
    ) {
      const id = items[i]
      const container = droppableContainers.get(id)
      const rect = droppableRects.get(id)
      if (!container || container.disabled || !rect) continue
      keyboardTarget.current = id
      return { x: rect.left, y: rect.top }
    }
    return undefined
  }
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: keyboardCoordinates,
    }),
  )
  return {
    activeId,
    sensors,
    collisionDetection: ((args) => {
      // A transformed preview must not change the row selected with arrow keys.
      if (!args.pointerCoordinates && keyboardTarget.current !== null)
        return [{ id: keyboardTarget.current }]
      return collisionDetection(args)
    }) satisfies CollisionDetection,
    onDragStart: (event: DragStartEvent) => {
      keyboardTarget.current = null
      setActiveId(String(event.active.id))
    },
    onDragCancel: () => {
      keyboardTarget.current = null
      setActiveId(null)
    },
    onDragEnd: (event: DragEndEvent) => {
      keyboardTarget.current = null
      setActiveId(null)
      if (event.over) onMove(String(event.active.id), String(event.over.id))
    },
  }
}
