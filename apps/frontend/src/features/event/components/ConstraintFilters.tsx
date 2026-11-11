import { useState } from 'react'

import { constraintLabels } from '../../../shared/model/constraints'
import { memberLabel } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select } from '../../../shared/ui/Input'
import type { EventController } from '../hooks/useEvent'
import {
  type ConstraintFilters as Filters,
  emptyConstraintFilters,
} from '../model/constraintFilters'

const statusLabels = {
  met: '達成',
  unmet: '未達成',
  unchecked: '未判定',
  invalid: '入力不備',
  disabled: '無効',
}

type FilterController = Pick<
  EventController,
  | 'event'
  | 'constraintFilters'
  | 'setConstraintFilters'
  | 'constraintViews'
  | 'showUnmet'
  | 'setShowUnmet'
  | 'unmetCount'
>

export function ConstraintFilters({
  controller,
}: {
  controller: FilterController
}) {
  const [open, setOpen] = useState(false)
  const event = controller.event
  if (!event) return null
  const filters = controller.constraintFilters
  function change(patch: Partial<Filters>) {
    controller.setConstraintFilters((value) => ({ ...value, ...patch }))
  }
  const member = event.members.find((item) => item.id === filters.memberId)
  const filterLabels: { key: keyof Filters; label: string }[] = [
    { key: 'query', label: `検索: ${filters.query.trim()}` },
    {
      key: 'type',
      label: `種類: ${filters.type ? constraintLabels[filters.type] : ''}`,
    },
    {
      key: 'bandId',
      label: `バンド: ${event.performances.find((item) => item.id === filters.bandId)?.name ?? '不明なバンド'}`,
    },
    {
      key: 'memberId',
      label: `メンバー: ${member ? memberLabel(event, member) : '不明なメンバー'}`,
    },
    {
      key: 'status',
      label: `状況: ${filters.status ? statusLabels[filters.status] : ''}`,
    },
  ]
  const chips = filterLabels
    .filter(({ key }) => filters[key].trim())
    .map(({ key, label }) => ({
      key,
      label,
      remove: () => change({ [key]: '' }),
    }))
  const activeChips = controller.showUnmet
    ? [
        ...chips,
        {
          key: 'unmetOnly',
          label: '未達成のみ',
          remove: () => controller.setShowUnmet(false),
        },
      ]
    : chips
  return (
    <>
      <div
        role="group"
        aria-label="制約フィルター"
        className="flex h-11 min-w-0 shrink-0 items-center gap-2 border-b border-line px-2"
      >
        <Button
          variant="ghost"
          className="min-h-8 gap-1 px-1.5 text-xs"
          aria-label="フィルターを設定"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          <Icon name="search" className="size-3.5" />
        </Button>
        <div
          role="region"
          aria-label="選択中のフィルター"
          className="flex h-9 min-w-0 flex-1 scrollbar-thin items-center gap-1 overflow-x-auto overflow-y-hidden rounded-md border border-line bg-canvas/60 px-1 whitespace-nowrap"
        >
          {activeChips.map((chip) => (
            <span
              key={chip.key}
              className="inline-flex max-w-56 shrink-0 items-center rounded-full border border-brand/20 bg-wash text-xs text-brand"
            >
              <button
                type="button"
                title={chip.label}
                onClick={() => setOpen(true)}
                className="min-w-0 truncate rounded-l-full py-1 pr-1 pl-2.5 focus-visible:outline-2 focus-visible:outline-brand"
              >
                {chip.label}
              </button>
              <button
                type="button"
                aria-label={`${chip.label}を解除`}
                title="この項目を解除"
                onClick={chip.remove}
                className="mr-1 flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-brand/10 focus-visible:outline-2 focus-visible:outline-brand"
              >
                <Icon name="close" className="size-3" />
              </button>
            </span>
          ))}
          <button
            type="button"
            aria-label="フィルターを追加"
            onClick={() => setOpen(true)}
            className="h-full min-w-8 flex-1 shrink-0 rounded focus-visible:outline-2 focus-visible:outline-brand"
          />
        </div>
      </div>
      {open && (
        <Dialog title="制約の絞り込み" onClose={() => setOpen(false)}>
          <label className="block space-y-1 text-xs text-muted">
            <span>キーワード</span>
            <Input
              aria-label="制約を検索"
              placeholder="制約・バンド・メンバー名で検索"
              value={filters.query}
              onChange={(e) => change({ query: e.target.value })}
              className="w-full"
            />
          </label>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="space-y-1 text-xs text-muted">
              <span>種類</span>
              <Select
                className="w-full"
                aria-label="制約の種類で絞り込み"
                value={filters.type}
                onChange={(e) =>
                  change({ type: e.target.value as Filters['type'] })
                }
              >
                <option value="">すべての種類</option>
                {Object.entries(constraintLabels).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </Select>
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>達成状況</span>
              <Select
                className="w-full"
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
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>対象バンド</span>
              <Select
                className="w-full"
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
            </label>
            <label className="space-y-1 text-xs text-muted">
              <span>対象メンバー</span>
              <Select
                className="w-full"
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
            </label>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <Button
              variant={controller.showUnmet ? 'primary' : 'secondary'}
              className="text-xs"
              aria-pressed={controller.showUnmet}
              onClick={() => controller.setShowUnmet(!controller.showUnmet)}
            >
              未達成のみ（{controller.unmetCount}）
            </Button>
            <span className="text-muted">
              {controller.constraintViews.length}/{event.constraints.length}件
            </span>
          </div>
          <div className="mt-5 flex justify-end gap-2 border-t border-line pt-3">
            <Button
              variant="ghost"
              onClick={() => {
                controller.setConstraintFilters({ ...emptyConstraintFilters })
                controller.setShowUnmet(false)
              }}
            >
              絞り込みを解除
            </Button>
            <Button variant="primary" onClick={() => setOpen(false)}>
              完了
            </Button>
          </div>
        </Dialog>
      )}
    </>
  )
}
