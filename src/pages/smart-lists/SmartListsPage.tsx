import { useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getListSmartListsQueryKey,
  updateSmartList,
  useDeleteSmartList,
  useListSmartListItems,
  useListSmartLists,
} from '@/api/generated/endpoints/smart-list/smart-list'
import type { AnimeBindingSummary, SmartListResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate, queryClient } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Pagination } from '@/components/ui/misc'
import { Section } from '@/components/ui/section'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'
import { describeCriteria, FORMATS, sortLabel, type CriteriaLine } from './criteria'
import { SmartListDialog, type SmartListDialogState } from './SmartListDialog'

const PAGE_SIZE = 24

/**
 * Tela Listas (`/listas/:listId?`): as listas por critério, na ordem em que os clientes as mostram,
 * e os títulos da lista escolhida. Sem `listId`, abre a primeira.
 */
export function SmartListsPage() {
  usePageMeta('Listas')
  const { listId } = useParams()
  const navigate = useNavigate()
  const query = useListSmartLists()
  const lists = query.data ?? []
  const [dialog, setDialog] = useState<SmartListDialogState>(null)

  const selectedId = listId != null ? Number(listId) : lists[0]?.id
  const selected = lists.find((l) => l.id === selectedId)
  const create = () => setDialog({ mode: 'create', position: lists.length ? Math.max(...lists.map((l) => l.position)) + 1 : 0 })

  const dialogEl = (
    <SmartListDialog
      state={dialog}
      onClose={() => setDialog(null)}
      onSaved={(l) => {
        setDialog(null)
        navigate(`/listas/${l.id}`)
      }}
    />
  )

  if (query.isLoading) return <Loading />
  if (query.isError) return <ErrorState error={query.error} onRetry={() => query.refetch()} />

  if (lists.length === 0)
    return (
      <>
        <EmptyState
          dashed
          icon="featured_play_list"
          title="Nenhuma lista cadastrada"
          description="Listas agrupam as franquias da coleção por um filtro — gêneros, tags, estúdio, ano, nota — e uma ordem, como “Comédias recentes” ou “Mais populares”. Os títulos são recalculados sozinhos a cada consulta."
          action={
            <Button variant="primary" size="lg" icon="add" iconSize={19} onClick={create}>
              Criar primeira lista
            </Button>
          }
        />
        {dialogEl}
      </>
    )

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[320px_minmax(0,1fr)]">
      <ListRail lists={lists} selectedId={selectedId} onCreate={create} />
      {selected ? (
        <ListDetail key={selected.id} list={selected} onEdit={() => setDialog({ mode: 'edit', list: selected })} />
      ) : (
        <section className="card">
          <EmptyState
            icon="search_off"
            title="Lista não encontrada"
            description="Ela pode ter sido removida. Escolha outra lista ao lado."
          />
        </section>
      )}
      {dialogEl}
    </div>
  )
}

/**
 * As listas na ordem de exibição, com as setas de reordenar. O backend não tem uma operação de
 * reordenar: a nova ordem é gravada com um `PUT` por lista cuja posição mudou, e as posições
 * ficam 0, 1, 2… a partir daí.
 */
function ListRail({ lists, selectedId, onCreate }: { lists: SmartListResponse[]; selectedId?: number; onCreate: () => void }) {
  const navigate = useNavigate()
  const [moving, setMoving] = useState(false)

  const move = async (from: number, to: number) => {
    const order = [...lists]
    const [item] = order.splice(from, 1)
    order.splice(to, 0, item)
    setMoving(true)
    try {
      await Promise.all(
        order.map((l, position) =>
          l.position === position
            ? null
            : updateSmartList(l.id, {
                name: l.name,
                position,
                criteria: l.criteria,
                sortField: l.sortField,
                sortDirection: l.sortDirection,
              }),
        ),
      )
    } catch (e) {
      toastError(e, 'Não foi possível reordenar as listas')
    } finally {
      await invalidate.smartLists()
      setMoving(false)
    }
  }

  return (
    <Section
      title="Listas"
      subtitle="Na ordem dos clientes"
      actions={
        <Button size="sm" variant="primary" icon="add" iconSize={18} onClick={onCreate}>
          Nova lista
        </Button>
      }
    >
      <ol className="m-0 flex list-none flex-col p-0">
        {lists.map((l, i) => {
          const on = l.id === selectedId
          return (
            <li
              key={l.id}
              className={cn(
                'group flex items-center gap-2 border-b border-l-[3px] border-b-line py-1.5 pl-3.5 pr-2 last:border-b-0',
                on ? 'border-l-accent bg-tint' : 'border-l-transparent hover:bg-hover',
              )}
            >
              <span className="w-5 shrink-0 text-center font-mono text-sm text-muted">{i + 1}</span>
              <button
                type="button"
                onClick={() => navigate(`/listas/${l.id}`)}
                aria-current={on ? 'page' : undefined}
                className="flex min-w-0 flex-1 flex-col gap-0.5 py-1 text-left"
              >
                <span className={cn('truncate', on ? 'font-semibold' : 'font-medium')}>{l.name}</span>
                <span className="truncate text-sm text-muted">{sortLabel(l)}</span>
              </button>
              <div className="flex shrink-0 gap-0.5">
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon="arrow_upward"
                  iconSize={17}
                  aria-label={`Subir ${l.name}`}
                  title="Subir"
                  disabled={moving || i === 0}
                  onClick={() => move(i, i - 1)}
                />
                <Button
                  size="icon-sm"
                  variant="ghost"
                  icon="arrow_downward"
                  iconSize={17}
                  aria-label={`Descer ${l.name}`}
                  title="Descer"
                  disabled={moving || i === lists.length - 1}
                  onClick={() => move(i, i + 1)}
                />
              </div>
            </li>
          )
        })}
      </ol>
    </Section>
  )
}

function ListDetail({ list, onEdit }: { list: SmartListResponse; onEdit: () => void }) {
  const navigate = useNavigate()
  const [sp, setSp] = useSearchParams()
  const page = Number(sp.get('page') ?? 0)
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteSmartList()
  const itemsKey = `/v1/smart-lists/${list.id}/items`
  const items = useListSmartListItems(
    list.id,
    { page, size: PAGE_SIZE },
    // Mantém a página anterior só ao paginar a mesma lista, não ao trocar de lista.
    { query: { placeholderData: (prev, prevQuery) => (prevQuery?.queryKey[0] === itemsKey ? prev : undefined) } },
  )
  const { franchise, root } = describeCriteria(list.criteria)
  const rows = items.data?.data ?? []
  const total = items.data?.totalElements

  const setPage = (p: number) => {
    const next = new URLSearchParams(sp)
    if (p) next.set('page', String(p))
    else next.delete('page')
    setSp(next, { replace: true })
  }

  const remove = () =>
    del.mutate(
      { listId: list.id },
      {
        // Só a listagem: o prefixo de `invalidate.smartLists` pediria de novo os títulos da lista removida.
        onSuccess: async () => {
          navigate('/listas', { replace: true })
          toast.success(`Lista ${list.name} removida`)
          await queryClient.invalidateQueries({ queryKey: getListSmartListsQueryKey() })
        },
        onError: (e) => toastError(e),
      },
    )

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <Section
        title={list.name}
        subtitle={`${total != null ? `${pluralize(total, 'título', 'títulos')} · ` : ''}${sortLabel(list)}`}
        actions={
          <>
            <Button icon="edit" iconSize={17} onClick={onEdit}>
              Editar
            </Button>
            <Button variant="danger" icon="delete" iconSize={17} onClick={() => setConfirming(true)} disabled={confirming}>
              Remover
            </Button>
          </>
        }
      >
        {confirming && (
          <div className="flex flex-wrap items-center gap-3 border-b border-line bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] px-5 py-3">
            <span className="min-w-[240px] flex-1 text-13 leading-[1.45]">
              Remover a lista <b>{list.name}</b>? Só a lista sai; os títulos continuam no catálogo.
            </span>
            <Button size="sm" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="danger-solid" loading={del.isPending} onClick={remove}>
              Remover
            </Button>
          </div>
        )}
        <div className="grid gap-x-6 gap-y-4 px-5 py-4 md:grid-cols-2">
          {franchise.length === 0 && root.length === 0 ? (
            <span className="text-13 text-muted md:col-span-2">
              Sem filtro: todas as franquias da coleção entram na lista, só ordenadas.
            </span>
          ) : (
            <>
              <CriteriaGroup icon="account_tree" title="Em qualquer obra da franquia" lines={franchise} />
              <CriteriaGroup icon="flag" title="Na obra de início" lines={root} />
            </>
          )}
        </div>
      </Section>

      <Section
        title="Títulos"
        subtitle="As franquias que passam no filtro, pela obra de início, na ordem da lista"
        footer="Obras ocultas na tela Franquias nunca entram nas listas."
      >
        {items.isLoading && <Loading />}
        {items.isError && <ErrorState error={items.error} onRetry={() => items.refetch()} />}
        {items.data && rows.length === 0 && (
          <EmptyState
            icon="filter_alt_off"
            title="Nenhum título atende a esse filtro"
            description="Afrouxe algum critério. Tags e estúdios só casam escritos exatamente como na AniList."
            action={
              <Button icon="edit" iconSize={17} onClick={onEdit}>
                Editar filtro
              </Button>
            }
          />
        )}
        {rows.length > 0 && (
          <div
            className={cn(
              'grid gap-3 p-4 [grid-template-columns:repeat(auto-fill,minmax(132px,1fr))]',
              items.isPlaceholderData && 'opacity-60',
            )}
          >
            {rows.map((b, i) => (
              <ItemCard key={b.anilistId} item={b} rank={page * PAGE_SIZE + i + 1} />
            ))}
          </div>
        )}
        {items.data && items.data.totalPages > 1 && (
          <Pagination
            className="border-t border-line"
            page={page}
            totalPages={items.data.totalPages}
            size={PAGE_SIZE}
            onPage={setPage}
          />
        )}
      </Section>
    </div>
  )
}

function CriteriaGroup({ icon, title, lines }: { icon: string; title: string; lines: CriteriaLine[] }) {
  return (
    <div className="flex min-w-0 flex-col gap-2">
      <span className="flex items-center gap-1.5 text-xs uppercase tracking-[.06em] text-muted">
        <Icon name={icon} size={15} />
        {title}
      </span>
      {lines.length ? (
        <ul className="m-0 flex list-none flex-col gap-1 p-0 text-13">
          {lines.map((l) => (
            <li key={l.text} className={cn('flex items-start gap-2', l.negative && 'text-[var(--err-fg)]')}>
              <Icon name={l.negative ? 'block' : 'check'} size={16} className={cn('mt-px', !l.negative && 'text-accent')} />
              {l.text}
            </li>
          ))}
        </ul>
      ) : (
        <span className="text-13 text-muted">Nenhum critério</span>
      )}
    </div>
  )
}

const formatLabel = (f?: string | null) => (f ? (FORMATS.find(([k]) => k === f)?.[1] ?? f) : null)

/** Pôster da obra de início; abre o item no catálogo, na aba AniList. */
function ItemCard({ item: b, rank }: { item: AnimeBindingSummary; rank: number }) {
  const navigate = useNavigate()
  const title = b.title ?? `AniList ${b.anilistId}`
  const meta = [b.year, formatLabel(b.format), b.studio].filter(Boolean).join(' · ')
  return (
    <button
      type="button"
      onClick={() => navigate(`/catalogo/${b.folderId}/anilist`)}
      title={title}
      className="flex min-w-0 flex-col gap-2 rounded-rs p-1.5 text-left transition-colors hover:bg-raised"
    >
      <div className="relative w-full">
        <Thumb src={b.thumbnail} width="100%" className="border border-line" fallbackIcon="image" />
        <span className="absolute left-1.5 top-1.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-chip bg-overlay px-1.5 font-mono text-xs font-bold text-white">
          {rank}
        </span>
      </div>
      <div className="flex min-w-0 flex-col gap-0.5">
        <span className="line-clamp-2 text-13 font-semibold leading-snug">{title}</span>
        {meta && <span className="truncate text-xs text-muted">{meta}</span>}
      </div>
    </button>
  )
}
