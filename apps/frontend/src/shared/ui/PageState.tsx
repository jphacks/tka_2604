import { Button } from './Button'
import { Icon } from './Icon'
import { LinkButton } from './LinkButton'

export function PageState({
  error,
  onRetry,
}: {
  error?: string
  onRetry?: () => void
}) {
  return (
    <div
      className="flex min-h-[300px] flex-col items-center justify-center gap-4 rounded-xl border border-line bg-white p-8 text-center"
      role={error ? 'alert' : 'status'}
    >
      <Icon
        name={error ? 'info' : 'refresh'}
        className={`size-6 text-muted ${error ? '' : 'motion-safe:animate-spin'}`}
      />
      <p className="text-muted">{error || '読み込んでいます…'}</p>
      {error && (
        <div className="flex gap-2">
          {onRetry && <Button onClick={onRetry}>再試行</Button>}
          <LinkButton to="/event">イベント一覧へ</LinkButton>
        </div>
      )}
    </div>
  )
}
