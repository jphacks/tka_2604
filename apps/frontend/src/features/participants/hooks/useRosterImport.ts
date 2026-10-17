import { useState } from 'react'

import type { Member } from '../../../shared/model/event'
import { workspaceRepository } from '../../../shared/repositories/workspaceRepository'
import type { RosterRow } from '../model/rosterCsv'
import { decodeCsv, parseRosterCsv, planRosterImport } from '../model/rosterCsv'

/**
 * 名簿の各行をaddPerformanceで順に登録する。同じ名前は同じ人として扱い、
 * 登録済みなら既存のIDを使う。新しく作った人を後の行で使う場合は、
 * 作成後にイベントを取り直してIDを得る（新しい名前は常に別人として作られるため）。
 */
export async function importRoster(
  eventId: string,
  rows: RosterRow[],
  onProgress: (done: number) => void = () => {},
) {
  let members = (await workspaceRepository.getRegistration(eventId)).data
    .members
  for (const [index, row] of rows.entries()) {
    const memberIds: string[] = []
    const added: string[] = []
    for (const name of row.members) {
      const found = members.filter((member) => member.name === name)
      if (found.length > 1)
        throw new Error(`「${name}」は同名の登録済みメンバーが複数います。`)
      if (found.length) memberIds.push(found[0].id)
      else added.push(name)
    }
    try {
      await workspaceRepository.addPerformance(eventId, {
        name: row.name,
        memberIds,
        members: added.join('\n'),
        requests: '',
        contact: '',
      })
    } catch (cause) {
      const reason =
        cause instanceof Error ? cause.message : '登録に失敗しました。'
      throw new Error(
        `${row.line}行目「${row.name}」で止まりました（${index}組は登録済み）。${reason}`,
      )
    }
    onProgress(index + 1)
    const reused = rows
      .slice(index + 1)
      .some((later) => later.members.some((name) => added.includes(name)))
    if (reused)
      members = (await workspaceRepository.getRegistration(eventId)).data
        .members
  }
}

export function useRosterImport(
  eventId: string,
  registered: Member[],
  /** completed=falseは途中で失敗した場合。登録済みの分を一覧へ反映するために呼ぶ。 */
  onDone: (count: number, completed: boolean) => void,
) {
  const [text, setText] = useState('')
  const [fileName, setFileName] = useState('')
  const [progress, setProgress] = useState<number | null>(null)
  const [error, setError] = useState('')
  const parsed = text.trim() ? parseRosterCsv(text) : null
  const rows = parsed && 'rows' in parsed ? parsed.rows : null
  const plan = rows ? planRosterImport(rows, registered) : null
  const busy = progress !== null
  return {
    text,
    fileName,
    rows,
    plan,
    busy,
    progress,
    error: error || (parsed && 'error' in parsed ? parsed.error : ''),
    canImport: Boolean(plan && !plan.ambiguous.length && !busy),
    setText: (value: string) => {
      setText(value)
      setFileName('')
      setError('')
    },
    async readFile(file: File) {
      setText(decodeCsv(await file.arrayBuffer()))
      setFileName(file.name)
      setError('')
    },
    async run() {
      if (!rows || busy) return
      let done = 0
      setProgress(0)
      setError('')
      try {
        await importRoster(eventId, rows, (count) => {
          done = count
          setProgress(count)
        })
        onDone(done, true)
      } catch (cause) {
        setError(
          cause instanceof Error ? cause.message : '登録に失敗しました。',
        )
        onDone(done, false)
      } finally {
        setProgress(null)
      }
    },
  }
}
