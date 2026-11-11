import { useState } from 'react'

import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import type { EventController } from '../hooks/useEvent'

export function HistoryConfirmation({
  controller,
}: {
  controller: EventController
}) {
  const [skip, setSkip] = useState(false)
  return (
    <Dialog title="制約の変更を確認" onClose={controller.cancelHistory}>
      <p className="text-sm">
        この操作で制約が変わり、自動保存されます。出演順の変更は保存ボタンで保存してください。
      </p>
      <label className="my-4 flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={skip}
          onChange={(event) => setSkip(event.target.checked)}
        />
        今後この確認を表示しない
      </label>
      <div className="flex justify-end gap-2">
        <Button onClick={controller.cancelHistory}>キャンセル</Button>
        <Button
          variant="primary"
          onClick={() => controller.confirmHistory(skip)}
        >
          {controller.historyConfirmation === 'undo' ? '戻る' : '進む'}
        </Button>
      </div>
    </Dialog>
  )
}
