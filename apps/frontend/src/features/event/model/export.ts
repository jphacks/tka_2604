import { buildSchedule } from './schedule'
import type { EventData } from './types'

const cell = (value: string) => {
  const safe = /^\s*[=+@-]/.test(value) ? `'${value}` : value
  return `"${safe.replaceAll('"', '""')}"`
}

export function eventCsv(event: EventData) {
  const schedule = buildSchedule(event)
  const rows = [
    ['部', '出演順', '出演名', 'メンバー', '固定'],
    ...schedule.sections.flatMap((section) =>
      section.rows
        .filter((row) => row.performance)
        .map((row) => [
          section.name,
          String(row.order),
          row.performance!.name,
          row.performance!.members.join('・'),
          row.performance!.fixed ? '固定' : '',
        ]),
    ),
    ...schedule.unassigned.map((row) => [
      '未配置',
      '',
      row.performance.name,
      row.performance.members.join('・'),
      row.performance.fixed ? '固定' : '',
    ]),
  ]
  return '\uFEFF' + rows.map((row) => row.map(cell).join(',')).join('\r\n')
}

export function exportEventCsv(event: EventData) {
  const blob = new Blob([eventCsv(event)], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${event.name}-出演順.csv`
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
