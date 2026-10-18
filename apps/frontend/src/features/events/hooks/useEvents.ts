import { useCallback, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'

import { useResource } from '../../../shared/hooks/useResource'
import {
  defaultEventName,
  type EventDraft,
  splitBandCounts,
} from '../../../shared/model/workspace'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import { importRoster } from '../../participants/hooks/useRosterImport'
import {
  decodeCsv,
  parseRosterCsv,
  planRosterImport,
} from '../../participants/model/rosterCsv'

const emptyDraft: EventDraft = {
  name: '',
  date: '',
  venue: '',
  description: '',
  bandCounts: [4],
}
export function useEvents() {
  const navigate = useNavigate()
  const load = useCallback(
    (signal: AbortSignal) => workspaceRepository.listEvents(signal),
    [],
  )
  const resource = useResource(load)
  const [query, setQuery] = useState('')
  const [searchParams, setSearchParams] = useSearchParams()
  const creating = searchParams.get('create') === '1'
  const [draft, setDraft] = useState(emptyDraft)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [roster, setRoster] = useState({ text: '', source: '' })
  const [progress, setProgress] = useState<number | null>(null)
  const parsed = roster.text ? parseRosterCsv(roster.text) : null
  const rows = parsed && 'rows' in parsed ? parsed.rows : null
  const events = resource.data ?? []
  function loadRoster(text: string, source: string) {
    setRoster({ text, source })
    setError('')
    const result = parseRosterCsv(text)
    if ('rows' in result)
      setDraft((value) => ({
        ...value,
        bandCounts: splitBandCounts(
          result.rows.length,
          value.bandCounts?.length ?? 1,
        ),
      }))
  }
  async function create() {
    if (busy || (parsed && 'error' in parsed)) return
    setBusy(true)
    setError('')
    let eventId = ''
    try {
      const event = await workspaceRepository.createEvent({
        ...draft,
        name: draft.name.trim() || defaultEventName(new Date()),
      })
      eventId = event.id
      if (rows) {
        setProgress(0)
        await importRoster(
          event.id,
          rows,
          [],
          event.updatedAt ?? '',
          setProgress,
        )
      }
      await navigate(`/event/${event.id}`)
    } catch (cause) {
      const message =
        cause instanceof Error ? cause.message : '作成に失敗しました。'
      // イベントは作成済み。再送で重複させず、出演順画面で理由を伝える。
      if (eventId)
        await navigate(`/event/${eventId}`, {
          state: {
            notice: `イベントは作成しましたが、名簿の取込が途中で止まりました。${message}`,
          },
        })
      else setError(message)
    } finally {
      setBusy(false)
      setProgress(null)
    }
  }
  return {
    ...resource,
    query,
    creating,
    draft,
    busy,
    formError: error || (parsed && 'error' in parsed ? parsed.error : ''),
    roster: {
      source: roster.source,
      rows,
      plan: rows ? planRosterImport(rows, []) : null,
      progress,
      async readFile(file: File) {
        loadRoster(decodeCsv(await file.arrayBuffer()), file.name)
      },
      async loadSample(path: string, label: string) {
        try {
          const response = await fetch(path)
          if (!response.ok) throw new Error()
          loadRoster(decodeCsv(await response.arrayBuffer()), label)
        } catch {
          setError('サンプルを読み込めませんでした。')
        }
      },
      clear: () => setRoster({ text: '', source: '' }),
    },
    visible: events.filter((event) =>
      `${event.name} ${event.venue}`
        .toLowerCase()
        .includes(query.trim().toLowerCase()),
    ),
    setQuery,
    create,
    openCreate: () => {
      setDraft(emptyDraft)
      setRoster({ text: '', source: '' })
      setError('')
      setSearchParams(
        (params) => {
          params.set('create', '1')
          return params
        },
        { replace: true },
      )
    },
    closeCreate: () => {
      if (!busy)
        setSearchParams(
          (params) => {
            params.delete('create')
            return params
          },
          { replace: true },
        )
    },
    setDraft: (patch: Partial<EventDraft>) =>
      setDraft((value) => {
        const next = { ...value, ...patch }
        // 名簿があれば、部数の変更に合わせて組数を割り振り直す。
        if (
          rows &&
          patch.bandCounts &&
          patch.bandCounts.length !== value.bandCounts?.length
        )
          next.bandCounts = splitBandCounts(
            rows.length,
            patch.bandCounts.length,
          )
        return next
      }),
  }
}
export type EventsController = ReturnType<typeof useEvents>
