import { useCallback, useEffect, useReducer, useRef, useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import { type EventData, scheduleContent } from '../../../shared/model/event'
import {
  canAutoApprove,
  readAutoApproval,
  storeAutoApproval,
} from '../model/autoApproval'
import { applyChatProposal } from '../model/chatProposal'
import { applyChatReorder } from '../model/chatReorder'
import {
  emptyConstraintFilters,
  filterConstraintViews,
} from '../model/constraintFilters'
import { skipHistoryWarning, skipsHistoryWarning } from '../model/editHistory'
import {
  type ConstraintPatch,
  eventReducer,
  initialState,
  removeBandFromEvent,
} from '../model/eventReducer'
import { exportEventCsv } from '../model/export'
import { buildSchedule, configureSchedule, findTarget } from '../model/schedule'
import { applySolverSchedule, solveMessages } from '../model/solve'
import { eventRepository } from '../repositories/eventRepository'
import { useEventChat } from './useEventChat'

export function useEvent(eventId: string) {
  const [autoApprove, setAutoApprove] = useState(readAutoApproval)
  const autoAttempted = useRef(new Set<string>())
  const [state, dispatch] = useReducer(eventReducer, initialState)
  const [historyConfirmation, setHistoryConfirmation] = useState<
    'undo' | 'redo' | null
  >(null)
  const [baseline, setBaseline] = useState<EventData | null>(null)
  const [savingKind, setSavingKind] = useState<
    'schedule' | 'constraints' | null
  >(null)
  const saving = savingKind !== null
  const [importing, setImporting] = useState(false)
  const [deletingBand, setDeletingBand] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [failedKind, setFailedKind] = useState<'schedule' | 'constraints'>(
    'constraints',
  )
  const [solving, setSolving] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const busy = useRef(false)
  const lifetime = useRef<AbortController | null>(null)
  const event = state.event
  const scheduleDirty =
    !!event &&
    !!baseline &&
    JSON.stringify(scheduleContent(event)) !==
      JSON.stringify(scheduleContent(baseline))
  const constraintsDirty =
    !!event &&
    !!baseline &&
    JSON.stringify(event.constraints) !== JSON.stringify(baseline.constraints)
  const dirty = scheduleDirty || constraintsDirty
  const chat = useEventChat(
    eventId,
    dispatch,
    event,
    dirty || saving || solving || refreshing || deletingBand || importing,
  )
  const [loadError, setLoadError] = useState('')
  useEffect(() => {
    if (!state.notice || state.error || saveError || loadError) return
    const timer = window.setTimeout(() => {
      dispatch({ type: 'notice', message: '' })
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [state.notice, state.error, saveError, loadError])
  const [retry, setRetry] = useState(0)
  const [constraintFilters, setConstraintFilters] = useState({
    ...emptyConstraintFilters,
  })
  const [showUnmet, setShowUnmet] = useState(false)
  // Bumped on each approved AI reorder so the schedule animates the move.
  const [reorderRevision, setReorderRevision] = useState(0)
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
    async (kind: 'schedule' | 'constraints', snapshot = event) => {
      if (
        !snapshot ||
        busy.current ||
        refreshing ||
        chat.sending ||
        deletingBand ||
        importing
      )
        return null
      busy.current = true
      setSavingKind(kind)
      setSaveError('')
      dispatch({ type: 'notice', message: '' })
      const signal = lifetime.current?.signal
      try {
        return await persist(snapshot, kind)
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
      return null
    },
    [event, refreshing, chat.sending, deletingBand, importing, persist],
  )

  useEffect(() => {
    if (
      !constraintsDirty ||
      saving ||
      solving ||
      refreshing ||
      chat.sending ||
      deletingBand ||
      importing ||
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
    deletingBand,
    importing,
    saveError,
    save,
  ])

  async function generate() {
    if (
      !event ||
      busy.current ||
      refreshing ||
      chat.sending ||
      deletingBand ||
      importing
    )
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
      setReorderRevision((value) => value + 1)
      dispatch({ type: 'loaded', event: next, keepHistory: true })
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
    if (busy.current || refreshing || chat.sending || deletingBand || importing)
      return
    dispatch(action)
  }
  const historyBlocked =
    saving || solving || refreshing || chat.sending || deletingBand || importing
  function requestHistory(direction: 'undo' | 'redo') {
    if (!event || historyBlocked) return
    const target = (direction === 'undo' ? state.past : state.future).at(-1)
    if (!target) return
    if (
      JSON.stringify(target.constraints) !==
        JSON.stringify(event.constraints) &&
      !skipsHistoryWarning()
    ) {
      setHistoryConfirmation(direction)
      return
    }
    dispatch({ type: 'history', direction })
  }
  async function deleteBand(bandId: string) {
    const snapshot = event
    if (
      !snapshot?.updatedAt ||
      dirty ||
      busy.current ||
      refreshing ||
      chat.sending ||
      deletingBand
    )
      return false
    busy.current = true
    setDeletingBand(true)
    dispatch({ type: 'notice', message: '' })
    try {
      const saved = await eventRepository.deleteBand(
        eventId,
        bandId,
        snapshot.updatedAt,
      )
      const next = removeBandFromEvent(snapshot, bandId, saved.updatedAt)
      dispatch({ type: 'band-deleted', id: bandId, updatedAt: saved.updatedAt })
      setBaseline(next)
      return true
    } catch (error) {
      dispatch({
        type: 'notice',
        error: true,
        message:
          error instanceof Error ? error.message : '削除に失敗しました。',
      })
      return false
    } finally {
      busy.current = false
      setDeletingBand(false)
    }
  }
  const applyProposal = useCallback(async () => {
    if (
      !event ||
      !chat.chatProposal ||
      chat.pendingDecision ||
      chat.chatBlocked ||
      busy.current ||
      refreshing ||
      chat.sending
    )
      return
    try {
      const constraints = applyChatProposal(event, chat.chatProposal)
      if (await save('constraints', { ...event, constraints })) {
        dispatch({ type: 'constraints-replaced', constraints })
        chat.dismissProposal()
        await chat.recordDecision('applied')
      }
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
  }, [event, chat, refreshing, save])

  useEffect(() => {
    const proposal = chat.chatProposal
    if (
      !autoApprove ||
      !proposal ||
      !canAutoApprove(proposal) ||
      chat.sending ||
      chat.chatBlocked ||
      chat.pendingDecision ||
      saving ||
      solving ||
      refreshing ||
      importing ||
      deletingBand
    )
      return
    let cancelled = false
    queueMicrotask(() => {
      if (cancelled || autoAttempted.current.has(proposal.messageId)) return
      autoAttempted.current.add(proposal.messageId)
      void applyProposal()
    })
    return () => {
      cancelled = true
    }
  }, [
    autoApprove,
    chat.chatProposal,
    chat.sending,
    chat.chatBlocked,
    chat.pendingDecision,
    saving,
    solving,
    refreshing,
    importing,
    deletingBand,
    applyProposal,
  ])
  return {
    ...state,
    ...chat,
    autoApprove,
    setAutoApprove: (value: boolean) => {
      storeAutoApproval(value)
      setAutoApprove(value)
    },
    importing,
    setImporting,
    canUndo: state.past.length > 0 && !historyBlocked,
    canRedo: state.future.length > 0 && !historyBlocked,
    undo: () => requestHistory('undo'),
    redo: () => requestHistory('redo'),
    historyConfirmation,
    cancelHistory: () => setHistoryConfirmation(null),
    confirmHistory: (skip: boolean) => {
      if (historyBlocked || !historyConfirmation) return
      if (skip) skipHistoryWarning()
      dispatch({ type: 'history', direction: historyConfirmation })
      setHistoryConfirmation(null)
    },
    saveConstraintBatch: (constraints: Constraint[]) =>
      edit({
        type: 'batch',
        actions: constraints.map((constraint) => ({
          type: 'constraint-save',
          constraint,
        })),
      }),
    updateConstraints: (ids: string[], patch: ConstraintPatch) =>
      edit({
        type: 'batch',
        actions: ids.map((id) => ({ type: 'constraint-update', id, patch })),
      }),
    deleteConstraints: (ids: string[]) =>
      edit({
        type: 'batch',
        actions: ids.map((id) => ({ type: 'constraint-delete', id })),
      }),
    error: state.error || saveError,
    saveFailed: Boolean(saveError),
    retrySave: () => save(failedKind),
    saveSchedule: () => save('schedule'),
    generate,
    solving,
    deletingBand,
    deleteBand,
    applyProposal,
    dismissProposal: () => {
      if (
        !chat.chatProposal ||
        chat.pendingDecision ||
        chat.chatBlocked ||
        busy.current
      )
        return
      chat.dismissProposal()
      void chat.recordDecision('discarded')
    },
    applyReorder: async () => {
      if (
        !event ||
        !chat.chatReorder ||
        chat.pendingDecision ||
        chat.chatBlocked ||
        busy.current ||
        refreshing ||
        chat.sending
      )
        return
      let next: EventData
      try {
        next = applyChatReorder(event, chat.chatReorder)
      } catch (error) {
        dispatch({
          type: 'notice',
          error: true,
          message:
            error instanceof Error
              ? error.message
              : '並べ替え案を反映できませんでした。',
        })
        return
      }
      const saved = await save('schedule', next)
      if (!saved) return
      chat.dismissReorder()
      setReorderRevision((value) => value + 1)
      dispatch({ type: 'loaded', event: saved, keepHistory: true })
      dispatch({
        type: 'notice',
        message: '並べ替え案を出演順に保存しました。',
      })
      await chat.recordDecision('applied')
    },
    dismissReorder: () => {
      if (
        !chat.chatReorder ||
        chat.pendingDecision ||
        chat.chatBlocked ||
        busy.current
      )
        return
      chat.dismissReorder()
      void chat.recordDecision('discarded')
    },
    reorderRevision,
    loadError,
    processingMessage: importing
      ? '名簿CSVを登録しています。'
      : chat.sending
        ? 'AIが考えています。返信が届くまで編集できません。'
        : saving
          ? '変更を保存しています。'
          : solving
            ? '出演順を計算しています。'
            : refreshing
              ? '最新の状態を取得しています。'
              : deletingBand
                ? '出演枠を削除しています。'
                : undefined,
    saving,
    savingSchedule: savingKind === 'schedule',
    refreshing,
    scheduleDirty,
    constraintsDirty,
    schedule: event ? buildSchedule(event) : null,
    constraintFilters,
    setConstraintFilters,
    allConstraintViews: views,
    constraintViews: event
      ? filterConstraintViews(views, event, constraintFilters, showUnmet)
      : [],
    unmetCount: views.filter(
      (view) => view.status === 'unmet' || view.status === 'invalid',
    ).length,
    hardViolationCount: views.filter(
      (view) =>
        view.constraint.hardness === 'hard' &&
        (view.status === 'unmet' || view.status === 'invalid'),
    ).length,
    exportCsv: () => {
      if (event && window.confirm('出演順をCSVでエクスポートしますか？')) {
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
    dismissNotice: () => {
      setLoadError('')
      dispatch({ type: 'notice', message: '' })
    },
    setOrder: (id: string, value: number | null) =>
      edit({ type: 'order', id, value }),
    setFixed: (id: string, fixed: boolean) =>
      edit({ type: 'fixed', id, fixed }),
    resize: (count: number, sectionId?: string) =>
      edit({ type: 'resize', count, sectionId }),
    configureSchedule: (counts: number[]) => {
      if (!event || busy.current || refreshing || chat.sending)
        return '処理が終わってから変更してください。'
      const result = configureSchedule(event, counts)
      if (result.error) return result.error
      edit({
        type: 'schedule-configured',
        event: {
          sections: result.event.sections,
          unassigned: result.event.unassigned,
        },
      })
      return ''
    },
    move: (id: string, overId: string) => {
      if (!event || id === overId) return
      const target = findTarget(event, overId)
      if (target) edit({ type: 'move', id, target })
    },
    saveConstraint: (constraint: Constraint) =>
      edit({ type: 'constraint-save', constraint }),
    updateConstraint: (id: string, patch: ConstraintPatch) =>
      edit({ type: 'constraint-update', id, patch }),
    deleteConstraint: (id: string) => edit({ type: 'constraint-delete', id }),
  }
}
export type EventController = ReturnType<typeof useEvent>
