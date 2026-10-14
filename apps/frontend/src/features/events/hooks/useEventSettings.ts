import { useState } from 'react'
import { useNavigate } from 'react-router'

import { useEventResource } from '../../../shared/hooks/useEventResource'
import type { EventDetails } from '../../../shared/model/workspace'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'

export function useEventDeletion(eventId: string) {
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  async function remove() {
    if (busy) return
    setBusy(true)
    setError('')
    try {
      await workspaceRepository.deleteEvent(eventId)
      await navigate('/event', { replace: true })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '削除に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  return {
    deleting,
    busy,
    error,
    remove,
    requestDelete: () => {
      setError('')
      setDeleting(true)
    },
    cancelDelete: () => {
      if (!busy) setDeleting(false)
    },
  }
}
export function useEventSettings(eventId: string) {
  const resource = useEventResource(eventId)
  const [draft, setDraft] = useState<EventDetails | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const settings = draft ?? resource.data?.event
  async function save() {
    if (!settings || busy) return
    if (!settings.name.trim()) {
      setError('イベント名を入力してください。')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await workspaceRepository.updateDetails(eventId, {
        ...settings,
        name: settings.name.trim(),
      })
      setDraft(null)
      resource.refresh()
      setNotice('イベントの設定を更新しました。')
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '設定を更新できませんでした。',
      )
    } finally {
      setBusy(false)
    }
  }
  return {
    ...resource,
    settings,
    busy,
    formError: error,
    notice,
    save,
    change: (patch: Partial<EventDetails>) => {
      if (settings) setDraft({ ...settings, ...patch })
      setError('')
      setNotice('')
    },
  }
}
