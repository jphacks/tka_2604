import { Link } from 'react-router'

import { Badge } from './Badge'

export function Brand({ to = '/event' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-3 rounded-md"
      aria-label="Setly ホーム"
    >
      <img
        src="/favicon.svg"
        alt="Setlyアイコン"
        className="size-[30px] rounded-[7px]"
      />
      <span className="text-xl font-bold tracking-wide">Setly</span>
      <Badge>デモ</Badge>
    </Link>
  )
}
