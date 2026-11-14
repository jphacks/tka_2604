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
      <p className="mb-5 text-sm leading-6 text-muted">
        別の端末からも続きが使えます。作成したデータはそのまま残ります。
      </p>
      <form
        onSubmit={(event) => {
          event.preventDefault()
          void registration.login()
        }}
      >
        <label className="mb-2 flex flex-col gap-2 text-sm font-medium">
          ログインID
          <Input
            className="h-11 sm:h-9"
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
            className="h-11 sm:h-9"
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
            className="h-11 sm:h-9"
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
      </form>
    </Dialog>
  )
}
