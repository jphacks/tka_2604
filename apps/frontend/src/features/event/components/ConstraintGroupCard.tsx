import { useState } from 'react'

import type {
  Constraint,
  Hardness,
  Priority,
} from '../../../generated/constraint'
import type { ConstraintStatus } from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { constraintTone } from '../model/constraintGroups'
import { ConstraintControls } from './ConstraintControls'

/** 同じ設定の「メンバーの出演間隔」を1枚にまとめ、操作は含む全件へ反映する */
export function ConstraintGroupCard({
  event,
  views,
  onUpdate,
  onEdit,
  onDelete,
}: {
  event: EventData
  views: { constraint: Constraint; status: ConstraintStatus }[]
  onUpdate: (
    patch: Partial<{
      enabled: boolean
      hardness: Hardness
      priority: Exclude<Priority, null>
    }>,
  ) => void
  onEdit: (constraint: Constraint) => void
  onDelete: (constraints: Constraint[]) => void
}) {
  const [open, setOpen] = useState(false)
  const first = views[0].constraint
  if (first.type !== 'min_gap_member') return null
  const { enabled, hardness, priority } = first
  const failed = views.filter(
    (view) => view.status === 'unmet' || view.status === 'invalid',
  ).length
  const unchecked = views.filter((view) => view.status === 'unchecked').length
  const status: ConstraintStatus = !enabled
    ? 'disabled'
    : failed
      ? 'unmet'
      : unchecked
        ? 'unchecked'
        : 'met'
  const title = `${views.length}人の出演の間に${first.params.min_diff - 1}組以上空ける${first.params.same_part_only ? '（同じ部のみ）' : '（部をまたいで適用）'}`
  const detail = !enabled
    ? '無効'
    : failed
      ? `${failed}人が${hardness === 'hard' ? '必須条件に違反' : '未達成'}`
      : unchecked
        ? `${unchecked}人は対象に未配置の出演枠があります`
        : 'すべて達成'
  const memberName = (constraint: Constraint) =>
    constraint.type === 'min_gap_member'
      ? (event.members.find(
          (member) => member.id === constraint.targets.member_id,
        )?.name ?? '不明なメンバー')
      : ''
  return (
    <article
      className={`rounded-lg border p-3 ${constraintTone(enabled, hardness, status)}`}
    >
      <div className="mb-3 flex items-start gap-2">
        <input
          type="checkbox"
          className="mt-1"
          aria-label={`${title}を有効にする`}
          checked={enabled}
          onChange={(change) => onUpdate({ enabled: change.target.checked })}
        />
        <h3
          className={`min-w-0 flex-1 text-sm leading-6 ${enabled ? '' : 'text-muted line-through'}`}
        >
          {title}
        </h3>
      </div>
      <ConstraintControls
        label={title}
        hardness={hardness}
        priority={priority}
        onHardness={(value) => onUpdate({ hardness: value })}
        onPriority={(value) => onUpdate({ priority: value })}
      />
      <p
        className={`mt-3 text-xs leading-6 ${status === 'met' ? 'text-emerald-700' : status === 'unmet' ? 'text-red-700' : 'text-muted'}`}
      >
        {status === 'met' ? '✓ ' : ''}
        {detail}
      </p>
      {open && (
        <ul className="mt-2 divide-y divide-line/60 rounded-md border border-line/60 bg-white">
          {views.map(({ constraint, status: itemStatus }) => {
            const name = memberName(constraint)
            return (
              <li
                key={constraint.constraint_id}
                className="flex items-center gap-2 px-2 py-1 text-xs"
              >
                <span className="min-w-0 flex-1">{name}</span>
                <span
                  className={
                    itemStatus === 'met'
                      ? 'text-emerald-700'
                      : itemStatus === 'unmet' || itemStatus === 'invalid'
                        ? 'text-red-700'
                        : 'text-muted'
                  }
                >
                  {itemStatus === 'met'
                    ? '✓'
                    : itemStatus === 'unmet' || itemStatus === 'invalid'
                      ? '未達成'
                      : itemStatus === 'unchecked'
                        ? '未判定'
                        : ''}
                </span>
                <Button
                  variant="ghost"
                  className="px-1.5"
                  aria-label={`${name}の間隔を編集`}
                  onClick={() => onEdit(constraint)}
                >
                  <Icon name="edit" />
                </Button>
                <Button
                  variant="ghost"
                  className="px-1.5 hover:text-red-600"
                  aria-label={`${name}の間隔を削除`}
                  onClick={() => onDelete([constraint])}
                >
                  <Icon name="trash" />
                </Button>
              </li>
            )
          })}
        </ul>
      )}
      <div className="mt-2 flex justify-end gap-1 border-t border-line/60 pt-2">
        <Button
          variant="ghost"
          className="px-2"
          aria-expanded={open}
          onClick={() => setOpen(!open)}
        >
          <Icon name="list" />
          {open ? '内訳を閉じる' : `内訳（${views.length}人）`}
        </Button>
        <Button
          variant="ghost"
          className="px-2 hover:text-red-600"
          aria-label={`${title}をまとめて削除`}
          onClick={() => onDelete(views.map((view) => view.constraint))}
        >
          <Icon name="trash" />
          まとめて削除
        </Button>
      </div>
    </article>
  )
}
