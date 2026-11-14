import { useEffect, useRef, useState } from 'react'

export function ProcessingStatus({ message }: { message?: string }) {
  const [visibleMessage, setVisibleMessage] = useState<string>()
  const shownAt = useRef<number | null>(null)

  useEffect(() => {
    const delay = message
      ? shownAt.current === null
        ? 500
        : 0
      : Math.max(0, 800 - (Date.now() - (shownAt.current ?? 0)))
    const timer = window.setTimeout(() => {
      if (message) {
        shownAt.current ??= Date.now()
        setVisibleMessage(message)
      } else {
        shownAt.current = null
        setVisibleMessage(undefined)
      }
    }, delay)
    return () => window.clearTimeout(timer)
  }, [message])

  return (
    <div
      role="status"
      className="inline-flex h-4 w-24 shrink-0 items-center text-xs text-brand"
    >
      {visibleMessage && (
        <span
          className="inline-flex items-center gap-1.5 whitespace-nowrap"
          title={visibleMessage}
        >
          <span
            aria-hidden="true"
            className="size-3 shrink-0 animate-spin rounded-full border-2 border-brand/25 border-t-brand motion-reduce:animate-none"
          />
          {visibleMessage === '変更を保存しています。'
            ? '保存中'
            : visibleMessage === '出演順を計算しています。'
              ? '計算中'
              : visibleMessage === '最新の状態を取得しています。'
                ? '取得中'
                : visibleMessage === '出演枠を削除しています。'
                  ? '削除中'
                  : visibleMessage === '名簿CSVを登録しています。'
                    ? '登録中'
                    : 'AIが思考中'}
        </span>
      )}
    </div>
  )
}
