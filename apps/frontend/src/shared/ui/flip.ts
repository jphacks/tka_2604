// Small FLIP helpers: rows are measured before a change and slid from their
// old place after it. Skipped when the person prefers reduced motion or the
// environment (e.g. jsdom) lacks the Web Animations API.
export const prefersReducedMotion = () =>
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function slideFrom(
  element: HTMLElement,
  dy: number,
  options: { duration: number },
) {
  if (!dy || prefersReducedMotion() || typeof element.animate !== 'function')
    return
  const easing = 'cubic-bezier(0.2, 0.8, 0.2, 1)'
  element.animate(
    [{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
    { duration: options.duration, easing },
  )
}
