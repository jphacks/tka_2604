import { useParams } from 'react-router'

import { useEventResource } from '../../../shared/hooks/useEventResource'
import { AppFrame } from '../../../shared/ui/AppFrame'
import { PageState } from '../../../shared/ui/PageState'

export function EventPage() {
  const { eventId = '' } = useParams()
  const resource = useEventResource(eventId)
  return (
    <AppFrame eventId={eventId} eventName={resource.data?.event.name}>
      {resource.data ? (
        <h1 className="text-2xl font-semibold">{resource.data.event.name}</h1>
      ) : (
        <PageState error={resource.error} onRetry={resource.refresh} />
      )}
    </AppFrame>
  )
}
