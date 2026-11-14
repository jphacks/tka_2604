import { Button } from '../../../shared/ui/Button'
import { Dialog } from '../../../shared/ui/Dialog'
import { Icon } from '../../../shared/ui/Icon'
import { Input } from '../../../shared/ui/Input'
import { useLogin } from '../hooks/useLogin'

export function AccountRegistration({ onClose }: { onClose: () => void }) {
  const registration = useLogin(true)
  return (
    <Dialog
      title="アカウント登録"
      busy={registration.busy}
      onClose={() => {
        if (!registration.busy) onClose()
      }}
    >
      <div className="mb-5 rounded-xl bg-wash p-4">
        <span className="mb-2 flex items-center gap-2 text-sm font-semibold text-brand">
          <Icon name="check" />
          つくったイベントを、そのまま引き継ぐ
        </span>
        <p className="text-xs leading-6 text-muted">
          ログインIDとパスワードを設定すると、別の端末からも続きが使えます。イベントや出演順、チャットの内容もすべて残ります。
        </p>
      </div>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void registration.login()
        }}
      >
        <label className="mb-2 flex flex-col gap-2 text-sm font-medium">
          ログインID
          <Input
            name="userId"
            required
            minLength={3}
            maxLength={20}
            pattern="[A-Za-z0-9_\-]+"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={registration.userId}
            onChange={(event) => registration.setUserId(event.target.value)}
            disabled={registration.busy}
            aria-describedby="registration-id-help"
          />
        </label>
        <p id="registration-id-help" className="mb-4 text-xs text-muted">
          半角英数字・ハイフン・アンダースコアで3〜20文字
        </p>
        <label className="mb-2 flex flex-col gap-2 text-sm font-medium">
          パスワード
          <Input
            type="password"
            required
            minLength={7}
            maxLength={32}
            autoComplete="new-password"
            value={registration.password}
            onChange={(event) => registration.setPassword(event.target.value)}
            disabled={registration.busy}
            aria-describedby="registration-password-help"
          />
        </label>
        <p id="registration-password-help" className="mb-4 text-xs text-muted">
          7〜32文字。空白のみは使用できません。
        </p>
        <label className="mb-5 flex flex-col gap-2 text-sm font-medium">
          パスワード（確認）
          <Input
            type="password"
            required
            maxLength={32}
            autoComplete="new-password"
            value={registration.confirmation}
            onChange={(event) =>
              registration.setConfirmation(event.target.value)
            }
            disabled={registration.busy}
          />
        </label>
        {registration.error && (
          <p role="alert" className="mb-4 text-sm text-red-600">
            {registration.error}
          </p>
        )}
        <Button
          type="submit"
          variant="primary"
          className="h-11 w-full"
          disabled={registration.busy}
        >
          <Icon name="lock" />
          {registration.busy ? '登録中…' : 'アカウント登録'}
        </Button>
        <p className="mt-3 text-center text-xs text-muted">
          登録後も、この画面で作業を続けられます。
        </p>
      </form>
    </Dialog>
  )
}
