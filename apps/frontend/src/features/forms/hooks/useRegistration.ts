import { useState } from 'react'

import { useEventResource } from '../../../shared/hooks/useEventResource'
import type {
  FormSettings,
  PerformanceDraft,
} from '../../../shared/model/workspace'
import { validatePerformance } from '../../../shared/model/workspace'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'

const emptyDraft: PerformanceDraft = {
  name: '',
  memberIds: [],
  members: '',
  requests: '',
  contact: '',
}
export function useRegistrationForm(eventId: string) {
  const resource = useEventResource(eventId)
  const [draft, setDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')
  async function submit() {
    if (busy || !resource.data?.settings.accepting) return
    const message = validatePerformance({
      ...draft,
      contact: resource.data.settings.collectContact ? draft.contact : '',
      requests: resource.data.settings.collectRequests ? draft.requests : '',
    })
    if (message) {
      setError(message)
      return
    }
    setBusy(true)
    setError('')
    try {
      await workspaceRepository.submitPerformance(eventId, draft)
      setSubmitted(true)
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '送信に失敗しました。')
    } finally {
      setBusy(false)
    }
  }
  return {
    ...resource,
    draft,
    busy,
    submitted,
    formError: error,
    submit,
    setDraft: (patch: Partial<PerformanceDraft>) => {
      setDraft((value) => ({ ...value, ...patch }))
      setError('')
    },
    another: () => {
      setDraft(emptyDraft)
      resource.refresh()
      setSubmitted(false)
      setError('')
    },
  }
}
export function useFormEditor(eventId: string) {
  const resource = useEventResource(eventId)
  const [draft, setDraft] = useState<FormSettings | null>(null)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const settings = draft ?? resource.data?.settings ?? null
  async function save() {
    if (!settings || busy) return
    if (!settings.title.trim()) {
      setError('フォーム名を入力してください。')
      return
    }
    setBusy(true)
    setError('')
    setNotice('')
    try {
      await workspaceRepository.updateForm(eventId, settings)
      setNotice('フォームの設定を更新しました。')
      resource.refresh()
      setDraft(settings)
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : '設定を更新できませんでした。',
      )
    } finally {
      setBusy(false)
    }
  }
  const formUrl = `${window.location.origin}/event/${eventId}/forms`
  const responseCount =
    resource.data?.submissions.filter((item) => item.source === 'form')
      .length ?? 0
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(formUrl)
      setNotice('回答フォームのリンクをコピーしました。')
    } catch {
      setNotice('リンクを選択してコピーしてください。')
    }
  }
  return {
    ...resource,
    settings,
    busy,
    notice,
    formError: error,
    save,
    copyLink,
    formUrl,
    responseCount,
    change: (patch: Partial<FormSettings>) => {
      if (settings) setDraft({ ...settings, ...patch })
      setNotice('')
      setError('')
    },
  }
}
export type RegistrationController = ReturnType<typeof useRegistrationForm>
export type FormEditorController = ReturnType<typeof useFormEditor>
