import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useResource } from '../../../shared/hooks/useResource'
import type { EventDraft, EventStatus } from '../../../shared/model/workspace'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'

const emptyDraft: EventDraft = {
  name: '',
  date: '',
  venue: '',
  description: '',
  bandCounts: [4],
}
export function useEvents() {
  const navigate = useNavigate()
  const load = useCallback(
    (signal: AbortSignal) => workspaceRepository.listEvents(signal),
    [],
  )
  const resource = useResource(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<EventStatus | 'all'>('all')
  const [searchParams, setSearchParams] = useSearchParams()
  const creating = searchParams.get('create') === '1'
  const [draft, setDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const events = resource.data ?? []
  async function create() {
    if (busy) return
    if (!draft.name.trim()) {
      setError('イベント名を入力してください。')
      return
    }
    setBusy(true)
    setError('')
    try {
      const event = await workspaceRepository.createEvent(draft)
      await navigate(`/event/${event.id}`)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '作成に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  return {
    ...resource,
    query,
    filter,
    creating,
    draft,
    busy,
    formError: error,
    visible: events.filter(
      (event) =>
        (filter === 'all' || event.status === filter) &&
        `${event.name} ${event.venue}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    setQuery,
    setFilter,
    create,
    openCreate: () => {
      setDraft(emptyDraft)
      setError('')
      setSearchParams(
        (params) => {
          params.set('create', '1')
          return params
        },
        { replace: true },
      )
    },
    closeCreate: () => {
      if (!busy)
        setSearchParams(
          (params) => {
            params.delete('create')
            return params
          },
          { replace: true },
        )
    },
    setDraft: (patch: Partial<EventDraft>) =>
      setDraft((value) => ({ ...value, ...patch })),
  }
}
export type EventsController = ReturnType<typeof useEvents>
