import { useState } from 'react'
import { useListHiddenAnimes } from '@/api/generated/endpoints/anime-franchise/anime-franchise'
import { Button } from '@/components/ui/button'
import { Dialog } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Pagination } from '@/components/ui/misc'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { Tooltip } from '@/components/ui/tooltip'
import { FranchisePicker } from './pickers'
import { titleOf, useFranchiseActions, type Work } from './useFranchiseActions'

const PAGE_SIZE = 20

/**
 * Obras ocultas: postas fora de qualquer franquia (os clientes não as listam). Cada uma pode voltar
 * ao automático, ir para uma franquia ou virar o início de uma franquia própria. As que estão
 * ocultas só por herança (o pai está oculto) não aparecem aqui: voltam junto com o pai.
 */
export function HiddenPanel() {
  const [page, setPage] = useState(0)
  const hidden = useListHiddenAnimes({ page, size: PAGE_SIZE })
  const actions = useFranchiseActions()
  const [moving, setMoving] = useState<Work | null>(null)

  if (hidden.isLoading) return <Loading />
  if (hidden.isError) return <ErrorState error={hidden.error} onRetry={() => hidden.refetch()} />
  const items = hidden.data?.data ?? []

  return (
    <section className="card flex flex-col gap-3 p-4">
      <div className="flex flex-col gap-0.5">
        <h2 className="m-0 text-17 font-semibold">Ocultas</h2>
        <span className="text-sm text-muted">
          Obras fora de qualquer franquia: os clientes não as listam. As obras abaixo de cada uma também ficam ocultas.
        </span>
      </div>
      {items.length === 0 && <EmptyState icon="visibility" title="Nenhuma obra oculta" dashed />}
      <div className="flex flex-col gap-1.5">
        {items.map((b) => {
          const w: Work = { anilistId: b.anilistId, title: titleOf(b) }
          const loading = actions.busy?.endsWith(`-${b.anilistId}`)
          return (
            <div key={b.anilistId} className="flex items-center gap-3 rounded-rs border border-line bg-bg px-3 py-2">
              <Thumb src={b.thumbnail} width={30} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="font-semibold">{w.title}</span>
                <span className="truncate text-sm text-muted">
                  {[b.format, b.year, `AniList ${b.anilistId}`].filter(Boolean).join(' · ')}
                </span>
              </div>
              {loading ? (
                <Icon name="progress_activity" size={18} className="animate-spin text-muted" />
              ) : (
                <div className="flex shrink-0 flex-wrap justify-end gap-1">
                  <Tooltip content="Abrir item">
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      aria-label="Abrir item"
                      onClick={() => window.open(`/catalogo/${b.folderId}/anilist`, '_blank', 'noopener')}
                    >
                      <Icon name="open_in_new" size={18} />
                    </Button>
                  </Tooltip>
                  <Button size="sm" icon="undo" disabled={actions.busy != null} onClick={() => void actions.toAuto(w)}>
                    Voltar ao automático
                  </Button>
                  <Button size="sm" icon="drive_file_move" disabled={actions.busy != null} onClick={() => setMoving(w)}>
                    Mover para…
                  </Button>
                  <Button
                    size="sm"
                    icon="account_tree"
                    disabled={actions.busy != null}
                    onClick={() => void actions.ownFranchise(w)}
                  >
                    Franquia própria
                  </Button>
                </div>
              )}
            </div>
          )
        })}
      </div>
      {hidden.data && hidden.data.totalPages > 1 && (
        <Pagination page={page} totalPages={hidden.data.totalPages} size={PAGE_SIZE} onPage={setPage} />
      )}

      <Dialog open={moving != null} onOpenChange={(o) => !o && setMoving(null)}>
        {moving && (
          <FranchisePicker
            title={`Mover ${moving.title}`}
            description="A obra vai para a franquia escolhida, com as que estão abaixo dela."
            stateOf={() => null}
            action={{ icon: 'check', label: 'Escolher', busyKey: () => `move-${moving.anilistId}` }}
            busy={actions.busy}
            onPick={async (f) => {
              await actions.moveTo(moving, { anilistId: f.root.anilistId, title: titleOf(f.root) })
              setMoving(null)
            }}
          />
        )}
      </Dialog>
    </section>
  )
}
