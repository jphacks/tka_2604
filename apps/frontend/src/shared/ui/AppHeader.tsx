import type { ReactNode } from 'react'

import { Brand } from './Brand'

export function AppHeader({
  children,
  navigation,
  brandTo,
}: {
  children: ReactNode
  navigation?: ReactNode
  brandTo?: string
}) {
  return (
    <header className="z-20 flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-3 py-1.5 sm:min-h-16 sm:px-4 sm:py-3">
      <div className="flex min-w-0 items-center gap-3 sm:gap-8">
        <Brand to={brandTo} />
        {navigation}
      </div>
      <div className="flex min-h-9 shrink-0 items-center gap-3">{children}</div>
    </header>
  )
}
