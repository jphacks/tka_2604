import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { PageState } from '../../../shared/ui/PageState'
import { ConstraintsPanel } from '../components/ConstraintsPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { useEvent } from '../hooks/useEvent'

export function EventPage() {
  const { eventId = '' } = useParams()
  const controller = useEvent(eventId)
  return (
    <AppFrame eventId={eventId} eventName={controller.event?.name}>
      {!controller.event ? (
        <PageState
          error={controller.loadError}
          onRetry={controller.retryLoad}
        />
      ) : (
        <>
          <h1 className="mb-2 text-2xl font-semibold">
            {controller.event.name}
          </h1>
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
          <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.65fr)_minmax(340px,1fr)]">
            <SchedulePanel controller={controller} />
            <ConstraintsPanel controller={controller} />
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
