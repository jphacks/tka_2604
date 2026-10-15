import { type EventData, memberLabel } from '../../../shared/model/event'
import { Input, Select } from '../../../shared/ui/Input'
import type { ConstraintDraft } from '../model/constraintDraft'
import { BandPicker, BandSelect, PartPicker } from './ConstraintTargets'

function NumericInput({
  label,
  value,
  onChange,
  min = 1,
  max,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  min?: number
  max?: number
}) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <Input
        className="block w-full"
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        onChange={(change) => onChange(change.target.value)}
      />
    </label>
  )
}

export function ConstraintFields({
  event,
  draft,
  change,
}: {
  event: EventData
  draft: ConstraintDraft
  change: (patch: Partial<ConstraintDraft>) => void
}) {
  const capacity = event.sections.reduce(
    (total, section) => total + section.slots.length,
    0,
  )
  const multiple = ['min_gap_bands', 'in_range', 'count'].includes(draft.type)
  return (
    <div className="space-y-4">
      {draft.type === 'min_gap_member' && (
        <label className="block space-y-2 text-sm font-medium">
          対象のメンバー
          <Select
            className="block h-10 w-full"
            value={draft.memberId}
            onChange={(changeEvent) =>
              change({ memberId: changeEvent.target.value })
            }
          >
            <option value="">メンバーを選んでください</option>
            {event.members.map((member) => (
              <option key={member.id} value={member.id}>
                {memberLabel(event, member)}
              </option>
            ))}
          </Select>
        </label>
      )}
      {multiple && (
        <BandPicker
          event={event}
          selected={draft.bandIds}
          onChange={(bandIds) => change({ bandIds })}
        />
      )}
      {(draft.type === 'min_gap_member' || draft.type === 'min_gap_bands') && (
        <>
          <NumericInput
            label="間に空ける出演枠（組以上）"
            min={1}
            value={draft.between}
            onChange={(between) => change({ between })}
          />
          <p className="text-xs leading-6 text-muted">
            例：「2」なら A → 別の組 → 別の組 →
            B。対象のすべての組合せに適用します。
          </p>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.samePartOnly}
              onChange={(changeEvent) =>
                change({ samePartOnly: changeEvent.target.checked })
              }
            />
            同じ部の出演だけに適用する
          </label>
          <p className="text-xs text-muted">
            チェックを外すと、部をまたぐ出演にも適用します。
          </p>
        </>
      )}
      {draft.type === 'before' && (
        <div className="space-y-4">
          <BandSelect
            event={event}
            label="先に出演する組"
            value={draft.beforeId}
            onChange={(beforeId) => change({ beforeId })}
          />
          <BandSelect
            event={event}
            label="後に出演する組"
            value={draft.afterId}
            onChange={(afterId) => change({ afterId })}
          />
        </div>
      )}
      {draft.type === 'at_position' && (
        <>
          <BandSelect
            event={event}
            label="位置を指定する出演枠"
            value={draft.bandIds[0] ?? ''}
            onChange={(id) => change({ bandIds: id ? [id] : [] })}
          />
          <NumericInput
            label="出演位置（番）"
            value={draft.position}
            max={capacity}
            onChange={(position) => change({ position })}
          />
          <p className="text-xs text-muted">
            イベント全体の1〜{capacity}
            番。「必ず守る」にすると、指定位置にいる出演枠を固定します。
          </p>
        </>
      )}
      {draft.type === 'in_range' && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            範囲の指定方法
            <Select
              className="block h-10 w-full"
              value={draft.rangeKind}
              onChange={(changeEvent) =>
                change({
                  rangeKind:
                    changeEvent.target.value === 'parts'
                      ? 'parts'
                      : 'positions',
                })
              }
            >
              <option value="positions">出演順の範囲で指定</option>
              <option value="parts">出演できる部を選択</option>
            </Select>
          </label>
          {draft.rangeKind === 'positions' ? (
            <div className="grid grid-cols-2 gap-3">
              <NumericInput
                label="開始（番）"
                max={capacity}
                value={draft.from}
                onChange={(from) => change({ from })}
              />
              <NumericInput
                label="終了（番）"
                max={capacity}
                value={draft.to}
                onChange={(to) => change({ to })}
              />
            </div>
          ) : (
            <PartPicker
              event={event}
              selected={draft.partIds}
              onChange={(partIds) => change({ partIds })}
            />
          )}
          <p className="text-xs leading-6 text-muted">
            対象の全組を、開始・終了を含む範囲内、または選んだ部のいずれかに配置します。
          </p>
        </>
      )}
      {draft.type === 'count' && (
        <>
          <label className="block space-y-2 text-sm font-medium">
            出演数を数える範囲
            <Select
              className="block h-10 w-full"
              value={draft.countScope}
              onChange={(changeEvent) =>
                change({
                  countScope:
                    changeEvent.target.value === 'in_parts'
                      ? 'in_parts'
                      : 'per_part',
                })
              }
            >
              <option value="per_part">すべての部に、それぞれ適用</option>
              <option value="in_parts">選んだ部の合計に適用</option>
            </Select>
          </label>
          {draft.countScope === 'in_parts' && (
            <PartPicker
              event={event}
              selected={draft.partIds}
              onChange={(partIds) => change({ partIds })}
            />
          )}
          <div className="grid grid-cols-2 gap-3">
            <NumericInput
              label="下限（組）"
              min={0}
              value={draft.min}
              onChange={(min) => change({ min })}
            />
            <NumericInput
              label="上限（組）"
              min={0}
              value={draft.max}
              onChange={(max) => change({ max })}
            />
          </div>
          <p className="text-xs text-muted">
            選んだ出演枠だけを数えます。下限と上限を同じにすると本数を指定できます。
          </p>
        </>
      )}
    </div>
  )
}
