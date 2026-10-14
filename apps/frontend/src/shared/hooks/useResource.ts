import { useEffect, useState } from 'react'

export function useResource<T>(load: (signal: AbortSignal) => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [version, setVersion] = useState(0)
  useEffect(() => {
    const controller = new AbortController()
    load(controller.signal)
      .then((result) => {
        if (!controller.signal.aborted) {
          setData(result)
          setError('')
        }
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted)
          setError(
            cause instanceof Error ? cause.message : '読み込みに失敗しました。',
          )
      })
    return () => controller.abort()
  }, [load, version])
  return {
    data,
    error,
    loading: !data && !error,
    refresh: () => setVersion((value) => value + 1),
  }
}
