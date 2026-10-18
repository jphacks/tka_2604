import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input, Select } from '../../../shared/ui/Input'
import type { PublicRegistrationController } from '../hooks/usePublicRegistration'
import {
  memberOptionLabel,
  type MemberRow,
  newMemberRow,
} from '../model/registration'

export function RegistrationFields({
  controller,
}: {
  controller: PublicRegistrationController
}) {
  const { data, draft, mode } = controller
  const change = (patch: Parameters<typeof controller.change>[0]) =>
    controller.change(patch)
  if (!data) return null
  const updateRow = (key: string, patch: Partial<MemberRow>) =>
    change({
      rows: draft.rows.map((row) =>
        row.key === key ? { ...row, ...patch } : row,
      ),
    })
  return (
    <>
      {mode === 'update' && (
        <div className="mb-7 rounded-lg bg-wash p-4">
          <label className="block text-sm font-medium">
            更新するバンド
            <Select
              className="mt-2 h-11 w-full bg-white"
              value={draft.bandId}
              onChange={(event) => controller.chooseBand(event.target.value)}
            >
              <option value="">バンドを選んでください</option>
              {data.bands.map((band) => (
                <option key={band.bandId} value={band.bandId}>
                  {band.bandName}
                  {data.bands.filter((item) => item.bandName === band.bandName)
                    .length > 1
                    ? `（ID: ${band.bandId.slice(-8)}）`
                    : ''}
                </option>
              ))}
            </Select>
          </label>
          {!data.bands.length && (
            <p className="mt-3 text-xs text-muted">
              登録済みのバンドがありません。初回登録から追加してください。
            </p>
          )}
        </div>
      )}
      {(mode === 'create' || draft.bandId) && (
        <div className="space-y-7">
          <label className="block text-sm font-medium">
            バンド名 <span className="ml-1 text-xs text-brand">必須</span>
            <Input
              value={draft.bandName}
              onChange={(event) => change({ bandName: event.target.value })}
              maxLength={80}
              placeholder="例：サンセット・レコード"
              className="mt-2 h-11 w-full text-sm"
            />
          </label>
          <section aria-labelledby="members-heading">
            <div className="mb-2 flex items-center justify-between gap-3">
              <h2 id="members-heading" className="text-sm font-semibold">
                メンバー
              </h2>
              <span className="rounded-full bg-wash px-2.5 py-1 text-xs text-brand">
                {draft.rows.length} / 20人
              </span>
            </div>
            <p className="mb-4 text-xs leading-6 text-muted">
              {mode === 'create'
                ? '1人につき1行、人数分の行を追加してください。掛け持ちの人は名簿から選べます。'
                : '追加・差し替え・削除した内容は「変更を保存」で反映されます。全員を外すこともできます。'}
            </p>
            <div className="space-y-3">
              {draft.rows.map((row, index) => (
                <div
                  key={row.key}
                  className="rounded-lg border border-line bg-canvas/40 p-3 sm:p-4"
                >
                  <div className="mb-2.5 flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-muted">
                      メンバー {index + 1}{' '}
                      <span className="ml-2 font-normal">
                        {row.kind === 'new' ? '新しく登録' : '登録済み'}
                      </span>
                    </span>
                    <Button
                      variant="ghost"
                      className="min-h-8 px-2 text-xs"
                      aria-label={`メンバー${index + 1}を削除`}
                      onClick={() =>
                        change({
                          rows: draft.rows.filter(
                            (item) => item.key !== row.key,
                          ),
                        })
                      }
                    >
                      <Icon name="close" />
                      削除
                    </Button>
                  </div>
                  {row.kind === 'new' ? (
                    <Input
                      aria-label={`メンバー${index + 1}の名前`}
                      placeholder="名前を入力"
                      maxLength={40}
                      value={row.value}
                      onChange={(event) =>
                        updateRow(row.key, { value: event.target.value })
                      }
                      className="h-10 w-full text-sm"
                      autoComplete="off"
                    />
                  ) : (
                    <Select
                      aria-label={`メンバー${index + 1}を名簿から選択`}
                      value={row.value}
                      onChange={(event) =>
                        updateRow(row.key, { value: event.target.value })
                      }
                      className="h-10 w-full"
                    >
                      <option value="">登録済みのメンバーを選択</option>
                      {data.members.map((member) => (
                        <option
                          key={member.memberId}
                          value={member.memberId}
                          disabled={draft.rows.some(
                            (item) =>
                              item.key !== row.key &&
                              item.kind === 'existing' &&
                              item.value === member.memberId,
                          )}
                        >
                          {memberOptionLabel(data, member.memberId)}
                        </option>
                      ))}
                    </Select>
                  )}
                  <button
                    type="button"
                    className="mt-2.5 text-xs font-medium text-brand hover:underline disabled:opacity-45"
                    disabled={row.kind === 'new' && !data.members.length}
                    onClick={() =>
                      updateRow(row.key, {
                        kind: row.kind === 'new' ? 'existing' : 'new',
                        value: '',
                      })
                    }
                  >
                    {row.kind === 'new'
                      ? '名簿から選ぶ'
                      : '新しい人を入力して差し替え'}
                  </button>
                </div>
              ))}
            </div>
            {!draft.rows.length && (
              <p className="rounded-lg border border-dashed border-line p-5 text-center text-xs text-muted">
                メンバーはまだいません。
                {mode === 'create'
                  ? '下のボタンから追加してください。'
                  : 'このまま保存すると全員の所属を解除します。'}
              </p>
            )}
            <Button
              variant="subtle"
              className="mt-4 h-10 w-full border-dashed text-xs"
              disabled={draft.rows.length >= 20}
              onClick={() => change({ rows: [...draft.rows, newMemberRow()] })}
            >
              <Icon name="plus" />
              メンバーの行を追加
            </Button>
            <p className="mt-3 text-xs leading-5 text-muted">
              {mode === 'update'
                ? '削除はこのバンドから外す操作です。名前の欄を差し替えても、元の人の名前や他バンドの所属は変わりません。'
                : '同じ名前でも、新しく入力した人は別のメンバーとして登録します。'}
            </p>
          </section>
        </div>
      )}
    </>
  )
}
