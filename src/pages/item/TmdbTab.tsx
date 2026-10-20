import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { bindTmdb, clearTmdbBinding } from '@/api/generated/endpoints/anime-tmdb/anime-tmdb'
import { useSearchTmdbMovie, useSearchTmdbTv } from '@/api/generated/endpoints/tmdb-search/tmdb-search'
import type { TmdbMediaType } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { SearchInput } from '@/components/ui/input'
import { ExternalLink, KeyValue, Pagination } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { Section } from '@/components/ui/section'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { TMDB_LOCALES } from '@/features/item/labels'
import type { ItemState } from '@/features/item/useItem'
import { useSetting } from '@/features/settings/useSetting'
import { formatDate, formatDateTime } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'
import type { ItemTab } from './ItemPage'

const OVERRIDE_KEYS = ['title', 'synopsis', 'posterPath', 'backdropPath', 'logoPath'] as const

async function refreshAfterTmdbChange(anilistId: number) {
  await Promise.all([invalidate.tmdb(anilistId), invalidate.catalog(), invalidate.anime(anilistId), invalidate.videoFiles()])
}

export function TmdbTab({ item, onGo }: { item: ItemState; onGo: (t: ItemTab) => void }) {
  const { tmdb, anime, folder } = item
  const anilistId = item.anilistId!
  const [searchOpen, setSearchOpen] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const b = tmdb.data

  if (tmdb.isLoading) return <Loading />
  if (tmdb.isError && !item.tmdbMissing) return <ErrorState error={tmdb.error} onRetry={() => tmdb.refetch()} />

  const ovCount = OVERRIDE_KEYS.filter((k) => b?.overrides?.[k] != null).length

  const remove = async () => {
    setRemoving(true)
    try {
      await clearTmdbBinding(anilistId)
      await refreshAfterTmdbChange(anilistId)
      toast.success('Vínculo TMDB removido')
      setConfirmRemove(false)
    } catch (e) {
      toastError(e)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <>
      {b?.tmdbId != null ? (
        <Section
          title="Vínculo TMDB"
          actions={
            <>
              <Button size="sm" icon="swap_horiz" onClick={() => setSearchOpen((v) => !v)}>
                Trocar vínculo
              </Button>
              <Button size="sm" className="text-danger" onClick={() => setConfirmRemove(true)}>
                Remover vínculo
              </Button>
            </>
          }
          footer={
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="min-w-[220px] flex-1">
                {ovCount} de 5 campos com override. Banner e logo do anime vêm deste vínculo.
              </span>
              <Button variant="link" size="xs" onClick={() => onGo('overrides')}>
                Abrir overrides
              </Button>
              {b.mediaType === 'TV' && (
                <Button variant="link" size="xs" onClick={() => onGo('pareamento')}>
                  Abrir pareamento
                </Button>
              )}
            </div>
          }
        >
          {confirmRemove && (
            <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[color-mix(in_oklch,var(--danger)_10%,transparent)] px-5 py-3 text-13">
              <Icon name="link_off" size={20} className="text-danger" />
              <span className="min-w-[220px] flex-1">
                Remover o vínculo apaga também os {ovCount} overrides. O pareamento dos arquivos continua salvo.
              </span>
              <Button size="sm" onClick={() => setConfirmRemove(false)}>
                Cancelar
              </Button>
              <Button size="sm" variant="danger-solid" loading={removing} onClick={remove}>
                Remover vínculo
              </Button>
            </div>
          )}
          <div className="flex flex-wrap gap-5 px-5 py-[18px]">
            <Thumb
              src={b.overrides?.posterPreviewUrl ?? anime.data?.thumbnails?.large}
              width={92}
              rounded="rs"
              className="border border-line"
            />
            <div className="flex min-w-[260px] flex-1 flex-col">
              <KeyValue
                labelWidth={140}
                rows={[
                  {
                    label: 'tmdbId',
                    mono: true,
                    value: (
                      <ExternalLink href={`https://www.themoviedb.org/${b.mediaType === 'TV' ? 'tv' : 'movie'}/${b.tmdbId}`}>
                        {b.tmdbId}
                      </ExternalLink>
                    ),
                  },
                  { label: 'Tipo', value: b.mediaType === 'TV' ? 'TV · Série' : 'MOVIE · Filme', mono: true },
                  { label: 'Título', value: b.overrides?.title ?? anime.data?.titles?.main },
                  { label: 'Vinculado em', value: formatDateTime(b.createdAt), mono: true },
                ]}
              />
            </div>
          </div>
        </Section>
      ) : (
        <div className="flex items-center gap-3 rounded-r border border-dashed border-line px-5 py-4 text-13 text-muted">
          <Icon name="link_off" size={20} />
          <span className="flex-1">
            Sem vínculo TMDB. Overrides e pareamento de episódios ficam indisponíveis até vincular uma série ou filme.
          </span>
        </div>
      )}

      {(b?.tmdbId == null || searchOpen) && (
        <TmdbSearch
          anilistId={anilistId}
          current={b?.tmdbId != null ? { tmdbId: b.tmdbId, mediaType: b.mediaType! } : null}
          initialQuery={anime.data?.titles?.english ?? anime.data?.titles?.main ?? folder.data?.name ?? ''}
          initialType={folder.data?.mediaType === 'MOVIE' || anime.data?.format === 'MOVIE' ? 'MOVIE' : 'TV'}
          onClose={b?.tmdbId != null ? () => setSearchOpen(false) : undefined}
          onBound={() => setSearchOpen(false)}
        />
      )}
    </>
  )
}

function TmdbSearch({
  anilistId,
  current,
  initialQuery,
  initialType,
  onClose,
  onBound,
}: {
  anilistId: number
  current: { tmdbId: number; mediaType: TmdbMediaType } | null
  initialQuery: string
  initialType: TmdbMediaType
  onClose?: () => void
  onBound: () => void
}) {
  const { setting: langSetting } = useSetting('tmdb.default-language')
  const [type, setType] = useState<TmdbMediaType>(initialType)
  const [lang, setLang] = useState('')
  const [q, setQ] = useState(initialQuery)
  const [page, setPage] = useState(0)
  const [pending, setPending] = useState<number | null>(null)
  const query = useDebounced(q.trim(), 400)

  useEffect(() => {
    if (!lang && langSetting?.value) setLang(langSetting.value)
  }, [lang, langSetting])

  const params = { q: query, page, ...(lang && { language: lang }) }
  const opts = { query: { enabled: query.length > 0, placeholderData: <T,>(p: T) => p } }
  const tv = useSearchTmdbTv(params, { query: { ...opts.query, enabled: opts.query.enabled && type === 'TV' } })
  const movie = useSearchTmdbMovie(params, { query: { ...opts.query, enabled: opts.query.enabled && type === 'MOVIE' } })
  const search = type === 'TV' ? tv : movie

  const rows =
    type === 'TV'
      ? (tv.data?.data ?? []).map((r) => ({
          id: r.tmdbId,
          title: r.name,
          alt: r.originalName,
          date: r.firstAirDate,
          country: r.originCountry?.join(', '),
          poster: r.posterUrl,
          overview: r.overview,
          va: r.voteAverage,
          vc: r.voteCount,
          pop: r.popularity,
        }))
      : (movie.data?.data ?? []).map((r) => ({
          id: r.tmdbId,
          title: r.title,
          alt: r.originalTitle,
          date: r.releaseDate,
          country: r.originalLanguage,
          poster: r.posterUrl,
          overview: r.overview,
          va: r.voteAverage,
          vc: r.voteCount,
          pop: r.popularity,
        }))

  const pick = async (tmdbId: number, name?: string | null) => {
    setPending(tmdbId)
    try {
      // O backend recusa um segundo vínculo: para trocar, remove o atual antes.
      if (current) await clearTmdbBinding(anilistId)
      await bindTmdb(anilistId, { tmdbId, mediaType: type })
      await refreshAfterTmdbChange(anilistId)
      toast.success(`Vinculado ao TMDB: ${name ?? tmdbId}`)
      onBound()
    } catch (e) {
      toastError(e, 'Não foi possível vincular ao TMDB')
      await refreshAfterTmdbChange(anilistId)
    } finally {
      setPending(null)
    }
  }

  const fmt = (n?: number | null) => (n == null ? null : n.toLocaleString('pt-BR', { maximumFractionDigits: 1 }))

  return (
    <Section
      className="border-accent"
      title={current ? 'Trocar vínculo TMDB' : 'Vincular ao TMDB'}
      actions={
        onClose && (
          <Button size="sm" icon="close" onClick={onClose}>
            Fechar
          </Button>
        )
      }
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
        <Segmented
          size="md"
          aria-label="Tipo"
          value={type}
          onChange={(v) => {
            setType(v)
            setPage(0)
          }}
          options={[
            { value: 'TV', label: <span className="font-mono">TV</span> },
            { value: 'MOVIE', label: <span className="font-mono">MOVIE</span> },
          ]}
        />
        <div className="w-[200px]">
          <Select
            aria-label="Idioma"
            value={lang}
            onChange={(v) => {
              setLang(v)
              setPage(0)
            }}
            placeholder="Idioma"
            options={TMDB_LOCALES.map(([value, label]) => ({ value, label: `${value} · ${label}` }))}
          />
        </div>
        <SearchInput
          height={36}
          containerClassName="min-w-[220px] flex-1"
          placeholder={type === 'TV' ? 'Buscar série no TMDB' : 'Buscar filme no TMDB'}
          value={q}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>
      {!query && <div className="px-5 py-5 text-13 text-muted">Digite um nome para buscar.</div>}
      {search.isLoading && <Loading label="Buscando no TMDB…" />}
      {search.isError && <ErrorState error={search.error} onRetry={() => search.refetch()} />}
      {search.data && rows.length === 0 && <div className="px-5 py-5 text-13 text-muted">Nenhum resultado para “{query}”.</div>}
      {rows.map((r) => {
        const isCurrent = current?.tmdbId === r.id && current.mediaType === type
        const meta = [
          `${type === 'TV' ? 'tv' : 'movie'}/${r.id}`,
          r.date && formatDate(r.date),
          r.country,
          r.va ? `★ ${fmt(r.va)} (${r.vc ?? 0})` : 'sem nota',
          r.pop != null && `pop. ${fmt(r.pop)}`,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={r.id} className={cn('flex gap-3.5 border-b border-line px-5 py-3', isCurrent && 'bg-tint')}>
            <Thumb src={r.poster} width={52} />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{r.title ?? '—'}</span>
                {r.alt && r.alt !== r.title && <span className="text-sm text-muted">{r.alt}</span>}
              </div>
              <span className="font-mono text-xs text-muted">{meta}</span>
              {r.overview && <span className="line-clamp-2 text-sm leading-[1.45] text-muted">{r.overview}</span>}
            </div>
            <div className="flex items-center">
              {isCurrent ? (
                <Chip tone="ok">Vinculado</Chip>
              ) : (
                <Button
                  size="sm"
                  className="border-accent"
                  loading={pending === r.id}
                  disabled={pending != null}
                  onClick={() => pick(r.id, r.title)}
                >
                  Vincular
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {search.data && search.data.totalPages > 1 && (
        <Pagination page={page} totalPages={search.data.totalPages} size={20} onPage={setPage} />
      )}
      {current && (
        <div className="bg-[var(--warn-bg)] px-5 py-2.5 text-sm text-[var(--warn-fg)]">
          Trocar o vínculo remove os overrides atuais (caem em cascata).
        </div>
      )}
    </Section>
  )
}
