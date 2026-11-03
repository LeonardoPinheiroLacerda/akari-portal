import { useState } from 'react'
import { useListFranchises } from '@/api/generated/endpoints/anime-franchise/anime-franchise'
import { useListFolders } from '@/api/generated/endpoints/media-folder/media-folder'
import type { AnimeBindingSummary, FranchiseSummary } from '@/api/generated/model'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { DialogContent } from '@/components/ui/dialog'
import { SearchInput } from '@/components/ui/input'
import { Pagination } from '@/components/ui/misc'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { useDebounced } from '@/lib/useDebounced'
import { titleOf } from './useFranchiseActions'

/** Linha de resultado: pôster, título, detalhe e o botão (ou o texto que explica por que não). */
function PickRow({
  thumb,
  title,
  meta,
  state,
  action,
  loading,
  disabled,
  onPick,
}: {
  thumb?: string | null
  title: string
  meta: string
  state: string | null
  action: { icon: string; label: string }
  loading: boolean
  disabled: boolean
  onPick: () => void
}) {
  return (
    <div className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
      <Thumb src={thumb} width={34} />
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate font-semibold">{title}</span>
        <span className="truncate text-sm text-muted">{meta}</span>
      </div>
      {state ? (
        <Chip tone="neutral" className="h-6 text-xs">
          {state}
        </Chip>
      ) : (
        <Button size="sm" icon={action.icon} loading={loading} disabled={disabled} onClick={onPick}>
          {action.label}
        </Button>
      )}
    </div>
  )
}

function PickerBody({
  query,
  placeholder,
  q,
  setQ,
  setPage,
  children,
  empty,
}: {
  query: string
  placeholder: string
  q: string
  setQ: (v: string) => void
  setPage: (p: number) => void
  children: React.ReactNode
  empty: boolean
}) {
  return (
    <>
      <div className="border-b border-line px-5 py-3">
        <SearchInput
          height={36}
          value={q}
          autoFocus
          placeholder={placeholder}
          onChange={(e) => {
            setQ(e.target.value)
            setPage(0)
          }}
        />
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {children}
        {query && empty && <div className="px-5 py-5 text-13 text-muted">Nada encontrado para “{query}”.</div>}
      </div>
    </>
  )
}

/** Busca na coleção (pastas com anime vinculado) para escolher uma obra. */
export function CollectionPicker({
  title,
  description,
  stateOf,
  action,
  busy,
  onPick,
}: {
  title: string
  description: string
  /** Texto no lugar do botão quando a obra não pode ser escolhida. */
  stateOf: (b: AnimeBindingSummary) => string | null
  action: { icon: string; label: string; busyKey: (b: AnimeBindingSummary) => string }
  busy: string | null
  onPick: (b: AnimeBindingSummary) => void
}) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const query = useDebounced(q.trim(), 300)
  const folders = useListFolders(
    { name: query, hasAnilist: true, page, size: 8 },
    { query: { enabled: query.length > 0, placeholderData: (p) => p } },
  )
  return (
    <DialogContent title={title} description={description}>
      <PickerBody
        query={query}
        placeholder="Buscar pelo nome da pasta"
        q={q}
        setQ={setQ}
        setPage={setPage}
        empty={folders.data?.data.length === 0}
      >
        {!query && <div className="px-5 py-5 text-13 text-muted">Digite o nome para buscar na coleção.</div>}
        {folders.isLoading && <Loading label="Buscando…" />}
        {folders.isError && <ErrorState error={folders.error} onRetry={() => folders.refetch()} />}
        {folders.data?.data.map((folder) => {
          const b = folder.animeBinding
          if (!b) return null
          return (
            <PickRow
              key={folder.id}
              thumb={b.thumbnail}
              title={titleOf(b)}
              meta={[b.format, b.year, `AniList ${b.anilistId}`].filter(Boolean).join(' · ')}
              state={stateOf(b)}
              action={action}
              loading={busy === action.busyKey(b)}
              disabled={busy != null}
              onPick={() => onPick(b)}
            />
          )
        })}
      </PickerBody>
      {folders.data && folders.data.totalPages > 1 && (
        <Pagination page={page} totalPages={folders.data.totalPages} size={8} onPage={setPage} className="border-t border-line" />
      )}
    </DialogContent>
  )
}

/** Busca nas franquias (pelo título da raiz ou de qualquer obra delas) para escolher uma. */
export function FranchisePicker({
  title,
  description,
  stateOf,
  action,
  busy,
  onPick,
}: {
  title: string
  description: string
  stateOf: (f: FranchiseSummary) => string | null
  action: { icon: string; label: string; busyKey: (f: FranchiseSummary) => string }
  busy: string | null
  onPick: (f: FranchiseSummary) => void
}) {
  const [q, setQ] = useState('')
  const [page, setPage] = useState(0)
  const query = useDebounced(q.trim(), 300)
  const list = useListFranchises(
    { q: query || undefined, page, size: 8 },
    { query: { enabled: query.length > 0, placeholderData: (p) => p } },
  )
  return (
    <DialogContent title={title} description={description}>
      <PickerBody
        query={query}
        placeholder="Buscar pelo título de qualquer obra da franquia"
        q={q}
        setQ={setQ}
        setPage={setPage}
        empty={list.data?.data.length === 0}
      >
        {!query && <div className="px-5 py-5 text-13 text-muted">Digite um título para buscar as franquias.</div>}
        {list.isLoading && <Loading label="Buscando…" />}
        {list.isError && <ErrorState error={list.error} onRetry={() => list.refetch()} />}
        {list.data?.data.map((f) => (
          <PickRow
            key={f.root.anilistId}
            thumb={f.root.thumbnail}
            title={titleOf(f.root)}
            meta={[f.memberCount === 1 ? '1 obra' : `${f.memberCount} obras`, f.kind === 'MANUAL' ? 'manual' : null]
              .filter(Boolean)
              .join(' · ')}
            state={stateOf(f)}
            action={action}
            loading={busy === action.busyKey(f)}
            disabled={busy != null}
            onPick={() => onPick(f)}
          />
        ))}
      </PickerBody>
      {list.data && list.data.totalPages > 1 && (
        <Pagination page={page} totalPages={list.data.totalPages} size={8} onPage={setPage} className="border-t border-line" />
      )}
    </DialogContent>
  )
}
