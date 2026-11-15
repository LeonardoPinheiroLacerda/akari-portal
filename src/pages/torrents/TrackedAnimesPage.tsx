import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useListTrackedAnimeReleases,
  useListTrackedAnimes,
  useUntrackAnime,
} from '@/api/generated/endpoints/torrent-tracking/torrent-tracking'
import type { TrackedAnimeResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
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
  // A lista refaz a busca completa no provedor, então só carrega quando aberta.
  const releases = useListTrackedAnimeReleases(t.id, { query: { enabled: open, staleTime: 5 * 60_000 } })
  const untrack = useUntrackAnime()

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
            {t.lastCheckedAt ? `checado ${formatRelative(t.lastCheckedAt)}` : 'ainda não checado'}
          </span>
          {t.lastError && <span className="text-sm text-[var(--err-fg)]">{t.lastError}</span>}
        </div>
        <div className="flex items-center gap-2">
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
