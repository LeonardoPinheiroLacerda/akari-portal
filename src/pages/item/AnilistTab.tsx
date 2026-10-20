import DOMPurify from 'dompurify'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useSearchAnilistMedia } from '@/api/generated/endpoints/anilist-search/anilist-search'
import { bindAnimeToFolder, deleteAnime, useSetAnimeFranchiseRoot, useSyncAnime } from '@/api/generated/endpoints/anime/anime'
import { useGetAnimeRelationGraph } from '@/api/generated/endpoints/anime-relations/anime-relations'
import type { AnilistMediaSummary, AnimeResponse, FranchiseRootCuration } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Input, SearchInput } from '@/components/ui/input'
import { ExternalLink, KeyValue, Pagination } from '@/components/ui/misc'
import { RadioCard, RadioGroup } from '@/components/ui/radio'
import { Section } from '@/components/ui/section'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { FRANCHISE_ROOT, relationLabel, SEASON_LABEL } from '@/features/item/labels'
import { buildFranchiseTree, findFranchiseRoot } from '@/features/item/relationsTree'
import type { ItemState } from '@/features/item/useItem'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

const LOSES = [
  'Dados da AniList (títulos, sinopse, gêneros, nota)',
  'Vínculo com o TMDB e todos os overrides',
  'Ligações com outras obras da franquia',
  'Status de revisão e definição de início da franquia',
]
const KEEPS = ['A pasta e os arquivos de vídeo', 'Pareamento dos arquivos com episódios do TMDB', 'Arquivos já baixados no cache']

/** Sanitiza o HTML da AniList e junta quebras de linha repetidas. */
function cleanSynopsis(html?: string | null) {
  if (!html) return ''
  return DOMPurify.sanitize(html)
    .replace(/(\s*<br\s*\/?>\s*){2,}/gi, '<br><br>')
    .replace(/^(\s*<br\s*\/?>)+|(<br\s*\/?>\s*)+$/gi, '')
}

const timeNow = () => new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })

async function invalidateAfterBindingChange(anilistId?: number) {
  await Promise.all([invalidate.catalog(), invalidate.anime(anilistId), invalidate.anime()])
}

export function AnilistTab({ item, folderId }: { item: ItemState; folderId: number }) {
  const { anime, folder } = item
  const [searchOpen, setSearchOpen] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [lastAction, setLastAction] = useState<string | null>(null)
  const a = anime.data

  if (anime.isError && !item.animeMissing) return <ErrorState error={anime.error} onRetry={() => anime.refetch()} />

  const folderPath = folder.data?.path ?? '—'

  return (
    <>
      {confirmOpen && a && (
        <UnbindConfirm
          anime={a}
          folderName={folder.data?.name ?? ''}
          folderPath={folderPath}
          onCancel={() => setConfirmOpen(false)}
          onDone={() => {
            setConfirmOpen(false)
            setLastAction(`Desvinculado às ${timeNow()}.`)
          }}
        />
      )}

      {!a && (
        <section className="flex flex-wrap items-center gap-4 rounded-r border border-dashed border-line bg-panel p-6">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-raised text-muted">
            <Icon name="folder_open" size={22} />
          </span>
          <div className="flex min-w-[240px] flex-1 flex-col gap-1">
            <span className="font-semibold">Pasta sem anime vinculado</span>
            <span className="text-13 leading-[1.45] text-muted">
              <span className="font-mono">{folderPath}</span> está livre. Vincule um anime da AniList ou deixe para a próxima
              ingestão tentar vincular automaticamente.
            </span>
            {lastAction && <span className="text-sm text-muted">{lastAction}</span>}
          </div>
          <Button variant="primary" icon="add_link" onClick={() => setSearchOpen(true)}>
            Vincular anime
          </Button>
        </section>
      )}

      {a && (
        <div className="flex flex-wrap items-start gap-4">
          <MetadataCard
            anime={a}
            lastAction={lastAction}
            onSearch={() => {
              setSearchOpen((v) => !v)
              setConfirmOpen(false)
            }}
            onUnbind={() => {
              setConfirmOpen(true)
              setSearchOpen(false)
            }}
            onSynced={() => setLastAction(`Sincronizado com a AniList às ${timeNow()}.`)}
          />
          <FranchiseRootCard anime={a} />
        </div>
      )}

      {searchOpen && (
        <AnilistSearch
          current={a ?? null}
          folderId={folderId}
          initialQuery={a?.titles?.main ?? folder.data?.name ?? ''}
          onClose={() => setSearchOpen(false)}
          onBound={(title) => {
            setSearchOpen(false)
            setLastAction(`Pasta vinculada a ${title}.`)
          }}
        />
      )}

      {a && <RelationsTree anime={a} />}
    </>
  )
}

function MetadataCard({
  anime: a,
  lastAction,
  onSearch,
  onUnbind,
  onSynced,
}: {
  anime: AnimeResponse
  lastAction: string | null
  onSearch: () => void
  onUnbind: () => void
  onSynced: () => void
}) {
  const sync = useSyncAnime()
  const synopsis = useMemo(() => cleanSynopsis(a.synopsis), [a.synopsis])
  const season = [a.format, a.season ? `${SEASON_LABEL[a.season] ?? a.season} ${a.year ?? ''}`.trim() : a.year]
    .filter(Boolean)
    .join(' · ')

  return (
    <section className="card min-w-0 flex-[2_1_520px] overflow-hidden">
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3.5">
        <h3 className="m-0 min-w-[200px] flex-1 text-15 font-semibold">Metadata AniList</h3>
        <Button
          size="sm"
          icon="sync"
          loading={sync.isPending}
          onClick={() =>
            sync.mutate(
              { anilistId: a.anilistId },
              {
                onSuccess: async () => {
                  await invalidate.anime(a.anilistId)
                  toast.success('Dados atualizados com a AniList')
                  onSynced()
                },
                onError: (e) => toastError(e),
              },
            )
          }
        >
          Sincronizar
        </Button>
        <Button size="sm" icon="swap_horiz" onClick={onSearch}>
          Trocar anime
        </Button>
        <Button size="sm" variant="secondary" className="text-danger" onClick={onUnbind}>
          Desvincular
        </Button>
      </div>
      <div className="flex flex-wrap gap-5 px-5 py-[18px]">
        <Thumb src={a.thumbnails?.large ?? a.thumbnails?.medium} width={120} rounded="rs" className="border border-line" />
        <div className="flex min-w-[260px] flex-1 flex-col">
          <KeyValue
            labelWidth={140}
            rows={[
              {
                label: 'anilistId',
                value: <ExternalLink href={`https://anilist.co/anime/${a.anilistId}`}>{a.anilistId}</ExternalLink>,
                mono: true,
              },
              {
                label: 'malId',
                value:
                  a.malId != null ? (
                    <ExternalLink href={`https://myanimelist.net/anime/${a.malId}`}>{a.malId}</ExternalLink>
                  ) : (
                    '—'
                  ),
                mono: true,
              },
              { label: 'Título principal', value: a.titles?.main },
              { label: 'Inglês', value: a.titles?.english },
              { label: 'Japonês', value: a.titles?.japanese },
              { label: 'Sinônimos', value: a.titles?.synonyms?.length ? a.titles.synonyms.join(', ') : '—' },
              { label: 'Formato · estação', value: season || '—', mono: true },
              {
                label: 'Episódios',
                value: [a.episodes ?? '?', a.duration && `${a.duration}${/^\d+$/.test(a.duration) ? ' min' : ''}`]
                  .filter(Boolean)
                  .join(' · '),
                mono: true,
              },
              {
                label: 'Nota',
                value: a.score != null ? `${a.score.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / 10` : '—',
                mono: true,
              },
              { label: 'Adulto', value: a.isAdult ? 'sim' : 'não' },
            ]}
          />
          {!!a.genres?.length && (
            <div className="flex flex-wrap gap-1.5 pt-2.5">
              {a.genres.map((g) => (
                <span key={g} className="rounded-chip bg-raised px-2 py-0.5 text-sm">
                  {g}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
      {synopsis && (
        <div className="flex flex-col gap-1.5 px-5 pb-[18px]">
          <span className="text-sm text-muted">Sinopse</span>
          <div
            className="prose-anilist max-w-[820px] leading-[1.55] [text-wrap:pretty] [&_p]:m-0"
            dangerouslySetInnerHTML={{ __html: synopsis }}
          />
        </div>
      )}
      {lastAction && <span className="block border-t border-line px-5 py-2 font-mono text-xs text-muted">{lastAction}</span>}
    </section>
  )
}

function FranchiseRootCard({ anime: a }: { anime: AnimeResponse }) {
  const mutation = useSetAnimeFranchiseRoot()
  const graph = useGetAnimeRelationGraph(a.anilistId, { depth: 1 })
  const node = graph.data?.nodes?.find((n) => n.anilistId === a.anilistId)
  const kind = node?.rootKind

  const set = (v: FranchiseRootCuration) => {
    if (v === a.franchiseRootCuration) return
    mutation.mutate(
      { anilistId: a.anilistId, data: { franchiseRootCuration: v } },
      {
        onSuccess: async () => {
          await invalidate.anime()
          toast.success('Início da franquia atualizado')
        },
        onError: (e) => toastError(e),
      },
    )
  }

  return (
    <section className="card min-w-0 flex-[1_1_280px] overflow-hidden">
      <div className="flex flex-col gap-0.5 border-b border-line px-5 py-3.5">
        <h3 className="m-0 text-15 font-semibold">Início da franquia</h3>
        <span className="text-sm leading-[1.4] text-muted">
          Define se este anime aparece na coleção como a entrada principal da franquia, agrupando sequências e spin-offs.
        </span>
      </div>
      <RadioGroup
        value={a.franchiseRootCuration}
        onValueChange={(v) => set(v as FranchiseRootCuration)}
        className="gap-1 p-2.5"
        disabled={mutation.isPending}
      >
        {(Object.keys(FRANCHISE_ROOT) as FranchiseRootCuration[]).map((k) => (
          <RadioCard key={k} value={k} checked={a.franchiseRootCuration === k} className="border-0 p-2.5">
            <span className="flex flex-col gap-0.5">
              <span className="text-13 font-semibold">{FRANCHISE_ROOT[k].label}</span>
              <span className="text-sm leading-[1.4] text-muted">{FRANCHISE_ROOT[k].hint}</span>
            </span>
          </RadioCard>
        ))}
      </RadioGroup>
      <div className="flex items-center gap-2 border-t border-line px-5 py-3 text-13">
        {kind == null ? (
          <span className="text-muted">Calculando…</span>
        ) : (
          <>
            <Icon
              name={kind === 'NOT_ROOT' ? 'subdirectory_arrow_right' : 'flag'}
              size={18}
              className={kind === 'NOT_ROOT' ? 'text-muted' : 'text-accent'}
            />
            <span>
              {kind === 'NOT_ROOT'
                ? 'Hoje aparece agrupado dentro de outra franquia.'
                : kind === 'MANUAL'
                  ? 'Hoje aparece como início da franquia (definido manualmente).'
                  : 'Hoje aparece como início da franquia (sem temporada anterior).'}
            </span>
          </>
        )}
      </div>
    </section>
  )
}

function UnbindConfirm({
  anime: a,
  folderName,
  folderPath,
  onCancel,
  onDone,
}: {
  anime: AnimeResponse
  folderName: string
  folderPath: string
  onCancel: () => void
  onDone: () => void
}) {
  const [text, setText] = useState('')
  const [pending, setPending] = useState(false)
  const word = folderName || 'desvincular'
  const ok = text.trim().toLowerCase() === word.toLowerCase()
  const title = a.titles?.main ?? `AniList ${a.anilistId}`

  const confirm = async () => {
    setPending(true)
    try {
      await deleteAnime(a.anilistId)
      await invalidateAfterBindingChange(a.anilistId)
      toast.success(`${title} foi desvinculado da pasta`)
      onDone()
    } catch (e) {
      toastError(e)
    } finally {
      setPending(false)
    }
  }

  return (
    <section className="overflow-hidden rounded-r border border-danger bg-panel">
      <div className="flex items-start gap-3 border-b border-line px-5 py-4">
        <Icon name="link_off" size={22} className="text-danger" />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <h3 className="m-0 text-15 font-semibold">Desvincular {title} desta pasta?</h3>
          <span className="text-13 leading-[1.45] text-muted">
            A pasta <b className="font-mono font-medium text-text">{folderPath}</b> volta a ficar livre para outro anime.
          </span>
        </div>
      </div>
      <div className="grid gap-4 px-5 py-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,280px),1fr))]">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-danger">Será removido</span>
          {LOSES.map((t) => (
            <span key={t} className="flex gap-2 text-13 leading-[1.4]">
              <Icon name="remove" size={16} className="text-danger" />
              {t}
            </span>
          ))}
        </div>
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold text-[var(--ok-fg)]">Continua como está</span>
          {KEEPS.map((t) => (
            <span key={t} className="flex gap-2 text-13 leading-[1.4]">
              <Icon name="check" size={16} className="text-[var(--ok-fg)]" />
              {t}
            </span>
          ))}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-code px-5 py-3">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1">
          <span className="text-sm text-muted">
            Para confirmar, digite <b className="font-mono text-text">{word}</b>
          </span>
          <Input mono value={text} onChange={(e) => setText(e.target.value)} className="max-w-[360px]" autoFocus />
        </label>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="danger-solid" disabled={!ok} loading={pending} onClick={confirm}>
          Desvincular
        </Button>
      </div>
    </section>
  )
}

function AnilistSearch({
  current,
  folderId,
  initialQuery,
  onClose,
  onBound,
}: {
  current: AnimeResponse | null
  folderId: number
  initialQuery: string
  onClose: () => void
  onBound: (title: string) => void
}) {
  const [q, setQ] = useState(initialQuery)
  const [page, setPage] = useState(0)
  const [pendingId, setPendingId] = useState<number | null>(null)
  const query = useDebounced(q.trim(), 400)
  const search = useSearchAnilistMedia(
    { q: query, page, size: 8 },
    { query: { enabled: query.length > 0, placeholderData: (p) => p } },
  )

  const pick = async (r: AnilistMediaSummary) => {
    const title = r.title?.userPreferred ?? r.title?.romaji ?? `AniList ${r.anilistId}`
    setPendingId(r.anilistId)
    try {
      if (current) await deleteAnime(current.anilistId)
      await bindAnimeToFolder(r.anilistId, { folderId })
      await invalidateAfterBindingChange(current?.anilistId)
      toast.success(`Pasta vinculada a ${title}`)
      onBound(title)
    } catch (e) {
      toastError(e, current ? 'Não foi possível trocar o anime' : 'Não foi possível vincular o anime')
      await invalidateAfterBindingChange(current?.anilistId)
    } finally {
      setPendingId(null)
    }
  }

  return (
    <Section
      className="border-accent"
      title={current ? 'Trocar anime vinculado à pasta' : 'Vincular anime à pasta'}
      actions={
        <Button size="sm" icon="close" onClick={onClose}>
          Fechar
        </Button>
      }
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-line px-5 py-3">
        <SearchInput
          height={36}
          containerClassName="min-w-[220px] flex-1"
          value={q}
          autoFocus
          placeholder="Buscar anime na AniList"
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>
      {current && (
        <div className="bg-[var(--warn-bg)] px-5 py-2.5 text-sm text-[var(--warn-fg)]">
          Trocar o anime remove o vínculo TMDB, os overrides e as relações do anime atual.
        </div>
      )}
      {!query && <div className="px-5 py-5 text-13 text-muted">Digite o nome do anime para buscar.</div>}
      {search.isLoading && <Loading label="Buscando na AniList…" />}
      {search.isError && <ErrorState error={search.error} onRetry={() => search.refetch()} />}
      {search.data && search.data.data.length === 0 && (
        <div className="px-5 py-5 text-13 text-muted">Nenhum anime encontrado para “{query}”.</div>
      )}
      {search.data?.data.map((r) => {
        const isCurrent = current?.anilistId === r.anilistId
        const title = r.title?.userPreferred ?? r.title?.romaji ?? `AniList ${r.anilistId}`
        const meta = [
          `AniList ${r.anilistId}`,
          r.format,
          r.season && r.seasonYear ? `${r.season} ${r.seasonYear}` : r.seasonYear,
          r.episodes != null && `${r.episodes} eps`,
          r.duration != null && `${r.duration} min`,
          r.averageScore != null && `nota ${r.averageScore}/100`,
        ]
          .filter(Boolean)
          .join(' · ')
        return (
          <div
            key={r.anilistId}
            className={cn('flex gap-3.5 border-b border-line px-5 py-3 last:border-b-0', isCurrent && 'bg-tint')}
          >
            <Thumb src={r.coverImage?.medium ?? r.coverImage?.large} width={52} />
            <div className="flex min-w-0 flex-1 flex-col gap-[3px]">
              <div className="flex flex-wrap items-baseline gap-2">
                <span className="font-semibold">{title}</span>
                {r.title?.english && <span className="text-sm text-muted">{r.title.english}</span>}
              </div>
              <span className="font-mono text-xs text-muted">{meta}</span>
              {r.description && (
                <span className="line-clamp-2 text-sm leading-[1.45] text-muted">
                  {DOMPurify.sanitize(r.description, { ALLOWED_TAGS: [] })}
                </span>
              )}
            </div>
            <div className="flex items-center">
              {isCurrent ? (
                <Chip tone="ok">Vinculado</Chip>
              ) : (
                <Button
                  size="sm"
                  className="border-accent"
                  loading={pendingId === r.anilistId}
                  disabled={pendingId != null}
                  onClick={() => pick(r)}
                >
                  Vincular
                </Button>
              )}
            </div>
          </div>
        )
      })}
      {search.data && search.data.totalPages > 1 && (
        <Pagination page={page} totalPages={search.data.totalPages} size={8} onPage={setPage} className="border-t border-line" />
      )}
    </Section>
  )
}

function RelationsTree({ anime: a }: { anime: AnimeResponse }) {
  const navigate = useNavigate()
  const own = useGetAnimeRelationGraph(a.anilistId)
  const rootId = own.data ? findFranchiseRoot(own.data, a.anilistId) : undefined
  const rootGraph = useGetAnimeRelationGraph(rootId ?? 0, { depth: 4 }, { query: { enabled: rootId != null } })
  const graph = rootGraph.data ?? (rootId === a.anilistId ? own.data : undefined)
  const groups = useMemo(() => (graph && rootId != null ? buildFranchiseTree(graph, rootId) : []), [graph, rootId])

  return (
    <Section
      title="Relações da franquia"
      subtitle="Ordem de lançamento da franquia, com as obras derivadas abaixo de cada entrada."
    >
      {(own.isLoading || rootGraph.isLoading) && <Loading />}
      {own.isError && <ErrorState error={own.error} onRetry={() => own.refetch()} />}
      {graph && (
        <div className="flex flex-col gap-3.5 px-5 pb-[18px] pt-3.5">
          {groups.map((g) => (
            <div key={g.key} className="flex flex-col gap-1.5">
              <span className="group-label">{g.label}</span>
              {g.items.map((it) => {
                const n = it.node
                const cur = n.anilistId === a.anilistId
                const inColl = n.folderId != null
                const isRoot = n.rootKind !== 'NOT_ROOT'
                return (
                  <div
                    key={`${g.key}-${n.anilistId}`}
                    className="flex items-stretch"
                    style={{ paddingLeft: it.level ? (it.level - 1) * 28 + 28 : 0 }}
                  >
                    {!!it.level && (
                      <div className="relative w-[22px] shrink-0">
                        <div className="absolute bottom-1/2 left-2 top-[-6px] w-3 rounded-bl-[6px] border-b-2 border-l-2 border-line" />
                      </div>
                    )}
                    <button
                      type="button"
                      disabled={!inColl || cur}
                      onClick={() => navigate(`/catalogo/${n.folderId}/anilist`)}
                      className={cn(
                        'flex min-w-0 flex-1 items-center gap-3 rounded-rs px-3 py-2 text-left transition-colors',
                        cur
                          ? 'border-2 border-accent bg-tint'
                          : inColl
                            ? 'border border-line bg-bg hover:border-muted'
                            : 'cursor-default border border-dashed border-line',
                      )}
                    >
                      <span className="w-6 shrink-0 text-center font-mono text-13 font-bold text-muted">{it.num ?? ''}</span>
                      <Thumb src={n.posterUrl} width={30} />
                      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-semibold">{n.title ?? `AniList ${n.anilistId}`}</span>
                          {cur && (
                            <Chip tone="accent" className="h-[18px] text-xs font-bold">
                              Este anime
                            </Chip>
                          )}
                          {isRoot && (
                            <span className="flex items-center gap-[3px] text-xs font-semibold text-accent-text">
                              <Icon name="flag" size={14} />
                              Início da franquia
                            </span>
                          )}
                        </div>
                        <span className="text-sm text-muted">
                          {[
                            it.relation ? relationLabel(it.relation) : g.key === 'other' ? 'Relacionada' : 'Primeira entrada',
                            `AniList ${n.anilistId}`,
                          ].join(' · ')}
                        </span>
                      </div>
                      <Chip tone={inColl ? 'ok' : 'neutral'} dashed={!inColl} className="h-5 text-xs">
                        {inColl ? 'Na coleção' : 'Fora da coleção'}
                      </Chip>
                    </button>
                  </div>
                )
              })}
            </div>
          ))}
          {groups.every((g) => g.items.length <= 1) && (
            <span className="text-13 text-muted">Nenhuma outra obra relacionada na AniList.</span>
          )}
        </div>
      )}
    </Section>
  )
}
