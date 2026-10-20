import * as RadioGroupPrimitive from '@radix-ui/react-radio-group'
import { cn } from '@/lib/utils'

export const RadioGroup = ({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) => (
  <RadioGroupPrimitive.Root className={cn('flex flex-col gap-2', className)} {...props} />
)

/** Bolinha do radio (usada dentro de opções customizadas). */
export function RadioDot({ checked, className }: { checked: boolean; className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition-colors',
        checked ? 'border-accent' : 'border-line',
        className,
      )}
    >
      {checked && <span className="h-2 w-2 rounded-full bg-accent" />}
    </span>
  )
}

/** Opção em cartão: borda + tint de acento quando selecionada. */
export function RadioCard({
  value,
  checked,
  disabled,
  className,
  children,
}: {
  value: string
  checked: boolean
  disabled?: boolean
  className?: string
  children: React.ReactNode
}) {
  return (
    <RadioGroupPrimitive.Item
      value={value}
      disabled={disabled}
      className={cn(
        'flex w-full items-start gap-3 rounded-rs border px-3.5 py-3 text-left outline-none transition-colors focus-visible:border-accent disabled:cursor-not-allowed disabled:opacity-50',
        checked ? 'border-accent bg-tint' : 'border-line hover:bg-hover',
        className,
      )}
    >
      <RadioDot checked={checked} className="mt-0.5" />
      <div className="min-w-0 flex-1">{children}</div>
    </RadioGroupPrimitive.Item>
  )
}
