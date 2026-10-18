import type { LinkProps } from 'react-router'
import { Link } from 'react-router'

export function LinkButton({
  primary,
  className = '',
  ...props
}: LinkProps & { primary?: boolean }) {
  return (
    <Link
      className={`inline-flex min-h-8 shrink-0 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium whitespace-nowrap transition-colors ${primary ? 'border-brand bg-brand text-white hover:bg-brand-dark' : 'border-line bg-white text-ink hover:border-brand/40 hover:bg-wash'} ${className}`}
      {...props}
    />
  )
}
