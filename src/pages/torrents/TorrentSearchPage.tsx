import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSearchAnilistMedia } from '@/api/generated/endpoints/anilist-search/anilist-search'
import { useSearchTorrentReleases } from '@/api/generated/endpoints/torrent-search/torrent-search'
import { useListTrackedAnimes, useTrackAnime } from '@/api/generated/endpoints/torrent-tracking/torrent-tracking'
import { TorrentProviderType, type AnilistMediaSummary, type TorrentEdition, type TorrentTrackType } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Input, SearchInput } from '@/components/ui/input'
import { Pagination } from '@/components/ui/misc'
import { Section } from '@/components/ui/section'
import { Select } from '@/components/ui/select'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { AUDIO_TYPE_LABEL, editionName, SOURCE, SUBTITLE_TYPE_LABEL } from '@/features/torrents/labels'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'
import { EditionReleases } from './EditionReleases'

const PROVIDER_LABEL: Record<TorrentProviderType, string> = { NYAA: 'Nyaa' }

const animeTitle = (a: AnilistMediaSummary) => a.title?.userPreferred ?? a.title?.romaji ?? `AniList ${a.anilistId}`

const NO_GROUP = 'Sem grupo'

/** Valor dos filtros de áudio e legenda para "um idioma só": o título não indica multi nem dual. */
const SINGLE = 'SINGLE'

type EditionFilters = { group: string; resolution: string; video: string; audio: string; subtitle: string }

const NO_FILTERS: EditionFilters = { group: '', resolution: '', video: '', audio: '', subtitle: '' }

const matchesTrack = (value: TorrentTrackType | null | undefined, filter: string) =>
  !filter || (filter === SINGLE ? value == null : value === filter)

function matchesFilters(e: TorrentEdition, f: EditionFilters, term: string) {
  return (
    (!term || editionName(e.group, e.label).toLowerCase().includes(term)) &&
    (!f.group || (e.group ?? NO_GROUP) === f.group) &&
    (!f.resolution || e.resolution === f.resolution) &&
    (!f.video || e.videoCodec === f.video) &&
    matchesTrack(e.audioType, f.audio) &&
    matchesTrack(e.subtitleType, f.subtitle)
  )
}

/** Opções de um filtro: "todos" mais os valores distintos que aparecem nas edições, em ordem. */
function optionsOf(editions: TorrentEdition[], pick: (e: TorrentEdition) => string | null | undefined, all: string) {
  const values = [...new Set(editions.map(pick).filter((v): v is string => !!v))].sort()
  return [{ value: '', label: all }, ...values.map((v) => ({ value: v, label: v }))]
}

const trackOptions = (all: string, labels: Record<TorrentTrackType, string>, single: string) => [
  { value: '', label: all },
  { value: 'MULTI', label: labels.MULTI },
  { value: 'DUAL', label: labels.DUAL },
  { value: SINGLE, label: single },
]

export function TorrentSearchPage() {
  usePageMeta('Buscar torrent')
  const [anime, setAnime] = useState<AnilistMediaSummary | null>(null)

  if (!anime) return <AnimePicker onPick={setAnime} />
  return <ReleaseSearch anime={anime} onChangeAnime={() => setAnime(null)} />
}

function AnimePicker({ onPick }: { onPick: (anime: AnilistMediaSummary) => void }) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const query = useDebounced(q.trim(), 400)
  const search = useSearchAnilistMedia(
    { q: query, page, size: 8 },
    { query: { enabled: query.length > 0, placeholderData: (p) => p } },
  )

  return (
    <Section title="Escolha o anime" subtitle="Os episódios baixados vão para a pasta dele na biblioteca.">
      <div className="border-b border-line px-5 py-3">
        <SearchInput
          height={36}
          value={q}
          autoFocus
          placeholder="Buscar anime na AniList"
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>
      {!query && <div className="px-5 py-5 text-13 text-muted">Digite o nome do anime para buscar.</div>}
      {search.isLoading && <Loading label="Buscando na AniList…" />}
      {search.isError && <ErrorState error={search.error} onRetry={() => search.refetch()} />}
      {search.data && search.data.data.length === 0 && (
        <div className="px-5 py-5 text-13 text-muted">Nenhum anime encontrado para “{query}”.</div>
      )}
      {search.data?.data.map((r) => {
        const meta = [
          r.format,
          r.season && r.seasonYear ? `${r.season} ${r.seasonYear}` : r.seasonYear,
          r.episodes != null && `${r.episodes} eps`,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={r.anilistId} className="flex items-center gap-3.5 border-b border-line px-5 py-3 last:border-b-0">
            <Thumb src={r.coverImage?.medium ?? r.coverImage?.large} width={44} />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <span className="font-semibold">{animeTitle(r)}</span>
              <span className="font-mono text-xs text-muted">{meta}</span>
            </div>
            <Button size="sm" onClick={() => onPick(r)}>
              Escolher
            </Button>
          </div>
        )
      })}
      {search.data && search.data.totalPages > 1 && (
        <Pagination page={page} totalPages={search.data.totalPages} size={8} onPage={setPage} className="border-t border-line" />
      )}
    </Section>
  )
}

function ReleaseSearch({ anime, onChangeAnime }: { anime: AnilistMediaSummary; onChangeAnime: () => void }) {
  const navigate = useNavigate()
  // O título romaji é o que os grupos de fansub usam no nome das releases.
  const initialQuery = anime.title?.romaji ?? animeTitle(anime)
  const [provider, setProvider] = useState<TorrentProviderType>('NYAA')
  const [draft, setDraft] = useState(initialQuery)
  const [query, setQuery] = useState(initialQuery)
  const [filter, setFilter] = useState('')
  const [filters, setFilters] = useState(NO_FILTERS)
  const [open, setOpen] = useState<string | null>(null)

  const search = useSearchTorrentReleases({ provider, q: query }, { query: { enabled: query.length > 0, staleTime: 5 * 60_000 } })
  const tracked = useListTrackedAnimes()
  const trackedHere = tracked.data?.find((t) => t.anilistId === anime.anilistId)
  const track = useTrackAnime()

  const startTracking = (edition: TorrentEdition) =>
    track.mutate(
      { data: { anilistId: anime.anilistId, provider, query, editionKey: edition.key } },
      {
        onSuccess: async () => {
          await invalidate.torrents()
          toast.success(`${animeTitle(anime)} rastreado`, {
            description: 'Os episódios novos desta edição serão baixados sozinhos.',
          })
          navigate('/torrents')
        },
        onError: (e) => toastError(e, 'Não foi possível rastrear o anime'),
      },
    )

  const allEditions = search.data?.editions ?? []
  const term = filter.trim().toLowerCase()
  const editions = allEditions.filter((e) => matchesFilters(e, filters, term))
  const filtering = !!term || Object.values(filters).some(Boolean)
  const setFilterValue = (key: keyof EditionFilters) => (value: string) => setFilters({ ...filters, [key]: value })

  return (
    <>
      <Section>
        <div className="flex flex-wrap items-center gap-3.5 px-5 py-4">
          <Thumb src={anime.coverImage?.medium ?? anime.coverImage?.large} width={44} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-semibold">{animeTitle(anime)}</span>
            <span className="text-sm text-muted">
              {trackedHere
                ? `Já rastreado na edição ${editionName(trackedHere.editionGroup, trackedHere.editionLabel)}`
                : 'Não rastreado'}
            </span>
          </div>
          <Button size="sm" icon="swap_horiz" onClick={onChangeAnime}>
            Trocar anime
          </Button>
        </div>
        <form
          className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            setQuery(draft.trim())
            setOpen(null)
            setFilter('')
            setFilters(NO_FILTERS)
          }}
        >
          <Select
            className="w-[140px]"
            value={provider}
            onChange={(v) => setProvider(v as TorrentProviderType)}
            options={Object.values(TorrentProviderType).map((p) => ({ value: p, label: PROVIDER_LABEL[p] }))}
          />
          <Input
            className="min-w-[220px] flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Texto da busca"
          />
          <Button type="submit" variant="primary" icon="search" disabled={!draft.trim()} loading={search.isFetching}>
            Buscar
          </Button>
        </form>
      </Section>

      {search.isLoading && <Loading label="Buscando no provedor… a busca lê todas as páginas e pode levar alguns segundos." />}
      {search.isError && <ErrorState error={search.error} onRetry={() => search.refetch()} />}
      {search.data?.truncated && (
        <div className="rounded-r bg-[var(--warn-bg)] px-5 py-2.5 text-sm text-[var(--warn-fg)]">
          O provedor cortou a busca no limite dele, então as releases mais antigas ficaram de fora. Refine o texto (grupo,
          resolução, temporada) para encontrá-las.
        </div>
      )}
      {search.data && search.data.editions.length === 0 && (
        <EmptyState
          dashed
          icon="search_off"
          title="Nenhuma release encontrada"
          description={`Nada no provedor para “${query}”.`}
        />
      )}

      {search.data && search.data.editions.length > 0 && (
        <Section
          title={
            filtering
              ? `${editions.length} de ${allEditions.length} edições`
              : `${allEditions.length} ${allEditions.length === 1 ? 'edição' : 'edições'}`
          }
          subtitle="Cada edição é um grupo de fansub com a mesma qualidade (resolução, fonte, áudio, codec)."
          actions={
            <SearchInput
              height={36}
              containerClassName="w-[240px]"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filtrar edições"
            />
          }
        >
          <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-3">
            <Select
              size="sm"
              className="w-[170px]"
              aria-label="Grupo"
              value={filters.group}
              onChange={setFilterValue('group')}
              options={optionsOf(allEditions, (e) => e.group ?? NO_GROUP, 'Todos os grupos')}
            />
            <Select
              size="sm"
              className="w-[150px]"
              aria-label="Resolução"
              value={filters.resolution}
              onChange={setFilterValue('resolution')}
              options={optionsOf(allEditions, (e) => e.resolution, 'Toda resolução')}
            />
            <Select
              size="sm"
              className="w-[150px]"
              aria-label="Áudio"
              value={filters.audio}
              onChange={setFilterValue('audio')}
              options={trackOptions('Todo áudio', AUDIO_TYPE_LABEL, 'Um idioma')}
            />
            <Select
              size="sm"
              className="w-[160px]"
              aria-label="Legenda"
              value={filters.subtitle}
              onChange={setFilterValue('subtitle')}
              options={trackOptions('Toda legenda', SUBTITLE_TYPE_LABEL, 'Sem indicação')}
            />
            <Select
              size="sm"
              className="w-[140px]"
              aria-label="Codec de vídeo"
              value={filters.video}
              onChange={setFilterValue('video')}
              options={optionsOf(allEditions, (e) => e.videoCodec, 'Todo codec')}
            />
            {filtering && (
              <Button
                size="sm"
                variant="ghost"
                icon="filter_alt_off"
                onClick={() => {
                  setFilter('')
                  setFilters(NO_FILTERS)
                }}
              >
                Limpar filtros
              </Button>
            )}
          </div>
          {editions.map((edition) => {
            const episodes = edition.releases.filter((r) => r.episode != null).length
            const isOpen = open === edition.key
            const isTrackedEdition = trackedHere?.editionKey === edition.key
            return (
              <div key={edition.key} className="border-b border-line last:border-b-0">
                <div className={cn('flex items-center gap-3 px-5 py-3', isOpen && 'bg-tint')}>
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2.5 text-left"
                    onClick={() => setOpen(isOpen ? null : edition.key)}
                  >
                    <Icon name={isOpen ? 'expand_less' : 'expand_more'} size={20} className="text-muted" />
                    <span className="flex min-w-0 flex-col gap-1">
                      <span className="truncate font-semibold">{editionName(edition.group, edition.label)}</span>
                      <EditionBadges edition={edition} />
                      <span className="text-sm text-muted">
                        {episodes} {episodes === 1 ? 'episódio' : 'episódios'}
                        {edition.releases.length > episodes && ` · ${edition.releases.length - episodes} pacote(s)`}
                      </span>
                    </span>
                  </button>
                  <Button
                    size="sm"
                    icon="radar"
                    disabled={!!trackedHere}
                    loading={track.isPending && track.variables?.data.editionKey === edition.key}
                    onClick={() => startTracking(edition)}
                  >
                    {isTrackedEdition ? 'Rastreada' : 'Rastrear'}
                  </Button>
                </div>
                {isOpen && <EditionReleases releases={edition.releases} provider={provider} anilistId={anime.anilistId} />}
              </div>
            )
          })}
          {editions.length === 0 && <div className="px-5 py-5 text-13 text-muted">Nenhuma edição com esses filtros.</div>}
        </Section>
      )}
    </>
  )
}

/** Badges das características da edição: áudio e legenda em mais de um idioma em destaque, depois as técnicas. */
function EditionBadges({ edition: e }: { edition: TorrentEdition }) {
  const specs = [e.resolution, e.videoCodec, e.bitDepth, e.medium, e.audioCodec].filter((v): v is string => !!v)
  const source = e.source ? SOURCE[e.source] : undefined

  if (!e.audioType && !e.subtitleType && !e.source && !specs.length) return null

  return (
    <span className="flex flex-wrap gap-1.5">
      {e.audioType && (
        <Chip tone="accent" icon="translate">
          {AUDIO_TYPE_LABEL[e.audioType]}
        </Chip>
      )}
      {e.subtitleType && (
        <Chip tone="info" icon="subtitles">
          {SUBTITLE_TYPE_LABEL[e.subtitleType]}
        </Chip>
      )}
      {source && (
        // Fundo e texto saem da cor da marca misturada ao tema, para ficar legível no escuro e no claro.
        <Chip
          title={e.source ?? undefined}
          style={{
            background: `color-mix(in oklch, ${source.color} 22%, transparent)`,
            color: `color-mix(in oklch, ${source.color} 70%, var(--text))`,
          }}
        >
          {source.name}
        </Chip>
      )}
      {e.source && !source && <Chip mono>{e.source}</Chip>}
      {specs.map((spec) => (
        <Chip key={spec} mono>
          {spec}
        </Chip>
      ))}
    </span>
  )
}
