import { cn } from '@/lib/utils'
import { Button } from './button'
import { Icon } from './icon'

/** Link para um site externo, aberto em nova aba, com o ícone de "abrir fora". */
export function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-accent-text hover:underline">
      {children}
      <Icon name="open_in_new" size={14} />
    </a>
  )
}

/** Barra de progresso fina (acento). */
export function Progress({ value, className, color }: { value: number; className?: string; color?: string }) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('h-1.5 w-full overflow-hidden rounded-chip bg-raised', className)}>
      <div
        className="h-full rounded-chip transition-[width] duration-200"
        style={{ width: `${pct}%`, background: color ?? 'var(--accent)' }}
      />
    </div>
  )
}

/** Lista chave/valor (rótulo `muted` à esquerda, valor à direita). */
export function KeyValue({
  rows,
  className,
  labelWidth = 150,
}: {
  rows: { label: React.ReactNode; value: React.ReactNode; mono?: boolean }[]
  className?: string
  labelWidth?: number
}) {
  return (
    <dl className={cn('m-0 flex flex-col', className)}>
      {rows.map((r, i) => (
        <div
          key={i}
          className="grid items-baseline gap-3 border-b border-line py-2 last:border-b-0"
          style={{ gridTemplateColumns: `${labelWidth}px 1fr` }}
        >
          <dt className="text-13 text-muted">{r.label}</dt>
          <dd className={cn('m-0 min-w-0 break-words text-13', r.mono && 'font-mono')}>{r.value ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Rodapé de paginação 0-based. */
export function Pagination({
  page,
  totalPages,
  size,
  onPage,
  className,
}: {
  page: number
  totalPages: number
  size: number
  onPage: (p: number) => void
  className?: string
}) {
  const total = Math.max(1, totalPages)
  return (
    <div className={cn('flex items-center gap-3 px-5 py-3 text-sm text-muted', className)}>
      <span className="flex-1">
        Página {page + 1} de {total} · {size} por página
      </span>
      <Button
        size="icon-sm"
        variant="secondary"
        icon="chevron_left"
        aria-label="Página anterior"
        disabled={page <= 0}
        onClick={() => onPage(page - 1)}
      />
      <Button
        size="icon-sm"
        variant="secondary"
        icon="chevron_right"
        aria-label="Próxima página"
        disabled={page + 1 >= total}
        onClick={() => onPage(page + 1)}
      />
    </div>
  )
}
