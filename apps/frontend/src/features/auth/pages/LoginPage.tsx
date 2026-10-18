import { Brand } from '../../../shared/ui/Brand'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
import { Input } from '../../../shared/ui/Input'
import { useLogin } from '../hooks/useLogin'

export function LoginPage() {
  const login = useLogin()
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] md:grid-cols-[1.1fr_1fr] md:grid-rows-1">
      <section className="relative flex flex-col bg-wash px-6 py-5 md:px-8 md:py-6 lg:px-[10%]">
        <Brand to="/login" />
        <div className="relative mt-4 md:my-auto md:py-6">
          <p className="mb-4 hidden text-xs font-semibold tracking-[0.18em] text-brand md:block">
            MAKE YOUR LIVE FLOW.
          </p>
          <h1 className="text-2xl leading-[1.5] font-bold tracking-tight text-ink md:text-3xl lg:text-4xl">
            最高のライブは、
            <br />
            いい出演順から。
          </h1>
          <p className="mt-4 hidden max-w-sm text-sm leading-7 text-muted md:block">
            出演者の掛け持ちも、譲れない条件も。
            <br />
            みんなの希望を整理して、ライブのたたき台を一緒につくりましょう。
          </p>
          <div
            aria-hidden="true"
            className="mt-6 hidden max-w-[420px] rounded-xl border border-white bg-white/80 p-4 shadow-[0_8px_32px_#256bc70a] lg:block"
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
        <p className="hidden text-xs leading-5 text-muted md:block">
          Setly — ライブの出演順づくりを支えるワークスペース
        </p>
      </section>
      <main className="flex items-center justify-center bg-white px-6 py-6 md:px-8">
        <div className="w-full max-w-[380px]">
          <fieldset className="mb-6 grid grid-cols-2 gap-1 rounded-lg bg-canvas p-1">
            <legend className="sr-only">認証方法</legend>
            {[
              { label: 'ログイン', registering: false },
              { label: '新規登録', registering: true },
            ].map((mode) => (
              <label key={mode.label} className="relative">
                <input
                  className="peer absolute inset-0 z-10 m-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
                  type="radio"
                  name="auth-mode"
                  value={mode.registering ? 'register' : 'login'}
                  checked={login.registering === mode.registering}
                  onChange={() => login.selectMode(mode.registering)}
                  disabled={login.busy}
                />
                <span className="flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium text-muted transition-colors peer-checked:bg-white peer-checked:text-brand peer-checked:shadow-sm peer-focus-visible:ring-2 peer-focus-visible:ring-brand/50 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">
                  {mode.label}
                </span>
              </label>
            ))}
          </fieldset>
          <h2 className="text-xl font-semibold md:text-2xl">
            {login.registering ? 'アカウントを作成' : 'ログイン'}
          </h2>
          <p className="mt-2 mb-5 text-sm leading-6 text-muted">
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
            <label className="mb-4 flex flex-col gap-2 text-sm font-medium">
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
              <p
                id="user-id-help"
                className="-mt-2 mb-4 text-xs leading-5 text-muted"
              >
                半角英数字・ハイフン・アンダースコアで3〜64文字
              </p>
            )}
            <label className="mb-4 flex flex-col gap-2 text-sm font-medium">
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
                  className="-mt-2 mb-4 text-xs leading-5 text-muted"
                >
                  15文字以上128文字以内。他のサービスで使っていない、長いパスワードを設定してください。
                </p>
                <label className="mb-5 flex flex-col gap-2 text-sm font-medium">
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
        </div>
      </main>
    </div>
  )
}
