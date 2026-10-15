import { Button } from './Button'
import { Dialog } from './Dialog'

export function ConfirmDialog({
  title,
  message,
  error,
  busy,
  onCancel,
  onConfirm,
}: {
  title: string
  message: string
  error?: string
  busy?: boolean
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <Dialog title={title} onClose={onCancel}>
      <p className="text-sm leading-7">{message}</p>
      {error && (
        <p role="alert" className="mt-4 text-xs text-red-500">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
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
