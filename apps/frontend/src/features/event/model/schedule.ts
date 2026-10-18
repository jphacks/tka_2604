import { validateConstraint } from '../../../shared/model/constraints'
import { isFixed, memberNames } from '../../../shared/model/event'
import type { EventData, ModelResult, MoveTarget, SectionView } from './types'

export function buildSchedule(event: EventData) {
  const performances = new Map(
    event.performances.map((performance) => [
      performance.id,
      {
        ...performance,
        members: memberNames(event, performance),
        fixed: isFixed(event, performance.id),
      },
    ]),
  )
  let offset = 0
  const sections: SectionView[] = event.sections.map((section, index) => {
    const start = offset + 1
    const rows = section.slots.map((id, slotIndex) => ({
      key: id ?? `empty:${section.id}:${slotIndex}`,
      performance: id ? performances.get(id)! : null,
      order:
        event.scheduleMode === 'dense'
          ? id === null
            ? null
            : start +
              section.slots.slice(0, slotIndex).filter((id) => id !== null)
                .length
          : offset + slotIndex + 1,
      target: { sectionId: section.id, index: slotIndex },
    }))
    offset +=
      event.scheduleMode === 'dense'
        ? section.slots.filter((id) => id !== null).length
        : section.slots.length
    return {
      id: section.id,
      name: section.name || `第${index + 1}部`,
      capacity: section.slots.length,
      assigned: section.slots.filter(Boolean).length,
      range: start > offset ? '—' : `${start}–${offset}`,
      rows,
    }
  })
  return {
    sections,
    unassigned: event.unassigned.map((id, index) => ({
      key: id,
      performance: performances.get(id)!,
      order: null,
      target: { unassignedIndex: index },
    })),
    assignedCount: event.sections.reduce(
      (total, section) => total + section.slots.filter(Boolean).length,
      0,
    ),
    capacity: event.sections.reduce(
      (total, part) => total + part.slots.length,
      0,
    ),
  }
}

export function findTarget(
  event: EventData,
  key: string,
): MoveTarget | undefined {
  if (key === 'unassigned') return { unassignedIndex: event.unassigned.length }
  for (const section of event.sections) {
    if (section.id === key)
      return {
        sectionId: section.id,
        index:
          section.slots.findIndex((id) => id === null) >= 0
            ? section.slots.indexOf(null)
            : section.slots.length - 1,
      }
    const index = section.slots.findIndex(
      (id, i) => id === key || `empty:${section.id}:${i}` === key,
    )
    if (index >= 0) return { sectionId: section.id, index }
  }
  const unassignedIndex = event.unassigned.indexOf(key)
  return unassignedIndex >= 0 ? { unassignedIndex } : undefined
}

export function movePerformance(
  event: EventData,
  id: string,
  target: MoveTarget,
): ModelResult {
  const performance = event.performances.find((item) => item.id === id)
  const source = findTarget(event, id)
  if (!performance || !source) return { event }
  if (
    'sectionId' in source &&
    'sectionId' in target &&
    source.sectionId === target.sectionId &&
    source.index === target.index
  )
    return { event }
  if (
    'unassignedIndex' in source &&
    'unassignedIndex' in target &&
    source.unassignedIndex === target.unassignedIndex
  )
    return { event }
  if (isFixed(event, id))
    return {
      event,
      error: '固定されている出演枠です。固定を解除してから移動してください。',
    }
  const next = structuredClone(event)
  if ('unassignedIndex' in target) {
    if (
      !Number.isInteger(target.unassignedIndex) ||
      target.unassignedIndex < 0 ||
      target.unassignedIndex > event.unassigned.length
    )
      return { event, error: '移動先が無効です。' }
    if ('unassignedIndex' in source) {
      next.unassigned.splice(source.unassignedIndex, 1)
      next.unassigned.splice(target.unassignedIndex, 0, id)
    } else {
      next.sections.find((section) => section.id === source.sectionId)!.slots[
        source.index
      ] = null
      next.unassigned.splice(target.unassignedIndex, 0, id)
    }
    return { event: next }
  }
  const destination = next.sections.find(
    (section) => section.id === target.sectionId,
  )
  if (
    !destination ||
    !Number.isInteger(target.index) ||
    target.index < 0 ||
    target.index >= destination.slots.length
  )
    return { event }
  const displaced = destination.slots[target.index]
  if (displaced && isFixed(event, displaced)) {
    return {
      event,
      error: '移動先の出演枠は固定されています。別の位置を選んでください。',
    }
  }
  if ('sectionId' in source) {
    // Insert across parts as well, skipping every fixed slot without moving it.
    const movable = next.sections.flatMap((section) =>
      section.slots.flatMap((slotId, index) =>
        slotId !== null && isFixed(event, slotId) ? [] : [{ section, index }],
      ),
    )
    const from = movable.findIndex(
      ({ section, index }) =>
        section.id === source.sectionId && index === source.index,
    )
    const to = movable.findIndex(
      ({ section, index }) =>
        section.id === target.sectionId && index === target.index,
    )
    const values = movable.map(({ section, index }) => section.slots[index])
    values.splice(from, 1)
    values.splice(to, 0, id)
    movable.forEach(({ section, index }, i) => {
      section.slots[index] = values[i]
    })
  } else {
    next.unassigned.splice(
      source.unassignedIndex,
      1,
      ...(displaced ? [displaced] : []),
    )
    destination.slots[target.index] = id
  }
  return { event: next }
}

export function setPerformanceOrder(
  event: EventData,
  id: string,
  value: number | null,
): ModelResult {
  if (value === null)
    return movePerformance(event, id, {
      unassignedIndex: event.unassigned.length,
    })
  let remaining = value - 1
  if (!Number.isInteger(value) || value < 1)
    return { event, error: '出演順は1以上の整数を入力してください。' }
  for (const section of event.sections) {
    if (remaining < section.slots.length)
      return movePerformance(event, id, {
        sectionId: section.id,
        index: remaining,
      })
    remaining -= section.slots.length
  }
  return { event, error: '出演順は現在の枠数以内で入力してください。' }
}

export function resizeSchedule(
  event: EventData,
  count: number,
  sectionId?: string,
): ModelResult {
  if (sectionId && !event.sections.some((section) => section.id === sectionId))
    return { event, error: '部が見つかりません。' }
  const max = sectionId ? 20 : 8
  if (!Number.isInteger(count) || count < 1 || count > max)
    return { event, error: `1〜${max}の整数を入力してください。` }
  const currentCount = sectionId
    ? event.sections.find((section) => section.id === sectionId)?.slots.length
    : event.sections.length
  if (count === currentCount) return { event }
  const removed = sectionId
    ? (event.sections
        .find((section) => section.id === sectionId)
        ?.slots.slice(count) ?? [])
    : event.sections.slice(count).flatMap((section) => section.slots)
  // Changing preceding capacities also shifts absolute positions of fixed slots.
  const precedingFixed =
    sectionId &&
    event.sections
      .slice(
        event.sections.findIndex((section) => section.id === sectionId) + 1,
      )
      .some((section) =>
        section.slots.some((id) => id !== null && isFixed(event, id)),
      )
  const oldCapacity = event.sections.find((section) => section.id === sectionId)
    ?.slots.length
  if (
    removed.some((id) => id !== null && isFixed(event, id)) ||
    (precedingFixed && count !== oldCapacity)
  ) {
    return {
      event,
      error:
        '固定枠の位置が変わる設定です。該当する固定を解除してから変更してください。',
    }
  }
  const next = structuredClone(event)
  next.unassigned.push(...removed.filter((id): id is string => id !== null))
  if (sectionId) {
    const section = next.sections.find((item) => item.id === sectionId)
    if (!section) return { event }
    section.slots = Array.from(
      { length: count },
      (_, index) => section.slots[index] ?? null,
    )
  } else {
    next.sections = Array.from(
      { length: count },
      (_, index) =>
        next.sections[index] ?? {
          id: `part-${crypto.randomUUID()}`,
          slots: Array<string | null>(4).fill(null),
        },
    )
  }
  for (const constraint of next.constraints) {
    const error = validateConstraint(constraint, next)
    if (error)
      return {
        event,
        error: `制約の指定範囲が使えなくなります。先に制約を編集・削除してください。${error}`,
      }
  }
  return { event: next }
}
