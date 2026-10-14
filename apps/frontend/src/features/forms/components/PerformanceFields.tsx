import type { EventData } from '../../../shared/model/event'
import type { PerformanceDraft } from '../../../shared/model/workspace'
import { Input, Textarea } from '../../../shared/ui/Input'
import { MemberPicker } from '../../../shared/ui/MemberPicker'

export function PerformanceFields({
  event,
  draft,
  onChange,
  collectRequests = true,
  collectContact = true,
  disabled = false,
}: {
  event: EventData
  draft: PerformanceDraft
  onChange: (patch: Partial<PerformanceDraft>) => void
  collectRequests?: boolean
  collectContact?: boolean
  disabled?: boolean
}) {
  return (
    <fieldset disabled={disabled} className="space-y-5">
      <label className="block text-xs font-medium">
        出演名 <span className="ml-1 text-[10px] text-brand">必須</span>
        <Input
          value={draft.name}
          onChange={(event) => onChange({ name: event.target.value })}
          maxLength={80}
          placeholder="例：気分上々↑↑"
          className="mt-2 h-10 w-full text-sm"
        />
      </label>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-xs font-medium">
          メンバー <span className="text-brand">1名以上</span>
        </legend>
        <p className="text-xs leading-6 text-muted">
          掛け持ちのある人は登録済みのメンバーを選んでください。同名の別人は新しく登録できます。
        </p>
        <MemberPicker
          event={event}
          selected={draft.memberIds}
          onChange={(memberIds) => onChange({ memberIds })}
        />
        <label className="block text-xs font-medium">
          新しいメンバー（任意）
          <Textarea
            value={draft.members}
            onChange={(change) => onChange({ members: change.target.value })}
            rows={2}
            placeholder="例：佐藤、田中、鈴木"
            maxLength={1000}
            className="mt-2 w-full text-sm"
          />
          <span className="mt-2 block text-xs leading-6 font-normal text-muted">
            「、」か改行で区切って入力。ここに入力した人は、同名の人がいても別のメンバーとして登録します。
          </span>
        </label>
      </fieldset>
      {collectContact && (
        <label className="block text-xs font-medium">
          連絡先メール{' '}
          <span className="ml-1 text-[10px] font-normal text-muted">任意</span>
          <Input
            type="email"
            value={draft.contact}
            onChange={(event) => onChange({ contact: event.target.value })}
            maxLength={200}
            placeholder="you@example.com"
            className="mt-2 h-10 w-full"
          />
        </label>
      )}
      {collectRequests && (
        <label className="block text-xs font-medium">
          出演に関する希望{' '}
          <span className="ml-1 text-[10px] font-normal text-muted">任意</span>
          <Textarea
            value={draft.requests}
            onChange={(event) => onChange({ requests: event.target.value })}
            rows={3}
            maxLength={1000}
            placeholder="例：第2部以降に出演したい、衣装替えの時間を空けたい"
            className="mt-2 w-full text-sm"
          />
          <span className="mt-1.5 block text-[11px] font-normal text-muted">
            希望は運営が確認し、出演順の調整に役立てます。
          </span>
        </label>
      )}
    </fieldset>
  )
}
