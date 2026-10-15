import { useParams } from 'react-router'

import { useSession } from '../../../app/sessionContext'
import { formatDate } from '../../../shared/model/workspace'
import { Brand } from '../../../shared/ui/Brand'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { PerformanceFields } from '../components/PerformanceFields'
import { useRegistrationForm } from '../hooks/useRegistration'

export function RegistrationPage() {
  const { eventId = '' } = useParams()
  const controller = useRegistrationForm(eventId)
  const { session } = useSession()
  return (
    <div className="min-h-dvh bg-canvas">
      <header className="flex h-16 items-center justify-between border-b border-line bg-white px-6">
        <Brand to={session ? '/event' : '/login'} />
        {session ? (
          <LinkButton to={`/event/${eventId}/forms/edit`} className="text-xs">
            フォーム管理へ
          </LinkButton>
        ) : (
          <span className="text-xs text-muted">出演者向けフォーム</span>
        )}
      </header>
      <main className="mx-auto max-w-[650px] px-5 py-10">
        {controller.loading || controller.error ? (
          <PageState error={controller.error} onRetry={controller.refresh} />
        ) : (
          controller.data && (
            <>
              <div className="mb-6 flex items-center gap-2 text-xs text-muted">
                <Icon name="calendar" />
                {controller.data.event.name}
              </div>
              {controller.submitted ? (
                <section className="rounded-xl border border-line bg-white px-8 py-12 text-center">
                  <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                    <Icon name="check" className="size-7" />
                  </span>
                  <h1 className="text-xl font-semibold">
                    出演登録を受け付けました
                  </h1>
                  <p className="mt-4 text-sm leading-7 text-muted">
                    「{controller.draft.name}」の登録が完了しました。
                    <br />
                    運営の出演枠一覧に反映されています。
                  </p>
                  <div className="mt-8 flex justify-center gap-3">
                    <Button onClick={controller.another}>
                      別の出演枠を登録
                    </Button>
                    {session && (
                      <LinkButton primary to={`/event/${eventId}/performances`}>
                        登録内容を確認
                        <Icon name="chevron" />
                      </LinkButton>
                    )}
                  </div>
                </section>
              ) : !controller.data.settings.accepting ? (
                <section className="rounded-xl border border-line bg-white px-8 py-12 text-center">
                  <Icon
                    name="lock"
                    className="mx-auto mb-5 size-8 text-muted"
                  />
                  <h1 className="text-xl font-semibold">
                    出演登録の受付は終了しました
                  </h1>
                  <p className="mt-4 text-sm text-muted">
                    登録内容については、イベント運営にお問い合わせください。
                  </p>
                </section>
              ) : (
                <section className="overflow-hidden rounded-xl border border-line bg-white">
                  <div className="h-1.5 bg-brand" />
                  <div className="border-b border-line p-7">
                    <span className="mb-3 inline-block rounded-full bg-wash px-2.5 py-1 text-[10px] font-medium text-brand">
                      出演者登録
                    </span>
                    <h1 className="text-xl font-semibold">
                      {controller.data.settings.title}
                    </h1>
                    <p className="mt-3 text-sm leading-7 whitespace-pre-wrap text-muted">
                      {controller.data.settings.description}
                    </p>
                    <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-muted">
                      <span className="flex items-center gap-1.5">
                        <Icon name="calendar" className="size-3.5" />
                        {formatDate(controller.data.event.date)}
                      </span>
                      <span className="flex items-center gap-1.5">
                        <Icon name="location" className="size-3.5" />
                        {controller.data.event.venue || '会場未定'}
                      </span>
                      {controller.data.settings.deadline && (
                        <span>
                          回答締切：
                          {formatDate(controller.data.settings.deadline)}
                        </span>
                      )}
                    </div>
                  </div>
                  <form
                    noValidate
                    onSubmit={(event) => {
                      event.preventDefault()
                      void controller.submit()
                    }}
                    className="p-7"
                  >
                    <PerformanceFields
                      event={controller.data.data}
                      draft={controller.draft}
                      onChange={controller.setDraft}
                      collectRequests={controller.data.settings.collectRequests}
                      collectContact={controller.data.settings.collectContact}
                      disabled={controller.busy}
                    />
                    {controller.formError && (
                      <p role="alert" className="mt-4 text-xs text-red-500">
                        {controller.formError}
                      </p>
                    )}
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={controller.busy}
                      className="mt-7 h-11 w-full"
                    >
                      {controller.busy ? '送信中…' : '出演登録を送信'}
                      <Icon name="chevron" />
                    </Button>
                  </form>
                </section>
              )}
            </>
          )
        )}
        <p className="mt-5 text-center text-[11px] leading-5 text-muted">
          プレビュー内の登録です。ページを再読み込みすると初期状態に戻ります。
        </p>
      </main>
    </div>
  )
}
