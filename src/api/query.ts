import { QueryClient, type QueryKey } from '@tanstack/react-query'
import { errorStatus } from './errors'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (count, error) => {
        const status = errorStatus(error)
        if (status && status >= 400 && status < 500) return false
        return count < 2
      },
    },
  },
})

/** As chaves geradas pelo Orval começam pela URL; invalida tudo que começa com algum dos prefixos. */
export function invalidatePrefixes(...prefixes: string[]) {
  return queryClient.invalidateQueries({
    predicate: (q) => {
      const head = (q.queryKey as QueryKey)[0]
      return typeof head === 'string' && prefixes.some((p) => head.startsWith(p))
    },
  })
}

/** Grupos de invalidação usados depois de mutações. */
export const invalidate = {
  catalog: () => invalidatePrefixes('/v1/catalog/'),
  anime: (anilistId?: number) =>
    invalidatePrefixes(
      anilistId != null ? `/v1/metadata/animes/${anilistId}` : '/v1/metadata/animes/',
      '/v1/metadata/folders/',
      '/v1/metadata/anime-relations',
    ),
  tmdb: (anilistId: number) => invalidatePrefixes(`/v1/metadata/animes/${anilistId}/tmdb`),
  videoFiles: () => invalidatePrefixes('/v1/catalog/video-files'),
  providers: () => invalidatePrefixes('/v1/storage/providers'),
  notifications: () => invalidatePrefixes('/v1/notifications'),
  cache: () => invalidatePrefixes('/v1/cache/'),
  settings: () => invalidatePrefixes('/v1/settings'),
}
