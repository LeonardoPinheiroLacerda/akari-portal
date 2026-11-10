import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  getGetIngestionTaskQueryKey,
  listIngestions,
  useResolveIngestionTask,
} from '@/api/generated/endpoints/ingestion/ingestion'
import { toastError } from '@/api/errors'
import { queryClient } from '@/api/query'
import type { IngestionSummary } from '@/api/generated/model'
import { applyTask, invalidateHistory, useCurrentIngestion } from './IngestionLiveProvider'

/**
 * Página do histórico. Pequena porque cada ingestão vem com todas as tarefas dela, que podem ser
 * centenas.
 */
export const HISTORY_PAGE_SIZE = 5

/**
 * Uma ingestão pelo id. A atual vem do cache mantido pelo stream (ao vivo); as demais são
 * procuradas página a página no histórico, porque o contrato não tem `GET /v1/ingestion/{id}`.
 * `null` se nenhuma página tem o id.
 */
export function useIngestionById(id: number) {
  const current = useCurrentIngestion()
  const isCurrent = current.data?.id === id
  const past = useQuery<IngestionSummary | null>({
    queryKey: ['/v1/ingestion', 'by-id', id],
    enabled: current.isSuccess && !isCurrent,
    queryFn: async ({ signal }) => {
      for (let page = 0; ; page++) {
        const res = await listIngestions({ page, size: HISTORY_PAGE_SIZE }, { signal })
        const found = res.data.find((i) => i.id === id)
        if (found) return found
        // Mais nova primeiro: passou do id, ou acabaram as páginas.
        if (page + 1 >= res.totalPages || res.data.some((i) => i.id < id)) return null
      }
    },
  })
  if (isCurrent)
    return { data: current.data, isLoading: false, isError: false, error: null, refetch: current.refetch, live: true }
  return {
    data: past.data,
    isLoading: current.isLoading || past.isLoading,
    isError: current.isError || past.isError,
    error: current.error ?? past.error,
    refetch: past.refetch,
    live: false,
  }
}

/**
 * Marca como resolvida à mão uma tarefa em `WAITING_CURATION` (`RESOLVED`). Aplica a resposta na
 * hora, sem esperar o stream, e recarrega o histórico, que guarda as contagens de cada ingestão.
 */
export function useResolveTask() {
  return useResolveIngestionTask({
    mutation: {
      onSuccess: (detail) => {
        const { executions, ...task } = detail
        applyTask(task)
        queryClient.setQueryData(getGetIngestionTaskQueryKey(detail.id), { ...detail, executions })
        void invalidateHistory()
        toast.success('Tarefa marcada como resolvida', { description: detail.folderName })
      },
      onError: (e) => toastError(e, 'Não foi possível marcar como resolvida'),
    },
  })
}
