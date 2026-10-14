import type {
  InputHTMLAttributes,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from 'react'

const style =
  'rounded-md border border-[#cbd9ed] bg-white text-ink transition-colors placeholder:text-muted/80 focus:border-brand disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-muted'

export function Input({
  className = '',
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`${style} h-9 px-2.5 ${className}`} {...props} />
}

export function Select({
  className = '',
  ...props
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={`${style} h-8 px-2 text-[13px] ${className}`}
      {...props}
    />
  )
}

export function Textarea({
  className = '',
  ...props
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={`${style} resize-none p-3 ${className}`} {...props} />
  )
}
