import { useGetAnimeByFolder } from '@/api/generated/endpoints/anime/anime'
import { useGetTmdbState } from '@/api/generated/endpoints/anime-tmdb/anime-tmdb'
import { useGetFolder } from '@/api/generated/endpoints/media-folder/media-folder'
import { errorStatus } from '@/api/errors'

/**
 * Estado consolidado do item: pasta → anime (404 = sem vínculo) → TMDB (404 = sem vínculo).
 */
export function useItem(folderId: number) {
  const folder = useGetFolder(folderId)
  const animeQuery = useGetAnimeByFolder(folderId)
  // Depois de um DELETE o refetch dá 404, mas o React Query mantém o dado anterior: o 404 vence.
  const animeMissing = animeQuery.isError && errorStatus(animeQuery.error) === 404
  const anime = { ...animeQuery, data: animeMissing ? undefined : animeQuery.data }
  const anilistId = anime.data?.anilistId

  const tmdbQuery = useGetTmdbState(anilistId ?? 0, { query: { enabled: anilistId != null } })
  const tmdbMissing =
    anilistId == null ||
    (tmdbQuery.isError && errorStatus(tmdbQuery.error) === 404) ||
    (tmdbQuery.data != null && tmdbQuery.data.tmdbId == null)
  const tmdb = { ...tmdbQuery, data: tmdbMissing ? undefined : tmdbQuery.data }

  return {
    folder,
    anime,
    tmdb,
    anilistId,
    hasAnime: anime.data != null,
    animeMissing,
    hasTmdb: tmdb.data?.tmdbId != null,
    tmdbMissing,
    isTv: tmdb.data?.mediaType === 'TV',
  }
}

export type ItemState = ReturnType<typeof useItem>
