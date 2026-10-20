import { cn } from '@/lib/utils'
import { errorMessage } from '@/api/errors'
import { Button } from './button'
import { Icon } from './icon'

export function EmptyState({
  icon = 'inbox',
  title,
  description,
  action,
  className,
  dashed,
}: {
  icon?: string
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
  dashed?: boolean
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center gap-3 px-6 py-10 text-center',
        dashed && 'rounded-r border border-dashed border-line',
        className,
      )}
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-rs bg-raised text-muted">
        <Icon name={icon} size={22} />
      </span>
      <div className="flex max-w-[460px] flex-col gap-1">
        <span className="text-15 font-semibold">{title}</span>
        {description && <p className="m-0 text-13 text-muted">{description}</p>}
      </div>
      {action}
    </div>
  )
}

export function Loading({ label = 'Carregando…', className }: { label?: string; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2 px-5 py-6 text-13 text-muted', className)}>
      <Icon name="progress_activity" size={18} className="animate-spin" />
      {label}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }: { error: unknown; onRetry?: () => void; className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center gap-3 px-5 py-5 text-13', className)}>
      <Icon name="error" size={20} className="text-[var(--err-fg)]" />
      <span className="flex-1 text-muted">{errorMessage(error)}</span>
      {onRetry && (
        <Button size="sm" icon="refresh" onClick={onRetry}>
          Tentar de novo
        </Button>
      )}
    </div>
  )
}
