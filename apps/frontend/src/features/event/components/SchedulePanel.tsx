import { useRef, useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Panel } from '../../../shared/ui/Panel'
import type { EventController } from '../hooks/useEvent'
import { LiveInfoDialog } from './LiveInfoDialog'
import {
  EmptyPerformanceRow,
  PerformanceRow,
  rowColumns,
} from './PerformanceRow'
import { ScheduleDragSurface, UnassignedDropZone } from './ScheduleDragSurface'

export function SchedulePanel({ controller }: { controller: EventController }) {
  const unassignedRef = useRef<HTMLElement>(null)
  const { event, schedule, setOrder, setFixed } = controller
  const [editingLive, setEditingLive] = useState(false)
  if (!event || !schedule) return null
  return (
    <Panel
      inert={
        controller.saving ||
        controller.solving ||
        controller.refreshing ||
        controller.sending
      }
      title="出演順"
      headerClassName="flex-wrap py-2"
      action={
        <div className="flex flex-wrap items-center justify-end gap-2">
          <Button
            aria-label="出演順を保存"
            className="text-xs"
            variant={controller.scheduleDirty ? 'primary' : 'secondary'}
            disabled={
              !controller.scheduleDirty ||
              controller.saving ||
              controller.solving ||
              controller.refreshing ||
              controller.sending
            }
            onClick={() => void controller.saveSchedule()}
          >
            {controller.savingSchedule ? '保存中…' : '保存'}
            {controller.scheduleDirty && ' *'}
          </Button>
          <Button
            disabled={
              !event.performances.length ||
              controller.saving ||
              controller.solving ||
              controller.refreshing ||
              controller.sending
            }
            title="出演順・制約を保存してから計算します"
            className="text-xs"
            onClick={() => void controller.generate()}
          >
            {controller.solving ? '計算中…' : '自動生成'}
          </Button>
          <Button onClick={controller.exportCsv} className="text-xs">
            CSVを出力
          </Button>
          <Button onClick={() => setEditingLive(true)} className="text-xs">
            ライブ情報の編集
          </Button>
          {schedule.unassigned.length > 0 ? (
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
          ) : undefined}
        </div>
      }
      detail={
        <span className="text-xs text-muted">
          配置済み {schedule.assignedCount} / {event.performances.length}組
        </span>
      }
    >
      {editingLive && (
        <LiveInfoDialog
          controller={controller}
          onClose={() => setEditingLive(false)}
        />
      )}
      <ScheduleDragSurface controller={controller}>
        <div className="max-h-[65dvh] min-h-64 scrollbar-thin overflow-auto xl:max-h-none xl:min-h-0 xl:flex-1">
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
                <span>{!section.assigned ? '—' : `${section.range}番`}</span>
              </div>
              {section.rows.map((row) =>
                row.performance ? (
                  <PerformanceRow
                    key={row.key}
                    row={{ ...row, performance: row.performance }}
                    capacity={
                      schedule.assignedCount + (row.order === null ? 1 : 0)
                    }
                    onFixed={setFixed}
                    onOrder={setOrder}
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
                  capacity={
                    schedule.assignedCount + (row.order === null ? 1 : 0)
                  }
                  onFixed={setFixed}
                  onOrder={setOrder}
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
    </Panel>
  )
}
