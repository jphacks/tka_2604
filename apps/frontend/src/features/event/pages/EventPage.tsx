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
  const controller = useEvent(eventId)
  return (
    <AppFrame wide eventId={eventId} eventName={controller.event?.name}>
      {!controller.event ? (
        <PageState
          error={controller.loadError}
          onRetry={controller.retryLoad}
        />
      ) : (
        <>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-4">
            <h1 className="text-2xl font-semibold">{controller.event.name}</h1>
            <div className="flex gap-2">
              <Button disabled title="ソルバー接続は準備中です">
                自動生成（準備中）
              </Button>
              <Button onClick={controller.exportCsv}>CSVを出力</Button>
            </div>
          </div>
          <p className="mb-6 text-sm text-muted">
            出演順を調整し、現在の並びに対する条件を確認できます。
          </p>
          {controller.hardViolationCount > 0 && (
            <p
              role="status"
              className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              ハード条件に{controller.hardViolationCount}
              件の違反があります。条件を確認し、並びを調整してください。
            </p>
          )}
          {controller.event.performances.length === 0 && (
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-brand/20 bg-wash p-4">
              <p className="text-sm">まず出演名とメンバーを登録しましょう。</p>
              <LinkButton primary to={`/event/${eventId}/performances`}>
                出演枠を登録する
              </LinkButton>
            </div>
          )}
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.5fr)_minmax(340px,1fr)] 2xl:grid-cols-[minmax(500px,1.6fr)_minmax(300px,1fr)_minmax(300px,1fr)]">
            <SchedulePanel controller={controller} />
            <ConstraintsPanel controller={controller} />
            <div className="min-w-0 xl:col-span-2 2xl:col-span-1">
              <ChatPanel controller={controller} />
            </div>
          </div>
        </>
      )}
      {(controller.notice || controller.error) && (
        <div
          role={controller.error ? 'alert' : 'status'}
          className={`sticky bottom-4 z-40 mt-4 flex items-center justify-between gap-3 rounded-lg border bg-white p-3 shadow-sm ${controller.error ? 'border-red-200 text-red-700' : 'border-brand/30 text-brand'}`}
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
