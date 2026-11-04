import { useRef, useState } from 'react'

import {
  evaluateConstraint,
  violatedBandIds,
} from '../../../shared/model/constraints'
import { isFixed } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { RosterImportDialog } from '../../participants/components/RosterImportDialog'
import type { EventController } from '../hooks/useEvent'
import { useScheduleFlip } from '../hooks/useScheduleFlip'
import { HistoryConfirmation } from './HistoryConfirmation'
import { LiveInfoDialog } from './LiveInfoDialog'
import { PerformanceDetailsDialog } from './PerformanceDetailsDialog'
import {
  EmptyPerformanceRow,
  PerformanceRow,
  rowColumns,
} from './PerformanceRow'
import { ScheduleDragSurface, UnassignedDropZone } from './ScheduleDragSurface'

export function SchedulePanel({ controller }: { controller: EventController }) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const focusAfterDelete = useRef(false)
  const [selectedBandId, setSelectedBandId] = useState<string | null>(null)
  useScheduleFlip(scrollRef, controller.reorderRevision)
  const { event, schedule, setOrder, setFixed } = controller
  const [importingCsv, setImportingCsv] = useState(false)
  const [editingLive, setEditingLive] = useState(false)
  if (!event || !schedule) return null
  const selectedBand = event.performances.find(
    (performance) => performance.id === selectedBandId,
  )
  const selectedRow = selectedBandId
    ? [
        ...schedule.sections.flatMap((section) => section.rows),
        ...schedule.unassigned,
      ].find((row) => row.performance?.id === selectedBandId)
    : undefined
  const unavailable =
    controller.scheduleDirty ||
    controller.constraintsDirty ||
    controller.saving ||
    controller.solving ||
    controller.refreshing ||
    controller.sending ||
    controller.deletingBand ||
    controller.importing
  const violationByBand = new Map<string, 'hard' | 'soft'>()
  for (const constraint of event.constraints) {
    if (evaluateConstraint(constraint, event).status !== 'unmet') continue
    for (const bandId of violatedBandIds(constraint, event)) {
      if (
        constraint.hardness === 'hard' ||
        violationByBand.get(bandId) !== 'hard'
      ) {
        violationByBand.set(bandId, constraint.hardness)
      }
    }
  }
  return (
    <Panel
      busyMessage={controller.processingMessage}
      inert={
        controller.saving ||
        controller.solving ||
        controller.refreshing ||
        controller.sending ||
        controller.importing
      }
      title="出演順"
      headerClassName="flex-wrap py-2 xl:flex-nowrap xl:py-0"
      action={
        <div
          role="group"
          aria-label="出演順の操作"
          className="flex w-full max-w-full min-w-0 items-center gap-2 overflow-x-auto pb-1 xl:w-auto xl:pb-0"
        >
          <Button
            onClick={controller.undo}
            disabled={!controller.canUndo}
            aria-label="戻る"
            title="戻る"
            className="px-2.5"
          >
            <Icon name="undo" />
          </Button>
          <Button
            onClick={controller.redo}
            disabled={!controller.canRedo}
            aria-label="進む"
            title="進む"
            className="px-2.5"
          >
            <Icon name="redo" />
          </Button>
          <Button onClick={() => setEditingLive(true)} className="text-xs">
            ライブ情報の編集
          </Button>
          <Button
            onClick={() => setImportingCsv(true)}
            disabled={unavailable}
            title={
              unavailable
                ? '未保存の変更を保存し、処理完了後に追加してください'
                : undefined
            }
            className="text-xs"
          >
            CSVから追加
          </Button>
          <Button onClick={controller.exportCsv} className="text-xs">
            CSVを出力
          </Button>
          <Button
            aria-label="出演順を保存"
            className={`text-xs ${controller.scheduleDirty ? 'font-semibold' : ''}`}
            variant={controller.scheduleDirty ? 'subtle' : 'secondary'}
            disabled={
              !controller.scheduleDirty ||
              controller.saving ||
              controller.solving ||
              controller.refreshing ||
              controller.sending ||
              controller.importing
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
              controller.sending ||
              controller.importing
            }
            title="出演順・制約を保存してから計算します"
            variant="primary"
            className="text-xs font-semibold"
            onClick={() => void controller.generate()}
          >
            {controller.solving ? '計算中…' : '自動生成'}
          </Button>
        </div>
      }
      detail={
        <span className="text-xs text-muted">
          配置済み {schedule.assignedCount} / {event.performances.length}組
        </span>
      }
    >
      {controller.historyConfirmation && (
        <HistoryConfirmation controller={controller} />
      )}
      {importingCsv && (
        <RosterImportDialog
          event={event}
          onBusy={controller.setImporting}
          onClose={() => setImportingCsv(false)}
          onImported={() => {
            setImportingCsv(false)
            controller.retryLoad()
          }}
        />
      )}
      {editingLive && (
        <LiveInfoDialog
          controller={controller}
          onClose={() => setEditingLive(false)}
        />
      )}
      {selectedBand && (
        <PerformanceDetailsDialog
          event={event}
          performance={{
            ...selectedBand,
            fixed: isFixed(event, selectedBand.id),
          }}
          position={selectedRow?.order ?? null}
          unavailable={unavailable}
          deleting={controller.deletingBand}
          error={controller.error}
          onSaved={() => {
            setSelectedBandId(null)
            controller.retryLoad()
          }}
          onDelete={() => {
            void controller.deleteBand(selectedBand.id).then((deleted) => {
              if (deleted) {
                focusAfterDelete.current = true
                setSelectedBandId(null)
                requestAnimationFrame(() => {
                  if (focusAfterDelete.current) {
                    focusAfterDelete.current = false
                    scrollRef.current?.focus()
                  }
                })
              }
            })
          }}
          onRefresh={() => {
            setSelectedBandId(null)
            controller.retryLoad()
          }}
          onClose={() => setSelectedBandId(null)}
        />
      )}
      <ScheduleDragSurface controller={controller}>
        <div
          ref={scrollRef}
          role="region"
          aria-label="出演順の表"
          className="min-h-0 flex-1 scrollbar-thin overflow-auto"
        >
          <div className="min-w-170">
            <div
              className={`${rowColumns} sticky top-0 z-10 min-h-9 border-b border-line bg-white text-xs text-muted`}
            >
              <span />
              <span className="text-center">固定</span>
              <span>順</span>
              <span>出演名</span>
              <span>メンバー</span>
              <span>紹介</span>
            </div>
            {schedule.sections.map((section) => (
              <section key={section.id} aria-label={section.name}>
                <div className="flex min-h-9 items-center justify-between bg-wash px-4 text-xs">
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
                      violation={violationByBand.get(row.performance.id)}
                      capacity={
                        schedule.assignedCount + (row.order === null ? 1 : 0)
                      }
                      onFixed={setFixed}
                      onOrder={setOrder}
                      onDetails={setSelectedBandId}
                    />
                  ) : (
                    <EmptyPerformanceRow key={row.key} row={row} />
                  ),
                )}
              </section>
            ))}
            <UnassignedDropZone>
              <section aria-label="未配置">
                <div className="flex min-h-9 items-center gap-3 bg-slate-100 px-4 text-xs">
                  <h3 className="font-semibold">
                    未配置 · {schedule.unassigned.length}組
                  </h3>
                  <span className="text-muted">ドラッグまたは順番号で配置</span>
                </div>
                {schedule.unassigned.map((row) => (
                  <PerformanceRow
                    key={row.key}
                    row={row}
                    violation={violationByBand.get(row.performance.id)}
                    capacity={
                      schedule.assignedCount + (row.order === null ? 1 : 0)
                    }
                    onFixed={setFixed}
                    onOrder={setOrder}
                    onDetails={setSelectedBandId}
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
        </div>
      </ScheduleDragSurface>
    </Panel>
  )
}
