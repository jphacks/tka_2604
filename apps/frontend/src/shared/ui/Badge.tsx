import type { ReactNode } from 'react'

export function Badge({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center rounded border border-line bg-canvas px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-muted">
      {children}
    </span>
  )
}
