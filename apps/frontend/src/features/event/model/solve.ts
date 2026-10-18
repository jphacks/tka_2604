import type { SolveResponse } from '../../../shared/api/events'
import type { EventData } from './types'

export function applySolverSchedule(
  event: EventData,
  response: SolveResponse,
): EventData {
  const schedule = response.schedule
  if (!schedule) return event
  if (
    schedule.parts.length !== event.sections.length ||
    schedule.parts.some(
      (part) => !event.sections.some((current) => current.id === part.partId),
    ) ||
    event.sections.some(
      (part) =>
        schedule.placements.filter((item) => item.partId === part.id).length >
        part.slots.length,
    )
  )
    throw new Error('生成結果が設定された部・枠数を超えています。')
  return {
    ...event,
    updatedAt: schedule.updatedAt,
    sections: event.sections.map((part) => {
      const bands = schedule.placements
        .filter((item) => item.partId === part.id)
        .toSorted((a, b) => a.order - b.order)
        .map((item) => item.bandId)
      return {
        ...part,
        name:
          schedule.parts.find((saved) => saved.partId === part.id)?.partName ??
          part.name,
        slots: Array.from(
          { length: part.slots.length },
          (_, index) => bands[index] ?? null,
        ),
      }
    }),
    unassigned: schedule.unassignedBandIds,
  }
}

export const solveMessages: Record<SolveResponse['result']['status'], string> =
  {
    optimal: '出演順を生成して保存しました。',
    feasible: '実行可能な出演順を生成して保存しました。最適性は未証明です。',
    partial:
      '一部の出演枠を配置して保存しました。未配置の出演枠を確認してください。',
    infeasible:
      '必須条件を満たす出演順がありません。現在の配置を保持しています。',
    unknown: '探索が完了していません。現在の配置を保持しています。',
  }
