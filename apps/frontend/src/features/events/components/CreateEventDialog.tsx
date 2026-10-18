import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select, Textarea } from '../../../shared/ui/Input'
import { PartCountFields } from '../../../shared/ui/PartCountFields'
import type { EventsController } from '../hooks/useEvents'
import { rosterSamples } from '../model/samples'

export function CreateEventDialog({
  controller,
}: {
  controller: EventsController
}) {
  return (
    <Dialog title="新しいイベントを作成" onClose={controller.closeCreate}>
      <p className="mb-5 text-xs leading-6 text-muted">
        イベントを作って、出演者と条件を集めるところから。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void controller.create()
        }}
        className="space-y-4"
      >
        <label className="block text-xs font-medium">
          イベント名
          <Input
            value={controller.draft.name}
            onChange={(event) =>
              controller.setDraft({ name: event.target.value })
            }
            maxLength={80}
            placeholder="空欄なら作成日時の名前になります"
            className="mt-2 w-full"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="block text-xs font-medium">
            開催日
            <Input
              type="date"
              value={controller.draft.date}
              onChange={(event) =>
                controller.setDraft({ date: event.target.value })
              }
              className="mt-2 w-full"
            />
          </label>
          <label className="block text-xs font-medium">
            会場
            <Input
              value={controller.draft.venue}
              onChange={(event) =>
                controller.setDraft({ venue: event.target.value })
              }
              placeholder="後から設定できます"
              maxLength={80}
              className="mt-2 w-full"
            />
          </label>
        </div>
        <label className="block text-xs font-medium">
          イベントについて
          <Textarea
            value={controller.draft.description}
            onChange={(event) =>
              controller.setDraft({ description: event.target.value })
            }
            placeholder="参加者へのメッセージやイベントの概要"
            maxLength={500}
            rows={3}
            className="mt-2 w-full"
          />
        </label>
        <RosterFields controller={controller} />
        <PartCountFields
          key={controller.roster.source}
          counts={controller.draft.bandCounts ?? [4]}
          onChange={(bandCounts) => controller.setDraft({ bandCounts })}
        />
        {controller.formError && (
          <p role="alert" className="text-xs text-red-600">
            {controller.formError}
          </p>
        )}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={controller.closeCreate} disabled={controller.busy}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={controller.busy}>
            {controller.roster.progress !== null
              ? `名簿を登録中…（${controller.roster.progress}/${controller.roster.plan?.bands}）`
              : controller.busy
                ? '作成中…'
                : 'イベントを作成'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}

function RosterFields({ controller }: { controller: EventsController }) {
  const { roster } = controller
  const sample = rosterSamples.find(({ label }) => label === roster.source)
  return (
    <fieldset className="space-y-2 rounded-lg border border-line p-3">
      <legend className="px-1 text-xs font-medium">名簿CSV（任意）</legend>
      <p className="text-xs leading-5 text-muted">
        取り込むと出演枠とメンバーをまとめて登録し、部のバンド数も組数に合わせます。
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <Select
          aria-label="サンプル名簿"
          value={sample?.path ?? ''}
          onChange={(event) => {
            const next = rosterSamples.find(
              ({ path }) => path === event.target.value,
            )
            if (next) void roster.loadSample(next.path, next.label)
            else roster.clear()
          }}
        >
          <option value="">サンプルから選ぶ</option>
          {rosterSamples.map((option) => (
            <option key={option.path} value={option.path}>
              {option.label}
            </option>
          ))}
        </Select>
        <label className="inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-md border border-brand bg-white px-3 text-xs font-medium text-brand transition-colors focus-within:ring-2 focus-within:ring-brand/40 hover:bg-wash">
          <Icon name="list" />
          CSVファイルを選ぶ
          <input
            type="file"
            accept=".csv,text/csv"
            aria-label="名簿CSVファイル"
            onChange={(event) => {
              const file = event.target.files?.[0]
              if (file) void roster.readFile(file)
              event.target.value = ''
            }}
            className="sr-only"
          />
        </label>
      </div>
      {roster.source && (
        <div className="flex items-center gap-2 text-xs">
          <p className="min-w-0 flex-1 truncate">
            {!sample && `${roster.source}：`}
            {roster.plan &&
              `${roster.plan.bands}組・${roster.plan.people}人（掛け持ち${roster.plan.shared.length}人）を登録します`}
          </p>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={roster.clear}
            disabled={controller.busy}
          >
            取り消す
          </Button>
        </div>
      )}
    </fieldset>
  )
}
