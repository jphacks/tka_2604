import { useParams } from 'react-router'

import type { EventStatus } from '../../../shared/model/workspace'
import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select, Textarea } from '../../../shared/ui/Input'
import { PageState } from '../../../shared/ui/PageState'
import { useEventDeletion, useEventSettings } from '../hooks/useEventSettings'

export function EventSettingsPage() {
  const { eventId = '' } = useParams()
  const controller = useEventSettings(eventId)
  const deletion = useEventDeletion(eventId)
  const settings = controller.settings
  return (
    <AppFrame eventId={eventId} eventName={controller.data?.name}>
      <div className="mb-7">
        <p className="mb-2 text-[11px] font-semibold tracking-[0.16em] text-muted">
          EVENT SETTINGS
        </p>
        <h1 className="text-2xl font-semibold">イベント設定</h1>
        <p className="mt-2 text-xs text-muted">
          イベントの基本情報を管理します。
        </p>
      </div>
      {controller.loading || controller.error ? (
        <PageState error={controller.error} onRetry={controller.refresh} />
      ) : (
        settings && (
          <div className="max-w-[720px]">
            <form
              onSubmit={(event) => {
                event.preventDefault()
                void controller.save()
              }}
              className="space-y-5 rounded-xl border border-line bg-white p-6"
            >
              <h2 className="mb-5 text-sm font-semibold">基本情報</h2>
              <fieldset disabled={controller.busy} className="space-y-5">
                <label className="block text-xs font-medium">
                  イベント名
                  <Input
                    value={settings.name}
                    onChange={(event) =>
                      controller.change({ name: event.target.value })
                    }
                    maxLength={80}
                    className="mt-2 w-full"
                  />
                </label>
                <div className="grid grid-cols-2 gap-4">
                  <label className="block text-xs font-medium">
                    開催日
                    <Input
                      type="date"
                      value={settings.date}
                      onChange={(event) =>
                        controller.change({ date: event.target.value })
                      }
                      className="mt-2 w-full"
                    />
                  </label>
                  <label className="block text-xs font-medium">
                    会場
                    <Input
                      value={settings.venue}
                      onChange={(event) =>
                        controller.change({ venue: event.target.value })
                      }
                      maxLength={80}
                      className="mt-2 w-full"
                    />
                  </label>
                </div>
                <label className="block text-xs font-medium">
                  イベントについて
                  <Textarea
                    value={settings.description}
                    onChange={(event) =>
                      controller.change({ description: event.target.value })
                    }
                    maxLength={500}
                    rows={3}
                    className="mt-2 w-full"
                  />
                </label>
                <label className="block text-xs font-medium">
                  ステータス
                  <Select
                    value={settings.status}
                    onChange={(event) =>
                      controller.change({
                        status: event.target.value as EventStatus,
                      })
                    }
                    className="mt-2 block w-full"
                  >
                    <option value="planning">準備中</option>
                    <option value="adjusting">調整中</option>
                    <option value="confirmed">確定</option>
                  </Select>
                </label>
              </fieldset>
              {controller.formError && (
                <p role="alert" className="text-xs text-red-600">
                  {controller.formError}
                </p>
              )}
              <div className="flex justify-end">
                <Button
                  type="submit"
                  variant="primary"
                  disabled={controller.busy}
                >
                  {controller.busy ? '保存中…' : '変更を保存'}
                </Button>
              </div>
            </form>
            {controller.notice && (
              <p
                role="status"
                className="mt-4 rounded-lg bg-wash p-4 text-xs text-brand"
              >
                {controller.notice}
              </p>
            )}
            <section className="mt-7 flex flex-wrap items-center justify-between gap-6 rounded-xl border border-red-100 bg-white p-6">
              <div>
                <h2 className="text-sm font-semibold">イベントの削除</h2>
                <p className="mt-2 text-xs leading-6 text-muted">
                  出演枠、制約、フォームの回答を含めて削除します。
                </p>
              </div>
              <Button variant="danger" onClick={deletion.requestDelete}>
                <Icon name="trash" />
                削除
              </Button>
            </section>
          </div>
        )
      )}
      {deletion.deleting && (
        <ConfirmDialog
          title="イベントを削除"
          message={`「${settings?.name}」と関連する出演枠・制約・フォーム回答を削除します。`}
          error={deletion.error}
          busy={deletion.busy}
          onCancel={deletion.cancelDelete}
          onConfirm={() => void deletion.remove()}
        />
      )}
    </AppFrame>
  )
}
