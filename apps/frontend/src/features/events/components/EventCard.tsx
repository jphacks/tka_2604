import { Link } from 'react-router'

import type { EventSummary } from '../../../shared/model/workspace'
import { formatDate, statusLabels } from '../../../shared/model/workspace'
import { Icon } from '../../../shared/ui/Icon'

export function EventCard({ event }: { event: EventSummary }) {
  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-line bg-white transition-all hover:border-brand/35 hover:shadow-[0_4px_20px_#256bc70a]">
      <div className="flex items-center justify-between px-5 pt-5">
        <span className="flex size-10 items-center justify-center rounded-lg bg-wash text-brand">
          <Icon name="calendar" className="size-5" />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-medium ${event.status === 'confirmed' ? 'bg-emerald-50 text-emerald-700' : event.status === 'adjusting' ? 'bg-wash text-brand' : 'bg-canvas text-muted'}`}
        >
          {statusLabels[event.status]}
        </span>
      </div>
      <Link to={`/event/${event.id}`} className="px-5 pt-4 pb-5">
        <h2 className="mb-3 truncate text-base font-semibold group-hover:text-brand">
          {event.name}
        </h2>
        <p className="mb-2 flex items-center gap-2 text-xs text-muted">
          <Icon name="calendar" className="size-3.5" />
          {formatDate(event.date)}
        </p>
        <p className="flex items-center gap-2 text-xs text-muted">
          <Icon name="location" className="size-3.5" />
          {event.venue || '会場未定'}
        </p>
        <p className="mt-4 line-clamp-2 min-h-10 text-xs leading-5 text-muted">
          {event.description ||
            '出演者を集めて、ライブの準備をはじめましょう。'}
        </p>
      </Link>
      <div className="grid grid-cols-3 border-y border-line bg-canvas/40 px-5 py-4">
        <div>
          <p className="text-lg font-semibold tabular-nums">
            {event.performanceCount}
            <span className="ml-1 text-[11px] font-normal text-muted">組</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">出演枠</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">
            {event.partCount}
            <span className="ml-1 text-[11px] font-normal text-muted">部</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">構成</p>
        </div>
        <div>
          <p className="text-lg font-semibold tabular-nums">
            {event.responseCount ?? '—'}
            <span className="ml-1 text-[11px] font-normal text-muted">件</span>
          </p>
          <p className="mt-1 text-[11px] text-muted">フォーム回答</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div className="flex gap-3">
          <Link
            to={`/event/${event.id}/forms/edit`}
            className="text-xs text-muted hover:text-brand"
          >
            フォーム管理
          </Link>
          <Link
            to={`/event/${event.id}/settings`}
            className="text-xs text-muted hover:text-brand"
          >
            設定
          </Link>
        </div>
        <Link
          to={`/event/${event.id}`}
          aria-label={event.name}
          className="flex items-center gap-1 text-xs font-medium text-brand"
        >
          イベントを開く
          <Icon name="chevron" className="size-3" />
        </Link>
      </div>
    </article>
  )
}
