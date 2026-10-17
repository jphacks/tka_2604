import { useEffect, useReducer, useState } from 'react'

import type { Constraint } from '../../../generated/constraint'
import {
  describeConstraint,
  evaluateConstraint,
} from '../../../shared/model/constraints'
import type { EventData } from '../../../shared/model/event'
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
  const chat = useEventChat(eventId, dispatch)
  const [loadError, setLoadError] = useState('')
  const [retry, setRetry] = useState(0)
  const [showUnmet, setShowUnmet] = useState(false)
  useEffect(() => {
    const controller = new AbortController()
    eventRepository
      .getEvent(eventId, controller.signal)
      .then((event) => {
        if (!controller.signal.aborted) {
          dispatch({ type: 'loaded', event })
          setLoadError('')
        }
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setLoadError(
            error instanceof Error ? error.message : '読み込みに失敗しました。',
          )
      })
    return () => controller.abort()
  }, [eventId, retry])

  useEffect(() => {
    if (state.event) workspaceRepository.rememberEvent(state.event)
  }, [state.event])

  const event = state.event
  const views = event
    ? event.constraints.map((constraint) => ({
        constraint,
        text: describeConstraint(constraint, event),
        ...evaluateConstraint(constraint, event),
      }))
    : []
  return {
    ...state,
    ...chat,
    loadError,
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
    retryLoad: () => setRetry((value) => value + 1),
    applyPerformanceEdits: (event: EventData) =>
      dispatch({ type: 'performances-updated', event }),
    dismissNotice: () => dispatch({ type: 'notice', message: '' }),
    setOrder: (id: string, value: number | null) =>
      dispatch({ type: 'order', id, value }),
    setFixed: (id: string, fixed: boolean) =>
      dispatch({ type: 'fixed', id, fixed }),
    resize: (count: number, sectionId?: string) =>
      dispatch({ type: 'resize', count, sectionId }),
    move: (id: string, overId: string) => {
      if (!event || id === overId) return
      const target = findTarget(event, overId)
      if (target) dispatch({ type: 'move', id, target })
    },
    saveConstraint: (constraint: Constraint) =>
      dispatch({ type: 'constraint-save', constraint }),
    updateConstraint: (id: string, patch: ConstraintPatch) =>
      dispatch({ type: 'constraint-update', id, patch }),
    deleteConstraint: (id: string) =>
      dispatch({ type: 'constraint-delete', id }),
  }
}
export type EventController = ReturnType<typeof useEvent>
