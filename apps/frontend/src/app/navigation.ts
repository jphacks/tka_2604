export function loginDestination(state: unknown) {
  const destination =
    state && typeof state === 'object' && 'returnTo' in state
      ? state.returnTo
      : undefined
  return typeof destination === 'string' && /^\/event(?:\/|$)/.test(destination)
    ? destination
    : '/event'
}
