import { type ReactNode, useRef, useState } from 'react'
import { Link, NavLink } from 'react-router'

import { useSession } from '../../app/sessionContext'
import { AccountProfile } from '../../features/auth/components/AccountProfile'
import { AppHeader } from './AppHeader'
import { Button } from './Button'
import { Icon } from './Icon'

export function AppFrame({
  children,
  eventId,
  eventName,
  eventStatus,
  wide = false,
  workspace = false,
}: {
  children: ReactNode
  eventId?: string
  eventName?: string
  eventStatus?: ReactNode
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
        {session && (
          <AccountProfile key={session.userId} userId={session.userId} />
        )}
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
      </AppHeader>
      {logoutError && (
        <p role="alert" className="bg-red-50 px-4 py-3 text-sm text-red-600">
          {logoutError}
        </p>
      )}
      {eventId && !workspace && (
        <div className="shrink-0 border-b border-line bg-white">
          <nav
            aria-label="イベント内の移動"
            className="flex min-w-0 flex-wrap items-center gap-x-4 px-3 sm:gap-x-5 sm:px-6"
          >
            <div className="flex w-full min-w-0 items-center gap-3 py-2 sm:mr-auto sm:w-auto sm:flex-1 sm:py-4">
              <Link
                to={`/event/${eventId}`}
                className="min-w-0 truncate text-sm font-semibold"
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
              {eventStatus}
            </div>
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
