import { isFixed, positions } from '../../../shared/model/event'
import { findTarget } from './schedule'
import type { EventData, ModelResult, MoveTarget } from './types'

/** The API stores a dense order per part, without empty slots or capacity. */
export function movePersistedPerformance(
  event: EventData,
  id: string,
  target: MoveTarget,
): ModelResult {
  const source = findTarget(event, id)
  if (!source) return { event }
  if (isFixed(event, id))
    return { event, error: '固定を解除してから移動してください。' }
  const next = structuredClone(event)
  if ('sectionId' in source)
    next.sections
      .find((part) => part.id === source.sectionId)!
      .slots.splice(source.index, 1)
  else next.unassigned.splice(source.unassignedIndex, 1)
  if ('sectionId' in target) {
    const part = next.sections.find((part) => part.id === target.sectionId)
    if (!part || target.index < 0 || !Number.isInteger(target.index))
      return { event }
    part.slots.splice(Math.min(target.index, part.slots.length), 0, id)
  } else
    next.unassigned.splice(
      Math.min(target.unassignedIndex, next.unassigned.length),
      0,
      id,
    )
  const before = positions(event)
  const after = positions(next)
  if (
    event.performances.some(
      (band) =>
        isFixed(event, band.id) &&
        before.get(band.id)?.position !== after.get(band.id)?.position,
    )
  )
    return {
      event,
      error: '固定枠の位置が変わります。固定を解除してから移動してください。',
    }
  return { event: next }
}

export function setPersistedOrder(
  event: EventData,
  id: string,
  order: number | null,
): ModelResult {
  if (order === null)
    return movePersistedPerformance(event, id, {
      unassignedIndex: event.unassigned.length,
    })
  const count = event.sections.reduce(
    (total, part) => total + part.slots.length,
    0,
  )
  const limit = count + (event.unassigned.includes(id) ? 1 : 0)
  if (!Number.isInteger(order) || order < 1 || order > limit)
    return { event, error: `出演順は1〜${limit}の整数を入力してください。` }
  let index = order - 1
  for (const part of event.sections) {
    if (index < part.slots.length)
      return movePersistedPerformance(event, id, { sectionId: part.id, index })
    index -= part.slots.length
  }
  const last = event.sections.at(-1)
  return last
    ? movePersistedPerformance(event, id, {
        sectionId: last.id,
        index: last.slots.length,
      })
    : { event }
}
