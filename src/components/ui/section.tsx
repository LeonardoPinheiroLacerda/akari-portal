import { cn } from '@/lib/utils'

/** Seção com cabeçalho (título 15/600 + subtítulo + ações) e corpo. */
export function Section({
  title,
  subtitle,
  actions,
  className,
  bodyClassName,
  children,
  footer,
}: {
  title?: React.ReactNode
  subtitle?: React.ReactNode
  actions?: React.ReactNode
  className?: string
  bodyClassName?: string
  children?: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <section className={cn('card overflow-hidden', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-4">
          <div className="flex min-w-0 flex-col gap-0.5">
            {title && <h3 className="m-0 text-15 font-semibold">{title}</h3>}
            {subtitle && <span className="text-sm text-muted">{subtitle}</span>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      {children !== undefined && <div className={bodyClassName}>{children}</div>}
      {footer && <div className="border-t border-line bg-code px-5 py-3 text-sm text-muted">{footer}</div>}
    </section>
  )
}
