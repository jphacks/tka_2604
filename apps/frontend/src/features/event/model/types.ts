import type { EventData, Performance } from '../../../shared/model/event'

export type {
  Constraint,
  Hardness,
  Priority,
} from '../../../generated/constraint'
export type { ChatMessage, EventData } from '../../../shared/model/event'

export interface PerformanceView extends Performance {
  members: string[]
  fixed: boolean
}
export type MoveTarget =
  { sectionId: string; index: number } | { unassignedIndex: number }
export type ModelResult = { event: EventData; error?: string }
export interface PerformanceRow {
  key: string
  performance: PerformanceView | null
  order: number | null
  target: MoveTarget
}
export interface SectionView {
  id: string
  name: string
  capacity: number
  assigned: number
  range: string
  rows: PerformanceRow[]
}
