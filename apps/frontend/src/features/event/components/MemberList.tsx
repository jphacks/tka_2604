export function MemberList({
  bandName,
  names,
}: {
  bandName: string
  names: string[]
}) {
  if (!names.length) return <span className="text-xs text-muted">登録なし</span>
  return (
    <details className="min-w-0 py-1 text-xs">
      <summary
        aria-label={`${bandName}のメンバー全員を表示`}
        className="cursor-pointer rounded text-muted focus-visible:outline-2 focus-visible:outline-brand"
      >
        <span className="line-clamp-2 leading-5">{names.join('・')}</span>
        <span className="text-brand">{names.length}人・詳細</span>
      </summary>
      <ul
        aria-label={`${bandName}のメンバー`}
        className="mt-1 flex flex-wrap gap-1 pb-1"
      >
        {names.map((name, index) => (
          <li
            key={`${index}-${name}`}
            className="max-w-full rounded bg-wash px-2 py-1 break-all text-ink"
          >
            {name}
          </li>
        ))}
      </ul>
    </details>
  )
}
