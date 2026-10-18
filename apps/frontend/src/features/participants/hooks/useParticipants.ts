import { useCallback, useState } from 'react'

import { useResource } from '../../../shared/hooks/useResource'
import { memberNames } from '../../../shared/model/event'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { buildSchedule } from '../../event/model/schedule'

export function useParticipants(eventId: string) {
  const load = useCallback(
    (signal: AbortSignal) => workspaceRepository.getRoster(eventId, signal),
    [eventId],
  )
  const resource = useResource(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const data = resource.data
  const orders = new Map(
    data
      ? buildSchedule(data).sections.flatMap((section) =>
          section.rows
            .filter((row) => row.performance)
            .map((row) => [
              row.performance!.id,
              { order: row.order, section: section.name },
            ]),
        )
      : [],
  )
  const rows =
    data?.performances.map((performance) => ({
      ...performance,
      members: memberNames(data, performance),
      position: orders.get(performance.id),
    })) ?? []
  return {
    ...resource,
    query,
    filter,
    rows: rows.filter(
      (row) =>
        (filter === 'all' ||
          (filter === 'assigned' ? Boolean(row.position) : !row.position)) &&
        `${row.name} ${row.members.join(' ')}`
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    ),
    stats: {
      total: rows.length,
      members: data?.members.length ?? 0,
      unassigned: data?.unassigned.length ?? 0,
    },
    setQuery,
    setFilter,
  }
}
