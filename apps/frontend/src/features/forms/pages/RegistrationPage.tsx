import { useParams, useSearchParams } from 'react-router'

import { useSession } from '../../../app/sessionContext'
import { AppHeader } from '../../../shared/ui/AppHeader'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { RegistrationFields } from '../components/RegistrationFields'
import { usePublicRegistration } from '../hooks/usePublicRegistration'

export function RegistrationPage() {
  const { eventId = '' } = useParams()
  const [params] = useSearchParams()
  const controller = usePublicRegistration(
    eventId,
    undefined,
    params.get('bandId') ?? undefined,
  )
  const { session } = useSession()
  const updating = controller.mode === 'update'
  return (
    <div className="fixed inset-0 flex flex-col overflow-hidden bg-canvas">
      <AppHeader brandTo={session ? '/event' : '/login'}>
        {session ? (
          <LinkButton to={`/event/${eventId}/forms/edit`} className="text-xs">
            フォーム管理へ
          </LinkButton>
        ) : (
          <span className="text-xs text-muted">出演者向けフォーム</span>
        )}
      </AppHeader>
      <main className="min-h-0 flex-1 overflow-y-auto overscroll-y-none">
        <div className="mx-auto max-w-[680px] px-4 py-8 sm:px-6 sm:py-10">
          {controller.loading || controller.error ? (
            <PageState
              error={controller.error}
              onRetry={() => {
                void controller.refresh()
              }}
            />
          ) : (
            controller.data && (
              <>
                <div className="mb-5 flex items-center gap-2 text-xs text-muted">
                  <Icon name="calendar" />
                  {controller.data.eventTitle}
                </div>
                {controller.submitted ? (
                  <section
                    role="status"
                    className="rounded-xl border border-line bg-white px-6 py-12 text-center"
                  >
                    <span className="mx-auto mb-5 flex size-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-700">
                      <Icon name="check" className="size-7" />
                    </span>
                    <h1 className="text-xl font-semibold">
                      {updating
                        ? '登録内容を更新しました'
                        : '出演登録を受け付けました'}
                    </h1>
                    <p className="mt-4 text-sm leading-7 text-muted">
                      「{controller.submitted.band.bandName}」の
                      {updating ? '変更' : '登録'}を保存しました。
                      <br />
                      所属メンバー：{controller.submitted.members.length}人
                    </p>
                    {controller.rosterNotice && (
                      <p className="mt-4 text-xs leading-6 text-amber-700">
                        {controller.rosterNotice}
                      </p>
                    )}
                    <div className="mt-8 flex flex-wrap justify-center gap-3">
                      <Button
                        disabled={controller.busy}
                        onClick={() => {
                          controller.setMode('update')
                          controller.chooseBand(
                            controller.submitted!.band.bandId,
                          )
                        }}
                      >
                        登録内容を更新する
                      </Button>
                      <Button
                        variant="primary"
                        disabled={controller.busy}
                        onClick={() => {
                          controller.setMode('create')
                          controller.another()
                        }}
                      >
                        別の出演枠を登録
                      </Button>
                    </div>
                  </section>
                ) : (
                  <section className="overflow-hidden rounded-xl border border-line bg-white shadow-sm">
                    <div className="h-1.5 bg-brand" />
                    <div className="border-b border-line px-5 py-6 sm:px-7">
                      <span className="mb-3 inline-flex items-center gap-1.5 rounded-full bg-wash px-2.5 py-1 text-xs font-medium text-brand">
                        <Icon name="users" className="size-3.5" />
                        出演者登録
                      </span>
                      <h1 className="text-xl font-semibold">
                        {controller.data.eventTitle} 出演登録
                      </h1>
                      <p className="mt-3 text-sm leading-6 text-muted">
                        出演名とメンバーを登録してください。
                        <br className="hidden sm:block" />
                        登録済みの出演枠は、ここから内容を更新できます。
                      </p>
                    </div>
                    <form
                      noValidate
                      onSubmit={(event) => {
                        event.preventDefault()
                        void controller.submit()
                      }}
                      className="p-5 sm:p-7"
                    >
                      <fieldset
                        disabled={controller.busy || controller.refreshing}
                      >
                        <fieldset className="mb-7">
                          <legend className="mb-3 text-sm font-medium">
                            手続きの種類
                          </legend>
                          <div className="grid grid-cols-2 gap-3">
                            {(['create', 'update'] as const).map((mode) => (
                              <label
                                key={mode}
                                className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-3 sm:p-4 ${controller.mode === mode ? 'border-brand bg-wash' : 'border-line hover:bg-canvas'}`}
                              >
                                <input
                                  type="radio"
                                  name="registration-mode"
                                  value={mode}
                                  checked={controller.mode === mode}
                                  onChange={() => controller.setMode(mode)}
                                  className="mt-0.5 accent-brand"
                                />
                                <span>
                                  <span className="block text-sm font-medium">
                                    {mode === 'create'
                                      ? '初回登録'
                                      : '登録内容の更新'}
                                  </span>
                                  <span className="mt-1 block text-xs leading-5 text-muted">
                                    {mode === 'create'
                                      ? '新しい出演枠を登録'
                                      : '出演枠を選んで編集'}
                                  </span>
                                </span>
                              </label>
                            ))}
                          </div>
                        </fieldset>
                        <RegistrationFields controller={controller} />
                        {controller.formError && (
                          <p
                            role="alert"
                            className="mt-5 rounded-lg bg-red-50 p-3 text-xs leading-6 text-red-600"
                          >
                            {controller.formError}
                          </p>
                        )}
                        {controller.conflict && (
                          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-xs leading-6">
                            <p>
                              別の変更が保存されています。入力は保持しています。最新の名簿を再取得し、内容を確認してからもう一度保存してください。
                            </p>
                            <Button
                              className="mt-3 text-xs"
                              onClick={() => {
                                void controller.refresh()
                              }}
                            >
                              入力を残して名簿を再取得
                            </Button>
                          </div>
                        )}
                        <Button
                          type="submit"
                          variant="primary"
                          disabled={
                            controller.busy ||
                            controller.refreshing ||
                            controller.conflict ||
                            (updating && !controller.draft.bandId)
                          }
                          className="mt-7 h-11 w-full"
                        >
                          {controller.busy
                            ? '保存中…'
                            : updating
                              ? '変更を保存'
                              : '出演登録を送信'}
                          <Icon name={updating ? 'check' : 'chevron'} />
                        </Button>
                      </fieldset>
                    </form>
                  </section>
                )}
                <p className="mt-5 text-center text-xs leading-5 text-muted">
                  登録内容はイベントの名簿に保存されます。
                </p>
              </>
            )
          )}
        </div>
      </main>
    </div>
  )
}
