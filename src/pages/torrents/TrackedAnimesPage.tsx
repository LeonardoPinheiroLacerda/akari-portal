import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useListTrackedAnimeReleases,
  useListTrackedAnimes,
  useUntrackAnime,
  useUpdateTrackedAnimeQueries,
} from '@/api/generated/endpoints/torrent-tracking/torrent-tracking'
import type { TrackedAnimeResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { editionName } from '@/features/torrents/labels'
import { formatRelative } from '@/lib/format'
import { EditionReleases } from './EditionReleases'

export function TrackedAnimesPage() {
  usePageMeta('Rastreados')
  const navigate = useNavigate()
  const tracked = useListTrackedAnimes()
  const items = tracked.data ?? []

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-[240px] flex-1 text-muted">
          {items.length
            ? `${items.length} ${items.length === 1 ? 'anime rastreado' : 'animes rastreados'} · episódios novos são baixados sozinhos a cada 15 min`
            : 'Nenhum anime rastreado'}
        </span>
        <Button variant="primary" icon="add" iconSize={19} onClick={() => navigate('/torrents/buscar')}>
          Rastrear anime
        </Button>
      </div>

      {tracked.isLoading && <Loading />}
      {tracked.isError && <ErrorState error={tracked.error} onRetry={() => tracked.refetch()} />}
      {tracked.data && items.length === 0 && (
        <EmptyState
          dashed
          icon="radar"
          title="Nenhum anime rastreado"
          description="Rastreie um anime em lançamento numa edição (grupo e qualidade) para os episódios novos serem baixados sozinhos para a biblioteca."
          action={
            <Button variant="primary" icon="add" onClick={() => navigate('/torrents/buscar')}>
              Rastrear anime
            </Button>
          }
        />
      )}

      <div className="flex flex-col gap-4">
        {items.map((t) => (
          <TrackedCard key={t.id} tracked={t} />
        ))}
      </div>
    </>
  )
}

function TrackedCard({ tracked: t }: { tracked: TrackedAnimeResponse }) {
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [editingQueries, setEditingQueries] = useState(false)
  const [draft, setDraft] = useState('')
  // A lista refaz a busca completa no provedor, então só carrega quando aberta.
  const releases = useListTrackedAnimeReleases(t.id, { query: { enabled: open, staleTime: 5 * 60_000 } })
  const untrack = useUntrackAnime()
  // Fica pendente até recarregar o rastreio e os episódios, que refazem a busca no provedor.
  const updateQueries = useUpdateTrackedAnimeQueries({ mutation: { onSuccess: () => invalidate.torrents() } })

  const remove = () =>
    untrack.mutate(
      { trackedId: t.id },
      {
        onSuccess: async () => {
          await invalidate.torrents()
          toast.success(`${t.title} não é mais rastreado`)
        },
        onError: (e) => toastError(e),
      },
    )

  const saveQueries = (queries: string[]) =>
    updateQueries.mutate(
      { trackedId: t.id, data: { queries } },
      {
        onSuccess: () => setDraft(''),
        onError: (e) => toastError(e, 'Não foi possível salvar as buscas'),
      },
    )

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center gap-3.5 px-5 py-4">
        <Thumb src={t.coverImage} width={52} />
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <span className="font-semibold">{t.title}</span>
          <div className="flex flex-wrap items-center gap-2">
            <Chip mono>{editionName(t.editionGroup, t.editionLabel)}</Chip>
            {t.lastError && (
              <Chip tone="err" icon="error" title={t.lastError}>
                Falha na última checagem
              </Chip>
            )}
          </div>
          <span className="text-sm text-muted">
            {t.latestEpisode != null
              ? `Último episódio encontrado: ${t.latestEpisode}`
              : 'Nenhum episódio numerado encontrado ainda'}
            {' · '}
            {t.queries.map((q) => `“${q}”`).join(', ')}
            {' · '}
            {t.lastCheckedAt ? `checado ${formatRelative(t.lastCheckedAt)}` : 'ainda não checado'}
          </span>
          {t.lastError && <span className="text-sm text-[var(--err-fg)]">{t.lastError}</span>}
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" icon="manage_search" onClick={() => setEditingQueries(!editingQueries)}>
            Buscas
          </Button>
          <Button size="sm" icon={open ? 'expand_less' : 'expand_more'} onClick={() => setOpen(!open)}>
            Episódios
          </Button>
          <Button size="sm" variant="danger" icon="delete" onClick={() => setConfirming(true)}>
            Parar de rastrear
          </Button>
        </div>
      </div>
      {confirming && (
        <div className="flex flex-wrap items-center gap-2.5 border-t border-line bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] px-5 py-3">
          <span className="flex-1 text-13">
            Parar de rastrear <b>{t.title}</b>? Os episódios já baixados continuam na biblioteca.
          </span>
          <Button size="sm" onClick={() => setConfirming(false)}>
            Cancelar
          </Button>
          <Button size="sm" variant="danger-solid" loading={untrack.isPending} onClick={remove}>
            Parar de rastrear
          </Button>
        </div>
      )}
      {editingQueries && (
        <form
          className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3"
          onSubmit={(e) => {
            e.preventDefault()
            if (t.queries.includes(draft.trim())) setDraft('')
            else saveQueries([...t.queries, draft.trim()])
          }}
        >
          <span className="flex items-center gap-1.5 text-sm text-muted">
            {updateQueries.isPending && <Icon name="progress_activity" size={16} className="animate-spin" />}
            {updateQueries.isPending ? 'Salvando buscas…' : 'Buscas:'}
          </span>
          {t.queries.map((q) => (
            <Chip key={q} mono icon="search">
              {q}
              {t.queries.length > 1 && (
                <button
                  type="button"
                  aria-label={`Remover a busca ${q}`}
                  className="ml-1 align-middle"
                  disabled={updateQueries.isPending}
                  onClick={() => saveQueries(t.queries.filter((other) => other !== q))}
                >
                  <Icon name="close" size={14} />
                </button>
              )}
            </Chip>
          ))}
          <Input
            className="min-w-[220px] flex-1"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Outra busca"
          />
          <Button type="submit" size="sm" icon="add" disabled={!draft.trim()} loading={updateQueries.isPending}>
            Adicionar busca
          </Button>
        </form>
      )}
      {open && (
        <div className="border-t border-line">
          {releases.isLoading && <Loading label="Buscando os episódios no provedor…" />}
          {releases.isError && <ErrorState error={releases.error} onRetry={() => releases.refetch()} />}
          {releases.data && <EditionReleases releases={releases.data.releases} provider={t.provider} anilistId={t.anilistId} />}
        </div>
      )}
    </section>
  )
}
