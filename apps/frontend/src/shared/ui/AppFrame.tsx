import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import { useSession } from '../../app/sessionContext'
import { Brand } from './Brand'
import { Button } from './Button'
import { Icon } from './Icon'

export function AppFrame({
  children,
  eventId,
  eventName,
}: {
  children: ReactNode
  eventId?: string
  eventName?: string
}) {
  const { session, signOut } = useSession()
  return (
    <div className="min-h-dvh">
      <header className="flex min-h-16 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-6 py-3">
        <div className="flex items-center gap-4 sm:gap-8">
          <Brand />
          <Link to="/event" className="text-xs text-muted hover:text-brand">
            マイイベント
          </Link>
        </div>
        <div className="flex items-center gap-3">
          <span className="flex size-7 items-center justify-center rounded-full bg-wash text-xs font-semibold text-brand">
            運
          </span>
          <span className="text-xs">{session?.name}</span>
          <Button
            variant="ghost"
            className="text-xs"
            onClick={() => void signOut()}
          >
            <Icon name="logout" />
            ログアウト
          </Button>
        </div>
      </header>
      {eventId && (
        <div className="border-b border-line bg-white">
          <nav
            aria-label="イベント内の移動"
            className="mx-auto flex max-w-[1200px] flex-wrap items-center gap-x-5 px-4 sm:px-6"
          >
            <Link
              to={`/event/${eventId}`}
              className="mr-auto py-4 text-sm font-semibold"
            >
              {eventName || 'イベント'}
            </Link>
            {[
              { path: `/event/${eventId}`, label: '出演順' },
              {
                path: `/event/${eventId}/performances`,
                label: '出演枠・メンバー',
              },
              { path: `/event/${eventId}/forms/edit`, label: 'フォーム管理' },
              { path: `/event/${eventId}/settings`, label: '設定' },
            ].map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive }) =>
                  `border-b-2 py-4 text-xs ${isActive ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-brand'}`
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <main className="mx-auto max-w-[1200px] px-6 py-9">{children}</main>
      <footer className="mx-auto flex max-w-[1200px] justify-between px-6 py-6 text-[11px] text-muted/75">
        <span>セトリ · ライブの出演順を、もっとスムーズに。</span>
        <span>デモ · 再読み込みで初期化</span>
      </footer>
    </div>
  )
}
