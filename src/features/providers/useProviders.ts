import { useMemo } from 'react'
import { useListStorageProviders } from '@/api/generated/endpoints/storage-provider/storage-provider'
import type { StorageProviderResponse } from '@/api/generated/model'

/** Todos os provedores (a lista é pequena; pede uma página grande). */
export function useProviders() {
  const query = useListStorageProviders({ page: 0, size: 100 })
  const providers = useMemo(() => query.data?.data ?? [], [query.data])
  const byId = useMemo(() => new Map<number, StorageProviderResponse>(providers.map((p) => [p.id, p])), [providers])
  return { ...query, providers, byId }
}
