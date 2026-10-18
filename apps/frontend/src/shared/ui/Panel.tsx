import type { ReactNode } from 'react'

export function Panel({
  title,
  detail,
  action,
  children,
  className = '',
  inert,
}: {
  title: string
  detail?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
  inert?: boolean
}) {
  return (
    <section
      aria-label={title}
      inert={inert}
      className={`flex min-h-0 min-w-0 flex-col overflow-hidden border-b border-line bg-white xl:border-r xl:last:border-r-0 ${className}`}
    >
      <div className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-line px-3">
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold">{title}</h2>
          {detail}
        </div>
        {action}
      </div>
      {children}
    </section>
  )
}
