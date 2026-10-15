import { useRef, useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { NumberField } from '../../../shared/ui/NumberField'
import { Panel } from '../../../shared/ui/Panel'
import { PerformanceEditor } from '../../participants/components/PerformanceEditor'
import type { EventController } from '../hooks/useEvent'
import {
  EmptyPerformanceRow,
  PerformanceRow,
  rowColumns,
} from './PerformanceRow'
import { ScheduleDragSurface, UnassignedDropZone } from './ScheduleDragSurface'

export function SchedulePanel({ controller }: { controller: EventController }) {
  const unassignedRef = useRef<HTMLElement>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const { event, schedule, setOrder, setFixed, resize } = controller
  if (!event || !schedule) return null
  return (
    <Panel
      title="出演順"
      action={
        schedule.unassigned.length > 0 ? (
          <Button
            variant="subtle"
            className="text-xs"
            onClick={() =>
              unassignedRef.current?.scrollIntoView({
                block: 'nearest',
                behavior: 'smooth',
              })
            }
          >
            未配置へ（{schedule.unassigned.length}）
          </Button>
        ) : undefined
      }
      detail={
        <span className="text-xs text-muted">
          配置済み {schedule.assignedCount} / {event.performances.length}組
        </span>
      }
    >
      <div className="flex flex-wrap items-center gap-3 border-b border-line bg-canvas/50 p-3 text-xs">
        <label className="flex items-center gap-2">
          部数
          <NumberField
            label="部数"
            value={event.sections.length}
            max={8}
            onCommit={(value) => {
              if (value !== null) resize(value)
            }}
          />
        </label>
        {schedule.sections.map((section, index) => (
          <label key={section.id} className="flex items-center gap-2">
            第{index + 1}部
            <NumberField
              label={`第${index + 1}部の組数`}
              value={section.capacity}
              max={20}
              onCommit={(value) => {
                if (value !== null) resize(value, section.id)
              }}
            />
            組
          </label>
        ))}
      </div>
      <ScheduleDragSurface controller={controller}>
        <div className="max-h-[65dvh] min-h-64 scrollbar-thin overflow-auto">
          <div
            className={`${rowColumns} sticky top-0 z-10 min-h-9 border-b border-line bg-white text-xs text-muted`}
          >
            <span />
            <span className="text-center">固定</span>
            <span>順</span>
            <span>出演名</span>
            <span>メンバー</span>
          </div>
          {schedule.sections.map((section) => (
            <section key={section.id} aria-label={section.name}>
              <div className="flex min-h-9 min-w-[520px] items-center justify-between bg-wash px-4 text-xs">
                <h3 className="font-semibold text-brand-dark">
                  {section.name} · {section.assigned}/{section.capacity}組
                </h3>
                <span>{section.range}番</span>
              </div>
              {section.rows.map((row) =>
                row.performance ? (
                  <PerformanceRow
                    key={row.key}
                    row={{ ...row, performance: row.performance }}
                    capacity={schedule.capacity}
                    onFixed={setFixed}
                    onOrder={setOrder}
                    onEdit={setEditingId}
                  />
                ) : (
                  <EmptyPerformanceRow key={row.key} row={row} />
                ),
              )}
            </section>
          ))}
          <UnassignedDropZone>
            <section ref={unassignedRef} aria-label="未配置">
              <div className="flex min-h-9 min-w-[520px] items-center gap-3 bg-slate-100 px-4 text-xs">
                <h3 className="font-semibold">
                  未配置 · {schedule.unassigned.length}組
                </h3>
                <span className="text-muted">ドラッグまたは順番号で配置</span>
              </div>
              {schedule.unassigned.map((row) => (
                <PerformanceRow
                  key={row.key}
                  row={row}
                  capacity={schedule.capacity}
                  onFixed={setFixed}
                  onOrder={setOrder}
                  onEdit={setEditingId}
                />
              ))}
              {!schedule.unassigned.length && (
                <p className="p-4 text-xs text-muted">
                  未配置の出演枠はありません。
                </p>
              )}
            </section>
          </UnassignedDropZone>
        </div>
      </ScheduleDragSurface>
      {editingId && (
        <PerformanceEditor
          key={editingId}
          eventId={event.id}
          performanceId={editingId}
          onSaved={(updated) => {
            controller.applyPerformanceEdits(updated)
            setEditingId(null)
          }}
          onClose={() => setEditingId(null)}
        />
      )}
      <p className="border-t border-line px-4 py-3 text-xs leading-6 text-muted">
        ドラッグ／Spaceと矢印キー／順番号で配置。空欄で未配置に戻します。固定は現在の位置をハード条件として保持します。
      </p>
    </Panel>
  )
}
