import { useEffect, useState } from 'react'
import type { IngestionSummary, IngestionTaskCounts, IngestionTaskSummary } from '@/api/generated/model'
import type { SseStatus } from '@/api/sse'
import { Chip, type Tone } from '@/components/ui/chip'
import { formatElapsed, INGESTION_STATUS, isFinished, RESOLVED_COLOR, stepInfo, toneColor } from '@/features/ingestion/labels'
import { formatDateTime, formatTime, pluralize } from '@/lib/format'

export type TaskFilter = 'attention' | 'all' | 'completed' | 'queue'

const SSE_CHIP: Record<SseStatus, { label: string; tone: Tone; pulse: boolean }> = {
  open: { label: 'Ao vivo', tone: 'ok', pulse: true },
  idle: { label: 'Ocioso', tone: 'neutral', pulse: false },
  connecting: { label: 'Conectando…', tone: 'info', pulse: true },
  error: { label: 'Reconectando…', tone: 'warn', pulse: true },
}

export function LiveChip({ status, lastEventAt }: { status: SseStatus; lastEventAt: Date | null }) {
  const sse = SSE_CHIP[status]
  return (
    <>
      <span
        className="flex h-7 items-center gap-2 rounded-chip px-2.5 text-sm font-semibold"
        style={{ background: `var(--${sse.tone}-bg, var(--raised))`, color: `var(--${sse.tone}-fg, var(--muted))` }}
      >
        <span className={`h-[7px] w-[7px] rounded-full bg-current ${sse.pulse ? 'animate-pulse-dot' : ''}`} />
        {sse.label}
      </span>
      <span className="font-mono text-sm text-muted">Último evento {lastEventAt ? formatTime(lastEventAt) : '—'}</span>
    </>
  )
}

const segmentsOf = (c: IngestionTaskCounts) => [
  { key: 'completed', label: 'Concluídas', value: c.completed, tone: 'ok' as Tone, filter: 'completed' as TaskFilter },
  {
    key: 'resolved',
    label: 'Resolvidas à mão',
    value: c.resolved,
    tone: 'ok' as Tone,
    filter: 'completed' as TaskFilter,
    color: RESOLVED_COLOR,
  },
  {
    key: 'curation',
    label: 'Aguardam curadoria',
    value: c.waitingCuration,
    tone: 'warn' as Tone,
    filter: 'attention' as TaskFilter,
  },
  { key: 'failed', label: 'Falharam', value: c.failed, tone: 'err' as Tone, filter: 'attention' as TaskFilter },
  { key: 'running', label: 'Rodando', value: c.running, tone: 'info' as Tone, filter: 'queue' as TaskFilter },
  { key: 'pending', label: 'Na fila', value: c.pending, tone: 'neutral' as Tone, filter: 'queue' as TaskFilter },
]

/** Barra empilhada das tarefas por status; `compact` sem a legenda. */
export function TaskBar({ counts: c, compact }: { counts: IngestionTaskCounts; compact?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden rounded-chip bg-raised ${compact ? 'h-1.5' : 'h-2'}`}>
      {segmentsOf(c).map(
        (s) =>
          s.value > 0 &&
          s.key !== 'pending' && (
            <div
              key={s.key}
              className="h-full transition-[width] duration-300"
              style={{ width: `${(s.value / c.total) * 100}%`, background: s.color ?? toneColor(s.tone) }}
            />
          ),
      )}
    </div>
  )
}

/** Atualiza a cada segundo enquanto a ingestão roda, para a duração andar. */
function useTick(on: boolean) {
  const [, tick] = useState(0)
  useEffect(() => {
    if (!on) return
    const id = setInterval(() => tick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [on])
}

/**
 * Andamento de uma ingestão: status, horários, barra das tarefas com legenda e a tarefa em
 * execução. `onPickFilter` torna a legenda clicável; `onOpenTask` a linha da tarefa atual.
 */
export function IngestionHeader({
  ingestion,
  live,
  actions,
  onPickFilter,
  onOpenTask,
}: {
  ingestion: IngestionSummary
  live?: { status: SseStatus; lastEventAt: Date | null }
  actions?: React.ReactNode
  onPickFilter?: (f: TaskFilter) => void
  onOpenTask?: (task: IngestionTaskSummary) => void
}) {
  const c = ingestion.taskCounts
  const status = INGESTION_STATUS[ingestion.status]
  useTick(!isFinished(ingestion.status))
  const done = c.completed + c.resolved + c.waitingCuration + c.failed
  const current = ingestion.currentTask

  return (
    <div className="flex flex-col gap-4 px-5 py-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <h3 className="m-0 text-15 font-semibold">Ingestão #{ingestion.id}</h3>
        <Chip tone={status.tone}>{status.label}</Chip>
        <div className="flex-1" />
        {live && <LiveChip {...live} />}
        {actions}
      </div>

      <div className="flex flex-wrap gap-x-6 gap-y-1 text-13 text-muted">
        <span>Disparada {formatDateTime(ingestion.createdAt)}</span>
        {ingestion.startedAt && <span>Duração {formatElapsed(ingestion.startedAt, ingestion.completedAt)}</span>}
        <span>
          {done.toLocaleString('pt-BR')} de {pluralize(c.total, 'tarefa', 'tarefas')} terminadas
        </span>
      </div>

      {c.total > 0 ? (
        <div className="flex flex-col gap-2">
          <TaskBar counts={c} />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {segmentsOf(c).map((s) => {
              const content = (
                <>
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: s.key === 'pending' ? 'var(--line)' : (s.color ?? toneColor(s.tone)) }}
                  />
                  {s.label} <b className="font-semibold text-text">{s.value.toLocaleString('pt-BR')}</b>
                </>
              )
              return onPickFilter ? (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onPickFilter(s.filter)}
                  className="flex items-center gap-1.5 text-sm text-muted hover:text-text"
                >
                  {content}
                </button>
              ) : (
                <span key={s.key} className="flex items-center gap-1.5 text-sm text-muted">
                  {content}
                </span>
              )
            })}
          </div>
        </div>
      ) : (
        <span className="text-13 text-muted">
          {ingestion.status === 'PENDING'
            ? 'Cadastrando os vídeos das pastas; as tarefas aparecem assim que forem criadas.'
            : 'Nenhuma pasta com vídeo neste diretório.'}
        </span>
      )}

      {/* Fica visível o tempo todo enquanto roda: entre uma tarefa e a próxima o backend zera a
          tarefa atual por até 1 s, e a linha sumir e voltar a cada pasta fazia o bloco piscar. */}
      {!isFinished(ingestion.status) && c.total > 0 && (
        <button
          type="button"
          onClick={() => current && onOpenTask?.(current)}
          disabled={!current || !onOpenTask}
          className="flex h-9 items-center gap-3 rounded-rs border border-line bg-bg px-3 text-left enabled:hover:bg-hover"
        >
          <span className="h-[7px] w-[7px] animate-pulse-dot rounded-full bg-[var(--info-fg)]" />
          <span className="text-sm text-muted">Agora</span>
          {current ? (
            <>
              <span className="min-w-0 flex-1 truncate text-13 font-medium">{current.folderName}</span>
              {current.currentStep && <span className="text-sm text-muted">{stepInfo(current.currentStep).title}</span>}
            </>
          ) : (
            <span className="min-w-0 flex-1 truncate text-13 text-muted">Indo para a próxima pasta…</span>
          )}
        </button>
      )}
    </div>
  )
}
