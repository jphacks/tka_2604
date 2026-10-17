import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { ChatPanel } from '../components/ChatPanel'
import { ConstraintsPanel } from '../components/ConstraintsPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { useEvent } from '../hooks/useEvent'

export function EventPage() {
  const { eventId = '' } = useParams()
  return <EventWorkspace key={eventId} eventId={eventId} />
}

function EventWorkspace({ eventId }: { eventId: string }) {
  const controller = useEvent(eventId)
  return (
    <AppFrame workspace eventId={eventId} eventName={controller.event?.name}>
      {!controller.event ? (
        <PageState
          error={controller.loadError}
          onRetry={controller.retryLoad}
        />
      ) : (
        <>
          {controller.persistent && (
            <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-line bg-white p-3 text-xs">
              <span role="status">
                出演順：{controller.scheduleDirty ? '未保存' : '保存済み'} /
                制約：{controller.constraintsDirty ? '未保存' : '保存済み'}
              </span>
              <Button
                disabled={
                  !controller.scheduleDirty ||
                  controller.saving ||
                  controller.sending
                }
                onClick={() => void controller.saveSchedule()}
              >
                出演順を保存
              </Button>
              <Button
                disabled={
                  !controller.constraintsDirty ||
                  controller.saving ||
                  controller.sending
                }
                onClick={() => void controller.saveConstraints()}
              >
                制約を保存
              </Button>
              <Button
                disabled={
                  controller.saving ||
                  controller.refreshing ||
                  controller.sending
                }
                onClick={controller.retryLoad}
              >
                最新の状態を取得
              </Button>
              {controller.saving && <span role="status">保存中…</span>}
              {controller.loadError && (
                <span role="alert">{controller.loadError}</span>
              )}
            </div>
          )}
          {controller.hardViolationCount > 0 && (
            <p
              role="status"
              className="shrink-0 border-b border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700"
            >
              必須条件に{controller.hardViolationCount}
              件の違反があります。条件を確認し、並びを調整してください。
            </p>
          )}
          {controller.event.performances.length === 0 && (
            <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-brand/20 bg-wash p-3">
              <p className="text-sm">まず出演名とメンバーを登録しましょう。</p>
              <LinkButton primary to={`/event/${eventId}/performances`}>
                出演枠を登録する
              </LinkButton>
            </div>
          )}
          <div className="grid min-h-0 min-w-0 flex-1 xl:grid-cols-[minmax(0,1fr)_300px_320px]">
            <fieldset
              disabled={
                controller.saving || controller.refreshing || controller.sending
              }
              className="contents"
            >
              <SchedulePanel controller={controller} />
              <ConstraintsPanel controller={controller} />
            </fieldset>
            <ChatPanel controller={controller} />
          </div>
        </>
      )}
      {(controller.notice || controller.error) && (
        <div
          role={controller.error ? 'alert' : 'status'}
          className={`fixed right-3 bottom-3 left-3 z-40 flex items-center justify-between gap-3 rounded-lg border bg-white p-3 shadow-sm xl:right-auto xl:max-w-xl ${controller.error ? 'border-red-200 text-red-700' : 'border-brand/30 text-brand'}`}
        >
          <p>{controller.error || controller.notice}</p>
          <Button
            variant="ghost"
            aria-label="通知を閉じる"
            onClick={controller.dismissNotice}
          >
            閉じる
          </Button>
        </div>
      )}
    </AppFrame>
  )
}
