import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import type { IngestionTaskSummary } from '@/api/generated/model'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Pagination } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import { useIngestionLive } from '@/features/ingestion/IngestionLiveProvider'
import { blockedStep, needsAttention, STEP_STATUS, STEPS, TASK_STATUS, toneColor } from '@/features/ingestion/labels'
import { useIngestionById, useResolveTask } from '@/features/ingestion/queries'
import { cn } from '@/lib/utils'
import { IngestionHeader, type TaskFilter } from './IngestionHeader'
import { TaskPanel } from './TaskPanel'

const PAGE_SIZE = 25

const FILTERS: Record<TaskFilter, (t: IngestionTaskSummary) => boolean> = {
  attention: needsAttention,
  all: () => true,
  completed: (t) => t.status === 'COMPLETED' || t.status === 'RESOLVED',
  queue: (t) => t.status === 'PENDING' || t.status === 'RUNNING',
}

/** Grupo de cada tarefa na ordem da lista: a rodando, as finalizadas, as na fila. */
const rankOf = (t: IngestionTaskSummary) => (t.status === 'RUNNING' ? 0 : t.completedAt ? 1 : 2)

/**
 * A tarefa rodando no topo, depois as finalizadas da mais recente para a mais antiga, e por fim
 * as na fila, na ordem em que vão rodar (a do contrato).
 */
function byRecent(a: IngestionTaskSummary, b: IngestionTaskSummary) {
  const r = rankOf(a) - rankOf(b)
  if (r) return r
  // Compara o instante, não o texto: o stream manda algumas datas com fuso (`-03:00`) e o REST em UTC (`Z`).
  if (a.completedAt && b.completedAt) return Date.parse(b.completedAt) - Date.parse(a.completedAt)
  return 0
}

/** Tela das tarefas de uma ingestão (`/ingestao/:id`): andamento, filtros, lista e o painel da tarefa. */
export function IngestionTasksPage() {
  const id = Number(useParams().id)
  usePageMeta(`Ingestão #${id}`, 'Ingestão / Tarefas')
  const query = useIngestionById(id)
  const liveState = useIngestionLive()
  const ingestion = query.data

  const [sp, setSp] = useSearchParams()
  const [filter, setFilter] = useState<TaskFilter | null>(null)
  const [q, setQ] = useState('')
  const [pageState, setPage] = useState(0)

  const taskId = Number(sp.get('tarefa')) || null
  const openTask = (tid: number | null) =>
    setSp(
      (prev) => {
        const next = new URLSearchParams(prev)
        if (tid == null) next.delete('tarefa')
        else next.set('tarefa', String(tid))
        return next
      },
      { replace: true },
    )

  const c = ingestion?.taskCounts
  const attention = c ? c.waitingCuration + c.failed : 0
  // Sem escolha do usuário, abre em "Precisam de atenção" quando há alguma.
  const active: TaskFilter = filter ?? (attention > 0 ? 'attention' : 'all')
  const pick = (f: TaskFilter) => {
    setFilter(f)
    setPage(0)
  }

  const tasks = useMemo(() => {
    const term = q.trim().toLowerCase()
    return (ingestion?.tasks ?? [])
      .filter(
        (t) =>
          FILTERS[active](t) &&
          (!term || t.folderName.toLowerCase().includes(term) || (t.title ?? '').toLowerCase().includes(term)),
      )
      .sort(byRecent)
  }, [ingestion?.tasks, active, q])

  const totalPages = Math.max(1, Math.ceil(tasks.length / PAGE_SIZE))
  // A lista encolhe ao vivo (tarefas saem do filtro); a página nunca passa da última.
  const page = Math.min(pageState, totalPages - 1)
  const visible = tasks.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  const back = (
    <Link to="/ingestao" className="flex w-fit items-center gap-1 text-13 text-muted hover:text-text">
      <Icon name="arrow_back" size={18} />
      Ingestão
    </Link>
  )

  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />
  if (!ingestion)
    return (
      <>
        {back}
        <EmptyState dashed icon="search_off" title={`Ingestão #${id} não encontrada`} description="Ela não está no histórico." />
      </>
    )

  return (
    <>
      {back}
      <section className="card flex flex-col overflow-hidden">
        <div className="border-b border-line">
          <IngestionHeader
            ingestion={ingestion}
            live={query.live ? liveState : undefined}
            onPickFilter={pick}
            onOpenTask={(t) => openTask(t.id)}
          />
        </div>

        {ingestion.taskCounts.total > 0 && (
          <>
            <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-3">
              <Segmented
                aria-label="Filtrar tarefas"
                value={active}
                onChange={pick}
                options={[
                  { value: 'attention', label: `Precisam de atenção · ${attention}` },
                  { value: 'all', label: 'Todas' },
                  { value: 'completed', label: 'Concluídas' },
                  { value: 'queue', label: 'Na fila' },
                ]}
              />
              <label className="ml-auto flex h-9 w-[260px] max-w-full items-center gap-2 rounded-rs border border-line bg-bg px-3 text-muted focus-within:border-accent">
                <Icon name="search" size={18} />
                <input
                  value={q}
                  onChange={(e) => {
                    setQ(e.target.value)
                    setPage(0)
                  }}
                  placeholder="Buscar pasta ou título"
                  aria-label="Buscar pasta ou título"
                  className="min-w-0 flex-1 border-0 bg-transparent text-13 text-text outline-none placeholder:text-muted"
                />
              </label>
            </div>

            {visible.length === 0 ? (
              <div className="px-5 py-6 text-13 text-muted">
                {active === 'attention' && !q ? 'Nenhuma tarefa precisa de atenção.' : 'Nenhuma tarefa com esse filtro.'}
              </div>
            ) : (
              visible.map((t) => <TaskRow key={t.id} task={t} selected={t.id === taskId} onOpen={() => openTask(t.id)} />)
            )}
            {tasks.length > PAGE_SIZE && (
              <Pagination
                page={page}
                totalPages={totalPages}
                size={PAGE_SIZE}
                onPage={setPage}
                className="border-t border-line"
              />
            )}
          </>
        )}
      </section>

      {taskId != null && (
        <TaskPanel taskId={taskId} summary={ingestion.tasks.find((t) => t.id === taskId)} onClose={() => openTask(null)} />
      )}
    </>
  )
}

function TaskRow({ task, selected, onOpen }: { task: IngestionTaskSummary; selected: boolean; onOpen: () => void }) {
  const status = TASK_STATUS[task.status]
  const blocked = task.status === 'WAITING_CURATION' ? blockedStep(task) : null
  const resolve = useResolveTask()
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen())}
      className={cn(
        'flex cursor-pointer items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0 hover:bg-hover',
        selected && 'bg-tint',
      )}
    >
      <Thumb src={task.thumbnail} width={32} fallbackIcon="folder" />
      <div className="flex min-w-0 flex-1 flex-col gap-px">
        <span className="truncate text-13 font-medium">{task.folderName}</span>
        <span className="truncate text-sm text-muted">{task.title ?? 'Sem vínculo com a AniList'}</span>
      </div>
      <StepDots task={task} />
      <Chip tone={status.tone} className="w-[132px] justify-center max-sm:hidden">
        {status.label}
      </Chip>
      <div className="flex w-[136px] items-center justify-end gap-1.5">
        {blocked && (
          <>
            <Button asChild size="xs" variant="secondary" onClick={(e) => e.stopPropagation()}>
              <Link to={`/catalogo/${task.folderId}/${blocked.tab}`} target="_blank" rel="noopener">
                Resolver
              </Link>
            </Button>
            <Tooltip content="Marcar como resolvida">
              <Button
                size="icon-sm"
                variant="secondary"
                icon="check"
                iconSize={17}
                aria-label="Marcar como resolvida"
                loading={resolve.isPending}
                onClick={(e) => {
                  e.stopPropagation()
                  resolve.mutate({ taskId: task.id })
                }}
              />
            </Tooltip>
          </>
        )}
      </div>
    </div>
  )
}

/** Um marcador por etapa: cor do status da execução mais recente; vazio se a etapa não rodou. */
export function StepDots({ task }: { task: IngestionTaskSummary }) {
  return (
    <div className="flex items-center gap-1">
      {STEPS.map((s) => {
        const run = task.steps.find((x) => x.step === s.step)
        const st = run ? STEP_STATUS[run.status] : null
        return (
          <Tooltip key={s.step} content={`${s.title}: ${st ? st.label : 'não rodou'}`}>
            <span
              className={cn('h-2.5 w-2.5 rounded-full border', run?.status === 'RUNNING' && 'animate-pulse-dot')}
              style={
                st
                  ? {
                      background: toneColor(st.tone),
                      borderColor: toneColor(st.tone),
                      opacity: run?.status === 'SKIPPED' ? 0.45 : 1,
                    }
                  : { borderColor: 'var(--line)' }
              }
            />
          </Tooltip>
        )
      })}
    </div>
  )
}
