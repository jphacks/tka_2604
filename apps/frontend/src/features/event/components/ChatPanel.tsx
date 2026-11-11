import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { useChatScroll } from '../hooks/useChatScroll'
import type { EventController } from '../hooks/useEvent'
import { ChatComposer } from './ChatComposer'
import { ChatProposal } from './ChatProposal'
import { ReorderDialog } from './ReorderDialog'

const TEMPLATE_PROMPTS = [
  '〇〇と〇〇の間隔を2バンド空けてほしい',
  '〇〇さんは前後3バンド開けて配置したい',
  '後半ほど盛り上がる順にして',
]

export function ChatPanel({
  controller,
  active,
}: {
  controller: EventController
  active: boolean
}) {
  const endRef = useChatScroll(
    controller.event?.messages.length ?? 0,
    controller.sending,
    active,
  )
  if (!controller.event || !controller.schedule) return null
  return (
    <Panel
      title="AIチャット"
      busy={controller.sending}
      headerClassName="flex-wrap gap-y-1 py-2"
      action={
        <label
          className="flex items-center gap-1 text-xs"
          title="制約の追加・変更を自動承認します。削除や設定不足の提案は手動で確認します。設定はこのブラウザに保存します。"
        >
          <input
            type="checkbox"
            checked={controller.autoApprove}
            disabled={Boolean(controller.processingMessage)}
            onChange={(event) =>
              controller.setAutoApprove(event.target.checked)
            }
          />
          制約の追加・変更を自動承認
        </label>
      }
      busyMessage={controller.processingMessage}
      className="xl:border-r-0"
    >
      <div
        ref={endRef}
        className="flex min-h-0 flex-1 scrollbar-thin flex-col overflow-y-auto p-3 wrap-anywhere"
      >
        <div className="shrink-0">
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
                {controller.unanswered.some(
                  (item) => item.id === message.id,
                ) && (
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
          {controller.pendingDecision && (
            <Button
              className="mt-2 text-xs"
              onClick={() => void controller.retryDecision()}
            >
              選択の記録を再試行
            </Button>
          )}
          <ReorderDialog controller={controller} />
        </div>
        {controller.event.messages.length === 0 && (
          <div className="mt-auto mb-3 rounded-lg border border-line p-3">
            <p className="text-xs leading-5 text-muted">
              プロンプトの例（クリックすると入力）
            </p>
            {TEMPLATE_PROMPTS.map((prompt) => (
              <Button
                key={prompt}
                variant="subtle"
                className="mt-3 text-xs"
                disabled={controller.sending}
                onClick={() => controller.setChatDraft(prompt)}
              >
                {prompt}
              </Button>
            ))}
          </div>
        )}
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
          <ChatComposer
            value={controller.chatDraft}
            onChange={controller.setChatDraft}
            onSubmit={() => void controller.sendMessage()}
            disabled={controller.sending}
            active={active}
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="text-xs text-muted">Ctrl / ⌘ + Enterで送信</span>
            <Button
              variant="primary"
              type="submit"
              disabled={!controller.canSend}
              aria-label="メッセージを送信"
              className="size-8.5 min-h-0 p-0"
            >
              <Icon name="arrow" />
            </Button>
          </div>
        </div>
      </form>
    </Panel>
  )
}
