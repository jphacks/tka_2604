import type { ReactNode } from 'react'

type PanelType = {
  title: string
  detail?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  inert?: boolean
  busy?: boolean
  headerClassName?: string
}

export function Panel({
  title,
  detail,
  action,
  children,
  className = '',
  inert,
  headerClassName = '',
  busy,
}: PanelType) {
  return (
    <section
      aria-label={title}
      aria-busy={Boolean(busy || inert)}
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-b border-line bg-white xl:border-r ${className}`}
    >
      <div
        className={`flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-3 ${headerClassName}`}
      >
        <div className="flex shrink-0 items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {detail}
        </div>
        <div inert={inert}>{action}</div>
      </div>
      <div
        inert={inert}
        className={`flex min-h-0 flex-1 flex-col ${inert ? 'opacity-60' : ''}`}
      >
        {children}
      </div>
    </section>
  )
}
