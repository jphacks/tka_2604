import { useRef, useState } from 'react'

import type { EventData } from '../../../shared/model/event'
import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { importRoster } from '../hooks/useRosterImport'
import {
  decodeCsv,
  parseRosterCsv,
  planRosterImport,
  type RosterRow,
} from '../model/rosterCsv'
import { downloadRosterTemplate } from '../model/rosterTemplate'

export function RosterImportDialog({
  event,
  onBusy,
  onClose,
  onImported,
}: {
  event: EventData
  onBusy: (busy: boolean) => void
  onClose: () => void
  onImported: () => void
}) {
  const [rows, setRows] = useState<RosterRow[]>([])
  const [error, setError] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [attempted, setAttempted] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [fileName, setFileName] = useState('')
  const fileInput = useRef<HTMLInputElement>(null)
  const busy = useRef(false)
  const reading = useRef(0)
  const plan = planRosterImport(rows, event.members)
  async function read(file: File) {
    const revision = ++reading.current
    setRows([])
    setError('')
    try {
      const result = parseRosterCsv(decodeCsv(await file.arrayBuffer()))
      if (revision !== reading.current) return
      if ('error' in result) setError(result.error)
      else setRows(result.rows)
    } catch {
      if (revision === reading.current)
        setError('CSVファイルを読み込めませんでした。')
    }
  }
  async function submit() {
    if (
      busy.current ||
      !rows.length ||
      !event.updatedAt ||
      attempted ||
      plan.ambiguous.length
    )
      return
    busy.current = true
    setSubmitting(true)
    setAttempted(true)
    setProgress(0)
    onBusy(true)
    try {
      await importRoster(
        event.id,
        rows,
        event.members,
        event.updatedAt,
        setProgress,
      )
      onImported()
    } catch (cause) {
      setError(
        `${cause instanceof Error ? cause.message : '登録に失敗しました。'} 保存成否が不明な行があるため、自動再送はしません。閉じて最新の名簿を確認してください。`,
      )
    } finally {
      busy.current = false
      setSubmitting(false)
      onBusy(false)
    }
  }
  function close() {
    if (busy.current) return
    if (attempted) onImported()
    else onClose()
  }
  return (
    <Dialog title="名簿CSVを追加" onClose={close} busy={submitting}>
      <p className="mb-3 text-sm">
        既存のバンド・配置・制約を保持して、CSVのバンドを追加します。同名バンドも新規登録されます。
      </p>
      <Button onClick={downloadRosterTemplate} disabled={attempted}>
        テンプレートをダウンロード
      </Button>
      <div className="my-4 text-sm">
        <p className="mb-2">追加する名簿CSV</p>
        <Button disabled={attempted} onClick={() => fileInput.current?.click()}>
          ファイルを選択
        </Button>
        <span className="ml-2 text-muted">
          {fileName || '選択されていません'}
        </span>
        <input
          ref={fileInput}
          type="file"
          accept=".csv,text/csv"
          aria-label="追加する名簿CSV"
          className="hidden"
          disabled={attempted}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) {
              setFileName(file.name)
              void read(file)
            }
            e.target.value = ''
          }}
        />
      </div>
      {rows.length > 0 && (
        <p className="my-3 text-sm">
          {plan.bands}組・{plan.people}人を追加します（既存メンバーとの一致：
          {plan.matched.length}人）。
        </p>
      )}
      {plan.ambiguous.length > 0 && (
        <p role="alert" className="text-sm text-red-700">
          同名の候補が複数います：{plan.ambiguous.join('、')}
          。公開フォームから選択して登録してください。
        </p>
      )}
      {progress !== null && (
        <p role="status" className="my-3 text-sm">
          登録済み {progress}/{rows.length}組
        </p>
      )}
      {error && (
        <p role="alert" className="my-3 text-sm text-red-700">
          {error}
        </p>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button onClick={close} disabled={submitting}>
          閉じる
        </Button>
        <Button
          variant="primary"
          onClick={() => void submit()}
          disabled={!rows.length || attempted || plan.ambiguous.length > 0}
        >
          追加する
        </Button>
      </div>
    </Dialog>
  )
}
