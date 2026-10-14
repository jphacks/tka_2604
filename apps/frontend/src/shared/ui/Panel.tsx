import type { ReactNode } from 'react'

export function Panel({
  title,
  detail,
  action,
  children,
  className = '',
}: {
  title: string
  detail?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section
      aria-label={title}
      className={`flex min-h-0 flex-col overflow-hidden rounded-[10px] border border-line bg-white ${className}`}
    >
      <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-line px-4">
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
