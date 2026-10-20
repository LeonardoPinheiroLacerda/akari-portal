import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useGetFolder, useListFolders } from '@/api/generated/endpoints/media-folder/media-folder'
import type { AnimeReviewStatus, ListFoldersParams, MediaFolderResponse, MediaType } from '@/api/generated/model'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { SearchInput } from '@/components/ui/input'
import { Pagination } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import { MEDIA_TYPE_LABEL, REVIEW } from '@/features/item/labels'
import { providerName } from '@/features/providers/types'
import { useProviders } from '@/features/providers/useProviders'
import { formatDate } from '@/lib/format'
import { usePersistentState } from '@/lib/storage'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20
const SORTS = [
  { value: 'name:asc', label: 'Nome (A–Z)' },
  { value: 'name:desc', label: 'Nome (Z–A)' },
  { value: 'createdAt:desc', label: 'Mais recentes' },
  { value: 'createdAt:asc', label: 'Mais antigas' },
]
/** Filtros de opção única (Segmented); o valor vazio é "Todos". */
const SEGMENTED: { key: string; label: string; options: { value: string; label: string }[] }[] = [
  {
    key: 'mediaType',
    label: 'Tipo',
    options: [
      { value: '', label: 'Todos' },
      ...(Object.keys(MEDIA_TYPE_LABEL) as MediaType[]).map((t) => ({ value: t, label: MEDIA_TYPE_LABEL[t] })),
    ],
  },
  {
    key: 'hasFiles',
    label: 'Arquivos',
    options: [
      { value: '', label: 'Todos' },
      { value: 'true', label: 'Com arquivos' },
      { value: 'false', label: 'Sem arquivos' },
    ],
  },
  // Curadoria: filtram pelo anime vinculado; pasta sem vínculo só aparece com "AniList: Sem vínculo".
  {
    key: 'hasAnilist',
    label: 'AniList',
    options: [
      { value: '', label: 'Todos' },
      { value: 'true', label: 'Vinculado' },
      { value: 'false', label: 'Sem vínculo' },
    ],
  },
  {
    key: 'hasTmdb',
    label: 'TMDB',
    options: [
      { value: '', label: 'Todos' },
      { value: 'true', label: 'Vinculado' },
      { value: 'false', label: 'Sem TMDB' },
    ],
  },
  {
    key: 'allEpisodesPaired',
    label: 'Episódios',
    options: [
      { value: '', label: 'Todos' },
      { value: 'true', label: 'Todos pareados' },
      { value: 'false', label: 'Com pendência' },
    ],
  },
]
const reviewOptions = [
  { value: '', label: 'Todos' },
  ...(Object.keys(REVIEW) as AnimeReviewStatus[]).map((k) => ({ value: k, label: REVIEW[k].label })),
]

const COLS = 'grid-cols-[48px_minmax(200px,1.4fr)_80px_minmax(200px,1.5fr)_100px_120px_96px_40px]'

export function CatalogPage() {
  usePageMeta('Catálogo')
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const { providers, byId } = useProviders()

  const name = sp.get('name') ?? ''
  const sort = sp.get('sort') ?? 'name:asc'
  const mediaType = (sp.get('mediaType') ?? '') as MediaType | ''
  const hasFiles = sp.get('hasFiles') ?? ''
  const providerId = sp.get('storageProviderId') ?? ''
  const parentId = sp.get('parentId') ?? ''
  const reviewStatus = (sp.get('reviewStatus') ?? '') as AnimeReviewStatus | ''
  const hasAnilist = sp.get('hasAnilist') ?? ''
  const hasTmdb = sp.get('hasTmdb') ?? ''
  const allEpisodesPaired = sp.get('allEpisodesPaired') ?? ''
  const page = Number(sp.get('page') ?? 0)

  const [q, setQ] = useState(name)
  const debounced = useDebounced(q)
  useEffect(() => setQ(name), [name])

  const update = (patch: Record<string, string>, resetPage = true) => {
    const next = new URLSearchParams(sp)
    for (const [k, v] of Object.entries(patch)) {
      if (v) next.set(k, v)
      else next.delete(k)
    }
    if (resetPage) next.delete('page')
    setSp(next, { replace: true })
  }

  useEffect(() => {
    if (debounced !== name) update({ name: debounced.trim() })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])

  const params: ListFoldersParams = {
    page,
    size: PAGE_SIZE,
    sort: [sort],
    ...(name && { name }),
    ...(mediaType && { mediaType }),
    ...(hasFiles && { hasFiles: hasFiles === 'true' }),
    ...(providerId && { storageProviderId: Number(providerId) }),
    ...(parentId && { parentId: Number(parentId) }),
    ...(reviewStatus && { reviewStatus }),
    ...(hasAnilist && { hasAnilist: hasAnilist === 'true' }),
    ...(hasTmdb && { hasTmdb: hasTmdb === 'true' }),
    ...(allEpisodesPaired && { allEpisodesPaired: allEpisodesPaired === 'true' }),
  }
  const query = useListFolders(params, { query: { placeholderData: (prev) => prev } })
  const parent = useGetFolder(Number(parentId), { query: { enabled: !!parentId } })

  const [filtersOpen, setFiltersOpen] = usePersistentState('akari.catalog.filtersOpen', false)
  const providerOptions = [
    { value: '', label: 'Todos' },
    ...providers.map((p) => ({ value: String(p.id), label: providerName(p) })),
  ]
  // Filtros ativos, exibidos como chips removíveis (inclusive com o painel recolhido).
  const labelOf = (options: { value: string; label: string }[], v: string) => options.find((o) => o.value === v)?.label ?? v
  const active = [
    ...SEGMENTED.filter((f) => sp.get(f.key)).map((f) => ({
      key: f.key,
      label: f.label,
      value: labelOf(f.options, sp.get(f.key)!),
    })),
    ...(reviewStatus ? [{ key: 'reviewStatus', label: 'Revisão', value: labelOf(reviewOptions, reviewStatus) }] : []),
    ...(providerId ? [{ key: 'storageProviderId', label: 'Provedor', value: labelOf(providerOptions, providerId) }] : []),
  ]
  const hasFilters = !!(
    name ||
    mediaType ||
    hasFiles ||
    providerId ||
    parentId ||
    reviewStatus ||
    hasAnilist ||
    hasTmdb ||
    allEpisodesPaired
  )
  const rows = query.data?.data ?? []

  // Sem anime vinculado, a aba AniList do item oferece "Vincular anime".
  const openRow = (f: MediaFolderResponse) => navigate(`/catalogo/${f.id}/anilist`)

  return (
    <>
      <section className="card">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3">
          <SearchInput
            containerClassName="min-w-[240px] flex-1"
            placeholder="Buscar pelo nome da pasta"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
          <Button
            icon="tune"
            iconSize={18}
            aria-expanded={filtersOpen}
            className={cn(filtersOpen && 'border-accent bg-tint')}
            onClick={() => setFiltersOpen((v) => !v)}
          >
            Filtros
            {active.length > 0 && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-accent px-1.5 text-xs font-bold text-accent-ink">
                {active.length}
              </span>
            )}
            <Icon name={filtersOpen ? 'expand_less' : 'expand_more'} size={18} className="text-muted" />
          </Button>
          <div className="flex items-center gap-2">
            <Icon name="sort" size={18} className="text-muted" />
            <div className="w-[170px]">
              <Select
                value={sort}
                onChange={(v) => update({ sort: v === 'name:asc' ? '' : v })}
                options={SORTS}
                aria-label="Ordenação"
              />
            </div>
          </div>
        </div>

        {filtersOpen && (
          <div className="grid gap-x-5 gap-y-3 border-t border-line px-3.5 py-3 [grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr))]">
            {SEGMENTED.map((f) => (
              <div key={f.key} className="flex items-center gap-2">
                <span className="w-[68px] shrink-0 text-sm text-muted">{f.label}</span>
                <Segmented
                  aria-label={f.label}
                  value={sp.get(f.key) ?? ''}
                  onChange={(v) => update({ [f.key]: v })}
                  options={f.options}
                />
              </div>
            ))}
            <div className="flex items-center gap-2">
              <span className="w-[68px] shrink-0 text-sm text-muted">Revisão</span>
              <div className="w-[200px]">
                <Select
                  size="sm"
                  aria-label="Revisão"
                  value={reviewStatus}
                  onChange={(v) => update({ reviewStatus: v })}
                  options={reviewOptions}
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-[68px] shrink-0 text-sm text-muted">Provedor</span>
              <div className="w-[200px]">
                <Select
                  size="sm"
                  aria-label="Provedor"
                  value={providerId}
                  onChange={(v) => update({ storageProviderId: v })}
                  options={providerOptions}
                />
              </div>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2">
          {active.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => update({ [f.key]: '' })}
              aria-label={`Remover filtro ${f.label}: ${f.value}`}
              className="flex h-[26px] items-center gap-1 rounded-chip border border-line bg-raised pl-2.5 pr-1.5 text-sm hover:border-muted"
            >
              <span className="text-muted">{f.label}:</span> {f.value}
              <Icon name="close" size={14} className="text-muted" />
            </button>
          ))}
          {active.length === 0 && <span className="text-sm text-muted">Sem filtros</span>}
          <div className="flex-1" />
          <span className="text-sm text-muted">
            {query.data ? `${query.data.totalElements.toLocaleString('pt-BR')} pastas` : '…'}
          </span>
          {hasFilters && (
            <Button
              variant="ghost"
              size="xs"
              icon="filter_alt_off"
              iconSize={16}
              className="text-accent-text hover:bg-transparent"
              onClick={() => {
                setQ('')
                setSp(sort !== 'name:asc' ? { sort } : {}, { replace: true })
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </section>

      {parentId && (
        <div className="flex flex-wrap items-center gap-2 text-13">
          <button
            type="button"
            onClick={() => update({ parentId: '' })}
            className="flex h-[30px] items-center gap-1.5 rounded-chip border border-line bg-panel px-2.5 text-sm hover:bg-raised"
          >
            <Icon name="close" size={16} />
            Pasta pai
          </button>
          <span className="font-mono text-sm text-muted">
            {parent.data
              ? `${byId.get(parent.data.storageProviderId) ? providerName(byId.get(parent.data.storageProviderId)!) : ''} · ${parent.data.path}`
              : `#${parentId}`}
          </span>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="min-w-[940px]">
          <div
            className={`grid ${COLS} items-center gap-3 border-b border-line px-5 py-3 text-xs uppercase tracking-[.06em] text-muted`}
          >
            <span />
            <span>Pasta</span>
            <span>Tipo</span>
            <span>Anime vinculado</span>
            <span>TMDB</span>
            <span>Arquivos</span>
            <span>Criada em</span>
            <span />
          </div>
          {query.isLoading && <Loading />}
          {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
          {query.data && rows.length === 0 && <div className="px-5 py-6 text-muted">Nenhuma pasta com esses filtros.</div>}
          {rows.map((f) => {
            const b = f.animeBinding
            const prov = byId.get(f.storageProviderId)
            return (
              <div
                key={f.id}
                onClick={() => openRow(f)}
                className={`grid ${COLS} cursor-pointer items-center gap-3 border-b border-line px-5 py-2.5 transition-colors hover:bg-hover`}
              >
                {b ? (
                  <Thumb src={b.thumbnail} width={34} ratio="34/48" />
                ) : (
                  <div className="flex h-12 w-[34px] items-center justify-center text-muted">
                    <Icon name="folder" size={18} />
                  </div>
                )}
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{f.name}</span>
                  <span className="truncate font-mono text-xs text-muted">
                    {prov ? providerName(prov) : `Provedor #${f.storageProviderId}`} · {f.path}
                  </span>
                </div>
                <Chip className="justify-self-start">{MEDIA_TYPE_LABEL[f.mediaType]}</Chip>
                <div className="min-w-0">
                  {b ? (
                    <div className="flex min-w-0 flex-col gap-0.5">
                      <span className="truncate">{b.title ?? `AniList ${b.anilistId}`}</span>
                      <span className="truncate font-mono text-sm text-muted">
                        {[b.year, b.format, `AniList ${b.anilistId}`].filter(Boolean).join(' · ')}
                      </span>
                    </div>
                  ) : (
                    <Chip tone={f.hasFiles ? 'warn' : 'neutral'}>Sem vínculo</Chip>
                  )}
                </div>
                <span>{b && <Chip tone={b.hasTmdb ? 'ok' : 'warn'}>{b.hasTmdb ? 'Vinculado' : 'Sem TMDB'}</Chip>}</span>
                <Chip tone={f.hasFiles ? 'ok' : 'neutral'}>{f.hasFiles ? 'Com arquivos' : 'Sem arquivos'}</Chip>
                <span className="text-sm text-muted">{formatDate(f.createdAt)}</span>
                <span>
                  {
                    <Tooltip content="Ver subpastas">
                      <button
                        type="button"
                        aria-label="Ver subpastas"
                        onClick={(e) => {
                          e.stopPropagation()
                          update({ parentId: String(f.id) })
                        }}
                        className="flex h-[30px] w-[30px] items-center justify-center rounded-rxs text-muted hover:bg-raised"
                      >
                        <Icon name="subdirectory_arrow_right" size={19} />
                      </button>
                    </Tooltip>
                  }
                </span>
              </div>
            )
          })}
          {query.data && (
            <Pagination
              page={page}
              totalPages={query.data.totalPages}
              size={PAGE_SIZE}
              onPage={(p) => update({ page: p ? String(p) : '' }, false)}
            />
          )}
        </div>
      </div>
    </>
  )
}
