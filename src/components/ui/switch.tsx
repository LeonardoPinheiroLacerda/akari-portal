import * as SwitchPrimitive from '@radix-ui/react-switch'
import { cn } from '@/lib/utils'

export function Switch({
  checked,
  onCheckedChange,
  disabled,
  className,
  id,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onCheckedChange: (v: boolean) => void
  disabled?: boolean
  className?: string
  id?: string
  'aria-label'?: string
}) {
  return (
    <SwitchPrimitive.Root
      id={id}
      aria-label={ariaLabel}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      className={cn(
        'relative inline-flex h-[22px] w-[38px] shrink-0 cursor-pointer items-center rounded-chip bg-raised transition-colors duration-200 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:bg-accent',
        className,
      )}
    >
      <SwitchPrimitive.Thumb className="block h-[16px] w-[16px] translate-x-[3px] rounded-full bg-[var(--muted)] transition-transform duration-200 data-[state=checked]:translate-x-[19px] data-[state=checked]:bg-accent-ink" />
    </SwitchPrimitive.Root>
  )
}
