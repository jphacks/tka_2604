import { useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  constraintLabels,
  describeConstraint,
} from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Textarea } from '../../../shared/ui/Input'
import {
  buildConstraint,
  type ConstraintDraft,
  createConstraintDraft,
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
  {
    type: 'count',
    example: '選んだ出演枠を各部に1〜2組ずつ',
    description: '各部の本数、または複数部の合計を指定。',
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
  const [error, setError] = useState('')
  const change = (patch: Partial<ConstraintDraft>) => {
    setDraft((value) => ({ ...value, ...patch }))
    setError('')
  }
  const preview = buildConstraint(
    draft,
    event,
    constraint?.constraint_id ?? 'preview',
  )
  function submit() {
    const result = buildConstraint(
      draft,
      event,
      constraint?.constraint_id ?? crypto.randomUUID(),
    )
    if (!result.ok) {
      setError(result.error)
      return
    }
    onSave(result.constraint)
    onClose()
  }
  return (
    <Dialog
      title={constraint ? '制約を編集' : '制約を手動追加'}
      onClose={onClose}
    >
      {choosing ? (
        <>
          <p className="mb-4 text-sm leading-7 text-muted">
            どんな条件にしたいですか？ 種類を選ぶと、必要な情報を入力できます。
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            {choices.map((choice) => (
              <button
                key={choice.type}
                type="button"
                className="rounded-lg border border-line p-4 text-left hover:border-brand hover:bg-wash focus-visible:ring-2"
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
                <span className="mb-2 block text-sm font-semibold text-brand">
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
          <ConstraintFields event={event} draft={draft} change={change} />
          <fieldset className="space-y-3">
            <legend className="mb-2 text-sm font-medium">条件の強さ</legend>
            <ConstraintControls
              label="追加する制約"
              hardness={draft.hardness}
              priority={draft.priority}
              onHardness={(hardness) => change({ hardness })}
              onPriority={(priority) => change({ priority })}
            />
            <p className="text-xs leading-6 text-muted">
              「必ず守る」はハード条件です。両立しなくても自動で緩めません。「できれば守る」は優先度を付けられます。
            </p>
          </fieldset>
          <details>
            <summary className="cursor-pointer text-xs text-muted">
              要望の原文を残す（任意）
            </summary>
            <label className="mt-3 block text-sm">
              元の要望
              <Textarea
                className="mt-2 w-full"
                rows={2}
                maxLength={1000}
                value={draft.sourceText}
                onChange={(changeEvent) =>
                  change({ sourceText: changeEvent.target.value })
                }
              />
            </label>
          </details>
          <div className="rounded-lg border border-brand/20 bg-wash p-4">
            <p className="mb-2 text-xs font-semibold text-brand">
              追加する条件の確認
            </p>
            <p className="text-sm leading-7">
              {preview.ok
                ? describeConstraint(preview.constraint, event)
                : '対象と条件を入力すると、ここに内容を表示します。'}
            </p>
            <p className="mt-2 text-xs text-muted">
              {draft.hardness === 'hard'
                ? '必ず守る · ハード条件'
                : `できれば守る · 優先度：${{ high: '高', mid: '中', low: '低' }[draft.priority]}`}
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
