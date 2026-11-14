import type { EventData } from './types'

export type EditSnapshot = Pick<
  EventData,
  'sections' | 'unassigned' | 'constraints'
>
export function editSnapshot(event: EventData): EditSnapshot {
  return {
    sections: event.sections,
    unassigned: event.unassigned,
    constraints: event.constraints,
  }
}
export function sameEdits(a: EditSnapshot, b: EditSnapshot) {
  return JSON.stringify(a) === JSON.stringify(b)
}
export const historyWarningKey = 'setly:history-warning:v1'
export function skipsHistoryWarning() {
  try {
    return localStorage.getItem(historyWarningKey) === 'skip'
  } catch {
    return false
  }
}
export function skipHistoryWarning() {
  try {
    localStorage.setItem(historyWarningKey, 'skip')
  } catch {
    /* History remains usable when storage is unavailable. */
  }
}
