import type { ReactNode } from 'react'
import { Link, NavLink } from 'react-router'

import { useSession } from '../../app/sessionContext'
import { AppHeader } from './AppHeader'
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
        workspace ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-dvh'
      }
    >
      <AppHeader
        navigation={
          <Link
            to="/event"
            className="shrink-0 text-xs whitespace-nowrap text-muted hover:text-brand"
          >
            マイイベント
          </Link>
        }
      >
        <span className="hidden size-7 items-center justify-center rounded-full bg-wash text-xs font-semibold text-brand sm:flex">
          運
        </span>
        <span className="hidden max-w-32 truncate text-xs sm:inline">
          {session?.name}
        </span>
        <Button
          variant="ghost"
          className="text-xs"
          aria-label="ログアウト"
          onClick={() => void signOut()}
        >
          <Icon name="logout" />
          <span className="hidden sm:inline">ログアウト</span>
        </Button>
      </AppHeader>
      {eventId && (
        <div className="shrink-0 border-b border-line bg-white">
          <nav
            aria-label="イベント内の移動"
            className="flex min-w-0 flex-wrap items-center gap-x-4 px-3 sm:gap-x-5 sm:px-6"
          >
            <Link
              to={`/event/${eventId}`}
              className="w-full min-w-0 truncate py-2 text-sm font-semibold sm:mr-auto sm:w-auto sm:flex-1 sm:py-4"
              title={eventName || 'イベント'}
            >
              {workspace ? (
                <h1 className="truncate text-sm font-semibold">
                  {eventName || 'イベント'}
                </h1>
              ) : (
                eventName || 'イベント'
              )}
            </Link>
            {[
              { path: `/event/${eventId}`, label: '出演順' },
              { path: `/event/${eventId}/forms/edit`, label: 'フォーム管理' },
              { path: `/event/${eventId}/settings`, label: '設定' },
            ].map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                end
                className={({ isActive }) =>
                  `shrink-0 border-b-2 py-2 text-xs whitespace-nowrap sm:py-4 ${isActive ? 'border-brand font-semibold text-brand' : 'border-transparent text-muted hover:text-brand'}`
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
