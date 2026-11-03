import { useGetAnimeFranchise } from '@/api/generated/endpoints/anime-relations/anime-relations'
import type { AnimeResponse } from '@/api/generated/model'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { SEASON_LABEL } from '@/features/item/labels'
import { cn } from '@/lib/utils'

/**
 * Prévia da franquia como os clientes a mostram: temporadas, filmes e especiais lidos prontos do
 * backend (`/franchise`). Só leitura.
 */
export function FranchisePreview({
  anime: a,
  currentId,
  folderOf,
}: {
  anime: AnimeResponse
  /** Obra destacada como "Este anime" (a página de onde se veio), se houver. */
  currentId?: number
  /** Pasta de cada obra, para o cartão abrir o item; sem pasta, o cartão não é clicável. */
  folderOf: (anilistId: number) => number | undefined
}) {
  const franchise = useGetAnimeFranchise(a.anilistId)
  const f = franchise.data

  if (franchise.isLoading) return <Loading />
  if (franchise.isError) return <ErrorState error={franchise.error} onRetry={() => franchise.refetch()} />
  if (!f) return null

  const rootId = f.root.anilistId
  const seasons = f.seasons ?? []
  const listed = [...seasons, ...(f.movies ?? []), ...(f.specials ?? [])]
  const groups = [
    { key: 'seasons', label: 'Temporadas', empty: 'Nenhuma temporada.', items: seasons },
    { key: 'movies', label: 'Filmes', empty: 'Nenhum filme.', items: f.movies ?? [] },
    { key: 'specials', label: 'Especiais', empty: 'Nenhum especial.', items: f.specials ?? [] },
  ]
  // Raiz fora das listas (ex.: não tem formato de série): aparece num grupo próprio, antes das temporadas.
  if (!listed.some((x) => x.anilistId === rootId)) {
    groups.unshift({ key: 'root', label: 'Início da franquia', empty: '', items: [f.root] })
  }

  return (
    <div className="flex flex-col gap-5 px-5 pb-5 pt-4">
      {groups.map((g) => (
        <div key={g.key} className="flex flex-col gap-2.5">
          <span className="group-label">
            {g.label} · {g.items.length}
          </span>
          {g.items.length ? (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(132px,1fr))] gap-x-3.5 gap-y-4">
              {g.items.map((x, i) => (
                <PreviewCard
                  key={x.anilistId}
                  anime={x}
                  kicker={g.key === 'seasons' ? `Temporada ${i + 1}` : undefined}
                  current={x.anilistId === currentId}
                  root={x.anilistId === rootId}
                  folderId={folderOf(x.anilistId)}
                />
              ))}
            </div>
          ) : (
            <span className="text-13 text-muted">{g.empty}</span>
          )}
        </div>
      ))}
    </div>
  )
}

function PreviewCard({
  anime: x,
  kicker,
  current,
  root,
  folderId,
}: {
  anime: AnimeResponse
  kicker?: string
  current: boolean
  root: boolean
  folderId?: number
}) {
  const when = [x.season ? SEASON_LABEL[x.season] : null, x.year].filter(Boolean).join(' ')
  const meta = [x.format, when, x.episodes != null ? `${x.episodes} ep.` : null].filter(Boolean).join(' · ')
  const canOpen = !current && folderId != null
  return (
    <button
      type="button"
      disabled={!canOpen}
      onClick={() => window.open(`/catalogo/${folderId}/anilist`, '_blank', 'noopener')}
      title={x.titles?.main ?? undefined}
      className={cn(
        'flex min-w-0 flex-col gap-2 rounded-rs border-2 p-1.5 text-left transition-colors',
        current ? 'border-accent bg-tint' : canOpen ? 'border-transparent hover:bg-raised' : 'cursor-default border-transparent',
      )}
    >
      <Thumb src={x.thumbnails?.large ?? x.thumbnails?.medium} width="100%" className="border border-line" />
      <div className="flex min-w-0 flex-col gap-0.5">
        {(kicker || root || current) && (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs font-semibold">
            {kicker && <span className="text-muted">{kicker}</span>}
            {root && (
              <span className="flex items-center gap-[3px] text-accent-text">
                <Icon name="flag" size={14} />
                Início
              </span>
            )}
            {current && <span className="text-accent-text">Este anime</span>}
          </div>
        )}
        <span className="line-clamp-2 text-13 font-semibold leading-snug">{x.titles?.main ?? `AniList ${x.anilistId}`}</span>
        {meta && <span className="text-xs text-muted">{meta}</span>}
      </div>
    </button>
  )
}
