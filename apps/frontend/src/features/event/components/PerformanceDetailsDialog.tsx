import { useEffect, useState } from 'react'

import type { EventData, Performance } from '../../../shared/model/event'
import { memberNames } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { RegistrationFields } from '../../forms/components/RegistrationFields'
import { usePublicRegistration } from '../../forms/hooks/usePublicRegistration'

export function PerformanceDetailsDialog({
  event,
  performance,
  position,
  unavailable,
  deleting,
  error,
  onSaved,
  onDelete,
  onRefresh,
  onClose,
}: {
  event: EventData
  performance: Performance & { fixed: boolean }
  position: number | null
  unavailable: boolean
  deleting: boolean
  error: string
  onSaved: () => void
  onDelete: () => void
  onRefresh: () => void
  onClose: () => void
}) {
  const [confirming, setConfirming] = useState(false)
  const [editing, setEditing] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const members = memberNames(event, performance)
  return (
    <Dialog
      title={
        confirming
          ? '出演枠の削除'
          : editing
            ? '出演枠を編集'
            : performance.name
      }
      onClose={onClose}
      busy={deleting || savingEdit}
    >
      {confirming ? (
        <>
          <p className="text-sm leading-7">
            「{performance.name}
            」を削除します。配置は空き枠に戻り、この出演枠の希望から作られた制約だけを削除します。メンバー名簿と他の所属は残ります。
          </p>
          {error && (
            <div className="mt-4 space-y-3">
              <p role="alert" className="text-xs leading-5 text-red-700">
                {error}
              </p>
              <Button
                onClick={() => {
                  onRefresh()
                  onClose()
                }}
                disabled={deleting}
              >
                最新の状態を取得
              </Button>
            </div>
          )}
          <div className="mt-6 flex justify-end gap-2">
            <Button onClick={() => setConfirming(false)} disabled={deleting}>
              戻る
            </Button>
            <Button
              variant="danger"
              onClick={onDelete}
              disabled={deleting || unavailable}
            >
              {deleting ? '削除中…' : '削除する'}
            </Button>
          </div>
        </>
      ) : editing ? (
        <PerformanceEditForm
          eventId={event.id}
          bandId={performance.id}
          unavailable={unavailable}
          onBusyChange={setSavingEdit}
          onCancel={() => setEditing(false)}
          onSaved={onSaved}
        />
      ) : (
        <>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="text-xs text-muted">配置</dt>
              <dd className="mt-1">
                {position === null ? '未配置' : `${position}番`}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">メンバー</dt>
              <dd className="mt-1 leading-6">
                {members.length ? members.join('・') : '登録なし'}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-muted">紹介</dt>
              <dd className="mt-1 leading-6 whitespace-pre-wrap">
                {performance.description?.trim() || '紹介はありません。'}
              </dd>
            </div>
            {performance.fixed && (
              <p className="rounded-md bg-wash px-3 py-2 text-xs text-brand">
                この出演枠は現在の位置に固定されています。
              </p>
            )}
          </dl>
          {unavailable && (
            <p className="mt-4 text-xs text-muted">
              未保存の変更を保存してから編集・削除できます。
            </p>
          )}
          <div className="mt-6 flex flex-wrap justify-end gap-2">
            <Button
              variant="danger"
              onClick={() => setConfirming(true)}
              disabled={unavailable || deleting}
            >
              削除
            </Button>
            <Button onClick={onClose}>閉じる</Button>
            <Button
              variant="primary"
              disabled={unavailable || deleting}
              onClick={() => setEditing(true)}
            >
              編集
            </Button>
          </div>
        </>
      )}
    </Dialog>
  )
}

function PerformanceEditForm({
  eventId,
  bandId,
  unavailable,
  onBusyChange,
  onCancel,
  onSaved,
}: {
  eventId: string
  bandId: string
  unavailable: boolean
  onBusyChange: (busy: boolean) => void
  onCancel: () => void
  onSaved: () => void
}) {
  const controller = usePublicRegistration(eventId, undefined, bandId)
  useEffect(() => {
    onBusyChange(controller.busy)
  }, [controller.busy, onBusyChange])
  useEffect(() => {
    if (controller.submitted) onSaved()
  }, [controller.submitted, onSaved])

  if (controller.loading)
    return <p className="text-sm text-muted">出演情報を読み込んでいます…</p>
  if (controller.error)
    return (
      <div className="space-y-4">
        <p role="alert" className="text-sm text-red-700">
          {controller.error}
        </p>
        <div className="flex justify-end gap-2">
          <Button onClick={() => void controller.refresh()}>再読み込み</Button>
          <Button onClick={onCancel}>戻る</Button>
        </div>
      </div>
    )

  return (
    <form
      noValidate
      onSubmit={(submit) => {
        submit.preventDefault()
        void controller.submit()
      }}
    >
      <fieldset
        disabled={unavailable || controller.busy || controller.refreshing}
        className="space-y-5 disabled:opacity-60"
      >
        {controller.data && <RegistrationFields controller={controller} />}
        {controller.formError && (
          <p role="alert" className="text-xs leading-5 text-red-700">
            {controller.formError}
          </p>
        )}
        {controller.conflict && (
          <Button
            onClick={() => void controller.refresh()}
            disabled={controller.busy || controller.refreshing}
          >
            最新の名簿を取得
          </Button>
        )}
        <div className="flex justify-end gap-2 border-t border-line pt-4">
          <Button onClick={onCancel} disabled={controller.busy}>
            キャンセル
          </Button>
          <Button
            variant="primary"
            type="submit"
            disabled={
              unavailable ||
              controller.busy ||
              controller.refreshing ||
              controller.conflict ||
              !controller.data
            }
          >
            {controller.busy ? '保存中…' : '変更を保存'}
          </Button>
        </div>
      </fieldset>
    </form>
  )
}
