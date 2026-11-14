import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Panel } from '../../../shared/ui/Panel'
import { useChatScroll } from '../hooks/useChatScroll'
import type { EventController } from '../hooks/useEvent'
import { ChatComposer } from './ChatComposer'
import { ChatMessageItem } from './ChatMessageItem'
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
      busy={Boolean(controller.processingMessage)}
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
              <ChatMessageItem key={message.id} message={message} />
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
                disabled={controller.sending || controller.recordingDecision}
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
        className="shrink-0 border-t border-line bg-white p-3"
      >
        {controller.scheduleDirty && (
          <p className="mb-2 text-xs text-muted">
            出演順の変更を保存してから送信してください。
          </p>
        )}
        {controller.chatError && (
          <div
            role="alert"
            className="mx-2 -mb-3 flex items-start gap-2 rounded-t-xl border border-red-200 bg-red-50 px-3 pt-2.5 pb-5 text-xs leading-5 text-red-700"
          >
            <div className="min-w-0 flex-1 wrap-anywhere">
              <p className="font-semibold">
                {controller.pendingDecision
                  ? '選択の記録に失敗しました'
                  : 'メッセージの送信に失敗しました'}
              </p>
              <p>送信ボタンからもう一度送信してください。</p>
            </div>
            <Button
              variant="ghost"
              className="min-h-0 px-1 py-0.5 text-red-700 hover:bg-red-100 hover:text-red-800"
              aria-label="エラーを閉じる"
              onClick={controller.dismissChatError}
            >
              <Icon name="close" />
            </Button>
          </div>
        )}
        <div className="relative z-10 rounded-xl border border-[#cbd9ed] bg-white p-3 transition-colors focus-within:border-brand">
          <ChatComposer
            value={controller.chatDraft}
            onChange={controller.setChatDraft}
            onSubmit={() => void controller.sendMessage()}
            disabled={controller.sending || controller.recordingDecision}
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
