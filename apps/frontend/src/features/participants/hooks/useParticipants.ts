import { useCallback, useState } from 'react'

import { useResource } from '../../../shared/hooks/useResource'
import { memberNames } from '../../../shared/model/event'
import type { PerformanceDraft } from '../../../shared/model/workspace'
import { validatePerformance } from '../../../shared/model/workspace'
import { dataSource } from '../../../shared/repositories/dataSource'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { buildSchedule } from '../../event/model/schedule'

const emptyDraft: PerformanceDraft = {
  name: '',
  memberIds: [],
  members: '',
  requests: '',
  contact: '',
}
export function useParticipants(eventId: string) {
  const load = useCallback(
    (signal: AbortSignal) => workspaceRepository.getRoster(eventId, signal),
    [eventId],
  )
  const resource = useResource(load)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'unassigned' | 'assigned'>('all')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [draft, setDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const data = resource.data?.data
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
  const submissions = new Map(
    resource.data?.submissions?.map((submission) => [
      submission.performanceId,
      submission,
    ]),
  )
  const rows =
    data?.performances.map((performance) => ({
      ...performance,
      members: memberNames(data, performance),
      position: orders.get(performance.id),
      submission: submissions.get(performance.id),
    })) ?? []
  function openEditor(id?: string) {
    const row = rows.find((performance) => performance.id === id)
    setEditingId(id ?? null)
    setDraft(
      row
        ? {
            name: row.name,
            memberIds: row.memberIds,
            members: '',
            requests: row.submission?.requests ?? '',
            contact: row.submission?.contact ?? '',
          }
        : emptyDraft,
    )
    setError('')
    setEditorOpen(true)
  }
  async function save() {
    if (busy) return
    const message = validatePerformance(draft)
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    try {
      if (editingId)
        await workspaceRepository.updatePerformance(eventId, editingId, draft)
      else await workspaceRepository.addPerformance(eventId, draft)
      setEditorOpen(false)
      setNotice(
        editingId
          ? '出演枠を更新しました。'
          : '出演枠を追加しました。未配置一覧から配置できます。',
      )
      resource.refresh()
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  async function remove() {
    if (!deletingId || busy) return
    setBusy(true)
    try {
      await workspaceRepository.deletePerformance(eventId, deletingId)
      setDeletingId(null)
      resource.refresh()
      setNotice('出演枠を削除しました。')
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  return {
    ...resource,
    canEdit: dataSource === 'mock',
    query,
    filter,
    editorOpen,
    editingId,
    draft,
    busy,
    formError: error,
    notice,
    deletingId,
    deletingName: rows.find((row) => row.id === deletingId)?.name,
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
      members: new Set(rows.flatMap((row) => row.memberIds)).size,
      unassigned: data?.unassigned.length ?? 0,
      responses:
        resource.data?.submissions?.filter((item) => item.source === 'form')
          .length ?? null,
    },
    setQuery,
    setFilter,
    openEditor,
    save,
    remove,
    requestDelete: (id: string) => {
      setError('')
      setDeletingId(id)
    },
    cancelDelete: () => {
      if (!busy) setDeletingId(null)
    },
    closeEditor: () => {
      if (!busy) setEditorOpen(false)
    },
    change: (patch: Partial<PerformanceDraft>) => {
      setDraft((value) => ({ ...value, ...patch }))
      setError('')
    },
  }
}
