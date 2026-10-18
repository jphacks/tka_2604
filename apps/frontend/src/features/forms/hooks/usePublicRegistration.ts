import { useEffect, useRef, useState } from 'react'

import {
  applySavedBand,
  emptyRegistration,
  type RegistrationDraft,
  registrationInput,
  type RegistrationMode,
  selectBand,
} from '../model/registration'
import { registrationRepository } from '../repositories/registrationRepository'
import {
  type FormRoster,
  RegistrationError,
  type RegistrationRepository,
  type SavedFormBand,
} from '../repositories/types'

export function usePublicRegistration(
  eventId: string,
  repository: RegistrationRepository = registrationRepository,
  initialBandId?: string,
) {
  const [data, setData] = useState<FormRoster | null>(null)
  const [error, setError] = useState('')
  const [mode, setModeState] = useState<RegistrationMode>(
    initialBandId ? 'update' : 'create',
  )
  const [draft, setDraft] = useState(emptyRegistration)
  const [busy, setBusy] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [formError, setFormError] = useState('')
  const [conflict, setConflict] = useState(false)
  const [rosterNotice, setRosterNotice] = useState('')
  const [submitted, setSubmitted] = useState<SavedFormBand | null>(null)
  const locked = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    repository
      .get(eventId, controller.signal)
      .then((roster) => {
        if (!controller.signal.aborted) {
          setData(roster)
          if (
            initialBandId &&
            roster.bands.some((band) => band.bandId === initialBandId)
          )
            setDraft(selectBand(roster, initialBandId))
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error
              ? cause.message
              : '名簿を読み込めませんでした。',
          )
      })
    return () => controller.abort()
  }, [eventId, repository, initialBandId])

  async function refresh() {
    if (locked.current) return
    locked.current = true
    setRefreshing(true)
    try {
      const roster = await repository.get(eventId, lifetime.current?.signal)
      if (lifetime.current?.signal.aborted) return
      setData(roster)
      setError('')
      setConflict(false)
      setFormError('')
    } catch (cause) {
      if (!lifetime.current?.signal.aborted) {
        const message =
          cause instanceof Error
            ? cause.message
            : '名簿を読み込めませんでした。'
        if (data) setFormError(message)
        else setError(message)
      }
    } finally {
      locked.current = false
      if (!lifetime.current?.signal.aborted) setRefreshing(false)
    }
  }
  async function submit() {
    if (!data || locked.current || conflict || submitted) return
    let input
    try {
      input = registrationInput(mode, draft, data)
    } catch (cause) {
      setFormError(
        cause instanceof Error ? cause.message : '入力を確認してください。',
      )
      return
    }
    locked.current = true
    setBusy(true)
    setFormError('')
    try {
      const saved =
        mode === 'create'
          ? await repository.create(eventId, input)
          : await repository.update(eventId, draft.bandId, input)
      if (lifetime.current?.signal.aborted) return
      setData(applySavedBand(data, saved))
      setSubmitted(saved)
      try {
        const roster = await repository.get(eventId, lifetime.current?.signal)
        if (!lifetime.current?.signal.aborted) setData(roster)
      } catch {
        if (!lifetime.current?.signal.aborted)
          setRosterNotice(
            '保存は完了しましたが、最新名簿を取得できませんでした。次の編集の前にページを再読み込みしてください。',
          )
      }
    } catch (cause) {
      if (!lifetime.current?.signal.aborted) {
        setConflict(
          cause instanceof RegistrationError &&
            cause.code === 'event_save_conflict',
        )
        setFormError(
          cause instanceof Error
            ? cause.message
            : '保存に失敗しました。時間をおいて再試行してください。',
        )
      }
    } finally {
      locked.current = false
      if (!lifetime.current?.signal.aborted) setBusy(false)
    }
  }
  function reset() {
    setSubmitted(null)
    setRosterNotice('')
    setFormError('')
  }
  return {
    data,
    error,
    loading: !data && !error,
    mode,
    draft,
    busy,
    refreshing,
    formError,
    conflict,
    submitted,
    rosterNotice,
    submit,
    refresh,
    change(patch: Partial<RegistrationDraft>) {
      if (locked.current) return
      setDraft((value) => ({ ...value, ...patch }))
      setFormError('')
    },
    setMode(value: RegistrationMode) {
      if (locked.current) return
      setModeState(value)
      setDraft(emptyRegistration())
      reset()
    },
    chooseBand(bandId: string) {
      if (!data || locked.current) return
      setDraft(selectBand(data, bandId))
      reset()
    },
    another() {
      if (locked.current) return
      setDraft(emptyRegistration())
      reset()
      void refresh()
    },
  }
}
export type PublicRegistrationController = ReturnType<
  typeof usePublicRegistration
>
