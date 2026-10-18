import { Icon } from '../../../shared/ui/Icon'

const tabs = [
  { id: 'schedule', label: '出演順', icon: 'list' },
  { id: 'constraints', label: '制約', icon: 'check' },
  { id: 'chat', label: 'AIチャット', icon: 'sparkle' },
] as const

export type WorkspacePanel = (typeof tabs)[number]['id']

export function WorkspaceTabs({
  active,
  onChange,
}: {
  active: WorkspacePanel
  onChange: (panel: WorkspacePanel) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="ワークスペースの表示"
      className="z-30 order-last grid shrink-0 grid-cols-3 border-t border-line bg-white pb-[env(safe-area-inset-bottom)] xl:hidden"
    >
      {tabs.map((tab, index) => (
        <button
          key={tab.id}
          id={`workspace-tab-${tab.id}`}
          role="tab"
          type="button"
          aria-selected={active === tab.id}
          aria-controls={`workspace-panel-${tab.id}`}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={(event) => {
            const next =
              event.key === 'ArrowRight'
                ? (index + 1) % tabs.length
                : event.key === 'ArrowLeft'
                  ? (index + tabs.length - 1) % tabs.length
                  : event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? tabs.length - 1
                      : null
            if (next === null) return
            event.preventDefault()
            onChange(tabs[next].id)
            document.getElementById(`workspace-tab-${tabs[next].id}`)?.focus()
          }}
          className={`flex min-h-14 flex-col items-center justify-center gap-1 border-t-2 text-xs font-semibold whitespace-nowrap ${active === tab.id ? 'border-brand bg-wash text-brand' : 'border-transparent text-muted hover:bg-wash'}`}
        >
          <Icon name={tab.icon} />
          {tab.label}
        </button>
      ))}
    </div>
  )
}
