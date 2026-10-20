import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

const buttonVariants = cva(
  'inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-rs font-semibold transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed',
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-ink hover:brightness-110 disabled:bg-raised disabled:text-muted disabled:hover:brightness-100',
        secondary: 'border border-line bg-panel text-text hover:bg-raised disabled:opacity-50',
        ghost: 'text-text hover:bg-raised disabled:opacity-50',
        link: 'px-0 text-accent-text hover:underline disabled:opacity-50',
        danger:
          'border border-danger text-danger hover:bg-[color-mix(in_oklch,var(--danger)_12%,transparent)] disabled:opacity-50',
        'danger-solid': 'bg-danger text-white hover:brightness-110 disabled:bg-raised disabled:text-muted',
      },
      size: {
        xs: 'h-7 px-2.5 text-sm',
        sm: 'h-8 px-3 text-13',
        md: 'h-9 px-3.5 text-13',
        lg: 'h-10 px-4 text-base',
        icon: 'h-9 w-9 p-0',
        'icon-sm': 'h-[30px] w-[30px] p-0',
      },
    },
    compoundVariants: [{ variant: 'link', className: 'h-auto px-0' }],
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean
  icon?: string
  iconSize?: number
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, icon, iconSize = 18, loading, children, disabled, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp ref={ref} className={cn(buttonVariants({ variant, size }), className)} disabled={disabled || loading} {...props}>
        {asChild ? (
          children
        ) : (
          <>
            {loading ? (
              <Icon name="progress_activity" size={iconSize} className="animate-spin" />
            ) : (
              icon && <Icon name={icon} size={iconSize} />
            )}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
