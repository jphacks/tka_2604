import { isFixed, positions } from '../../../shared/model/event'
import { findTarget, movePerformance } from './schedule'
import type { EventData, ModelResult, MoveTarget } from './types'

function moveWithinFrames(
  event: EventData,
  id: string,
  target: MoveTarget,
): ModelResult {
  const source = findTarget(event, id)
  if (!source) return { event }
  let result: ModelResult
  if ('unassignedIndex' in source && 'sectionId' in target) {
    const next = structuredClone(event)
    const movable = next.sections.flatMap((section) =>
      section.slots.flatMap((bandId, index) =>
        bandId !== null && isFixed(event, bandId) ? [] : [{ section, index }],
      ),
    )
    const from = movable.findIndex(
      ({ section, index }) =>
        section.id === target.sectionId && index === target.index,
    )
    if (from < 0)
      return { event, error: '移動先が無効、または固定されています。' }
    let carried: string | null = id
    for (const { section, index } of movable.slice(from)) {
      const displaced = section.slots[index]
      section.slots[index] = carried
      carried = displaced
      if (carried === null) break
    }
    next.unassigned.splice(
      source.unassignedIndex,
      1,
      ...(carried ? [carried] : []),
    )
    result = { event: next }
  } else result = movePerformance(event, id, target)
  if (result.error || result.event === event) return result
  const next = {
    ...result.event,
    sections: result.event.sections.map((part) => {
      const bands = part.slots.filter((id) => id !== null)
      return {
        ...part,
        slots: Array.from(
          { length: part.slots.length },
          (_, index) => bands[index] ?? null,
        ),
      }
    }),
  }
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

/** Configured frames stay fixed; persisted placements remain dense within each part. */
export function movePersistedPerformance(
  event: EventData,
  id: string,
  target: MoveTarget,
): ModelResult {
  if (event.scheduleMode === 'dense') return moveWithinFrames(event, id, target)
  const displayed = event
  if ('sectionId' in target) {
    const { sectionId } = target
    const part = displayed.sections.find((part) => part.id === sectionId)
    if (
      !part ||
      !Number.isInteger(target.index) ||
      target.index < 0 ||
      target.index > part.slots.length
    )
      return { event }
    target = {
      ...target,
      index: part.slots.slice(0, target.index).filter((id) => id !== null)
        .length,
    }
  }
  event = {
    ...event,
    sections: event.sections.map((part) => ({
      ...part,
      slots: part.slots.filter((id) => id !== null),
    })),
  }
  const source = findTarget(event, id)
  if (!source) return { event: displayed }
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
    (total, part) => total + part.slots.filter((id) => id !== null).length,
    0,
  )
  const limit = Math.min(
    count + (event.unassigned.includes(id) ? 1 : 0),
    event.scheduleMode === 'dense'
      ? event.sections.reduce((total, part) => total + part.slots.length, 0)
      : Infinity,
  )
  if (!Number.isInteger(order) || order < 1 || order > limit)
    return { event, error: `出演順は1〜${limit}の整数を入力してください。` }
  const targetId = event.sections.flatMap((part) =>
    part.slots.filter((id) => id !== null),
  )[order - 1]
  const target = targetId ? findTarget(event, targetId) : undefined
  if (target) return movePersistedPerformance(event, id, target)
  if (event.scheduleMode === 'dense') {
    const lastOccupied = event.sections.findLastIndex((part) =>
      part.slots.some((id) => id !== null),
    )
    const available = event.sections
      .slice(Math.max(0, lastOccupied))
      .find((part) => part.slots.includes(null))
    return available
      ? movePersistedPerformance(event, id, {
          sectionId: available.id,
          index: available.slots.filter((id) => id !== null).length,
        })
      : {
          event,
          error:
            '末尾に空き枠がありません。空き枠へドラッグして配置してください。',
        }
  }
  const last = event.sections.at(-1)
  return last
    ? movePersistedPerformance(event, id, {
        sectionId: last.id,
        index: last.slots.length,
      })
    : { event }
}
