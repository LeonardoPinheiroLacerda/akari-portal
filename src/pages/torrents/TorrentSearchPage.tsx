import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSearchAnilistMedia } from '@/api/generated/endpoints/anilist-search/anilist-search'
import { useSearchTorrentReleases } from '@/api/generated/endpoints/torrent-search/torrent-search'
import { useListTrackedAnimes, useTrackAnime } from '@/api/generated/endpoints/torrent-tracking/torrent-tracking'
import {
  TorrentProviderType,
  type AnilistFuzzyDate,
  type AnilistMediaSummary,
  type TorrentEdition,
  type TorrentTrackType,
} from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Input, SearchInput } from '@/components/ui/input'
import { KeyValue, Pagination } from '@/components/ui/misc'
import { Section } from '@/components/ui/section'
import { Select } from '@/components/ui/select'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { SEASON_LABEL } from '@/features/item/labels'
import { AUDIO_TYPE_LABEL, editionName, SOURCE, SUBTITLE_TYPE_LABEL } from '@/features/torrents/labels'
import { useDebounced } from '@/lib/useDebounced'
import { FORMATS, STATUSES } from '@/pages/smart-lists/criteria'
import { formatBytes } from '@/lib/format'

const PROVIDER_LABEL: Record<TorrentProviderType, string> = { NYAA: 'Nyaa' }

const animeTitle = (a: AnilistMediaSummary) => a.title?.userPreferred ?? a.title?.romaji ?? `AniList ${a.anilistId}`

/** Título sem pontuação para a busca padrão: o provedor exige todas as palavras ("Sensou-hen" ≠ "Sensou Hen"). */
const searchableTitle = (title: string) =>
  title
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const FORMAT_LABEL = Object.fromEntries(FORMATS)
const STATUS_LABEL = Object.fromEntries(STATUSES)

/** Data parcial da AniList ("04/2025" quando falta o dia). */
const fuzzyDate = (d: AnilistFuzzyDate | null | undefined) =>
  d?.year
    ? [d.day, d.month, d.year]
        .filter((v) => v != null)
        .map((v) => String(v).padStart(2, '0'))
        .join('/')
    : null

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

const SIZE_UNITS: Record<string, number> = { Bytes: 1, KiB: 1024, MiB: 1024 ** 2, GiB: 1024 ** 3, TiB: 1024 ** 4 }

/** Bytes do tamanho como o provedor exibe ("1.4 GiB"); `null` se o formato não for reconhecido. */
function sizeInBytes(size: string | null | undefined) {
  const match = size?.match(/^([\d.]+)\s*(\w+)$/)
  const unit = match && SIZE_UNITS[match[2]]
  return match && unit ? Number(match[1]) * unit : null
}

const average = (values: number[]) => (values.length ? values.reduce((a, b) => a + b, 0) / values.length : null)

/** Tamanho e seeders médios da edição, sem os pacotes (a não ser que só haja pacotes). */
function editionAverages(e: TorrentEdition) {
  const episodes = e.releases.filter((r) => r.episode != null)
  const releases = episodes.length ? episodes : e.releases
  return {
    size: average(releases.map((r) => sizeInBytes(r.size)).filter((v): v is number => v != null)),
    seeders: average(releases.map((r) => r.seeders).filter((v): v is number => v != null)),
  }
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
  const [provider, setProvider] = useState<TorrentProviderType>('NYAA')
  const [draft, setDraft] = useState('')
  // Os grupos de fansub usam o título romaji ou o inglês no nome das releases.
  const [queries, setQueries] = useState(() => [
    ...new Set(
      [anime.title?.romaji ?? animeTitle(anime), anime.title?.english].filter((t): t is string => !!t).map(searchableTitle),
    ),
  ])
  const [filter, setFilter] = useState('')
  const [filters, setFilters] = useState(NO_FILTERS)

  const search = useSearchTorrentReleases({ provider, q: queries }, { query: { staleTime: 5 * 60_000 } })
  const tracked = useListTrackedAnimes()
  const trackedHere = tracked.data?.find((t) => t.anilistId === anime.anilistId)
  const track = useTrackAnime()

  const startTracking = (edition: TorrentEdition) =>
    track.mutate(
      { data: { anilistId: anime.anilistId, provider, queries, editionKey: edition.key } },
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

  const changeQueries = (next: string[]) => {
    setQueries(next)
    setFilter('')
    setFilters(NO_FILTERS)
  }

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
        <AnimeDetails anime={anime} />
        <form
          className="flex flex-wrap items-center gap-2.5 border-t border-line px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (!queries.includes(draft.trim())) changeQueries([...queries, draft.trim()])
            setDraft('')
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
            placeholder="Outra busca (ex.: Tokyo Revengers S04)"
          />
          <Button type="submit" variant="primary" icon="add" disabled={!draft.trim()} loading={search.isFetching}>
            Adicionar busca
          </Button>
        </form>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3">
          <span className="text-sm text-muted">Buscas:</span>
          {queries.map((q) => (
            <Chip key={q} mono icon="search">
              {q}
              {queries.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remover a busca ${q}`}
                  className="ml-1 align-middle"
                  onClick={() => changeQueries(queries.filter((other) => other !== q))}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </Chip>
          ))}
        </div>
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
          description={`Nada no provedor para ${queries.map((q) => `“${q}”`).join(', ')}.`}
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
            const averages = editionAverages(edition)
            const isTrackedEdition = trackedHere?.editionKey === edition.key
            const firstPageUrl = edition.releases[0]?.pageUrl
            const meta = [
              `${episodes} ${episodes === 1 ? 'episódio' : 'episódios'}`,
              edition.releases.length > episodes && `${edition.releases.length - episodes} pacote(s)`,
              averages.size != null && `média de ${formatBytes(averages.size)} por arquivo`,
              averages.seeders != null && `média de ${Math.round(averages.seeders)} seeders`,
            ]
              .filter(Boolean)
              .join(' · ')
            return (
              <div key={edition.key} className="flex items-center gap-3 border-b border-line px-5 py-3 last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col gap-1">
                  <span className="truncate font-semibold">{editionName(edition.group, edition.label)}</span>
                  <EditionBadges edition={edition} />
                  <span className="text-sm text-muted">{meta}</span>
                </span>
                {firstPageUrl && (
                  <Button asChild size="sm">
                    <a href={firstPageUrl} target="_blank" rel="noopener noreferrer">
                      <Icon name="open_in_new" size={18} />
                      Ver no {PROVIDER_LABEL[provider]}
                    </a>
                  </Button>
                )}
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
            )
          })}
          {editions.length === 0 && <div className="px-5 py-5 text-13 text-muted">Nenhuma edição com esses filtros.</div>}
        </Section>
      )}
    </>
  )
}

/** O que ajuda a montar as buscas e escolher a edição: os nomes do anime, quantos episódios tem e quando passou. */
function AnimeDetails({ anime: a }: { anime: AnilistMediaSummary }) {
  const season = [a.season ? SEASON_LABEL[a.season] : null, a.seasonYear].filter(Boolean).join(' ')
  const aired = [fuzzyDate(a.startDate), fuzzyDate(a.endDate)].filter(Boolean).join(' – ')
  // Os grupos escrevem os nomes em alfabeto latino; sinônimos em outras escritas não servem de busca.
  const synonyms = a.synonyms?.filter((name) => /^[\p{Script=Latin}\p{N}\p{P}\p{S}\s]+$/u.test(name)) ?? []

  return (
    <KeyValue
      className="border-t border-line px-5"
      labelWidth={140}
      rows={[
        { label: 'Romaji', value: a.title?.romaji },
        { label: 'Inglês', value: a.title?.english },
        { label: 'Japonês', value: a.title?.nativeTitle },
        { label: 'Sinônimos', value: synonyms.length ? synonyms.join(', ') : null },
        { label: 'Formato · estação', value: [a.format && FORMAT_LABEL[a.format], season].filter(Boolean).join(' · ') || null },
        { label: 'Status', value: a.status ? (STATUS_LABEL[a.status] ?? a.status) : null },
        { label: 'Episódios', value: a.episodes ?? null, mono: true },
        { label: 'Exibição', value: aired || null, mono: true },
        { label: 'Estúdio', value: a.studio },
      ]}
    />
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
