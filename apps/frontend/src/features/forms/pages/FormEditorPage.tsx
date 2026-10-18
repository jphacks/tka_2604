import { useCallback, useEffect, useState } from 'react'
import { useParams } from 'react-router'

import { useEventName } from '../../../app/eventNameContext'
import { useResource } from '../../../shared/hooks/useResource'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input } from '../../../shared/ui/Input'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { registrationRepository } from '../repositories/registrationRepository'

export function FormEditorPage() {
  const { eventId = '' } = useParams()
  const load = useCallback(
    (signal: AbortSignal) => registrationRepository.get(eventId, signal),
    [eventId],
  )
  const resource = useResource(load)
  const setEventName = useEventName()
  const [notice, setNotice] = useState('')
  useEffect(() => {
    if (resource.data?.eventTitle) setEventName?.(resource.data.eventTitle)
  }, [resource.data?.eventTitle, setEventName])
  const formUrl = `${window.location.origin}/event/${eventId}/forms`
  async function copyLink() {
    try {
      await navigator.clipboard.writeText(formUrl)
      setNotice('回答フォームのリンクをコピーしました。')
    } catch {
      setNotice('リンクを選択してコピーしてください。')
    }
  }
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="mb-3 text-2xl font-semibold">出演者フォーム</h1>
      <p className="mb-7 text-sm text-muted">
        回答フォームから出演枠とメンバーを登録・更新できます。
      </p>
      {resource.loading || resource.error ? (
        <PageState error={resource.error} onRetry={resource.refresh} />
      ) : (
        resource.data && (
          <section className="space-y-6 rounded-xl border border-line bg-white p-6">
            <div>
              <h2 className="text-lg font-semibold">
                {resource.data.eventTitle} 出演登録
              </h2>
              <p className="mt-2 text-sm text-muted">
                登録済みの出演枠：{resource.data.bands.length}組・メンバー：
                {resource.data.members.length}人
              </p>
            </div>
            <p className="text-sm leading-7 text-muted">
              リンクを知っている出演者が、ログインなしで初回登録と登録内容の更新を行えます。
            </p>
            <label className="block text-sm font-medium">
              回答フォームのリンク
              <Input
                readOnly
                aria-label="回答フォームのリンク"
                value={formUrl}
                className="mt-2 w-full text-sm"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <Button onClick={() => void copyLink()}>
                <Icon name="link" />
                リンクをコピー
              </Button>
              <LinkButton primary to={`/event/${eventId}/forms`}>
                回答フォームを開く
                <Icon name="chevron" />
              </LinkButton>
            </div>
            {notice && (
              <p role="status" className="text-sm text-brand">
                {notice}
              </p>
            )}
          </section>
        )
      )}
    </div>
  )
}
