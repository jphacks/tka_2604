import { describeConstraint } from '../../../shared/model/constraints'
import { Button } from '../../../shared/ui/Button'
import { Select } from '../../../shared/ui/Input'
import type { EventController } from '../hooks/useEvent'
import { applyChatProposal } from '../model/chatProposal'

export function ChatProposal({ controller }: { controller: EventController }) {
  const proposal = controller.chatProposal
  const event = controller.event
  if (!proposal || !event) return null
  let error = ''
  try {
    applyChatProposal(event, proposal)
  } catch (cause) {
    error = cause instanceof Error ? cause.message : '提案を確認してください。'
  }
  return (
    <section
      aria-label="AIの制約変更案"
      className="mt-4 space-y-3 rounded-lg border border-line bg-white p-3"
    >
      <h3 className="text-xs font-semibold">制約の変更案</h3>
      {proposal.actions.map((action, index) => {
        let text = '制約を削除する'
        if (action.type === 'delete_constraint') {
          const original = event.constraints.find(
            (item) => item.constraint_id === action.constraintId,
          )
          text = original
            ? `削除：${describeConstraint(original, event)}`
            : '削除対象が見つかりません'
        } else {
          try {
            const display = {
              ...proposal,
              actions: [
                {
                  ...action,
                  constraint: {
                    ...action.constraint,
                    hardness: action.constraint.hardness ?? 'hard',
                    priority:
                      action.constraint.hardness === 'soft'
                        ? (action.constraint.priority ?? 'mid')
                        : null,
                  },
                },
              ],
            }
            const preview = applyChatProposal(
              { ...event, updatedAt: proposal.expectedUpdatedAt },
              display,
            )
            const id =
              action.type === 'add_constraint'
                ? `chat-${proposal.messageId}-0`
                : action.constraintId
            text = `${action.type === 'add_constraint' ? '追加' : '更新'}：${describeConstraint(
              preview.find((item) => item.constraint_id === id)!,
              event,
            )}`
          } catch {
            text = '提案内容を確認できません。もう一度相談してください。'
          }
        }
        return (
          <div
            key={index}
            className="space-y-2 border-t border-line pt-2 text-xs"
          >
            <p>{text}</p>
            {action.type !== 'delete_constraint' && (
              <div className="flex flex-wrap gap-2">
                <Select
                  aria-label={`変更案${index + 1}の必須・任意`}
                  value={action.constraint.hardness ?? ''}
                  onChange={(e) =>
                    controller.changeProposal(index, {
                      hardness:
                        e.target.value === 'hard'
                          ? 'hard'
                          : e.target.value === 'soft'
                            ? 'soft'
                            : null,
                      priority: null,
                    })
                  }
                >
                  <option value="">必須／任意を選択</option>
                  <option value="hard">必須</option>
                  <option value="soft">任意</option>
                </Select>
                {action.constraint.hardness === 'soft' && (
                  <Select
                    aria-label={`変更案${index + 1}の優先度`}
                    value={action.constraint.priority ?? ''}
                    onChange={(e) =>
                      controller.changeProposal(index, {
                        priority:
                          e.target.value === 'high'
                            ? 'high'
                            : e.target.value === 'mid'
                              ? 'mid'
                              : e.target.value === 'low'
                                ? 'low'
                                : null,
                      })
                    }
                  >
                    <option value="">優先度を選択</option>
                    <option value="high">高</option>
                    <option value="mid">中</option>
                    <option value="low">低</option>
                  </Select>
                )}
              </div>
            )}
          </div>
        )
      })}
      {error && <p className="text-xs text-muted">{error}</p>}
      <div className="flex gap-2">
        <Button
          className="text-xs"
          variant="primary"
          disabled={
            Boolean(error) || controller.chatBlocked || controller.sending
          }
          onClick={controller.applyProposal}
        >
          確認して反映
        </Button>
        <Button className="text-xs" onClick={controller.dismissProposal}>
          取り消す
        </Button>
      </div>
    </section>
  )
}
