import { Link } from 'react-router'

import { Badge } from './Badge'
import { Icon } from './Icon'

export function Brand({ to = '/event' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-3 rounded-md"
      aria-label="セトリ ホーム"
    >
      <span className="flex size-[30px] items-center justify-center rounded-[7px] bg-brand text-white">
        <Icon name="list" className="size-[19px]" />
      </span>
      <span className="text-xl font-bold tracking-wide">セトリ</span>
      <Badge>デモ</Badge>
    </Link>
  )
}
