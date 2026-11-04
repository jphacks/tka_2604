import { constraintLabels } from '../../../shared/model/constraints'
import { memberLabel } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Input, Select } from '../../../shared/ui/Input'
import type { EventController } from '../hooks/useEvent'
import {
  type ConstraintFilters as Filters,
  emptyConstraintFilters,
} from '../model/constraintFilters'

export function ConstraintFilters({
  controller,
}: {
  controller: EventController
}) {
  const event = controller.event
  if (!event) return null
  const filters = controller.constraintFilters
  function change(patch: Partial<Filters>) {
    controller.setConstraintFilters((value) => ({ ...value, ...patch }))
  }
  return (
    <div className="shrink-0 space-y-2 border-b border-line p-2">
      <Input
        aria-label="制約を検索"
        placeholder="制約・バンド・メンバー名で検索"
        value={filters.query}
        onChange={(e) => change({ query: e.target.value })}
        className="w-full"
      />
      <div className="grid grid-cols-2 gap-1">
        <Select
          aria-label="制約の種類で絞り込み"
          value={filters.type}
          onChange={(e) => change({ type: e.target.value as Filters['type'] })}
        >
          <option value="">すべての種類</option>
          {Object.entries(constraintLabels).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </Select>
        <Select
          aria-label="制約の達成状況で絞り込み"
          value={filters.status}
          onChange={(e) =>
            change({ status: e.target.value as Filters['status'] })
          }
        >
          <option value="">すべての状況</option>
          <option value="met">達成</option>
          <option value="unmet">未達成</option>
          <option value="unchecked">未判定</option>
          <option value="invalid">入力不備</option>
          <option value="disabled">無効</option>
        </Select>
        <Select
          aria-label="バンドで絞り込み"
          value={filters.bandId}
          onChange={(e) => change({ bandId: e.target.value })}
        >
          <option value="">すべてのバンド</option>
          {event.performances.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name}
            </option>
          ))}
        </Select>
        <Select
          aria-label="メンバーで絞り込み"
          value={filters.memberId}
          onChange={(e) => change({ memberId: e.target.value })}
        >
          <option value="">すべてのメンバー</option>
          {event.members.map((m) => (
            <option key={m.id} value={m.id}>
              {memberLabel(event, m)}
            </option>
          ))}
        </Select>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-1 text-xs">
        <span>
          {controller.constraintViews.length}/{event.constraints.length}件
        </span>
        <Button
          variant={controller.showUnmet ? 'primary' : 'ghost'}
          className="text-xs"
          aria-pressed={controller.showUnmet}
          onClick={() => controller.setShowUnmet(!controller.showUnmet)}
        >
          未達成のみ（{controller.unmetCount}）
        </Button>
        <Button
          variant="ghost"
          className="text-xs"
          onClick={() => {
            controller.setConstraintFilters({ ...emptyConstraintFilters })
            controller.setShowUnmet(false)
          }}
        >
          絞り込みを解除
        </Button>
      </div>
    </div>
  )
}
