import { downloadCsv } from '../../../shared/ui/download'
import { buildSchedule } from './schedule'
import type { EventData } from './types'

const cell = (value: string) => {
  const safe = /^\s*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function eventCsv(event: EventData) {
  const schedule = buildSchedule(event)
  const performances = [
    ...schedule.sections.flatMap((section) =>
      section.rows.flatMap((row) => (row.performance ? [row.performance] : [])),
    ),
    ...schedule.unassigned.map((row) => row.performance),
  ]
  const memberCount = Math.max(
    0,
    ...performances.map((performance) => performance.members.length),
  )
  const rows = [
    [
      '部',
      '出演順',
      '出演名',
      ...Array.from(
        { length: memberCount },
        (_, index) => `メンバー${index + 1}`,
      ),
    ],
    ...schedule.sections.flatMap((section) =>
      section.rows
        .filter((row) => row.performance)
        .map((row) => [
          section.name,
          String(row.order),
          row.performance!.name,
          ...row.performance!.members,
        ]),
    ),
    ...schedule.unassigned.map((row) => [
      '未配置',
      '',
      row.performance.name,
      ...row.performance.members,
    ]),
  ]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function exportEventCsv(event: EventData) {
  downloadCsv(`${event.name}-出演順.csv`, eventCsv(event))
}
