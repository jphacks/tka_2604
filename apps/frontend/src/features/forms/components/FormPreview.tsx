import type { FormSettings } from '../../../shared/model/workspace'
import { Icon } from '../../../shared/ui/Icon'

export function FormPreview({ settings }: { settings: FormSettings }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="text-xs font-semibold">回答フォームのプレビュー</h2>
        <Icon name="form" className="text-muted" />
      </div>
      <div className="h-1 bg-brand" />
      <div className="space-y-5 p-6">
        <div>
          <span className="mb-3 inline-block rounded-full bg-wash px-2.5 py-1 text-[10px] text-brand">
            出演者登録
          </span>
          <h3 className="text-base font-semibold">
            {settings.title || 'フォーム名'}
          </h3>
          <p className="mt-3 text-xs leading-6 whitespace-pre-wrap text-muted">
            {settings.description}
          </p>
        </div>
        {[
          { title: '出演名', text: '例：気分上々↑↑', visible: true },
          {
            title: 'メンバー',
            text: '登録済みの人を選択、または新しい人を入力',
            visible: true,
          },
          {
            title: '連絡先メール',
            text: 'you@example.com',
            visible: settings.collectContact,
          },
          {
            title: '出演に関する希望',
            text: '出演する時間帯や、掛け持ちについて',
            visible: settings.collectRequests,
          },
        ].map((field) =>
          field.visible ? (
            <div key={field.title}>
              <p className="mb-2 text-xs font-medium">{field.title}</p>
              <div className="rounded-md border border-line px-3 py-3 text-xs text-muted/60">
                {field.text}
              </div>
            </div>
          ) : null,
        )}
        <div className="rounded-md bg-brand px-3 py-3 text-center text-xs font-medium text-white">
          出演登録を送信
        </div>
      </div>
    </div>
  )
}
