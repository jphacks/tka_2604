import { Link } from 'react-router'

import { Icon } from './Icon'

export function Brand({ to = '/event' }: { to?: string }) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-3 rounded-md"
      aria-label="Setly ホーム"
    >
      <span className="flex size-[30px] items-center justify-center rounded-[7px] bg-brand text-white">
        <Icon name="list" className="size-[19px]" />
      </span>
      <span className="text-xl font-bold tracking-wide">Setly</span>
    </Link>
  )
}
