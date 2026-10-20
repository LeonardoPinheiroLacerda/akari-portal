import * as SelectPrimitive from '@radix-ui/react-select'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

export type SelectOption = { value: string; label: React.ReactNode; disabled?: boolean }

/** Radix não aceita value vazio; este sentinela representa "nenhum". */
const EMPTY = '__empty__'

type SelectProps = {
  value: string
  onChange: (value: string) => void
  options: SelectOption[]
  placeholder?: string
  className?: string
  size?: 'sm' | 'md'
  disabled?: boolean
  mono?: boolean
  'aria-label'?: string
}

export function Select({ value, onChange, options, placeholder, className, size = 'md', disabled, mono, ...rest }: SelectProps) {
  return (
    <SelectPrimitive.Root
      value={value === '' ? EMPTY : value}
      onValueChange={(v) => onChange(v === EMPTY ? '' : v)}
      disabled={disabled}
    >
      <SelectPrimitive.Trigger
        aria-label={rest['aria-label']}
        className={cn(
          'inline-flex w-full min-w-0 items-center justify-between gap-2 rounded-rs border border-line bg-bg pl-2.5 pr-1.5 text-13 text-text outline-none transition-colors focus:border-accent disabled:opacity-60 data-[placeholder]:text-muted',
          size === 'sm' ? 'h-8' : 'h-[38px]',
          mono && 'font-mono text-sm',
          className,
        )}
      >
        <span className="truncate">
          <SelectPrimitive.Value placeholder={placeholder} />
        </span>
        <SelectPrimitive.Icon asChild>
          <Icon name="expand_more" size={18} className="text-muted" />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>
      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className="z-50 max-h-[min(360px,var(--radix-select-content-available-height))] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-rs border border-line bg-panel shadow-modal"
        >
          <SelectPrimitive.Viewport className="p-1">
            {options.map((o) => (
              <SelectPrimitive.Item
                key={o.value || EMPTY}
                value={o.value === '' ? EMPTY : o.value}
                disabled={o.disabled}
                className={cn(
                  'relative flex h-8 cursor-pointer select-none items-center rounded-rxs pl-2.5 pr-8 text-13 outline-none data-[disabled]:cursor-not-allowed data-[highlighted]:bg-raised data-[state=checked]:font-semibold data-[disabled]:opacity-50',
                  mono && 'font-mono text-sm',
                )}
              >
                <SelectPrimitive.ItemText>{o.label}</SelectPrimitive.ItemText>
                <SelectPrimitive.ItemIndicator className="absolute right-2 text-accent">
                  <Icon name="check" size={16} />
                </SelectPrimitive.ItemIndicator>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
