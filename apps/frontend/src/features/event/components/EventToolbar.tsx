import { useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Icon } from '../../../shared/ui/Icon'
import { FormEditorPage } from '../../forms/pages/FormEditorPage'
import { RosterImportDialog } from '../../participants/components/RosterImportDialog'
import type { EventController } from '../hooks/useEvent'
import { LiveInfoDialog } from './LiveInfoDialog'

export function EventToolbar({ controller }: { controller: EventController }) {
  const [dialog, setDialog] = useState<'edit' | 'csv' | 'forms' | null>(null)
  const event = controller.event
  if (!event) return null
  const unavailable = Boolean(
    controller.scheduleDirty ||
    controller.constraintsDirty ||
    controller.saving ||
    controller.solving ||
    controller.refreshing ||
    controller.sending ||
    controller.deletingBand ||
    controller.importing,
  )
  return (
    <>
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line bg-white px-3 py-3 sm:px-6">
        <div className="flex min-w-0 flex-1 basis-full items-center gap-2 sm:basis-auto">
          <h1
            title={event.name}
            className="min-w-0 truncate text-sm font-semibold"
          >
            {event.name}
          </h1>
          <Button
            variant="ghost"
            aria-label="ライブ情報の編集"
            title="ライブ情報の編集"
            className="shrink-0 px-2"
            disabled={Boolean(controller.processingMessage)}
            onClick={() => setDialog('edit')}
          >
            <Icon name="edit" />
          </Button>
          {controller.processingMessage && (
            <span
              role="status"
              className="flex max-w-1/2 min-w-0 items-center gap-2 text-xs text-brand"
            >
              <span
                aria-hidden="true"
                className="size-3 shrink-0 animate-spin rounded-full border-2 border-brand/30 border-t-brand"
              />
              <span className="truncate">{controller.processingMessage}</span>
            </span>
          )}
        </div>
        <div
          role="group"
          aria-label="イベントの操作"
          className="ml-auto flex max-w-full flex-wrap justify-end gap-2"
        >
          <Button
            className="text-xs"
            disabled={unavailable}
            title={
              unavailable
                ? '未保存の変更を保存し、処理完了後に追加してください'
                : undefined
            }
            onClick={() => setDialog('csv')}
          >
            CSVから追加
          </Button>
          <Button className="text-xs" onClick={controller.exportCsv}>
            CSVを出力
          </Button>
          <Button className="text-xs" onClick={() => setDialog('forms')}>
            <Icon name="form" />
            フォーム管理
          </Button>
        </div>
      </div>
      {dialog === 'edit' && (
        <LiveInfoDialog
          controller={controller}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'forms' && (
        <Dialog title="フォーム管理" onClose={() => setDialog(null)}>
          <FormEditorPage embedded />
        </Dialog>
      )}
      {dialog === 'csv' && (
        <RosterImportDialog
          event={event}
          onBusy={controller.setImporting}
          onClose={() => setDialog(null)}
          onImported={() => {
            setDialog(null)
            controller.retryLoad()
          }}
        />
      )}
    </>
  )
}
