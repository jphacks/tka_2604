import { Brand } from '../../../shared/ui/Brand'
import { Button } from '../../../shared/ui/Button'
import { Icon } from '../../../shared/ui/Icon'
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
          <h2 className="text-2xl font-semibold">出演順づくりをはじめる</h2>
          <p className="mt-2 mb-8 text-sm text-muted">
            イベントを作成して、出演者の登録と出演順の調整を始めましょう。
          </p>
          {login.error && (
            <p role="alert" className="mb-4 text-red-600">
              {login.error}
            </p>
          )}
          <Button
            variant="primary"
            className="h-11 w-full"
            disabled={login.busy}
            onClick={() => void login.login()}
          >
            <Icon name="sparkle" />
            ワークスペースを開く
          </Button>
          <p className="mt-5 text-center text-xs leading-5 text-muted">
            イベントの情報は保存され、再読み込み後も残ります。
          </p>
        </div>
      </main>
    </div>
  )
}
