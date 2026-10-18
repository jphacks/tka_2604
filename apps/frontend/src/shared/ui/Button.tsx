import type { ButtonHTMLAttributes } from 'react'

const variants = {
  primary:
    'border-brand bg-brand text-white hover:border-brand-dark hover:bg-brand-dark',
  secondary:
    'border-line bg-white text-ink hover:border-brand/40 hover:bg-wash',
  subtle: 'border-line bg-white text-brand hover:border-brand/40 hover:bg-wash',
  ghost: 'border-transparent text-muted hover:bg-wash hover:text-brand',
  danger:
    'border-line bg-white text-red-500 hover:border-red-200 hover:bg-red-50',
}

export function Button({
  variant = 'secondary',
  className = '',
  type = 'button',
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants
}) {
  return (
    <button
      type={type}
      className={`inline-flex min-h-9 items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-45 ${variants[variant]} ${className}`}
      {...props}
    />
  )
}
