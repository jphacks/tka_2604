import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import { type EventData, scheduleContent } from '../../../shared/model/event'
import { dataSource } from '../../../shared/repositories/dataSource'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { applyChatProposal } from '../model/chatProposal'
import {
  type ConstraintPatch,
  eventReducer,
  initialState,
} from '../model/eventReducer'
import { exportEventCsv } from '../model/export'
import { buildSchedule, findTarget } from '../model/schedule'
import { applySolverSchedule, solveMessages } from '../model/solve'
import { eventRepository } from '../repositories/eventRepository'
import { useEventChat } from './useEventChat'

export function useEvent(eventId: string) {
  const [state, dispatch] = useReducer(eventReducer, initialState)
  const [baseline, setBaseline] = useState<EventData | null>(null)
  const [savingKind, setSavingKind] = useState<
    'schedule' | 'constraints' | null
  >(null)
  const saving = savingKind !== null
  const [saveError, setSaveError] = useState('')
  const [failedKind, setFailedKind] = useState<'schedule' | 'constraints'>(
    'constraints',
  )
  const [solving, setSolving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const persistent = dataSource === 'api'
  const event = state.event
  const scheduleDirty =
    persistent &&
    !!event &&
    !!baseline &&
    JSON.stringify(scheduleContent(event)) !==
      JSON.stringify(scheduleContent(baseline))
  const constraintsDirty =
    persistent &&
    !!event &&
    !!baseline &&
    JSON.stringify(event.constraints) !== JSON.stringify(baseline.constraints)
  const dirty = scheduleDirty || constraintsDirty
  const chat = useEventChat(
    eventId,
    dispatch,
    event,
    persistent && (dirty || saving || solving || refreshing),
  )
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showUnmet, setShowUnmet] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    lifetime.current = controller
    eventRepository
      .getEvent(eventId, controller.signal)
      .then((event) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'loaded', event })
          setBaseline(event)
          setLoadError('')
          setSaveError('')
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error ? error.message : '読み込みに失敗しました。',
          )
      })
      .finally(() => {
        if (!controller.signal.aborted) setRefreshing(false)
      })
    return () => controller.abort()
  }, [eventId, retry])

  useEffect(() => {
    if (state.event) workspaceRepository.rememberEvent(state.event)
  }, [state.event])

  useEffect(() => {
    if (!dirty) return
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])

  const persist = useCallback(
    async (snapshot: EventData, kind: 'schedule' | 'constraints') => {
      const saved =
        kind === 'schedule'
          ? await eventRepository.saveSchedule(snapshot)
          : await eventRepository.saveConstraints(snapshot)
      const next = {
        ...snapshot,
        updatedAt: saved.updatedAt,
        constraintSources:
          saved.constraintSources ?? snapshot.constraintSources,
      }
      if (!lifetime.current?.signal.aborted) {
        dispatch({
          type: 'saved',
          updatedAt: saved.updatedAt,
          constraintSources: saved.constraintSources,
        })
        setBaseline(
          (current) =>
            current && {
              ...current,
              updatedAt: saved.updatedAt,
              ...(kind === 'schedule'
                ? {
                    sections: snapshot.sections,
                    unassigned: snapshot.unassigned,
                  }
                : { constraints: snapshot.constraints }),
            },
        )
      }
      return next
    },
    [],
  )

  const save = useCallback(
    async (kind: 'schedule' | 'constraints') => {
      if (!event || busy.current || refreshing || chat.sending || !persistent)
        return
      busy.current = true
      setSavingKind(kind)
      setSaveError('')
      dispatch({ type: 'notice', message: '' })
      const signal = lifetime.current?.signal
      try {
        await persist(event, kind)
      } catch (error) {
        if (!signal?.aborted) {
          setFailedKind(kind)
          setSaveError(
            error instanceof Error ? error.message : '保存に失敗しました。',
          )
        }
      } finally {
        busy.current = false
        if (!signal?.aborted) setSavingKind(null)
      }
    },
    [event, refreshing, chat.sending, persistent, persist],
  )

  useEffect(() => {
    if (
      !constraintsDirty ||
      saving ||
      solving ||
      refreshing ||
      chat.sending ||
      saveError
    )
      return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void save('constraints')
    })
    return () => {
      cancelled = true
    }
  }, [
    constraintsDirty,
    saving,
    solving,
    refreshing,
    chat.sending,
    saveError,
    save,
  ])

  async function generate() {
    if (!event || busy.current || refreshing || chat.sending || !persistent)
      return
    busy.current = true
    setSolving(true)
    setSaveError('')
    dispatch({ type: 'notice', message: '' })
    const signal = lifetime.current?.signal
    let stage: 'schedule' | 'constraints' | 'solve' = 'schedule'
    try {
      let current = await persist(event, 'schedule')
      if (signal?.aborted) return
      stage = 'constraints'
      current = await persist(current, 'constraints')
      if (signal?.aborted) return
      stage = 'solve'
      const result = await eventRepository.solve(current)
      if (signal?.aborted) return
      const next = applySolverSchedule(current, result)
      dispatch({ type: 'loaded', event: next })
      setBaseline(next)
      dispatch({ type: 'notice', message: solveMessages[result.result.status] })
    } catch (error) {
      if (!signal?.aborted) {
        const message =
          error instanceof Error ? error.message : '計算に失敗しました。'
        if (stage === 'solve')
          dispatch({ type: 'notice', error: true, message })
        else {
          setFailedKind(stage)
          setSaveError(message)
        }
      }
    } finally {
      busy.current = false
      if (!signal?.aborted) setSolving(false)
    }
  }
  const views = event
    ? event.constraints.map((constraint) => ({
        constraint,
        text: describeConstraint(constraint, event),
        ...evaluateConstraint(constraint, event),
      }))
    : []
  const edit: typeof dispatch = (action) => {
    if (busy.current || refreshing || chat.sending) return
    dispatch(action)
  }
  return {
    ...state,
    ...chat,
    error: state.error || saveError,
    saveFailed: Boolean(saveError),
    retrySave: () => save(failedKind),
    saveSchedule: () => save('schedule'),
    generate,
    solving,
    applyProposal: () => {
      if (
        !event ||
        !chat.chatProposal ||
        chat.chatBlocked ||
        busy.current ||
        refreshing ||
        chat.sending
      )
        return
      try {
        const constraints = applyChatProposal(event, chat.chatProposal)
        dispatch({ type: 'constraints-replaced', constraints })
        chat.dismissProposal()
      } catch (error) {
        dispatch({
          type: 'notice',
          error: true,
          message:
            error instanceof Error
              ? error.message
              : '提案を反映できませんでした。',
        })
      }
    },
    loadError,
    persistent,
    saving,
    savingSchedule: savingKind === 'schedule',
    refreshing,
    scheduleDirty,
    constraintsDirty,
    schedule: event ? buildSchedule(event) : null,
    constraintViews: views.filter(
      (view) =>
        !showUnmet || view.status === 'unmet' || view.status === 'invalid',
    ),
    unmetCount: views.filter(
      (view) => view.status === 'unmet' || view.status === 'invalid',
    ).length,
    hardViolationCount: views.filter(
      (view) =>
        view.constraint.hardness === 'hard' &&
        (view.status === 'unmet' || view.status === 'invalid'),
    ).length,
    exportCsv: () => {
      if (event) {
        exportEventCsv(event)
        dispatch({
          type: 'notice',
          message: '出演順をCSVでエクスポートしました。',
        })
      }
    },
    showUnmet,
    setShowUnmet,
    retryLoad: () => {
      if (busy.current || refreshing || chat.sending) return
      if (
        dirty &&
        !window.confirm('未保存の編集を破棄して最新の状態を取得しますか？')
      )
        return
      setRefreshing(true)
      setRetry((value) => value + 1)
    },
    applyPerformanceEdits: (event: EventData) =>
      dispatch({ type: 'performances-updated', event }),
    dismissNotice: () => {
      setLoadError('')
      dispatch({ type: 'notice', message: '' })
    },
    setOrder: (id: string, value: number | null) =>
      edit({ type: 'order', id, value, persistent }),
    setFixed: (id: string, fixed: boolean) =>
      edit({ type: 'fixed', id, fixed }),
    resize: (count: number, sectionId?: string) =>
      edit({ type: 'resize', count, sectionId, persistent }),
    move: (id: string, overId: string) => {
      if (!event || id === overId) return
      const target = findTarget(event, overId)
      if (target) edit({ type: 'move', id, target, persistent })
    },
    saveConstraint: (constraint: Constraint) =>
      edit({ type: 'constraint-save', constraint }),
    updateConstraint: (id: string, patch: ConstraintPatch) =>
      edit({ type: 'constraint-update', id, patch }),
    deleteConstraint: (id: string) => edit({ type: 'constraint-delete', id }),
  }
}
export type EventController = ReturnType<typeof useEvent>
