import { useEffect, useRef } from 'react'

export function useChatScroll(
  messageCount: number,
  sending: boolean,
  active = true,
) {
  const container = useRef<HTMLDivElement>(null)
  const previousCount = useRef(messageCount)
  useEffect(() => {
    if (messageCount > previousCount.current || sending || active) {
      const element = container.current
      if (element)
        element.scrollTo({
          top: element.scrollHeight,
          behavior: window.matchMedia('(prefers-reduced-motion: reduce)')
            .matches
            ? 'instant'
            : 'smooth',
        })
    }
    previousCount.current = messageCount
  }, [messageCount, sending, active])
  return container
}
