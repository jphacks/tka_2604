import type { Member } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { downloadCsv } from '../../../shared/ui/download'
import { Icon } from '../../../shared/ui/Icon'
import { Textarea } from '../../../shared/ui/Input'
import { useRosterImport } from '../hooks/useRosterImport'
import { rosterHeader, rosterTemplate } from '../model/rosterCsv'

function names(list: string[], limit = 8) {
  return list.length > limit
    ? `${list.slice(0, limit).join('・')} ほか${list.length - limit}名`
    : list.join('・')
}

export function RosterImportDialog({
  eventId,
  registered,
  onDone,
  onClose,
}: {
  eventId: string
  registered: Member[]
  onDone: (count: number, completed: boolean) => void
  onClose: () => void
}) {
  const roster = useRosterImport(eventId, registered, onDone)
  const { plan } = roster
  return (
    <Dialog
      title="名簿CSVを取り込む"
      onClose={() => {
        if (!roster.busy) onClose()
      }}
    >
      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault()
          void roster.run()
        }}
      >
        <fieldset disabled={roster.busy} className="space-y-4">
          <p className="text-xs leading-6 text-muted">
            1行目を「{rosterHeader}
            」の見出しにし、1行に1出演枠を書きます。同じ名前は同じ人（掛け持ち）として登録し、登録済みの人と同じ名前ならその人を使います。
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <label className="inline-flex min-h-9 cursor-pointer items-center gap-1.5 rounded-md border border-brand bg-white px-3 py-1.5 text-sm font-medium text-brand transition-colors focus-within:ring-2 focus-within:ring-brand/40 hover:bg-wash">
              <Icon name="list" />
              CSVファイルを選ぶ
              <input
                type="file"
                accept=".csv,text/csv"
                aria-label="CSVファイル"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  if (file) void roster.readFile(file)
                  event.target.value = ''
                }}
                className="sr-only"
              />
            </label>
            <span className="min-w-0 truncate text-xs text-muted">
              {roster.fileName || 'ファイルが選ばれていません'}
            </span>
            <Button
              variant="ghost"
              className="ml-auto text-xs"
              onClick={() => downloadCsv('名簿の雛形.csv', rosterTemplate())}
            >
              <Icon name="download" />
              雛形をダウンロード
            </Button>
          </div>
          <label className="block text-xs font-medium">
            またはCSVを貼り付け
            <Textarea
              value={roster.text}
              onChange={(event) => roster.setText(event.target.value)}
              rows={6}
              placeholder={`曲名,メンバー1,メンバー2\n気分上々↑↑,佐藤,田中\nソロギター,鈴木`}
              className="mt-2 w-full font-mono text-xs"
            />
          </label>
        </fieldset>
        {plan && (
          <section
            aria-label="取込内容の確認"
            className="mt-4 space-y-1 rounded-lg border border-line bg-canvas/50 p-3 text-xs leading-6"
          >
            <p className="font-medium">
              {plan.bands}組・{plan.people}人（掛け持ち{plan.shared.length}
              人）を登録します。
            </p>
            {plan.matched.length > 0 && (
              <p className="text-muted">
                登録済みの人と同じ名前：{names(plan.matched)}
                （同じ人として扱います）
              </p>
            )}
            {plan.shared.length > 0 && (
              <p className="text-muted">掛け持ち：{names(plan.shared)}</p>
            )}
          </section>
        )}
        {plan && plan.ambiguous.length > 0 && (
          <p role="alert" className="mt-3 text-xs text-red-500">
            同名の登録済みメンバーが複数いるため、どの人か決められません：
            {names(plan.ambiguous)}
            。CSVの名前を区別できるように直すか、出演枠を個別に追加してください。
          </p>
        )}
        {roster.error && (
          <p role="alert" className="mt-3 text-xs text-red-500">
            {roster.error}
          </p>
        )}
        <div className="mt-6 flex justify-end gap-2">
          <Button onClick={onClose} disabled={roster.busy}>
            キャンセル
          </Button>
          <Button type="submit" variant="primary" disabled={!roster.canImport}>
            {roster.busy
              ? `登録中…（${roster.progress}/${plan?.bands}）`
              : plan
                ? `${plan.bands}組を登録する`
                : '登録する'}
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
