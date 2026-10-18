import { Button } from './Button'
import { Dialog } from './Dialog'

export function ConfirmDialog({
  title,
  message,
  error,
  busy,
  onCancel,
  onConfirm,
  onRefresh,
}: {
  title: string
  message: string
  error?: string
  busy?: boolean
  onCancel: () => void
  onRefresh?: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog title={title} onClose={onCancel} busy={busy}>
      <p className="text-sm leading-7">{message}</p>
      {error && (
        <p role="alert" className="mt-4 text-xs text-red-500">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        {error && onRefresh && (
          <Button onClick={onRefresh} disabled={busy}>
            最新の状態を取得
          </Button>
        )}
        <Button onClick={onCancel} disabled={busy}>
          キャンセル
        </Button>
        <Button variant="danger" onClick={onConfirm} disabled={busy}>
          {busy ? '削除中…' : '削除する'}
        </Button>
      </div>
    </Dialog>
  )
}
