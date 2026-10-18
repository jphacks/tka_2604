import { useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { PartCountFields } from '../../../shared/ui/PartCountFields'
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
  return (
    <Dialog title="ライブ情報の編集" onClose={onClose}>
      <form
        className="space-y-4"
        onSubmit={(event) => {
          event.preventDefault()
          const message = controller.configureSchedule(counts)
          setError(message)
          if (!message) onClose()
        }}
      >
        <PartCountFields counts={counts} onChange={setCounts} />
        <p className="text-xs leading-5 text-muted">
          枠を減らすと、収まらないバンドは未配置に戻ります。
          適用後、出演順の「保存」で変更を保存してください。
        </p>
        {error && (
          <p role="alert" className="text-xs text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={onClose}>キャンセル</Button>
          <Button type="submit" variant="primary">
            適用
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
