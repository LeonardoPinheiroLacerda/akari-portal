import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useListIngestions } from '@/api/generated/endpoints/ingestion/ingestion'
import type { IngestionSummary } from '@/api/generated/model'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Pagination } from '@/components/ui/misc'
import { Section } from '@/components/ui/section'
import { ErrorState, Loading } from '@/components/ui/states'
import { useCurrentIngestion, useIngestionLive } from '@/features/ingestion/IngestionLiveProvider'
import { formatElapsed, INGESTION_STATUS, isFinished } from '@/features/ingestion/labels'
import { HISTORY_PAGE_SIZE } from '@/features/ingestion/queries'
import { formatDateTime, pluralize } from '@/lib/format'
import { IngestionHeader, LiveChip, TaskBar } from '@/features/ingestion/IngestionHeader'

/**
 * A ingestão em andamento ou, sem nenhuma, a última — sempre a mesma que o stream mantém. Mostrar
 * a última depois que ela termina evita que o bloco suma e reapareça (uma ingestão pequena roda em
 * segundos); só o título, o status e os números mudam.
 */
export function LatestIngestion() {
  const navigate = useNavigate()
  const current = useCurrentIngestion()
  const live = useIngestionLive()
  const ingestion = current.data

  if (current.isLoading) return <Loading />
  if (current.isError) return <ErrorState error={current.error} onRetry={() => current.refetch()} />
  if (!ingestion)
    return (
      <Section title="Em andamento" actions={<LiveChip {...live} />}>
        <div className="px-5 py-5 text-13 text-muted">Nenhuma ingestão disparada ainda.</div>
      </Section>
    )

  return (
    <Section
      title={isFinished(ingestion.status) ? 'Última ingestão' : 'Em andamento'}
      actions={
        <>
          <LiveChip {...live} />
          <Button asChild size="sm" variant="primary">
            <Link to={`/ingestao/${ingestion.id}`}>Ver tarefas</Link>
          </Button>
        </>
      }
    >
      <IngestionHeader ingestion={ingestion} onOpenTask={(t) => navigate(`/ingestao/${ingestion.id}?tarefa=${t.id}`)} />
    </Section>
  )
}

/** Ingestões anteriores à mostrada acima, da mais nova para a mais antiga; cada uma abre a tela das tarefas. */
export function IngestionHistory() {
  const [page, setPage] = useState(0)
  const current = useCurrentIngestion()
  const query = useListIngestions({ page, size: HISTORY_PAGE_SIZE }, { query: { placeholderData: (prev) => prev } })
  // A atual (ou a última) já aparece no bloco de cima.
  const rows = (query.data?.data ?? []).filter((i) => i.id !== current.data?.id)
  const total = query.data ? Math.max(0, query.data.totalElements - (current.data ? 1 : 0)) : null

  return (
    <Section
      title="Histórico"
      subtitle={total != null ? pluralize(total, 'ingestão anterior', 'ingestões anteriores') : undefined}
    >
      {query.isLoading && <Loading />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && rows.length === 0 && <div className="px-5 py-5 text-13 text-muted">Nenhuma ingestão anterior.</div>}
      {rows.map((i) => (
        <HistoryRow key={i.id} ingestion={i} />
      ))}
      {query.data && query.data.totalPages > 1 && (
        <Pagination
          page={page}
          totalPages={query.data.totalPages}
          size={HISTORY_PAGE_SIZE}
          onPage={setPage}
          className="border-t border-line"
        />
      )}
    </Section>
  )
}

function HistoryRow({ ingestion: i }: { ingestion: IngestionSummary }) {
  const status = INGESTION_STATUS[i.status]
  const c = i.taskCounts
  const parts = [
    `${c.completed.toLocaleString('pt-BR')} concluídas`,
    c.resolved ? `${c.resolved.toLocaleString('pt-BR')} resolvidas à mão` : null,
    c.waitingCuration ? `${c.waitingCuration.toLocaleString('pt-BR')} aguardam curadoria` : null,
    c.failed ? `${c.failed.toLocaleString('pt-BR')} falharam` : null,
  ].filter(Boolean)
  return (
    <Link
      to={`/ingestao/${i.id}`}
      className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-line px-5 py-3 last:border-b-0 hover:bg-hover"
    >
      <div className="flex w-[220px] flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="font-semibold">#{i.id}</span>
          <Chip tone={status.tone} className="h-5 text-xs">
            {status.label}
          </Chip>
        </div>
        <span className="text-sm text-muted">
          {formatDateTime(i.createdAt)} · {formatElapsed(i.startedAt, i.completedAt)}
        </span>
      </div>
      <div className="flex min-w-[220px] flex-1 flex-col gap-1.5">
        {c.total > 0 && <TaskBar counts={c} compact />}
        <span className="text-sm text-muted">
          {pluralize(c.total, 'tarefa', 'tarefas')}
          {parts.length ? ` · ${parts.join(' · ')}` : ''}
        </span>
      </div>
      <Icon name="chevron_right" size={20} className="text-muted" />
    </Link>
  )
}
