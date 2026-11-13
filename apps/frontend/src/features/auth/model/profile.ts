export type Profile = { displayName: string }

const characters = new Intl.Segmenter(undefined, { granularity: 'grapheme' })

export function avatarInitial(displayName: string) {
  const first = characters.segment(displayName.trim())[Symbol.iterator]().next()
    .value?.segment
  if (!first) return '?'
  return (
    characters.segment(first.toUpperCase())[Symbol.iterator]().next().value
      ?.segment ?? '?'
  )
}
