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
  wide = false,
  workspace = false,
}: {
  children: ReactNode
  eventId?: string
  eventName?: string
  wide?: boolean
  workspace?: boolean
}) {
  const width = workspace ? '' : wide ? 'max-w-[1600px]' : 'max-w-[1200px]'
  const { session, signOut } = useSession()
  return (
    <div
      className={
        workspace
          ? 'flex min-h-dvh flex-col xl:h-dvh xl:overflow-hidden'
          : 'min-h-dvh'
      }
    >
      <header className="flex min-h-16 shrink-0 flex-wrap items-center justify-between gap-3 border-b border-line bg-white px-4 py-3">
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
        <div className="shrink-0 border-b border-line bg-white">
          <nav
            aria-label="イベント内の移動"
            className="flex flex-wrap items-center gap-x-5 px-4 sm:px-6"
          >
            <Link
              to={`/event/${eventId}`}
              className="mr-auto py-4 text-sm font-semibold"
            >
              {workspace ? (
                <h1 className="text-sm font-semibold">
                  {eventName || 'イベント'}
                </h1>
              ) : (
                eventName || 'イベント'
              )}
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
                {/* 太字の幅を先に確保し、選択中のタブが変わっても位置がずれないようにする */}
                <span
                  data-label={item.label}
                  className="inline-flex flex-col after:invisible after:h-0 after:overflow-hidden after:font-semibold after:content-[attr(data-label)]"
                >
                  {item.label}
                </span>
              </NavLink>
            ))}
          </nav>
        </div>
      )}
      <main
        className={
          workspace
            ? 'relative flex min-h-0 min-w-0 flex-1 flex-col'
            : `mx-auto px-4 py-7 sm:px-6 sm:py-9 ${width}`
        }
      >
        {children}
      </main>
    </div>
  )
}
