import { useCallback, useRef, useState } from 'react'

import { useResource } from '../../../shared/hooks/useResource'
import { memberNames } from '../../../shared/model/event'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { buildSchedule } from '../../event/model/schedule'

export function useParticipants(eventId: string, initialNotice = '') {
  const load = useCallback(
    (signal: AbortSignal) => workspaceRepository.getRoster(eventId, signal),
    [eventId],
  )
  const resource = useResource(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [deleteTarget, setDeleteTarget] = useState<{
    id: string
    name: string
    updatedAt: string
  } | null>(null)
  const [deleteError, setDeleteError] = useState('')
  const [deleteBusy, setDeleteBusy] = useState(false)
  const [notice, setNotice] = useState(initialNotice)
  const [importOpen, setImportOpen] = useState(false)
  const busy = useRef(false)
  const data = resource.data
  async function confirmDelete() {
    if (!deleteTarget || busy.current) return
    busy.current = true
    setDeleteBusy(true)
    setDeleteError('')
    try {
      const saved = await workspaceRepository.deleteBand(
        eventId,
        deleteTarget.id,
        deleteTarget.updatedAt,
      )
      resource.setData(
        (current) =>
          current && {
            ...current,
            updatedAt: saved.updatedAt,
            performances: current.performances.filter(
              (band) => band.id !== deleteTarget.id,
            ),
            unassigned: current.unassigned.filter(
              (id) => id !== deleteTarget.id,
            ),
            sections: current.sections.map((section) => ({
              ...section,
              slots: section.slots.map((id) =>
                id === deleteTarget.id ? null : id,
              ),
            })),
          },
      )
      setDeleteTarget(null)
      setNotice(`「${deleteTarget.name}」を削除しました。`)
    } catch (cause) {
      setDeleteError(
        cause instanceof Error ? cause.message : '削除に失敗しました。',
      )
    } finally {
      busy.current = false
      setDeleteBusy(false)
    }
  }
  async function refreshDeleteTarget() {
    if (busy.current) return
    busy.current = true
    setDeleteBusy(true)
    try {
      const latest = await workspaceRepository.getRoster(eventId)
      resource.setData(latest)
      setDeleteTarget(null)
      setDeleteError('')
      setNotice('最新の状態を取得しました。削除する出演枠を確認してください。')
    } catch (cause) {
      setDeleteError(
        cause instanceof Error
          ? cause.message
          : '最新の状態を取得できませんでした。',
      )
    } finally {
      busy.current = false
      setDeleteBusy(false)
    }
  }
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
    deleteTarget,
    deleteError,
    deleteBusy,
    notice,
    confirmDelete,
    refreshDeleteTarget,
    requestDelete: (id: string) => {
      if (busy.current || !data?.updatedAt) return
      const band = data.performances.find((item) => item.id === id)
      if (!band) return
      setDeleteError('')
      setNotice('')
      setDeleteTarget({ id, name: band.name, updatedAt: data.updatedAt })
    },
    cancelDelete: () => {
      if (!busy.current) setDeleteTarget(null)
    },
    importOpen,
    openImport: () => {
      setNotice('')
      setImportOpen(true)
    },
    closeImport: () => setImportOpen(false),
    // A partial failure keeps the dialog open with its error; both cases reload
    // so the bands registered so far appear in the list.
    importDone: (count: number, completed: boolean) => {
      resource.refresh()
      if (completed) {
        setImportOpen(false)
        setNotice(`${count}組を取り込みました。`)
      }
    },
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
