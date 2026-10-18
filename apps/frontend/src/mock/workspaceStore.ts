import { targetBandIds, validateConstraint } from '../shared/model/constraints'
import type { EventData } from '../shared/model/event'
import type {
  EventDraft,
  FormSettings,
  PerformanceDraft,
  Session,
} from '../shared/model/workspace'
import { parseMembers, validatePerformance } from '../shared/model/workspace.ts'
import { createEmptyEvent, createForm, workspaceSeed } from './workspaceData.ts'

export function createMockWorkspaceStore() {
  const records = new Map(
    structuredClone(workspaceSeed).map((record) => [record.details.id, record]),
  )
  let session: Session | null = null
  function get(id: string) {
    const record = records.get(id)
    if (!record) throw new Error('イベントが見つかりません。')
    return record
  }
  function validate(draft: PerformanceDraft) {
    const error = validatePerformance(draft)
    if (error) throw new Error(error)
  }
  function resolveMembers(event: EventData, draft: PerformanceDraft) {
    if (
      new Set(draft.memberIds).size !== draft.memberIds.length ||
      draft.memberIds.some(
        (id) => !event.members.some((member) => member.id === id),
      )
    ) {
      throw new Error('登録済みのメンバーを選び直してください。')
    }
    const added = parseMembers(draft.members).map((name) => ({
      id: crypto.randomUUID(),
      name,
    }))
    event.members.push(...added)
    return [...draft.memberIds, ...added.map((member) => member.id)]
  }
  function register(
    id: string,
    draft: PerformanceDraft,
    source: 'form' | 'manual',
  ) {
    validate(draft)
    const record = get(id)
    const performanceId = crypto.randomUUID()
    record.data.performances.push({
      id: performanceId,
      name: draft.name.trim(),
      memberIds: resolveMembers(record.data, draft),
    })
    record.data.unassigned.push(performanceId)
    record.submissions.push({
      id: crypto.randomUUID(),
      source,
      performanceId,
      requests:
        source === 'manual' || record.form.collectRequests
          ? draft.requests.trim()
          : '',
      contact:
        source === 'manual' || record.form.collectContact
          ? draft.contact.trim()
          : '',
      createdAt: new Date().toISOString(),
    })
    return performanceId
  }
  return {
    getSession: () => structuredClone(session),
    signIn(email: string) {
      session = { name: 'ライブ運営', email }
      return structuredClone(session)
    },
    signOut() {
      session = null
    },
    getEvent: (id: string) => structuredClone(get(id).data),
    rememberEvent(data: EventData) {
      const record = get(data.id)
      const bandIds = new Set(data.performances.map((band) => band.id))
      const assigned = [
        ...data.sections.flatMap((section) =>
          section.slots.filter((id): id is string => id !== null),
        ),
        ...data.unassigned,
      ]
      if (
        assigned.length !== bandIds.size ||
        new Set(assigned).size !== assigned.length ||
        assigned.some((id) => !bandIds.has(id))
      )
        throw new Error('出演枠に欠落・重複があります。')
      for (const constraint of data.constraints) {
        const error = validateConstraint(constraint, data)
        if (error) throw new Error(error)
      }
      record.data = structuredClone(data)
      record.details.name = data.name
    },
    listEvents: () =>
      [...records.values()].map((record) => ({
        ...structuredClone(record.details),
        performanceCount: record.data.performances.length,
        assignedCount: record.data.sections
          .flatMap((section) => section.slots)
          .filter(Boolean).length,
        partCount: record.data.sections.length,
        responseCount: record.submissions.filter(
          (item) => item.source === 'form',
        ).length,
      })),
    createEvent(draft: EventDraft) {
      if (!draft.name.trim()) throw new Error('イベント名を入力してください。')
      const id = crypto.randomUUID()
      const details = {
        ...draft,
        name: draft.name.trim(),
        id,
        status: 'planning' as const,
      }
      records.set(id, {
        details,
        data: createEmptyEvent(id, details.name),
        form: createForm(details.name),
        submissions: [],
      })
      return structuredClone(details)
    },
    updateDetails(
      id: string,
      patch: Partial<(typeof workspaceSeed)[number]['details']>,
    ) {
      const record = get(id)
      if (patch.name !== undefined && !patch.name.trim())
        throw new Error('イベント名を入力してください。')
      record.details = { ...record.details, ...patch, id }
      record.data.name = record.details.name
      return structuredClone(record.details)
    },
    deleteEvent(id: string) {
      get(id)
      records.delete(id)
    },
    getRegistration(id: string) {
      const record = get(id)
      return structuredClone({
        event: record.details,
        settings: record.form,
        submissions: record.submissions,
        data: record.data,
      })
    },
    updateForm(id: string, settings: FormSettings) {
      if (!settings.title.trim())
        throw new Error('フォーム名を入力してください。')
      get(id).form = structuredClone(settings)
    },
    submitPerformance(id: string, draft: PerformanceDraft) {
      const record = get(id)
      if (!record.form.accepting)
        throw new Error('このフォームの受付は終了しています。')
      return register(
        id,
        {
          ...draft,
          contact: record.form.collectContact ? draft.contact : '',
          requests: record.form.collectRequests ? draft.requests : '',
        },
        'form',
      )
    },
    addPerformance(id: string, draft: PerformanceDraft) {
      return register(id, draft, 'manual')
    },
    updatePerformance(
      id: string,
      performanceId: string,
      draft: PerformanceDraft,
    ) {
      validate(draft)
      const record = get(id)
      const performance = record.data.performances.find(
        (item) => item.id === performanceId,
      )
      if (!performance) throw new Error('出演枠が見つかりません。')
      const memberIds = resolveMembers(record.data, draft)
      performance.name = draft.name.trim()
      performance.memberIds = memberIds
      const submission = record.submissions.find(
        (item) => item.performanceId === performanceId,
      )
      if (!submission) {
        record.submissions.push({
          id: crypto.randomUUID(),
          source: 'manual',
          performanceId,
          requests: draft.requests.trim(),
          contact: draft.contact.trim(),
          createdAt: new Date().toISOString(),
        })
      } else {
        submission.requests = draft.requests.trim()
        submission.contact = draft.contact.trim()
      }
    },
    deletePerformance(id: string, performanceId: string) {
      const record = get(id)
      if (
        record.data.constraints.some(
          (constraint) =>
            constraint.type !== 'min_gap_member' &&
            targetBandIds(constraint, record.data).includes(performanceId),
        )
      ) {
        throw new Error(
          'この出演枠を参照する制約があります。制約を確認・削除してから出演枠を削除してください。',
        )
      }
      record.data.performances = record.data.performances.filter(
        (item) => item.id !== performanceId,
      )
      record.data.unassigned = record.data.unassigned.filter(
        (item) => item !== performanceId,
      )
      record.data.sections.forEach((section) => {
        section.slots = section.slots.map((item) =>
          item === performanceId ? null : item,
        )
      })
      record.submissions = record.submissions.filter(
        (item) => item.performanceId !== performanceId,
      )
    },
  }
}
export const mockWorkspaceStore = createMockWorkspaceStore()
