import { useState } from 'react'
import { Outlet, useMatch, useParams } from 'react-router'

import { ProcessingStatus } from '../features/event/components/ProcessingStatus'
import { AppFrame } from '../shared/ui/AppFrame'
import { EventNameContext } from './eventNameContext'
import { EventProcessingContext } from './eventProcessingContext'

export function EventLayout() {
  const { eventId = '' } = useParams()
  return <EventLayoutForEvent key={eventId} eventId={eventId} />
}

function EventLayoutForEvent({ eventId }: { eventId: string }) {
  const [eventName, setEventName] = useState('')
  const [processingMessage, setProcessingMessage] = useState<string>()
  const isWorkspace = useMatch({ path: '/event/:eventId', end: true }) !== null
  return (
    <EventNameContext.Provider value={setEventName}>
      <EventProcessingContext.Provider value={setProcessingMessage}>
        <AppFrame
          eventId={eventId}
          eventName={eventName}
          workspace={isWorkspace}
          eventStatus={
            isWorkspace ? (
              <ProcessingStatus message={processingMessage} />
            ) : undefined
          }
        >
          <Outlet />
        </AppFrame>
      </EventProcessingContext.Provider>
    </EventNameContext.Provider>
  )
}
