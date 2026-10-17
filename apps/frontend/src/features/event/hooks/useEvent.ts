import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import { type EventData, scheduleContent } from '../../../shared/model/event'
import { dataSource } from '../../../shared/repositories/dataSource'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import {
  type ConstraintPatch,
  eventReducer,
  initialState,
} from '../model/eventReducer'
import { exportEventCsv } from '../model/export'
import { buildSchedule, findTarget } from '../model/schedule'
import { eventRepository } from '../repositories/eventRepository'
import { useEventChat } from './useEventChat'

export function useEvent(eventId: string) {
  const [state, dispatch] = useReducer(eventReducer, initialState)
  const [baseline, setBaseline] = useState<EventData | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
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
    persistent && (dirty || saving || refreshing),
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

  const save = useCallback(
    async (kind: 'schedule' | 'constraints') => {
      if (!event || busy.current || refreshing || chat.sending || !persistent)
        return
      busy.current = true
      setSaving(true)
      const signal = lifetime.current?.signal
      dispatch({ type: 'notice', message: '' })
      try {
        const saved =
          kind === 'schedule'
            ? await eventRepository.saveSchedule(event)
            : await eventRepository.saveConstraints(event)
        if (signal?.aborted) return
        const constraintSources = saved.constraintSources
        dispatch({
          type: 'saved',
          updatedAt: saved.updatedAt,
          constraintSources,
        })
        setBaseline(
          (current) =>
            current && {
              ...current,
              updatedAt: saved.updatedAt,
              ...(kind === 'schedule'
                ? { sections: event.sections, unassigned: event.unassigned }
                : { constraints: event.constraints }),
            },
        )
      } catch (error) {
        if (!signal?.aborted)
          setSaveError(
            error instanceof Error ? error.message : '保存に失敗しました。',
          )
      } finally {
        busy.current = false
        if (!signal?.aborted) setSaving(false)
      }
    },
    [event, refreshing, chat.sending, persistent],
  )

  useEffect(() => {
    if (!dirty || saving || refreshing || chat.sending || saveError) return
    let cancelled = false
    queueMicrotask(() => {
      if (!cancelled) void save(scheduleDirty ? 'schedule' : 'constraints')
    })
    return () => {
      cancelled = true
    }
  }, [dirty, scheduleDirty, saving, refreshing, chat.sending, saveError, save])
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
    retrySave: () => setSaveError(''),
    loadError,
    persistent,
    saving,
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
