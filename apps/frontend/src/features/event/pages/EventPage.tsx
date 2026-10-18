import type { CSSProperties } from 'react'
import { useState } from 'react'
import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { ChatPanel } from '../components/ChatPanel'
import { ColumnResizer } from '../components/ColumnResizer'
import { ConstraintsPanel } from '../components/ConstraintsPanel'
import { SchedulePanel } from '../components/SchedulePanel'
import { type WorkspacePanel, WorkspaceTabs } from '../components/WorkspaceTabs'
import { useColumnResize } from '../hooks/useColumnResize'
import { useEvent } from '../hooks/useEvent'

export function EventPage() {
  const { eventId = '' } = useParams()
  return <EventWorkspace key={eventId} eventId={eventId} />
}

function EventWorkspace({ eventId }: { eventId: string }) {
  const controller = useEvent(eventId)
  const columns = useColumnResize()
  const [activePanel, setActivePanel] = useState<WorkspacePanel>('schedule')
  const showConstraints = () => {
    controller.setShowUnmet(true)
    setActivePanel('constraints')
    document.getElementById('workspace-tab-constraints')?.focus()
  }
  return (
    <AppFrame workspace eventId={eventId} eventName={controller.event?.name}>
      {!controller.event ? (
        <PageState
          error={controller.loadError}
          onRetry={controller.retryLoad}
          action={
            <LinkButton primary to="/event?create=1">
              イベントを作成
            </LinkButton>
          }
        />
      ) : (
        <>
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
          <WorkspaceTabs active={activePanel} onChange={setActivePanel} />
          <div
            style={
              {
                '--constraints-width': `${columns.widths.constraints}px`,
                '--chat-width': `${columns.widths.chat}px`,
              } as CSSProperties
            }
            className="relative grid min-h-0 min-w-0 flex-1 xl:grid-cols-[minmax(0,1fr)_var(--constraints-width)_var(--chat-width)]"
          >
            {(
              [
                ['schedule', <SchedulePanel controller={controller} />],
                ['constraints', <ConstraintsPanel controller={controller} />],
                [
                  'chat',
                  <ChatPanel
                    controller={controller}
                    onShowConstraints={showConstraints}
                    active={activePanel === 'chat'}
                  />,
                ],
              ] as const
            ).map(([id, panel]) => (
              <div
                key={id}
                id={`workspace-panel-${id}`}
                role="tabpanel"
                aria-labelledby={`workspace-tab-${id}`}
                tabIndex={0}
                className={`min-h-0 min-w-0 flex-col xl:flex ${activePanel === id ? 'flex' : 'hidden'}`}
              >
                {panel}
              </div>
            ))}
            <ColumnResizer
              handle="constraints"
              label="出演順と制約の幅を変更"
              right={columns.widths.constraints + columns.widths.chat}
              columns={columns}
            />
            <ColumnResizer
              handle="chat"
              label="制約とAIチャットの幅を変更"
              right={columns.widths.chat}
              columns={columns}
            />
          </div>
        </>
      )}
      {controller.event &&
        (controller.notice || controller.error || controller.loadError) && (
          <div
            role={controller.error || controller.loadError ? 'alert' : 'status'}
            className={`fixed right-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] left-3 z-40 flex max-h-[50dvh] flex-wrap items-center justify-between gap-3 overflow-y-auto rounded-lg border bg-white p-3 shadow-sm xl:right-auto xl:bottom-3 xl:max-w-xl ${controller.error || controller.loadError ? 'border-red-200 text-red-700' : 'border-brand/30 text-brand'}`}
          >
            <p className="min-w-0 flex-1 basis-full wrap-anywhere xl:basis-auto">
              {controller.error || controller.loadError || controller.notice}
            </p>
            {controller.saveFailed ? (
              <>
                <Button onClick={() => void controller.retrySave()}>
                  保存を再試行
                </Button>
                <Button onClick={controller.retryLoad}>最新の状態を取得</Button>
              </>
            ) : (
              <Button
                variant="ghost"
                aria-label="通知を閉じる"
                onClick={controller.dismissNotice}
              >
                閉じる
              </Button>
            )}
          </div>
        )}
    </AppFrame>
  )
}
