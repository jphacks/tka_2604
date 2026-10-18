import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { ConfirmDialog } from '../../../shared/ui/ConfirmDialog'
import { Dialog } from '../../../shared/ui/Dialog'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select } from '../../../shared/ui/Input'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { PerformanceFields } from '../../forms/components/PerformanceFields'
import { RosterImportDialog } from '../components/RosterImportDialog'
import { useParticipants } from '../hooks/useParticipants'

export function ParticipantsPage() {
  const { eventId = '' } = useParams()
  const controller = useParticipants(eventId)
  return (
    <AppFrame eventId={eventId} eventName={controller.data?.data.name}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-muted">
            PERFORMANCES & MEMBERS
          </p>
          <h1 className="text-2xl font-semibold">出演枠・メンバー</h1>
          <p className="mt-2 text-xs text-muted">
            出演者の情報と、フォームから届いた希望を確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton to={`/event/${eventId}/forms`}>
            <Icon name="form" />
            回答フォーム
          </LinkButton>
          {controller.canEdit && (
            <Button
              onClick={controller.openImport}
              disabled={!controller.canEdit || !controller.data}
            >
              <Icon name="list" />
              CSVを取り込む
            </Button>
          )}
          {controller.canEdit ? (
            <Button
              variant="primary"
              disabled={!controller.canEdit}
              onClick={() => controller.openEditor()}
            >
              <Icon name="plus" />
              出演枠を追加
            </Button>
          ) : (
            <LinkButton primary to={`/event/${eventId}/forms`}>
              <Icon name="plus" />
              出演枠を追加
            </LinkButton>
          )}
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-4">
        {[
          { label: '出演枠', value: controller.stats.total, unit: '組' },
          { label: 'メンバー', value: controller.stats.members, unit: '名' },
          { label: '未配置', value: controller.stats.unassigned, unit: '組' },
          {
            label: 'フォーム回答',
            value: controller.stats.responses,
            unit: '件',
          },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-lg border border-line bg-white px-5 py-4"
          >
            <p className="text-[11px] text-muted">{item.label}</p>
            <p className="mt-2 text-2xl font-semibold tabular-nums">
              {item.value ?? '—'}
              <span className="ml-1.5 text-xs font-normal text-muted">
                {item.unit}
              </span>
            </p>
          </div>
        ))}
      </div>
      {controller.loading || controller.error ? (
        <PageState error={controller.error} onRetry={controller.refresh} />
      ) : (
        <section className="overflow-hidden rounded-xl border border-line bg-white">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
            <div className="relative">
              <Icon
                name="search"
                className="absolute top-2.5 left-3 text-muted"
              />
              <Input
                aria-label="出演枠・メンバーを検索"
                value={controller.query}
                onChange={(event) => controller.setQuery(event.target.value)}
                placeholder="出演名・メンバーで検索"
                className="w-64 pl-9 text-xs"
              />
            </div>
            <Select
              aria-label="配置で絞り込む"
              value={controller.filter}
              onChange={(event) =>
                controller.setFilter(
                  event.target.value as 'all' | 'unassigned' | 'assigned',
                )
              }
            >
              <option value="all">すべての出演枠</option>
              <option value="assigned">配置済み</option>
              <option value="unassigned">未配置</option>
            </Select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-left text-xs">
              <thead className="border-b border-line bg-canvas/50 text-[11px] font-normal text-muted">
                <tr>
                  <th className="px-5 py-3 font-normal">出演名</th>
                  <th className="py-3 font-normal">メンバー</th>
                  <th className="py-3 font-normal">配置</th>
                  <th className="py-3 font-normal">出演に関する希望</th>
                  <th className="px-5 py-3 font-normal">操作</th>
                </tr>
              </thead>
              <tbody>
                {controller.rows.map((row) => (
                  <tr
                    key={row.id}
                    className="border-b border-line/65 last:border-0 hover:bg-canvas/45"
                  >
                    <td className="max-w-56 px-5 py-4">
                      <p className="font-medium">{row.name}</p>
                      {row.submission && (
                        <span className="mt-1 block text-[10px] text-muted">
                          {row.submission.source === 'form'
                            ? 'フォーム回答'
                            : '手動登録'}
                          {row.submission.contact &&
                            ` · ${row.submission.contact}`}
                        </span>
                      )}
                    </td>
                    <td className="max-w-60 py-4 pr-5 leading-6 text-muted">
                      {row.members.join('・')}
                    </td>
                    <td className="py-4 pr-5 whitespace-nowrap">
                      <span
                        className={`rounded px-2 py-1 text-[10px] ${row.position ? 'bg-wash text-brand' : 'bg-canvas text-muted'}`}
                      >
                        {row.position
                          ? `${row.position.section} · ${row.position.order}番`
                          : '未配置'}
                      </span>
                    </td>
                    <td className="max-w-56 py-4 pr-5 leading-6 text-muted">
                      {row.requestText || row.submission?.requests || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        {controller.canEdit ? (
                          <Button
                            variant="ghost"
                            className="min-h-6 p-1"
                            disabled={!controller.canEdit}
                            aria-label={`${row.name}を編集`}
                            onClick={() => controller.openEditor(row.id)}
                          >
                            <Icon name="edit" className="size-3.5" />
                          </Button>
                        ) : (
                          <LinkButton
                            className="min-h-6 p-1"
                            aria-label={`${row.name}を編集`}
                            to={`/event/${eventId}/forms?bandId=${encodeURIComponent(row.id)}`}
                          >
                            <Icon name="edit" className="size-3.5" />
                          </LinkButton>
                        )}
                        {controller.canEdit && (
                          <Button
                            variant="ghost"
                            className="min-h-6 p-1 hover:text-red-500"
                            disabled={!controller.canEdit}
                            aria-label={`${row.name}を削除`}
                            onClick={() => controller.requestDelete(row.id)}
                          >
                            <Icon name="trash" className="size-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {controller.rows.length === 0 && (
            <div className="py-16 text-center">
              <Icon name="users" className="mx-auto mb-4 size-7 text-muted" />
              <p className="font-medium">
                {controller.query || controller.filter !== 'all'
                  ? '一致する出演枠がありません'
                  : '出演枠はまだありません'}
              </p>
              <p className="mt-2 text-xs text-muted">
                フォームで集めるか、「出演枠を追加」から登録してください。
              </p>
            </div>
          )}
        </section>
      )}
      {controller.notice && (
        <p
          role="status"
          className="mt-5 rounded-lg border border-brand/20 bg-wash px-4 py-3 text-xs text-brand"
        >
          {controller.notice}
        </p>
      )}
      {controller.editorOpen && controller.data && (
        <Dialog
          title={controller.editingId ? '出演枠を編集' : '出演枠を追加'}
          onClose={controller.closeEditor}
        >
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault()
              void controller.save()
            }}
          >
            <PerformanceFields
              event={controller.data.data}
              draft={controller.draft}
              onChange={controller.change}
              disabled={controller.busy}
            />
            {controller.formError && (
              <p role="alert" className="mt-4 text-xs text-red-500">
                {controller.formError}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <Button
                onClick={controller.closeEditor}
                disabled={controller.busy}
              >
                キャンセル
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={controller.busy}
              >
                {controller.busy
                  ? '保存中…'
                  : controller.editingId
                    ? '変更を保存'
                    : '追加する'}
              </Button>
            </div>
          </form>
        </Dialog>
      )}
      {controller.importOpen && controller.data && (
        <RosterImportDialog
          eventId={eventId}
          registered={controller.data.data.members}
          onDone={controller.importDone}
          onClose={controller.closeImport}
        />
      )}
      {controller.deletingId && (
        <ConfirmDialog
          title="出演枠を削除"
          message={`「${controller.deletingName}」を削除します。配置済みの場合は空き枠になります。参照する制約がある場合は、先に制約を整理してください。`}
          error={controller.formError}
          busy={controller.busy}
          onCancel={controller.cancelDelete}
          onConfirm={() => void controller.remove()}
        />
      )}
    </AppFrame>
  )
}
