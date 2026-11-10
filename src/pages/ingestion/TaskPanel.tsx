import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { useGetIngestionTask } from '@/api/generated/endpoints/ingestion/ingestion'
import type { IngestionStepExecutionDetail, IngestionTaskSummary } from '@/api/generated/model'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import {
  blockedStep,
  EVENT,
  formatElapsed,
  STEP_STATUS,
  STEPS,
  stepInfo,
  TASK_STATUS,
  toneColor,
} from '@/features/ingestion/labels'
import { useResolveTask } from '@/features/ingestion/queries'
import { formatDateTime, formatTime } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Painel lateral com a linha do tempo de uma tarefa: as execuções de cada etapa e os eventos delas. */
export function TaskPanel({
  taskId,
  summary,
  onClose,
}: {
  taskId: number
  /** Resumo da lista, mostrado enquanto o detalhe carrega. */
  summary?: IngestionTaskSummary
  onClose: () => void
}) {
  // Os eventos de uma etapa em andamento só chegam pelo stream quando ela termina; enquanto a
  // tarefa roda, o detalhe é recarregado para mostrar a linha do tempo da etapa atual.
  const query = useGetIngestionTask(taskId, {
    query: { refetchInterval: (q) => (q.state.data?.status === 'RUNNING' ? 2000 : false) },
  })
  const task = query.data ?? summary
  const resolve = useResolveTask()

  // Esc ou clique fora fecham. Clicar noutra tarefa da lista fecha aqui e o clique da linha
  // reabre o painel nela.
  const panelRef = useRef<HTMLElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    const onDown = (e: PointerEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose()
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [onClose])

  const blocked = task ? blockedStep(task) : null
  const status = task ? TASK_STATUS[task.status] : null
  const ran = new Set(query.data?.executions.map((e) => e.step))

  return (
    <aside
      ref={panelRef}
      aria-label="Tarefa da ingestão"
      className="fixed bottom-0 right-0 top-0 z-40 flex w-[min(560px,100vw)] flex-col border-l border-line bg-panel shadow-modal"
    >
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <Thumb src={task?.thumbnail} width={44} fallbackIcon="folder" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="truncate text-15 font-semibold">{task?.folderName ?? `Tarefa #${taskId}`}</span>
          <span className="truncate text-13 text-muted">{task?.title ?? 'Sem vínculo com a AniList'}</span>
          {status && (
            <div className="flex flex-wrap items-center gap-2">
              <Chip tone={status.tone}>{status.label}</Chip>
              {task?.startedAt && <span className="text-sm text-muted">{formatElapsed(task.startedAt, task.completedAt)}</span>}
            </div>
          )}
        </div>
        <Button size="icon-sm" variant="ghost" icon="close" aria-label="Fechar" onClick={onClose} />
      </div>

      {task && (
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
          {blocked && task.status === 'WAITING_CURATION' ? (
            <>
              <span className="min-w-[180px] flex-1 text-13">
                Parou em <b>{blocked.title}</b>. Resolva no item e marque como resolvida.
              </span>
              <Button asChild size="sm">
                <Link to={`/catalogo/${task.folderId}/${blocked.tab}`} target="_blank" rel="noopener">
                  Resolver
                </Link>
              </Button>
              <Button
                size="sm"
                variant="primary"
                icon="check"
                loading={resolve.isPending}
                onClick={() => resolve.mutate({ taskId: task.id })}
              >
                Marcar como resolvida
              </Button>
            </>
          ) : (
            <>
              <span className="min-w-0 flex-1 text-13 text-muted">
                {task.status === 'RESOLVED' ? 'Curadoria feita à mão; as etapas que faltavam não rodaram.' : ''}
              </span>
              <Button asChild size="sm">
                <Link to={`/catalogo/${task.folderId}`}>Abrir no catálogo</Link>
              </Button>
            </>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-5 py-4">
        {query.isLoading && <Loading />}
        {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
        {query.data && (
          <div className="flex flex-col gap-4">
            {query.data.executions.map((ex) => (
              <Execution key={ex.id} execution={ex} />
            ))}
            {STEPS.filter((s) => !ran.has(s.step)).map((s) => (
              <div key={s.step} className="flex items-center gap-2.5 text-13 text-muted">
                <span className="h-2.5 w-2.5 rounded-full border border-line" />
                {s.title} · não rodou
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  )
}

function Execution({ execution: ex }: { execution: IngestionStepExecutionDetail }) {
  const st = STEP_STATUS[ex.status]
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-semibold">{stepInfo(ex.step).title}</span>
        <Chip tone={st.tone} className="h-5 text-xs">
          {st.label}
        </Chip>
        {ex.attempt > 1 && <span className="text-sm text-muted">tentativa {ex.attempt}</span>}
        <span className="ml-auto font-mono text-xs text-muted" title={formatDateTime(ex.startedAt ?? ex.createdAt)}>
          {formatElapsed(ex.startedAt ?? ex.createdAt, ex.completedAt)}
        </span>
      </div>
      <ol className="m-0 flex list-none flex-col gap-2 p-0">
        {ex.events.map((ev) => {
          const meta = EVENT[ev.type]
          const loud = meta.tone !== 'neutral' && meta.tone !== 'ok'
          return (
            <li key={ev.id} className="flex flex-col gap-1">
              <div className="flex items-start gap-2">
                <span
                  className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full"
                  style={{ background: `var(--${meta.tone}-bg, var(--raised))`, color: toneColor(meta.tone) }}
                >
                  <Icon name={meta.icon} size={13} />
                </span>
                <span className={cn('flex-1 pt-px text-13', loud && 'font-medium')}>{ev.message}</span>
                <span className="shrink-0 pt-0.5 font-mono text-xs text-muted">{formatTime(new Date(ev.createdAt))}</span>
              </div>
              {ev.details != null && (
                <details className="ml-7">
                  <summary className="cursor-pointer text-xs text-muted">Detalhes</summary>
                  <pre className="m-0 mt-1 max-h-64 overflow-auto rounded-rxs bg-bg p-2.5 font-mono text-xs leading-[1.45]">
                    {JSON.stringify(ev.details, null, 2)}
                  </pre>
                </details>
              )}
            </li>
          )
        })}
        {ex.status === 'RUNNING' && <li className="pl-7 text-sm text-muted">Em andamento…</li>}
      </ol>
    </div>
  )
}
