import { useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { PartCountFields } from '../../../shared/ui/PartCountFields'
import { EventSettingsPage } from '../../events/pages/EventSettingsPage'
import type { EventController } from '../hooks/useEvent'

export function LiveInfoDialog({
  controller,
  onClose,
}: {
  controller: EventController
  onClose: () => void
}) {
  const [counts, setCounts] = useState(() =>
    controller.event!.sections.map((part) => part.slots.length),
  )
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const close = () => {
    if (!busy) onClose()
  }
  return (
    <Dialog title="ライブ情報の編集" onClose={close} busy={busy}>
      {(controller.scheduleDirty || controller.constraintsDirty) && (
        <p className="mb-4 text-xs text-muted">
          基本情報を変更する前に、出演順・制約の変更を保存してください。
        </p>
      )}
      <EventSettingsPage
        embedded
        onBusyChange={setBusy}
        disabled={controller.scheduleDirty || controller.constraintsDirty}
        onSaved={controller.retryLoad}
      />
      <h3 className="mt-6 mb-4 font-semibold">部構成</h3>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const message = controller.configureSchedule(counts)
          setError(message)
          if (!message) onClose()
        }}
      >
        <fieldset disabled={busy}>
          <PartCountFields counts={counts} onChange={setCounts} />
        </fieldset>
        <p className="text-xs leading-5 text-muted">
          枠を減らすと、収まらない出演枠は未配置に戻ります。
          適用後、出演順の「保存」で変更を保存してください。
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-600">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={close} disabled={busy}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={busy}>
            適用
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
