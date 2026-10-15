import type { ComponentType } from 'react'
import {
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
  useParams,
} from 'react-router'

import { LoginPage } from '../features/auth/pages/LoginPage'
import { EventPage } from '../features/event/pages/EventPage'
import { EventSettingsPage } from '../features/events/pages/EventSettingsPage'
import { EventsPage } from '../features/events/pages/EventsPage'
import { FormEditorPage } from '../features/forms/pages/FormEditorPage'
import { RegistrationPage } from '../features/forms/pages/RegistrationPage'
import { ParticipantsPage } from '../features/participants/pages/ParticipantsPage'
import { Brand } from '../shared/ui/Brand'
import { LinkButton } from '../shared/ui/LinkButton'
import { PageState } from '../shared/ui/PageState'
import { loginDestination } from './navigation'
import { useSession } from './sessionContext'

function ProtectedRoutes() {
  const { session, loading } = useSession()
  const location = useLocation()
  if (loading) return <PageState />
  return session ? (
    <Outlet />
  ) : (
    <Navigate to="/login" replace state={{ returnTo: location.pathname }} />
  )
}

function LoginRoute() {
  const { session, loading } = useSession()
  const location = useLocation()
  if (loading) return <PageState />
  return session ? (
    <Navigate to={loginDestination(location.state)} replace />
  ) : (
    <LoginPage />
  )
}

function EventScopedRoute({ component: Page }: { component: ComponentType }) {
  const { eventId = '' } = useParams()
  return <Page key={eventId} />
}

function NotFoundPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-5 px-6 text-center">
      <Brand />
      <p className="mt-4 text-5xl font-semibold text-brand/40">404</p>
      <h1 className="text-xl font-semibold">ページが見つかりません</h1>
      <p className="text-sm text-muted">
        URLをご確認いただくか、イベント一覧からお探しください。
      </p>
      <LinkButton primary to="/event">
        イベント一覧へ
      </LinkButton>
    </main>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/event" replace />} />
      <Route path="/login" element={<LoginRoute />} />
      <Route
        path="/event/:eventId/forms"
        element={<EventScopedRoute component={RegistrationPage} />}
      />
      <Route element={<ProtectedRoutes />}>
        <Route
          path="/event/:eventId/performances"
          element={<EventScopedRoute component={ParticipantsPage} />}
        />
        <Route
          path="/event/:eventId/forms/edit"
          element={<EventScopedRoute component={FormEditorPage} />}
        />
        <Route path="/event" element={<EventsPage />} />
        <Route
          path="/event/:eventId"
          element={<EventScopedRoute component={EventPage} />}
        />
        <Route
          path="/event/:eventId/settings"
          element={<EventScopedRoute component={EventSettingsPage} />}
        />
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}
