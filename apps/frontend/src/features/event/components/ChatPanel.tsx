import { Badge } from '../../../shared/ui/Badge'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { useChatScroll } from '../hooks/useChatScroll'
import type { EventController } from '../hooks/useEvent'
import { ChatProposal } from './ChatProposal'
import { ReorderDialog } from './ReorderDialog'

export function ChatPanel({ controller }: { controller: EventController }) {
  const endRef = useChatScroll(
    controller.event?.messages.length ?? 0,
    controller.sending,
  )
  if (!controller.event || !controller.schedule) return null
  return (
    <Panel title="AIチャット" action={<Badge>提案は確認して反映</Badge>}>
      <div
        ref={endRef}
        className="max-h-[55dvh] min-h-64 scrollbar-thin overflow-y-auto p-3 xl:max-h-none xl:min-h-0 xl:flex-1"
      >
        <div
          role="log"
          aria-label="チャット履歴"
          aria-live="polite"
          aria-relevant="additions"
          className="space-y-4"
        >
          {controller.event.messages.map((message) => (
            <div
              key={message.id}
              className={message.role === 'user' ? 'ml-7' : ''}
            >
              <p
                className={`mb-1.5 text-xs text-muted ${message.role === 'user' ? 'italic' : ''}`}
              >
                {message.role === 'user' ? 'あなた' : 'AIアシスタント'}
              </p>
              <div
                className={`rounded-lg px-3 py-3 text-[13px] leading-[1.85] whitespace-pre-wrap ${message.role === 'user' ? 'bg-[#eaf2ff] text-[#28588f]' : 'bg-[#f2f5f9]'}`}
              >
                {message.text}
              </div>
              {controller.unanswered.some((item) => item.id === message.id) && (
                <Button
                  className="mt-2 text-xs"
                  disabled={controller.sending || controller.chatBlocked}
                  onClick={() => void controller.retryMessage(message)}
                >
                  この発言を再試行
                </Button>
              )}
            </div>
          ))}
          {controller.sending && (
            <div role="status">
              <p className="mb-1.5 text-xs text-muted">AIアシスタント</p>
              <div
                className="inline-flex items-center gap-1 rounded-lg bg-canvas px-4 py-3"
                aria-label="返信を準備中"
              >
                <span className="size-1.5 rounded-full bg-muted motion-safe:animate-pulse" />
                <span className="size-1.5 rounded-full bg-muted [animation-delay:150ms] motion-safe:animate-pulse" />
                <span className="size-1.5 rounded-full bg-muted [animation-delay:300ms] motion-safe:animate-pulse" />
              </div>
            </div>
          )}
        </div>
        <ChatProposal controller={controller} />
        <ReorderDialog controller={controller} />
        <div className="mt-3 rounded-lg border border-line p-3">
          <h3 className="mb-2 text-xs font-semibold">現在の配置</h3>
          <p className="text-xs leading-5 text-muted">
            {controller.event.sections.length}部・配置済み{' '}
            {controller.schedule.assignedCount}組・未配置{' '}
            {controller.event.unassigned.length}組<br />
            出演間隔を部内に限るかは、各制約で設定できます。
          </p>
          <Button
            variant="subtle"
            className="mt-3 text-xs"
            onClick={() => controller.setShowUnmet(true)}
          >
            未達成の条件を確認
          </Button>
        </div>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void controller.sendMessage()
        }}
        className="shrink-0 border-t border-line p-3"
      >
        {controller.scheduleDirty && (
          <p className="mb-2 text-xs text-muted">
            出演順の変更を保存してから送信してください。
          </p>
        )}
        <div className="rounded-lg border border-[#cbd9ed] p-3 transition-colors focus-within:border-brand">
          <textarea
            aria-label="AIへのメッセージ"
            placeholder="要望や調整したいことを入力…"
            value={controller.chatDraft}
            onChange={(event) => controller.setChatDraft(event.target.value)}
            maxLength={1000}
            rows={2}
            onKeyDown={(event) => {
              if (
                event.key === 'Enter' &&
                (event.ctrlKey || event.metaKey) &&
                !event.nativeEvent.isComposing
              ) {
                event.preventDefault()
                void controller.sendMessage()
              }
            }}
            className="w-full resize-none bg-transparent text-[13px] leading-6 placeholder:text-muted focus-visible:ring-0"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-[11px] text-muted">
              Ctrl / ⌘ + Enterで送信
            </span>
            <Button
              variant="primary"
              type="submit"
              disabled={!controller.canSend}
              aria-label="メッセージを送信"
              className="size-[34px] min-h-0 p-0"
            >
              <Icon name="arrow" />
            </Button>
          </div>
        </div>
        <p className="mt-2 text-center text-[10px] text-muted/80">
          確認して反映した制約は自動保存されます。
        </p>
      </form>
    </Panel>
  )
}
