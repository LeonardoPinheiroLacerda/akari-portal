import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useListFranchises, useListHiddenAnimes } from '@/api/generated/endpoints/anime-franchise/anime-franchise'
import type { FranchiseKind } from '@/api/generated/model'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Dialog } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/input'
import { Pagination } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { useDebounced } from '@/lib/useDebounced'
import { FranchisePanel } from './FranchisePanel'
import { HiddenPanel } from './HiddenPanel'
import { CollectionPicker, FranchisePicker } from './pickers'
import { titleOf, useFranchiseActions } from './useFranchiseActions'

const PAGE_SIZE = 12

/**
 * Tela Franquias (`/franquias/:key?`). Sem `key`, a lista de franquias na largura toda; com `key`
 * (`anilistId` da raiz, ou `ocultas`), só a franquia ou as ocultas, com a largura toda para o grafo
 * e um atalho para voltar à lista ou trocar de franquia.
 */
export function FranchisesPage() {
  usePageMeta('Franquias')
  const { key } = useParams()
  const navigate = useNavigate()
  const [switching, setSwitching] = useState(false)
  const selected = key && key !== 'ocultas' ? Number(key) : null

  if (!key) return <FranchiseList />

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" icon="arrow_back" onClick={() => navigate('/franquias')}>
          Franquias
        </Button>
        <span className="flex-1" />
        <Button size="sm" icon="swap_horiz" onClick={() => setSwitching(true)}>
          Trocar franquia
        </Button>
      </div>

      {key === 'ocultas' ? (
        <HiddenPanel />
      ) : selected != null && !Number.isNaN(selected) ? (
        <FranchisePanel key={selected} rootId={selected} />
      ) : null}

      <Dialog open={switching} onOpenChange={setSwitching}>
        {switching && (
          <FranchisePicker
            title="Trocar franquia"
            description="Busque pelo título de qualquer obra da franquia."
            stateOf={(f) => (f.root.anilistId === selected ? 'Aberta' : null)}
            action={{ icon: 'arrow_forward', label: 'Abrir', busyKey: () => '' }}
            busy={null}
            onPick={(f) => {
              setSwitching(false)
              navigate(`/franquias/${f.root.anilistId}`)
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

/** Colunas da tabela, no mesmo formato da tabela do Catálogo. */
const COLS = 'grid-cols-[48px_minmax(260px,2fr)_120px_100px_32px]'

/**
 * A lista de franquias, com a mesma cara do Catálogo: busca por qualquer obra, filtro por tipo,
 * ocultas, "Nova franquia" e a tabela paginada.
 */
function FranchiseList() {
  const navigate = useNavigate()
  const [q, setQ] = useState('')
  const [kind, setKind] = useState<FranchiseKind | 'ALL'>('ALL')
  const [page, setPage] = useState(0)
  const [creating, setCreating] = useState(false)
  const query = useDebounced(q.trim(), 300)
  const list = useListFranchises(
    { q: query || undefined, kind: kind === 'ALL' ? undefined : kind, page, size: PAGE_SIZE },
    { query: { placeholderData: (p) => p } },
  )
  const hidden = useListHiddenAnimes({ page: 0, size: 1 })
  const actions = useFranchiseActions()
  const rows = list.data?.data ?? []
  const hasFilters = !!query || kind !== 'ALL'

  return (
    <>
      <section className="card">
        <div className="flex flex-wrap items-center gap-2.5 px-3.5 py-3">
          <SearchInput
            containerClassName="min-w-[240px] flex-1"
            placeholder="Buscar pelo título de qualquer obra da franquia"
            value={q}
            onChange={(e) => {
              setQ(e.target.value)
              setPage(0)
            }}
          />
          <Segmented
            size="md"
            aria-label="Tipo de franquia"
            value={kind}
            onChange={(v) => {
              setKind(v)
              setPage(0)
            }}
            options={[
              { value: 'ALL', label: 'Todas' },
              { value: 'NATURAL', label: 'Automáticas' },
              { value: 'MANUAL', label: 'Manuais' },
            ]}
          />
          <Button icon="visibility_off" iconSize={18} onClick={() => navigate('/franquias/ocultas')}>
            Ocultas
            {hidden.data != null && (
              <span className="flex h-5 min-w-5 items-center justify-center rounded-[10px] bg-raised px-1.5 text-xs font-bold">
                {hidden.data.totalElements}
              </span>
            )}
          </Button>
          <Button variant="primary" icon="add" iconSize={19} onClick={() => setCreating(true)}>
            Nova franquia
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2">
          <span className="text-sm text-muted">{hasFilters ? 'Filtrando' : 'Sem filtros'}</span>
          <div className="flex-1" />
          <span className="text-sm text-muted">
            {list.data ? `${list.data.totalElements.toLocaleString('pt-BR')} franquias` : '…'}
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
                setKind('ALL')
                setPage(0)
              }}
            >
              Limpar filtros
            </Button>
          )}
        </div>
      </section>

      <div className="card overflow-x-auto">
        <div className="min-w-[640px]">
          <div
            className={`grid ${COLS} items-center gap-3 border-b border-line px-5 py-3 text-xs uppercase tracking-[.06em] text-muted`}
          >
            <span />
            <span>Franquia</span>
            <span>Tipo</span>
            <span>Obras</span>
            <span />
          </div>
          {list.isLoading && <Loading />}
          {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
          {list.data && rows.length === 0 && <div className="px-5 py-6 text-muted">Nenhuma franquia com esses filtros.</div>}
          {rows.map((f) => (
            <div
              key={f.root.anilistId}
              onClick={() => navigate(`/franquias/${f.root.anilistId}`)}
              className={`grid ${COLS} cursor-pointer items-center gap-3 border-b border-line px-5 py-2.5 transition-colors hover:bg-hover`}
            >
              <Thumb src={f.root.thumbnail} width={34} ratio="34/48" />
              <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate font-medium">{titleOf(f.root)}</span>
                <span className="truncate font-mono text-sm text-muted">
                  {[f.root.year, f.root.format, f.root.studio, `AniList ${f.root.anilistId}`].filter(Boolean).join(' · ')}
                </span>
              </div>
              <Chip tone={f.kind === 'MANUAL' ? 'info' : 'neutral'} className="justify-self-start">
                {f.kind === 'MANUAL' ? 'Manual' : 'Automática'}
              </Chip>
              <span className="text-13">{f.memberCount === 1 ? '1 obra' : `${f.memberCount} obras`}</span>
              <Icon name="chevron_right" size={20} className="text-muted" />
            </div>
          ))}
          {list.data && <Pagination page={page} totalPages={list.data.totalPages} size={PAGE_SIZE} onPage={setPage} />}
        </div>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        {creating && (
          <CollectionPicker
            title="Nova franquia"
            description="Escolha a obra de início. Ela sai da franquia em que está, com as obras que estão abaixo dela."
            stateOf={() => null}
            action={{ icon: 'check', label: 'Escolher', busyKey: (b) => `own-${b.anilistId}` }}
            busy={actions.busy}
            onPick={async (b) => {
              const created = await actions.ownFranchise({ anilistId: b.anilistId, title: titleOf(b) })
              setCreating(false)
              if (created) navigate(`/franquias/${b.anilistId}`)
            }}
          />
        )}
      </Dialog>
    </>
  )
}
