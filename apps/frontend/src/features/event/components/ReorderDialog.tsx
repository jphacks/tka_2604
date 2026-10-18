import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import type { EventController } from '../hooks/useEvent'
import {
  applyChatReorder,
  type ReorderChange,
  summarizeChatReorder,
} from '../model/chatReorder'
import { ReorderPreview } from './ReorderPreview'

const priorityLabel = { high: '高', mid: '中', low: '低' } as const

function Changes({
  title,
  items,
  tone,
}: {
  title: string
  items: ReorderChange[]
  tone: string
}) {
  if (!items.length) return null
  return (
    <section className={`mt-4 rounded-lg border p-3 text-xs ${tone}`}>
      <h3 className="mb-2 font-semibold">
        {title}（{items.length}件）
      </h3>
      <ul className="space-y-2">
        {items.map((item) => (
          <li key={item.constraintId}>
            <p>
              {item.text}
              {item.priority && `（優先度：${priorityLabel[item.priority]}）`}
            </p>
            {item.explanations.map((text) => (
              <p key={text} className="mt-0.5 opacity-80">
                {text}
              </p>
            ))}
          </li>
        ))}
      </ul>
    </section>
  )
}

export function ReorderDialog({ controller }: { controller: EventController }) {
  const reorder = controller.chatReorder
  const event = controller.event
  if (!reorder || !event) return null
  let error = ''
  let next = event
  try {
    next = applyChatReorder(event, reorder)
  } catch (cause) {
    error =
      cause instanceof Error ? cause.message : '並べ替え案を確認してください。'
  }
  const summary = summarizeChatReorder(event, reorder)
  const hard = summary.hardViolations.length > 0
  const busy = controller.chatBlocked || controller.sending || controller.saving
  return (
    <Dialog title="並べ替え案の確認" onClose={controller.dismissReorder}>
      <p className="text-sm leading-6">{reorder.reply}</p>
      {reorder.source === 'solver' && (
        <p className="mt-2 rounded-md bg-wash px-3 py-2 text-xs text-brand">
          AIの案が必須条件を満たさなかったため、必須条件を守る中でAIの並びに一番近い順番へ自動で調整しました。
        </p>
      )}
      {!error && <ReorderPreview event={event} next={next} />}
      <Changes
        title="必須条件に違反しています"
        items={summary.hardViolations}
        tone="border-red-200 bg-red-50 text-red-700"
      />
      <Changes
        title="新たに満たせなくなる任意条件"
        items={summary.softNewlyUnmet}
        tone="border-amber-200 bg-amber-50 text-amber-800"
      />
      <Changes
        title="新たに満たせる任意条件"
        items={summary.softNewlyMet}
        tone="border-line bg-wash text-ink"
      />
      {error && (
        <p role="alert" className="mt-4 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button onClick={controller.dismissReorder}>破棄する</Button>
        <Button
          variant={hard ? 'danger' : 'primary'}
          disabled={Boolean(error) || busy}
          onClick={() => void controller.applyReorder()}
        >
          {hard ? '違反を確認して保存' : 'この並びで保存'}
        </Button>
      </div>
    </Dialog>
  )
}
