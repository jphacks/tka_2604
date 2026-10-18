import type { EventStatus } from '../../../shared/model/workspace'
import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input } from '../../../shared/ui/Input'
import { PageState } from '../../../shared/ui/PageState'
import { CreateEventDialog } from '../components/CreateEventDialog'
import { EventCard } from '../components/EventCard'
import { useEvents } from '../hooks/useEvents'

const filters: { value: EventStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'すべて' },
  { value: 'planning', label: '準備中' },
  { value: 'adjusting', label: '調整中' },
  { value: 'confirmed', label: '確定' },
]
export function EventsPage() {
  const controller = useEvents()
  return (
    <AppFrame>
      <div className="mb-7 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">マイイベント</h1>
        <Button
          variant="primary"
          onClick={controller.openCreate}
          className="h-10"
        >
          <Icon name="plus" />
          イベントを作成
        </Button>
      </div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1">
          {filters.map((filter) => (
            <button
              key={filter.value}
              type="button"
              aria-pressed={controller.filter === filter.value}
              onClick={() => controller.setFilter(filter.value)}
              className={`rounded-md px-3.5 py-2 text-xs ${controller.filter === filter.value ? 'bg-brand/10 font-medium text-brand' : 'text-muted hover:bg-white'}`}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <div className="relative">
          <Icon name="search" className="absolute top-2.5 left-3 text-muted" />
          <Input
            aria-label="イベントを検索"
            value={controller.query}
            onChange={(event) => controller.setQuery(event.target.value)}
            placeholder="イベント名・会場で検索"
            className="w-64 bg-white pl-9 text-xs"
          />
        </div>
      </div>
      {controller.loading || controller.error ? (
        <PageState error={controller.error} onRetry={controller.refresh} />
      ) : controller.visible.length ? (
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {controller.visible.map((event) => (
            <EventCard key={event.id} event={event} />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-line bg-white py-16 text-center">
          <Icon name="calendar" className="mx-auto mb-4 size-7 text-muted" />
          <p className="font-medium">
            {controller.query || controller.filter !== 'all'
              ? '条件に一致するイベントがありません'
              : '最初のイベントを作成しましょう'}
          </p>
          <p className="mt-2 text-xs text-muted">
            {controller.query
              ? '別のキーワードで検索してください。'
              : '出演者と条件を集めて、ライブの準備を始められます。'}
          </p>
          {!controller.query && controller.filter === 'all' && (
            <Button
              variant="primary"
              className="mt-5"
              onClick={controller.openCreate}
            >
              <Icon name="plus" />
              イベントを作成
            </Button>
          )}
        </div>
      )}
      {controller.creating && <CreateEventDialog controller={controller} />}
    </AppFrame>
  )
}
