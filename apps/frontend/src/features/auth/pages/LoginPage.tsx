import { Brand } from '../../../shared/ui/Brand'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input } from '../../../shared/ui/Input'
import { useLogin } from '../hooks/useLogin'

export function LoginPage() {
  const login = useLogin()
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.1fr_1fr]">
      <section className="relative flex flex-col overflow-hidden bg-wash px-10 py-8 lg:px-[10%]">
        <Brand to="/login" />
        <div className="relative my-auto py-16">
          <p className="mb-5 text-xs font-semibold tracking-[0.18em] text-brand">
            MAKE YOUR LIVE FLOW.
          </p>
          <h1 className="text-4xl leading-[1.5] font-bold tracking-tight text-ink">
            最高のライブは、
            <br />
            いい出演順から。
          </h1>
          <p className="mt-5 max-w-sm text-sm leading-7 text-muted">
            出演者の掛け持ちも、譲れない条件も。
            <br />
            みんなの希望を整理して、ライブのたたき台を一緒につくりましょう。
          </p>
          <div
            aria-hidden="true"
            className="mt-10 max-w-[420px] rounded-xl border border-white bg-white/80 p-5 shadow-[0_8px_32px_#256bc70a]"
          >
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold">
                <Icon name="list" className="text-brand" />
                あなたのライブ
              </span>
              <span className="rounded bg-wash px-2 py-1 text-[11px] text-brand">
                準備がもっと、スムーズに
              </span>
            </div>
            {[
              '出演者とメンバーを登録',
              '大切な条件を整理',
              'たたき台を見ながら調整',
            ].map((text, index) => (
              <div
                key={text}
                className="flex items-center gap-3 border-t border-line/70 py-3"
              >
                <span className="flex size-6 items-center justify-center rounded-full bg-wash text-[11px] font-semibold text-brand">
                  0{index + 1}
                </span>
                <span className="flex-1 text-xs">{text}</span>
                <Icon name="check" className="text-brand" />
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">
          Setly — ライブの出演順づくりを支えるワークスペース
        </p>
      </section>
      <main className="flex items-center justify-center bg-white px-8 py-16">
        <div className="w-full max-w-[360px]">
          <span className="mb-5 inline-flex size-11 items-center justify-center rounded-xl bg-wash text-brand">
            <Icon name="lock" className="size-5" />
          </span>
          <h2 className="text-2xl font-semibold">
            {login.registering ? 'アカウントを作成' : 'ログイン'}
          </h2>
          <p className="mt-2 mb-8 text-sm text-muted">
            {login.registering
              ? 'ログインIDとパスワードを設定して、イベントの管理を始めましょう。'
              : 'ログインして、イベントの管理と出演順の調整を始めましょう。'}
          </p>
          <form
            onSubmit={(event) => {
              event.preventDefault()
              void login.login()
            }}
          >
            <label className="mb-5 flex flex-col gap-2 text-sm font-medium">
              ログインID
              <Input
                name="userId"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                minLength={login.registering ? 3 : undefined}
                maxLength={login.registering ? 64 : 128}
                pattern={login.registering ? '[A-Za-z0-9_\\-]+' : undefined}
                aria-describedby={
                  login.registering ? 'user-id-help' : undefined
                }
                required
                value={login.userId}
                onChange={(event) => login.setUserId(event.target.value)}
                disabled={login.busy}
              />
            </label>
            {login.registering && (
              <p id="user-id-help" className="-mt-3 mb-5 text-xs text-muted">
                半角英数字・ハイフン・アンダースコアで3〜64文字
              </p>
            )}
            <label className="mb-6 flex flex-col gap-2 text-sm font-medium">
              パスワード
              <Input
                name="password"
                type="password"
                autoComplete={
                  login.registering ? 'new-password' : 'current-password'
                }
                minLength={login.registering ? 15 : undefined}
                maxLength={128}
                aria-describedby={
                  login.registering ? 'password-help' : undefined
                }
                required
                value={login.password}
                onChange={(event) => login.setPassword(event.target.value)}
                disabled={login.busy}
              />
            </label>
            {login.registering && (
              <>
                <p
                  id="password-help"
                  className="-mt-4 mb-5 text-xs leading-5 text-muted"
                >
                  15文字以上128文字以内。他のサービスで使っていない、長いパスワードを設定してください。
                </p>
                <label className="mb-6 flex flex-col gap-2 text-sm font-medium">
                  パスワード（確認）
                  <Input
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    required
                    maxLength={128}
                    value={login.confirmation}
                    onChange={(event) =>
                      login.setConfirmation(event.target.value)
                    }
                    disabled={login.busy}
                  />
                </label>
              </>
            )}
            {(login.error || (!login.registering && login.notice)) && (
              <p role="alert" className="mb-4 text-sm text-red-600">
                {login.error || login.notice}
              </p>
            )}
            <Button
              type="submit"
              variant="primary"
              className="h-11 w-full"
              disabled={login.busy}
            >
              <Icon name="lock" />
              {login.busy
                ? login.registering
                  ? '登録中…'
                  : 'ログイン中…'
                : login.registering
                  ? '新規登録'
                  : 'ログイン'}
            </Button>
          </form>
          <Button
            variant="ghost"
            className="mt-5 w-full text-sm"
            disabled={login.busy}
            onClick={login.switchMode}
          >
            {login.registering ? 'ログイン画面へ戻る' : 'アカウントを作成する'}
          </Button>
        </div>
      </main>
    </div>
  )
}
