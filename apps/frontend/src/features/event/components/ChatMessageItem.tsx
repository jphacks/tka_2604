import type { ChatMessage } from '../../../shared/model/event'
import { Icon } from '../../../shared/ui/Icon'
import { isDecisionMessage } from '../model/chatMessage'

export function ChatMessageItem({ message }: { message: ChatMessage }) {
  if (isDecisionMessage(message)) {
    return (
      <div
        role="note"
        aria-label="システムメッセージ"
        className="flex items-center gap-3 py-1 text-xs text-muted"
      >
        <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-line" />
        <p className="flex min-w-0 items-center gap-1.5 text-center">
          <Icon name="info" className="size-3.5" />
          {message.text}
        </p>
        <span aria-hidden="true" className="h-px min-w-3 flex-1 bg-line" />
      </div>
    )
  }
  const isUser = message.role === 'user'
  return (
    <div className={isUser ? 'ml-7' : ''}>
      {!isUser && <p className="mb-1.5 text-xs text-muted">AIアシスタント</p>}
      <div
        className={`rounded-lg px-3 py-3 text-[13px] leading-[1.85] whitespace-pre-wrap ${isUser ? 'bg-[#eaf2ff] text-[#28588f]' : 'bg-[#f2f5f9]'}`}
      >
        {message.text}
      </div>
    </div>
  )
}
