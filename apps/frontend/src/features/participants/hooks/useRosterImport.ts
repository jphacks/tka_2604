import { useState } from 'react'

import type { Member } from '../../../shared/model/event'
import { registrationRepository } from '../../forms/repositories/registrationRepository'
import type { RosterRow } from '../model/rosterCsv'
import { decodeCsv, parseRosterCsv, planRosterImport } from '../model/rosterCsv'

/**
 * 名簿の各行をフォームAPIで1組ずつ登録する。同じ名前は同じ人として扱い、
 * 登録済みなら既存のIDを使う。新しく作った人は応答のIDを後の行で使い、
 * 応答のupdatedAtを次の行の競合確認に渡す。
 */
export async function importRoster(
  eventId: string,
  rows: RosterRow[],
  registered: Member[],
  expectedUpdatedAt: string,
  onProgress: (done: number) => void = () => {},
) {
  const ids = new Map<string, string[]>()
  const remember = (name: string, id: string) =>
    ids.set(name, [...(ids.get(name) ?? []), id])
  for (const member of registered) remember(member.name, member.id)
  let token = expectedUpdatedAt
  for (const [index, row] of rows.entries()) {
    const memberIds: string[] = []
    const newMembers: { memberName: string }[] = []
    for (const name of row.members) {
      const found = ids.get(name) ?? []
      if (found.length > 1)
        throw new Error(`「${name}」は同名の登録済みメンバーが複数います。`)
      if (found.length) memberIds.push(found[0])
      else newMembers.push({ memberName: name })
    }
    try {
      const saved = await registrationRepository.create(eventId, {
        expectedUpdatedAt: token,
        bandName: row.name,
        description: row.description,
        memberIds,
        newMembers,
      })
      token = saved.updatedAt
      for (const member of saved.members)
        if (!ids.get(member.memberName)?.includes(member.memberId))
          remember(member.memberName, member.memberId)
    } catch (cause) {
      const reason =
        cause instanceof Error ? cause.message : '登録に失敗しました。'
      throw new Error(
        `${row.line}行目「${row.name}」で止まりました（${index}組は登録済み）。${reason}`,
      )
    }
    onProgress(index + 1)
  }
}

export function useRosterImport(
  eventId: string,
  registered: Member[],
  expectedUpdatedAt: string | undefined,
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
    canImport: Boolean(
      plan && !plan.ambiguous.length && !busy && expectedUpdatedAt,
    ),
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
      if (!rows || busy || !expectedUpdatedAt) return
      let done = 0
      setProgress(0)
      setError('')
      try {
        await importRoster(
          eventId,
          rows,
          registered,
          expectedUpdatedAt,
          (count) => {
            done = count
            setProgress(count)
          },
        )
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
