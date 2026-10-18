import { useParams } from 'react-router'

import { AppFrame } from '../../../shared/ui/AppFrame'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Textarea } from '../../../shared/ui/Input'
import { LinkButton } from '../../../shared/ui/LinkButton'
import { PageState } from '../../../shared/ui/PageState'
import { FormPreview } from '../components/FormPreview'
import { useFormEditor } from '../hooks/useRegistration'

export function FormEditorPage() {
  const { eventId = '' } = useParams()
  const controller = useFormEditor(eventId)
  const settings = controller.settings
  return (
    <AppFrame eventId={eventId} eventName={controller.data?.event.name}>
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-semibold tracking-[0.16em] text-muted">
            REGISTRATION FORM
          </p>
          <h1 className="text-2xl font-semibold">出演者フォーム</h1>
          <p className="mt-2 text-xs text-muted">
            出演者から、必要な情報と希望を集めましょう。
          </p>
        </div>
        <LinkButton to={`/event/${eventId}/forms/demo`}>
          <Icon name="form" />
          回答フォームを開く
        </LinkButton>
      </div>
      {controller.loading || controller.error ? (
        <PageState error={controller.error} onRetry={controller.refresh} />
      ) : (
        settings && (
          <>
            <div className="mb-6 flex flex-wrap items-center gap-4 rounded-lg border border-line bg-white p-4">
              <span
                className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${controller.data?.settings.accepting ? 'bg-emerald-50 text-emerald-700' : 'bg-canvas text-muted'}`}
              >
                {controller.data?.settings.accepting ? '受付中' : '受付終了'}
              </span>
              <span className="text-xs text-muted">
                フォーム回答{' '}
                <strong className="font-semibold text-ink">
                  {controller.responseCount}件
                </strong>
              </span>
              <LinkButton
                to={`/event/${eventId}/performances`}
                className="ml-auto text-xs"
              >
                回答・出演枠を確認
                <Icon name="chevron" className="size-3" />
              </LinkButton>
            </div>
            <div className="grid items-start gap-6 lg:grid-cols-[1.1fr_1fr]">
              <div className="space-y-5">
                <form
                  onSubmit={(event) => {
                    event.preventDefault()
                    void controller.save()
                  }}
                  className="rounded-xl border border-line bg-white p-6"
                >
                  <div className="mb-6 flex items-center gap-2">
                    <Icon name="edit" className="text-brand" />
                    <h2 className="text-sm font-semibold">フォーム設定</h2>
                  </div>
                  <fieldset disabled={controller.busy} className="space-y-5">
                    <label className="block text-xs font-medium">
                      フォーム名
                      <Input
                        value={settings.title}
                        onChange={(event) =>
                          controller.change({ title: event.target.value })
                        }
                        maxLength={100}
                        className="mt-2 w-full"
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      説明文
                      <Textarea
                        value={settings.description}
                        onChange={(event) =>
                          controller.change({ description: event.target.value })
                        }
                        maxLength={1000}
                        rows={4}
                        className="mt-2 w-full text-xs leading-6"
                      />
                    </label>
                    <label className="block text-xs font-medium">
                      回答締切
                      <Input
                        type="date"
                        value={settings.deadline}
                        onChange={(event) =>
                          controller.change({ deadline: event.target.value })
                        }
                        className="mt-2 w-full"
                      />
                      <span className="mt-1.5 block text-[11px] font-normal text-muted">
                        締切はフォームに表示されます。受付は下の設定で切り替えます。
                      </span>
                    </label>
                    <div className="border-t border-line pt-5">
                      <p className="mb-4 text-xs font-semibold">回答項目</p>
                      <div className="space-y-3 text-xs">
                        <p className="flex items-center gap-2 text-muted">
                          <Icon name="check" className="size-4 text-brand" />
                          出演名・メンバー
                          <span className="ml-auto text-[10px]">必須</span>
                        </p>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={settings.collectContact}
                            onChange={(event) =>
                              controller.change({
                                collectContact: event.target.checked,
                              })
                            }
                          />
                          連絡先メール
                          <span className="ml-auto text-[10px] text-muted">
                            任意
                          </span>
                        </label>
                        <label className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            checked={settings.collectRequests}
                            onChange={(event) =>
                              controller.change({
                                collectRequests: event.target.checked,
                              })
                            }
                          />
                          出演に関する希望
                          <span className="ml-auto text-[10px] text-muted">
                            任意
                          </span>
                        </label>
                      </div>
                    </div>
                    <label className="flex items-start gap-3 rounded-lg border border-line bg-canvas/40 p-3">
                      <input
                        type="checkbox"
                        checked={settings.accepting}
                        onChange={(event) =>
                          controller.change({ accepting: event.target.checked })
                        }
                        className="mt-0.5"
                      />
                      <span>
                        <span className="block text-xs font-medium">
                          回答を受け付ける
                        </span>
                        <span className="mt-1 block text-[11px] text-muted">
                          オフにすると、回答フォームの受付を終了します。
                        </span>
                      </span>
                    </label>
                  </fieldset>
                  {controller.formError && (
                    <p role="alert" className="mt-4 text-xs text-red-500">
                      {controller.formError}
                    </p>
                  )}
                  <div className="mt-6 flex justify-end">
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={controller.busy}
                    >
                      {controller.busy ? '保存中…' : '設定を保存'}
                    </Button>
                  </div>
                </form>
                <div className="rounded-xl border border-line bg-white p-5">
                  <h2 className="mb-2 text-xs font-semibold">
                    回答フォームのURL（デモ）
                  </h2>
                  <p className="mb-3 text-[11px] text-muted">
                    このタブ内で試すためのリンクです。別のタブやブラウザとはデータを共有しません。
                  </p>
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      aria-label="回答フォームのリンク"
                      value={controller.formUrl}
                      className="min-w-0 flex-1 bg-canvas text-xs"
                    />
                    <Button onClick={() => void controller.copyLink()}>
                      <Icon name="link" />
                      コピー
                    </Button>
                  </div>
                </div>
              </div>
              <FormPreview settings={settings} />
            </div>
            {controller.notice && (
              <p
                role="status"
                className="mt-5 rounded-lg border border-brand/20 bg-wash px-4 py-3 text-xs text-brand"
              >
                {controller.notice}
              </p>
            )}
          </>
        )
      )}
    </AppFrame>
  )
}
