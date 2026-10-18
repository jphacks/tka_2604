import type { Constraint, Hardness } from '../../../generated/constraint'
import type { ConstraintStatus } from '../../../shared/model/constraints'

/** 一覧の表示だけをまとめる。保存データは1人1件のまま */
export function groupConstraintViews<T extends { constraint: Constraint }>(
  views: T[],
) {
  const groups: { key: string; views: T[] }[] = []
  const byKey = new Map<string, T[]>()
  for (const view of views) {
    const { constraint } = view
    const key =
      constraint.type === 'min_gap_member'
        ? JSON.stringify([
            constraint.hardness,
            constraint.priority,
            constraint.enabled,
            constraint.params.min_diff,
            constraint.params.same_part_only,
          ])
        : constraint.constraint_id
    const group = byKey.get(key)
    if (group) {
      group.push(view)
      continue
    }
    const created = [view]
    byKey.set(key, created)
    groups.push({ key, views: created })
  }
  return groups
}

export function constraintTone(
  enabled: boolean,
  hardness: Hardness,
  status: ConstraintStatus,
) {
  const failed = status === 'unmet' || status === 'invalid'
  if (!enabled) return 'border-slate-200 bg-slate-50/70'
  if (failed && hardness === 'hard') return 'border-red-200 bg-red-50/30'
  if (hardness === 'hard' || status === 'met')
    return 'border-sky-200 bg-sky-50/40'
  if (failed) return 'border-amber-200 bg-amber-50/40'
  return 'border-slate-200 bg-slate-50/70'
}
