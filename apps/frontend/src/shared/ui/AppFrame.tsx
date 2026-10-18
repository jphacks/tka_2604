import { type ReactNode, useRef, useState } from 'react'
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
  const [signingOut, setSigningOut] = useState(false)
  const [logoutError, setLogoutError] = useState('')
  const logoutInFlight = useRef(false)
  async function logout() {
    if (logoutInFlight.current) return
    logoutInFlight.current = true
    setSigningOut(true)
    setLogoutError('')
    try {
      await signOut()
    } catch {
      setLogoutError(
        'ログアウトできませんでした。接続を確認してもう一度お試しください。',
      )
    } finally {
      logoutInFlight.current = false
      setSigningOut(false)
    }
  }
  return (
    <div
      className={
        workspace ? 'flex h-dvh flex-col overflow-hidden' : 'min-h-dvh'
      }
    >
      <header className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-b border-line bg-white px-3 py-1.5 sm:min-h-16 sm:px-4 sm:py-3">
        <div className="flex min-w-0 items-center gap-3 sm:gap-8">
          <Brand />
          <Link
            to="/event"
            className="shrink-0 text-xs whitespace-nowrap text-muted hover:text-brand"
          >
            マイイベント
          </Link>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <span className="hidden size-7 items-center justify-center rounded-full bg-wash text-xs font-semibold text-brand sm:flex">
            運
          </span>
          <span className="hidden max-w-32 truncate text-xs sm:inline">
            {session?.userId}
          </span>
          <Button
            variant="ghost"
            className="text-xs"
            aria-label="ログアウト"
            disabled={signingOut}
            onClick={() => void logout()}
          >
            <Icon name="logout" />
            <span className="hidden sm:inline">ログアウト</span>
          </Button>
        </div>
      </header>
      {logoutError && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-600">
          {logoutError}
        </p>
      )}
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
