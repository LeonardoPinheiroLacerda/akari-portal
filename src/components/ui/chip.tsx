import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/utils'
import { Icon } from './icon'

export type Tone = 'ok' | 'warn' | 'err' | 'info' | 'neutral' | 'accent'

const toneClass: Record<Tone, string> = {
  ok: 'bg-[var(--ok-bg)] text-[var(--ok-fg)]',
  warn: 'bg-[var(--warn-bg)] text-[var(--warn-fg)]',
  err: 'bg-[var(--err-bg)] text-[var(--err-fg)]',
  info: 'bg-[var(--info-bg)] text-[var(--info-fg)]',
  neutral: 'bg-raised text-muted',
  accent: 'bg-accent text-accent-ink',
}

type ChipProps = HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone
  mono?: boolean
  icon?: string
  dashed?: boolean
}

/** Chip de status (pill). */
export function Chip({ tone = 'neutral', mono, icon, dashed, className, children, ...props }: ChipProps) {
  return (
    <span
      className={cn(
        'inline-flex h-[22px] max-w-full shrink-0 items-center gap-1 justify-self-start whitespace-nowrap rounded-chip px-2 text-sm font-semibold',
        toneClass[tone],
        mono && 'font-mono text-xs font-bold',
        dashed && 'border border-dashed border-line bg-transparent',
        className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} size={14} />}
      <span className="truncate">{children}</span>
    </span>
  )
}
