import { useState } from 'react'
import { Outlet, useMatch, useParams } from 'react-router'

import { AppFrame } from '../shared/ui/AppFrame'
import { EventNameContext } from './eventNameContext'

export function EventLayout() {
  const { eventId = '' } = useParams()
  return <EventLayoutForEvent key={eventId} eventId={eventId} />
}

function EventLayoutForEvent({ eventId }: { eventId: string }) {
  const [eventName, setEventName] = useState('')
  const isWorkspace = useMatch({ path: '/event/:eventId', end: true }) !== null
  return (
    <EventNameContext.Provider value={setEventName}>
      <AppFrame eventId={eventId} eventName={eventName} workspace={isWorkspace}>
        <Outlet />
      </AppFrame>
    </EventNameContext.Provider>
  )
}
