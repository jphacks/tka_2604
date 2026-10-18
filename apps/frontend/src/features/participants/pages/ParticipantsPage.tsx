import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select } from '../../../shared/ui/Input'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { useParticipants } from '../hooks/useParticipants'

export function ParticipantsPage() {
  const { eventId = '' } = useParams()
  const controller = useParticipants(eventId)
  return (
    <AppFrame eventId={eventId} eventName={controller.data?.name}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-muted">
            PERFORMANCES & MEMBERS
          </p>
          <h1 className="text-2xl font-semibold">出演枠・メンバー</h1>
          <p className="mt-2 text-xs text-muted">
            登録された出演者の情報と、出演に関する希望を確認できます。
          </p>
        </div>
        <div className="flex gap-2">
          <LinkButton to={`/event/${eventId}/forms`}>
            <Icon name="form" />
            回答フォーム
          </LinkButton>
          <LinkButton primary to={`/event/${eventId}/forms`}>
            <Icon name="plus" />
            出演枠を追加
          </LinkButton>
        </div>
      </div>
      <div className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4">
        {[
          { label: '出演枠', value: controller.stats.total, unit: '組' },
          { label: 'メンバー', value: controller.stats.members, unit: '名' },
          { label: '未配置', value: controller.stats.unassigned, unit: '組' },
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
                      {row.requestText || '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1">
                        <LinkButton
                          className="min-h-6 p-1"
                          aria-label={`${row.name}を編集`}
                          to={`/event/${eventId}/forms?bandId=${encodeURIComponent(row.id)}`}
                        >
                          <Icon name="edit" className="size-3.5" />
                        </LinkButton>
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
    </AppFrame>
  )
}
