import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Input, Textarea } from '../../../shared/ui/Input'
import { PartCountFields } from '../../../shared/ui/PartCountFields'
import type { EventsController } from '../hooks/useEvents'

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
        <PartCountFields
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
            {controller.busy ? '作成中…' : 'イベントを作成'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
