import type { SolveResponse } from '../../../shared/api/events'
import type { EventData } from './types'

export function applySolverSchedule(
  event: EventData,
  response: SolveResponse,
): EventData {
  const schedule = response.schedule
  if (!schedule) return event
  return {
    ...event,
    updatedAt: schedule.updatedAt,
    sections: schedule.parts
      .toSorted((a, b) => a.sortOrder - b.sortOrder)
      .map((part) => {
        const bands = schedule.placements
          .filter((item) => item.partId === part.partId)
          .toSorted((a, b) => a.order - b.order)
          .map((item) => item.bandId)
        const capacity =
          event.sections.find((section) => section.id === part.partId)?.slots
            .length ?? 4
        return {
          id: part.partId,
          name: part.partName,
          slots: Array.from(
            { length: Math.max(capacity, bands.length) },
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
