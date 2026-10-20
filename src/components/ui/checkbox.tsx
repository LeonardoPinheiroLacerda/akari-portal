import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

export function Checkbox({
  checked,
  onCheckedChange,
  disabled,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  className?: string
  'aria-label'?: string
}) {
  return (
    <CheckboxPrimitive.Root
      checked={checked}
      onCheckedChange={(v) => onCheckedChange(v === true)}
      disabled={disabled}
      aria-label={ariaLabel}
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[5px] border-2 border-line outline-none transition-colors focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-40 data-[state=checked]:border-accent data-[state=checked]:bg-accent',
        className,
      )}
    >
      <CheckboxPrimitive.Indicator className="text-accent-ink">
        <Icon name="check" size={14} className="font-bold" />
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}
