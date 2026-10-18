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
  buildConstraints,
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
  return (
    <Dialog
      title={constraint ? '制約を編集' : '制約を手動追加'}
      onClose={onClose}
    >
      {choosing ? (
        <>
          <p className="mb-4 text-sm leading-7 text-muted">
            条件の種類を選び、対象や数値を入力します。
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
            <p className="text-xs leading-6 text-muted">
              必須は必ず守る条件、任意はできるだけ守る条件です。
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
