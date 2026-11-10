import { createContext, useCallback, useContext, useMemo } from 'react'
import { useQuery, type QueryKey } from '@tanstack/react-query'
import {
  getCurrentIngestion,
  getGetCurrentIngestionQueryKey,
  getGetIngestionTaskQueryKey,
} from '@/api/generated/endpoints/ingestion/ingestion'
import {
  IngestionStreamEventType,
  type IngestionStepExecutionDetail,
  type IngestionStreamEvent,
  type IngestionSummary,
  type IngestionTaskDetail,
  type IngestionTaskSummary,
} from '@/api/generated/model'
import { invalidate, queryClient } from '@/api/query'
import { useEventSource, type SseStatus } from '@/api/sse'
import { isFinished } from './labels'

type Ctx = { status: SseStatus; lastEventAt: Date | null }

const IngestionLiveContext = createContext<Ctx | null>(null)

// Tipada como `QueryKey` porque o dado aqui é `IngestionSummary | null`, não o `void` do `204` gerado.
const currentKey: QueryKey = getGetCurrentIngestionQueryKey()

/** A ingestão em andamento, ou a última; `null` se nunca houve. O stream mantém este cache. */
export function useCurrentIngestion() {
  return useQuery<IngestionSummary | null>({
    queryKey: currentKey,
    // `204` vira `undefined` no `http`, e o React Query não aceita `undefined` como dado.
    queryFn: async ({ signal }) => (await getCurrentIngestion({ signal })) ?? null,
    staleTime: Infinity,
  })
}

/** Recarrega o histórico (`GET /v1/ingestion`) e as ingestões abertas por id, sem tocar na atual. */
export const invalidateHistory = () => queryClient.invalidateQueries({ predicate: (q) => q.queryKey[0] === '/v1/ingestion' })

const upsert = <T extends { id: number }>(list: T[], item: T) => {
  const i = list.findIndex((x) => x.id === item.id)
  if (i < 0) return [...list, item]
  const next = [...list]
  next[i] = item
  return next
}

/**
 * Recarrega a ingestão atual pelo REST, sem cancelar uma recarga em andamento. O stream não
 * avisa quando as tarefas de uma ingestão nova são criadas, só quando cada uma começa.
 */
const reloadCurrent = () => queryClient.refetchQueries({ queryKey: currentKey }, { cancelRefetch: false })

function applyIngestion(ingestion: IngestionSummary) {
  const old = queryClient.getQueryData<IngestionSummary | null>(currentKey)
  if (!old || old.id !== ingestion.id || ingestion.taskCounts.total > old.tasks.length) {
    // Ingestão nova, ou tarefas que ainda não chegaram: o `INGESTION_UPDATED` vem sem tarefas.
    const next: IngestionSummary = { ...ingestion, tasks: old?.id === ingestion.id ? old.tasks : [] }
    queryClient.setQueryData<IngestionSummary | null>(currentKey, next)
    void reloadCurrent()
  } else {
    const next: IngestionSummary = { ...ingestion, tasks: old.tasks }
    queryClient.setQueryData<IngestionSummary | null>(currentKey, next)
  }
  if (!old || old.id !== ingestion.id) void invalidateHistory()
  if (isFinished(ingestion.status) && (!old || !isFinished(old.status))) {
    void invalidate.catalog()
    void invalidate.anime()
    void invalidateHistory()
  }
}

/** Aplica uma tarefa atualizada no cache da ingestão atual e no detalhe dela (stream ou resposta de uma ação). */
export function applyTask(task: IngestionTaskSummary, execution?: IngestionStepExecutionDetail | null) {
  queryClient.setQueryData<IngestionSummary | null>(currentKey, (old) => {
    if (!old || old.id !== task.ingestionId) return old
    return {
      ...old,
      tasks: upsert(old.tasks, task),
      currentTask: task.status === 'RUNNING' ? task : old.currentTask?.id === task.id ? null : old.currentTask,
    }
  })
  queryClient.setQueryData<IngestionTaskDetail>(getGetIngestionTaskQueryKey(task.id), (old) =>
    old ? { ...old, ...task, executions: execution ? upsert(old.executions, execution) : old.executions } : old,
  )
}

export function IngestionLiveProvider({ children }: { children: React.ReactNode }) {
  const onMessage = useCallback((e: IngestionStreamEvent) => {
    switch (e.type) {
      case 'SNAPSHOT':
        queryClient.setQueryData<IngestionSummary | null>(currentKey, e.ingestion ?? null)
        break
      case 'INGESTION_UPDATED':
        if (e.ingestion) applyIngestion(e.ingestion)
        break
      case 'TASK_UPDATED':
      case 'STEP_FINISHED':
        if (e.task) applyTask(e.task, e.execution)
        break
    }
  }, [])

  // O `SNAPSHOT` de cada (re)conexão já traz o estado inteiro; não precisa reconciliar pelo REST.
  const { status, lastEventAt } = useEventSource<IngestionStreamEvent>('/v1/ingestion/events', {
    events: Object.values(IngestionStreamEventType),
    onMessage,
  })

  const value = useMemo(() => ({ status, lastEventAt }), [status, lastEventAt])
  return <IngestionLiveContext.Provider value={value}>{children}</IngestionLiveContext.Provider>
}

export function useIngestionLive() {
  const ctx = useContext(IngestionLiveContext)
  if (!ctx) throw new Error('useIngestionLive fora do IngestionLiveProvider')
  return ctx
}
