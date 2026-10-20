import { forwardRef, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

export const inputClass =
  'h-9 w-full rounded-rs border border-line bg-bg px-3 text-13 text-text outline-none transition-colors placeholder:text-muted focus:border-accent disabled:opacity-60 aria-[invalid=true]:border-danger'

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { mono?: boolean }>(
  ({ className, mono, ...props }, ref) => (
    <input ref={ref} className={cn(inputClass, mono && 'font-mono text-sm', className)} {...props} />
  ),
)
Input.displayName = 'Input'

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, ...props }, ref) => (
    <textarea ref={ref} className={cn(inputClass, 'h-auto min-h-[96px] py-2 leading-relaxed', className)} {...props} />
  ),
)
Textarea.displayName = 'Textarea'

type SearchInputProps = InputHTMLAttributes<HTMLInputElement> & { containerClassName?: string; height?: 36 | 38 | 40 }

/** Campo com ícone de busca à esquerda. */
export const SearchInput = forwardRef<HTMLInputElement, SearchInputProps>(
  ({ containerClassName, className, height = 38, ...props }, ref) => (
    <label
      className={cn(
        'flex min-w-0 items-center gap-2 rounded-rs border border-line bg-bg px-3 text-muted transition-colors focus-within:border-accent',
        containerClassName,
      )}
      style={{ height }}
    >
      <Icon name="search" size={19} />
      <input
        ref={ref}
        className={cn(
          'min-w-0 flex-1 border-0 bg-transparent text-base text-text outline-none placeholder:text-muted',
          className,
        )}
        {...props}
      />
    </label>
  ),
)
SearchInput.displayName = 'SearchInput'
