import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  constraintLabels,
  describeConstraint,
} from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import {
  buildConstraints,
  buildRecommendedGapConstraints,
  type ConstraintDraft,
  createConstraintDraft,
  missingGapMemberIds,
  multiMemberIds,
} from '../model/constraintDraft'
import { ConstraintControls } from './ConstraintControls'
import { ConstraintFields } from './ConstraintFields'

const choices: {
  type: Constraint['type']
  example: string
  description: string
}[] = [
  {
    type: 'min_gap_member',
    example: '佐藤さんの出演の間に2組空ける',
    description: '選んだ人の掛け持ち出演をまとめて指定。',
  },
  {
    type: 'min_gap_bands',
    example: '衣装替えがある3組を互いに離す',
    description: '選んだ出演枠のすべてのペアを離します。',
  },
  {
    type: 'before',
    example: 'AをBより前にする',
    description: '部をまたいで、全体の前後関係を指定。',
  },
  {
    type: 'at_position',
    example: 'Aを最初の1番に固定する',
    description: 'イベント全体での順番号を指定。',
  },
  {
    type: 'in_range',
    example: 'AとBを第2部か第3部にする',
    description: '出演できる部、または順番号の範囲を指定。',
  },
]

export function ConstraintForm({
  event,
  constraint,
  onSave,
  onClose,
}: {
  event: EventData
  constraint?: Constraint
  onSave: (value: Constraint) => void
  onClose: () => void
}) {
  const [draft, setDraft] = useState(() => createConstraintDraft(constraint))
  const [choosing, setChoosing] = useState(!constraint)
  const [recommending, setRecommending] = useState(false)
  const [error, setError] = useState('')
  const change = (patch: Partial<ConstraintDraft>) => {
    setDraft((value) => ({ ...value, ...patch }))
    setError('')
  }
  const preview = buildConstraints(
    draft,
    event,
    () => constraint?.constraint_id ?? 'preview',
  )
  function submit() {
    const result = buildConstraints(
      draft,
      event,
      () => constraint?.constraint_id ?? crypto.randomUUID(),
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    for (const item of result.constraints) onSave(item)
    onClose()
  }
  const multiCount = multiMemberIds(event).length
  const missingCount = missingGapMemberIds(event).length
  function addRecommended() {
    for (const item of buildRecommendedGapConstraints(event, () =>
      crypto.randomUUID(),
    ))
      onSave(item)
    onClose()
  }
  return (
    <Dialog
      title={constraint ? '制約を編集' : '制約を手動追加'}
      onClose={onClose}
    >
      {recommending ? (
        <div className="space-y-5">
          <p className="text-sm leading-7">
            掛け持ちの{missingCount}
            人に「出演の間に1組以上空ける（必須）」を1人1件ずつ追加します。
            {multiCount > missingCount &&
              `間隔の条件が既にある${multiCount - missingCount}人には追加しません。`}
          </p>
          <div className="flex justify-end gap-2">
            <Button onClick={() => setRecommending(false)}>キャンセル</Button>
            <Button variant="primary" onClick={addRecommended}>
              {missingCount}件を追加
            </Button>
          </div>
        </div>
      ) : choosing ? (
        <>
          <h3 className="mb-2 text-xs font-semibold text-brand">推奨</h3>
          <button
            type="button"
            disabled={missingCount === 0}
            className="mb-6 w-full rounded-lg border-2 border-brand/40 bg-wash p-4 text-left hover:border-brand focus-visible:ring-2 disabled:cursor-not-allowed disabled:border-line disabled:bg-white disabled:opacity-70"
            onClick={() => setRecommending(true)}
          >
            <span className="mb-1 flex flex-wrap items-center gap-2 text-sm font-semibold text-brand">
              掛け持ちの人が連続しないようにする
              {multiCount > 0 && missingCount === 0 && (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-muted">
                  追加済み
                </span>
              )}
            </span>
            <span className="block text-xs leading-6 text-muted">
              {multiCount === 0
                ? '掛け持ちしているメンバーがいません。'
                : `掛け持ち${multiCount}人の出演の間に1組以上空けます（必須）。`}
            </span>
          </button>
          <h3 className="mb-1 text-xs font-semibold text-muted">
            個別に指定する
          </h3>
          <p className="mb-3 text-xs leading-6 text-muted">
            特定の組や人だけに条件をつけたいときに使います。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {choices.map((choice) => (
              <button
                key={choice.type}
                type="button"
                className="rounded-lg border border-line p-3 text-left hover:border-brand hover:bg-wash focus-visible:ring-2"
                onClick={() => {
                  setDraft({
                    ...createConstraintDraft(),
                    type: choice.type,
                    hardness: draft.hardness,
                    priority: draft.priority,
                    enabled: draft.enabled,
                    sourceText: draft.sourceText,
                  })
                  setChoosing(false)
                  setError('')
                }}
              >
                <span className="mb-1 block text-sm font-semibold text-ink">
                  {constraintLabels[choice.type]}
                </span>
                <span className="mb-2 block text-xs leading-6 text-ink">
                  例：{choice.example}
                </span>
                <span className="block text-xs leading-5 text-muted">
                  {choice.description}
                </span>
              </button>
            ))}
          </div>
        </>
      ) : (
        <form
          noValidate
          onSubmit={(submitEvent) => {
            submitEvent.preventDefault()
            submit()
          }}
          className="space-y-5"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-brand">
              {constraintLabels[draft.type]}
            </h3>
            <Button
              variant="ghost"
              className="text-xs"
              onClick={() => setChoosing(true)}
            >
              種類を選び直す
            </Button>
          </div>
          <ConstraintFields
            event={event}
            draft={draft}
            change={change}
            allowAllMembers={!constraint}
          />
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">条件の強さ</legend>
            <ConstraintControls
              label="追加する制約"
              hardness={draft.hardness}
              priority={draft.priority}
              onHardness={(hardness) => change({ hardness })}
              onPriority={(priority) => change({ priority })}
            />
          </fieldset>
          <div className="rounded-lg border border-brand/20 bg-wash p-4">
            <p className="mb-2 text-xs font-semibold text-brand">
              追加する条件の確認
            </p>
            <p className="text-sm leading-7">
              {preview.ok
                ? preview.constraints.map((item) => (
                    <span
                      key={describeConstraint(item, event)}
                      className="block"
                    >
                      {describeConstraint(item, event)}
                    </span>
                  ))
                : '対象と条件を入力すると、ここに内容を表示します。'}
            </p>
            <p className="mt-2 text-xs text-muted">
              {draft.hardness === 'hard'
                ? '必須'
                : `任意 · 優先度：${{ high: '高', mid: '中', low: '低' }[draft.priority]}`}
            </p>
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={onClose}>キャンセル</Button>
            <Button variant="primary" type="submit">
              {constraint ? '変更を保存' : 'この条件を追加'}
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
