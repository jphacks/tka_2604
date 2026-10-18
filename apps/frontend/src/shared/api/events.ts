import type { InferResponseType } from 'hono/client'

import type { ChatMessage, EventData } from '../model/event'
import type { EventDetails, EventDraft, EventSummary } from '../model/workspace'
import { type ApiClient, createApiClient, ensureOk } from './client'

type ApiDetails = InferResponseType<
  ApiClient['api']['events'][':eventId']['$get'],
  200
>
export type SolveResponse = InferResponseType<
  ApiClient['api']['events'][':eventId']['solve']['$post'],
  200
>
function toDetails(event: ApiDetails): EventDetails {
  return {
    id: event.eventId,
    name: event.title,
    status: event.status,
    date: event.date ?? '',
    venue: event.venue ?? '',
    description: event.description ?? '',
    updatedAt: event.updatedAt,
  }
}

export function createEventsApi(client: ApiClient) {
  const events = client.api.events
  async function getDetails(id: string, signal?: AbortSignal) {
    const response = await events[':eventId'].$get(
      { param: { eventId: id } },
      { init: { signal } },
    )
    await ensureOk(response)
    return toDetails(await response.json())
  }
  async function getMessages(
    id: string,
    signal?: AbortSignal,
  ): Promise<ChatMessage[]> {
    const response = await events[':eventId'].chat.$get(
      { param: { eventId: id } },
      { init: { signal } },
    )
    await ensureOk(response)
    const body = await response.json()
    return body.messages.map((message) => ({
      id: message.messageId,
      role: message.role,
      text: message.text,
      replyToMessageId: message.replyToMessageId,
    }))
  }
  function revision(event: EventData) {
    if (!event.updatedAt)
      throw new Error('イベントを再取得してから保存してください。')
    return event.updatedAt
  }
  return {
    getDetails,
    getMessages,
    async saveSchedule(event: EventData) {
      const expectedUpdatedAt = revision(event)
      const response = await events[':eventId'].schedule.$post({
        param: { eventId: event.id },
        json: {
          expectedUpdatedAt,
          parts: event.sections.map((part) => ({
            partId: part.id,
            partName: part.name ?? null,
            bandCount: part.slots.length,
          })),
          placements: event.sections.flatMap((part) =>
            part.slots.flatMap((bandId, order) =>
              bandId === null ? [] : [{ bandId, partId: part.id, order }],
            ),
          ),
          unassignedBandIds: event.unassigned,
        },
      })
      await ensureOk(response)
      if (response.status !== 200)
        throw new Error('出演順を保存できませんでした。')
      return response.json()
    },
    async solve(event: EventData): Promise<SolveResponse> {
      const response = await events[':eventId'].solve.$post({
        param: { eventId: event.id },
        json: {
          expectedUpdatedAt: revision(event),
          parts: event.sections.map((part) => ({
            partId: part.id,
            bandCount: part.slots.length,
          })),
        },
      })
      await ensureOk(response)
      if (response.status !== 200)
        throw new Error('出演順を計算できませんでした。')
      return response.json()
    },
    async saveConstraints(event: EventData) {
      const response = await events[':eventId'].constraints.$post({
        param: { eventId: event.id },
        json: {
          expectedUpdatedAt: revision(event),
          constraints: event.constraints,
        },
      })
      await ensureOk(response)
      if (response.status !== 200)
        throw new Error('制約を保存できませんでした。')
      return response.json()
    },
    async listEvents(signal?: AbortSignal): Promise<EventSummary[]> {
      const response = await events.$get({}, { init: { signal } })
      await ensureOk(response)
      return (await response.json()).events.map((event) => ({
        ...toDetails(event),
        performanceCount: event.performanceCount,
        assignedCount: event.assignedCount,
        partCount: event.partCount,
        responseCount: event.responseCount,
      }))
    },
    async createEvent(draft: EventDraft) {
      const response = await events.$post({
        json: {
          title: draft.name,
          date: draft.date || null,
          venue: draft.venue || null,
          description: draft.description || null,
          bandCounts: draft.bandCounts ?? [4],
        },
      })
      await ensureOk(response)
      if (response.status !== 201)
        throw new Error('イベントを作成できませんでした。')
      return toDetails(await response.json())
    },
    async updateDetails(id: string, patch: Partial<Omit<EventDetails, 'id'>>) {
      if (!patch.updatedAt)
        throw new Error('イベントを再取得してから保存してください。')
      const response = await events[':eventId'].$patch({
        param: { eventId: id },
        json: {
          expectedUpdatedAt: patch.updatedAt,
          ...(patch.name !== undefined && { title: patch.name }),
          ...(patch.status !== undefined && { status: patch.status }),
          ...(patch.date !== undefined && { date: patch.date || null }),
          ...(patch.venue !== undefined && { venue: patch.venue || null }),
          ...(patch.description !== undefined && {
            description: patch.description || null,
          }),
        },
      })
      await ensureOk(response)
      if (response.status !== 200)
        throw new Error('設定を保存できませんでした。')
      return toDetails(await response.json())
    },
    async deleteBand(
      eventId: string,
      bandId: string,
      expectedUpdatedAt: string,
    ) {
      const response = await events[':eventId'].bands[':bandId'].$delete({
        param: { eventId, bandId },
        json: { expectedUpdatedAt },
      })
      await ensureOk(
        response,
        'イベントが更新されました。「最新の状態を取得」で一覧を更新し、対象を確認してから削除してください。',
      )
      if (response.status !== 200)
        throw new Error('バンドを削除できませんでした。')
      return response.json()
    },
    async deleteEvent(id: string) {
      const response = await events[':eventId'].$delete({
        param: { eventId: id },
      })
      await ensureOk(response)
    },
    async getEvent(id: string, signal?: AbortSignal): Promise<EventData> {
      const param = { eventId: id }
      const [details, scheduleResponse, constraintsResponse, messages] =
        await Promise.all([
          getDetails(id, signal),
          events[':eventId'].schedule.$get({ param }, { init: { signal } }),
          events[':eventId'].constraints.$get({ param }, { init: { signal } }),
          getMessages(id, signal),
        ])
      await ensureOk(scheduleResponse)
      await ensureOk(constraintsResponse)
      const [schedule, constraints] = await Promise.all([
        scheduleResponse.json(),
        constraintsResponse.json(),
      ])
      if (
        details.updatedAt !== schedule.updatedAt ||
        schedule.updatedAt !== constraints.updatedAt
      ) {
        throw new Error('イベントが更新されました。再取得してください。')
      }
      return {
        id,
        scheduleMode: 'dense',
        name: details.name,
        updatedAt: details.updatedAt,
        members: schedule.members.map((member) => ({
          id: member.memberId,
          name: member.memberName,
        })),
        performances: schedule.bands.map((band) => ({
          id: band.bandId,
          name: band.bandName,
          memberIds: schedule.memberships
            .filter((item) => item.bandId === band.bandId)
            .map((item) => item.memberId),
          description: band.description,
          requestText: band.requestText,
          requestStatus: band.requestStatus,
        })),
        sections: schedule.parts
          .toSorted((a, b) => a.sortOrder - b.sortOrder)
          .map((part) => {
            const placements = schedule.placements.filter(
              (placement) => placement.partId === part.partId,
            )

            return {
              id: part.partId,
              name: part.partName,
              slots: Array.from(
                { length: part.bandCount },
                (_, index) =>
                  placements.find((row) => row.order === index)?.bandId ?? null,
              ),
            }
          }),
        unassigned: schedule.unassignedBandIds,
        constraints: constraints.constraints.map((item) => item.constraint),
        constraintSources: Object.fromEntries(
          constraints.constraints.map((item) => [
            item.constraint.constraint_id,
            item.sourceBandId,
          ]),
        ),
        messages,
      }
    },
  }
}

export const eventsApi = createEventsApi(
  createApiClient(window.location.origin),
)
