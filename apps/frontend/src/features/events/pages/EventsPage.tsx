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
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.18em] text-muted">
            YOUR WORKSPACE
          </p>
          <h1 className="text-2xl font-semibold">マイイベント</h1>
          <p className="mt-2 text-xs text-muted">
            次のライブの準備も、ここから。
          </p>
        </div>
        <Button
          variant="primary"
          onClick={controller.openCreate}
          className="h-10"
        >
          <Icon name="plus" />
          イベントを作成
        </Button>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-3 sm:gap-4">
        {[
          {
            label: 'イベント',
            value: controller.stats.events,
            suffix: '件',
            icon: 'calendar' as const,
          },
          {
            label: '登録された出演枠',
            value: controller.stats.performances,
            suffix: '組',
            icon: 'users' as const,
          },
          {
            label: '出演順を調整中',
            value: controller.stats.adjusting,
            suffix: '件',
            icon: 'list' as const,
          },
        ].map((item) => (
          <div
            key={item.label}
            className="flex items-center gap-4 rounded-lg border border-line bg-white px-5 py-4"
          >
            <span className="flex size-9 items-center justify-center rounded-md bg-canvas text-muted">
              <Icon name={item.icon} className="size-[18px]" />
            </span>
            <div>
              <p className="text-[11px] text-muted">{item.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">
                {item.value}
                <span className="ml-1.5 text-xs font-normal text-muted">
                  {item.suffix}
                </span>
              </p>
            </div>
          </div>
        ))}
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
      <section className="mt-9 rounded-xl border border-line bg-white p-6">
        <h2 className="mb-5 text-sm font-semibold">
          ライブの準備、3つのステップ
        </h2>
        <div className="grid gap-5 md:grid-cols-3">
          {[
            {
              title: '出演者を集める',
              text: 'フォームで出演名とメンバーを登録。',
            },
            {
              title: '条件を整理する',
              text: '必須条件と、できれば叶えたい希望を設定。',
            },
            {
              title: '出演順を調整する',
              text: 'たたき台を見ながら、納得のいく順番に。',
            },
          ].map((step, index) => (
            <div key={step.title} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-wash text-xs font-semibold text-brand">
                {index + 1}
              </span>
              <div>
                <h3 className="text-xs font-semibold">{step.title}</h3>
                <p className="mt-1.5 text-[11px] leading-5 text-muted">
                  {step.text}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      {controller.creating && <CreateEventDialog controller={controller} />}
    </AppFrame>
  )
}
