import { useState } from 'react'

import { useEventResource } from '../../../shared/hooks/useEventResource'
import type { EventData } from '../../../shared/model/event'
import {
  type PerformanceDraft,
  type RegistrationData,
  validatePerformance,
} from '../../../shared/model/workspace'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { PageState } from '../../../shared/ui/PageState'
import { PerformanceFields } from '../../forms/components/PerformanceFields'

export function PerformanceEditor({
  eventId,
  performanceId,
  onSaved,
  onClose,
}: {
  eventId: string
  performanceId: string
  onSaved: (event: EventData) => void
  onClose: () => void
}) {
  const resource = useEventResource(eventId)
  const [busy, setBusy] = useState(false)
  const close = () => {
    if (!busy) onClose()
  }
  return (
    <Dialog title="出演枠を編集" onClose={close}>
      {resource.data ? (
        <PerformanceEditorForm
          registration={resource.data}
          performanceId={performanceId}
          busy={busy}
          setBusy={setBusy}
          onSaved={onSaved}
          onClose={close}
        />
      ) : (
        <PageState error={resource.error} onRetry={resource.refresh} />
      )}
    </Dialog>
  )
}

function PerformanceEditorForm({
  registration,
  performanceId,
  busy,
  setBusy,
  onSaved,
  onClose,
}: {
  registration: RegistrationData
  performanceId: string
  busy: boolean
  setBusy: (value: boolean) => void
  onSaved: (event: EventData) => void
  onClose: () => void
}) {
  const performance = registration.data.performances.find(
    (item) => item.id === performanceId,
  )
  const [draft, setDraft] = useState<PerformanceDraft>(() => {
    const submission = registration.submissions.find(
      (item) => item.performanceId === performanceId,
    )
    return {
      name: performance?.name ?? '',
      memberIds: performance?.memberIds ?? [],
      members: '',
      requests: submission?.requests ?? '',
      contact: submission?.contact ?? '',
    }
  })
  const [error, setError] = useState('')
  async function save() {
    if (busy || !performance) return
    const message = validatePerformance(draft)
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    try {
      await workspaceRepository.updatePerformance(
        registration.event.id,
        performanceId,
        draft,
      )
      const updated = await workspaceRepository.getRegistration(
        registration.event.id,
      )
      onSaved(updated.data)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '更新に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  if (!performance) return <p role="alert">出演枠が見つかりません。</p>
  return (
    <form
      noValidate
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <PerformanceFields
        event={registration.data}
        draft={draft}
        disabled={busy}
        onChange={(patch) => {
          setDraft((current) => ({ ...current, ...patch }))
          setError('')
        }}
      />
      {error && (
        <p role="alert" className="mt-4 text-xs text-red-600">
          {error}
        </p>
      )}
      <div className="mt-6 flex justify-end gap-2">
        <Button disabled={busy} onClick={onClose}>
          キャンセル
        </Button>
        <Button disabled={busy} type="submit" variant="primary">
          {busy ? '保存中…' : '変更を保存'}
        </Button>
      </div>
    </form>
  )
}
