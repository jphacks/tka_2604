import type {
  CollisionDetection,
  DragEndEvent,
  DragStartEvent,
} from '@dnd-kit/core'
import {
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  pointerWithin,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable'
import { useState } from 'react'

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
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
  return {
    activeId,
    sensors,
    collisionDetection,
    onDragStart: (event: DragStartEvent) =>
      setActiveId(String(event.active.id)),
    onDragCancel: () => setActiveId(null),
    onDragEnd: (event: DragEndEvent) => {
      setActiveId(null)
      if (event.over) onMove(String(event.active.id), String(event.over.id))
    },
  }
}
