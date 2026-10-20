import { cn } from '@/lib/utils'

export type SegmentedOption<T extends string> = { value: T; label: React.ReactNode; disabled?: boolean }

type SegmentedProps<T extends string> = {
  value: T
  onChange: (value: T) => void
  options: SegmentedOption<T>[]
  size?: 'sm' | 'md'
  className?: string
  'aria-label'?: string
}

/** Controle segmentado: ativo com fundo `text` e texto `bg`. */
export function Segmented<T extends string>({ value, onChange, options, size = 'sm', className, ...rest }: SegmentedProps<T>) {
  return (
    <div
      role="radiogroup"
      aria-label={rest['aria-label']}
      className={cn(
        'inline-flex shrink-0 overflow-hidden rounded-rs border border-line bg-bg',
        size === 'sm' ? 'h-8' : 'h-9',
        className,
      )}
    >
      {options.map((o) => {
        const on = o.value === value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn(
              'whitespace-nowrap border-r border-line px-[11px] text-sm font-semibold transition-colors last:border-r-0 disabled:cursor-not-allowed disabled:opacity-50',
              on ? 'bg-text text-bg' : 'text-muted hover:text-text',
            )}
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}
