import { useCallback, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useGetTmdbFilePairing } from '@/api/generated/endpoints/anime-tmdb-file-pairing/anime-tmdb-file-pairing'
import {
  deleteCacheItem,
  listCaches,
  useDeleteCacheItem,
  useListCaches,
  useQueueCacheDownload,
} from '@/api/generated/endpoints/cache/cache'
import { useGetFolder } from '@/api/generated/endpoints/media-folder/media-folder'
import type { CacheItem, CacheStatus } from '@/api/generated/model'
import { errorStatus, toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { useEventSource, type CacheEvent } from '@/api/sse'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip, type Tone } from '@/components/ui/chip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Progress } from '@/components/ui/misc'
import { Section } from '@/components/ui/section'
import { ErrorState, Loading } from '@/components/ui/states'
import { providerName } from '@/features/providers/types'
import { useProviders } from '@/features/providers/useProviders'
import { episodeCode, formatBytes, formatRelative, formatTime } from '@/lib/format'

type Live = {
  status?: CacheStatus
  bytes?: number | null
  totalBytes?: number | null
  speed?: number | null
  eta?: number | null
  percentage?: number | null
  error?: string | null
}

const STATUS: Record<CacheStatus, { label: string; tone: Tone }> = {
  QUEUED: { label: 'Na fila', tone: 'neutral' },
  DOWNLOADING: { label: 'Baixando', tone: 'info' },
  COMPLETED: { label: 'Em cache', tone: 'ok' },
  FAILED: { label: 'Falhou', tone: 'err' },
}

const quality = (name: string, format?: string | null) =>
  /\b(2160|1440|1080|720|576|480)p\b/i.exec(name)?.[0].toLowerCase() ?? format?.toUpperCase() ?? '—'

export function CachePage() {
  usePageMeta('Cache')
  const pending = useListCaches({ page: 0, size: 200, pendingOnly: true })
  const all = useListCaches({ page: 0, size: 500 })
  const [live, setLive] = useState<Record<string, Live>>({})

  const onMessage = useCallback((e: CacheEvent) => {
    switch (e.type) {
      case 'SNAPSHOT':
      case 'QUEUED':
        invalidate.cache()
        break
      case 'STARTED':
        if (e.id)
          setLive((l) => ({
            ...l,
            [e.id!]: { ...l[e.id!], status: 'DOWNLOADING' },
          }))
        break
      case 'PROGRESS':
        if (e.id)
          setLive((l) => ({
            ...l,
            [e.id!]: {
              status: 'DOWNLOADING',
              bytes: e.bytes,
              totalBytes: e.totalBytes,
              speed: e.speed,
              eta: e.eta,
              percentage: e.percentage,
            },
          }))
        break
      case 'COMPLETED':
      case 'EVICTED':
      case 'CANCELLED':
      case 'DELETED':
        if (e.id)
          setLive((l) => {
            const { [e.id!]: _drop, ...rest } = l
            void _drop
            return rest
          })
        invalidate.cache()
        break
      case 'FAILED':
        if (e.id)
          setLive((l) => ({
            ...l,
            [e.id!]: { ...l[e.id!], status: 'FAILED', error: e.errorMessage },
          }))
        invalidate.cache()
        break
      case 'IDLE':
        invalidate.cache()
        break
    }
  }, [])

  // Sem replay nem heartbeat no stream: a cada (re)conexão reconcilia pelo REST.
  const sse = useEventSource<CacheEvent>('/v1/cache/events', {
    events: ['SNAPSHOT', 'IDLE', 'QUEUED', 'STARTED', 'PROGRESS', 'COMPLETED', 'FAILED', 'EVICTED', 'CANCELLED', 'DELETED'],
    onMessage,
    onOpen: () => invalidate.cache(),
    closeOn: (e) => e.type === 'IDLE',
  })

  const queue = useMemo(() => {
    const rows = pending.data?.data ?? []
    const order: Record<string, number> = {
      DOWNLOADING: 0,
      QUEUED: 1,
      FAILED: 2,
    }
    return [...rows].sort((a, b) => {
      const sa = live[a.id]?.status ?? a.status
      const sb = live[b.id]?.status ?? b.status
      return (order[sa] ?? 3) - (order[sb] ?? 3) || a.queuedAt.localeCompare(b.queuedAt)
    })
  }, [pending.data, live])
  const completed = useMemo(
    () => (all.data?.data ?? []).filter((c) => c.status === 'COMPLETED').sort((a, b) => b.queuedAt.localeCompare(a.queuedAt)),
    [all.data],
  )
  // Reenfileirar um FAILED reaproveita o id da linha: descarta o estado ao vivo da falha e
  // reabre o stream, que pode ter fechado em IDLE.
  const onRetried = (id: string) => {
    setLive((l) => {
      const { [id]: _drop, ...rest } = l
      void _drop
      return rest
    })
    sse.reconnect()
  }
  const totalBytes = completed.reduce((s, c) => s + (c.videoFile?.sizeBytes ?? 0), 0)

  const sseChip =
    sse.status === 'open'
      ? { label: 'Ao vivo', tone: 'ok' as Tone, pulse: true }
      : sse.status === 'idle'
        ? { label: 'Fila ociosa', tone: 'neutral' as Tone, pulse: false }
        : sse.status === 'connecting'
          ? { label: 'Conectando…', tone: 'info' as Tone, pulse: true }
          : { label: 'Reconectando…', tone: 'warn' as Tone, pulse: true }

  return (
    <>
      <Section
        title="Fila de downloads"
        actions={
          <>
            <span
              className="flex h-7 items-center gap-2 rounded-chip px-2.5 text-sm font-semibold"
              style={{
                background: `var(--${sseChip.tone}-bg, var(--raised))`,
                color: `var(--${sseChip.tone}-fg, var(--muted))`,
              }}
            >
              <span className={`h-[7px] w-[7px] rounded-full bg-current ${sseChip.pulse ? 'animate-pulse-dot' : ''}`} />
              {sseChip.label}
            </span>
            <span className="font-mono text-sm text-muted">
              Último evento {sse.lastEventAt ? formatTime(sse.lastEventAt) : '—'}
            </span>
            <BulkDelete
              kind="cancel"
              count={queue.filter((c) => ['QUEUED', 'DOWNLOADING'].includes(live[c.id]?.status ?? c.status)).length}
            />
          </>
        }
      >
        {pending.isLoading && <Loading />}
        {pending.isError && <ErrorState error={pending.error} onRetry={() => pending.refetch()} />}
        {pending.data && queue.length === 0 && (
          <div className="px-5 py-5 text-13 text-muted">Nenhum download em andamento. Aguardando novos pedidos.</div>
        )}
        {queue.map((c) => (
          <QueueRow key={c.id} item={c} live={live[c.id]} onRetried={onRetried} />
        ))}
      </Section>

      <section className="card overflow-x-auto">
        <div className="min-w-[720px]">
          <div className="flex items-center gap-2.5 border-b border-line px-5 py-3.5">
            <h3 className="m-0 flex-1 text-15 font-semibold">Arquivos em cache</h3>
            <span className="text-sm text-muted">
              {completed.length} {completed.length === 1 ? 'arquivo' : 'arquivos'} · {formatBytes(totalBytes)} · mais recentes
              primeiro
            </span>
            <BulkDelete kind="delete" count={completed.length} />
          </div>
          <div
            className={`grid ${CACHED_COLS} gap-3 border-b border-line px-5 py-2.5 text-xs uppercase tracking-[.06em] text-muted`}
          >
            <span>Episódio</span>
            <span>Origem</span>
            <span>Qualidade</span>
            <span>Tamanho</span>
            <span>Pedido em</span>
            <span />
          </div>
          {all.isLoading && <Loading />}
          {all.isError && <ErrorState error={all.error} onRetry={() => all.refetch()} />}
          {all.data && completed.length === 0 && (
            <div className="px-5 py-5 text-13 text-muted">Nenhum arquivo em cache ainda.</div>
          )}
          {completed.map((c) => (
            <CachedRow key={c.id} item={c} />
          ))}
        </div>
      </section>
    </>
  )
}

/** Título (pasta), código do episódio e provedor de um item do cache. */
function useCacheItemInfo(item: CacheItem) {
  const vf = item.videoFile
  const folder = useGetFolder(vf?.folderId ?? 0, {
    query: { enabled: vf != null, staleTime: 5 * 60_000 },
  })
  const pairing = useGetTmdbFilePairing(vf?.id ?? 0, {
    query: { enabled: vf != null, staleTime: 60_000 },
  })
  const { byId } = useProviders()
  const prov = folder.data ? byId.get(folder.data.storageProviderId) : undefined
  return {
    title: folder.data?.name ?? vf?.name ?? 'Arquivo removido do catálogo',
    folderId: vf?.folderId,
    ep: episodeCode(pairing.data?.seasonNumber, pairing.data?.episodeNumber),
    provider: prov ? providerName(prov) : undefined,
  }
}

function QueueRow({ item: c, live, onRetried }: { item: CacheItem; live?: Live; onRetried: (id: string) => void }) {
  const info = useCacheItemInfo(c)
  const queue = useQueueCacheDownload()
  const cancel = useDeleteCacheItem()
  const [confirming, setConfirming] = useState(false)
  const status = live?.status ?? c.status
  const st = STATUS[status]
  // O rclone reporta totalBytes 0 até a transferência começar (ex.: login no MEGA após reiniciar o rcd).
  const total = live?.totalBytes || c.videoFile?.sizeBytes || null
  const starting = status === 'DOWNLOADING' && !live?.bytes
  const pct = live?.percentage ?? (status === 'COMPLETED' ? 100 : 0)
  const retry = () =>
    c.videoFile &&
    queue.mutate(
      { data: { fileId: c.videoFile.id } },
      {
        onSuccess: async () => {
          onRetried(c.id)
          await invalidate.cache()
          toast.success('Download enfileirado de novo')
        },
        onError: (e) => toastError(e),
      },
    )
  // A linha some da fila pelo evento CANCELLED; o invalidate cobre o caso do stream fechado.
  const doCancel = () =>
    cancel.mutate(
      { itemId: c.id },
      {
        onSuccess: async () => {
          await invalidate.cache()
          toast.success('Download cancelado')
        },
        onError: (e) => {
          setConfirming(false)
          toastError(e)
        },
      },
    )
  const cancellable = status === 'QUEUED' || status === 'DOWNLOADING'

  return (
    <div className="flex flex-col gap-2 border-b border-line px-5 py-3 last:border-b-0">
      <div className="flex flex-wrap items-baseline gap-2.5">
        <span className="font-medium">{info.title}</span>
        <span className="font-mono text-sm text-muted">{info.ep ?? c.videoFile?.name}</span>
        {info.provider && <span className="text-sm text-muted">{info.provider}</span>}
        <div className="flex-1" />
        {status === 'FAILED' && c.videoFile && (
          <Button size="xs" icon="refresh" iconSize={16} loading={queue.isPending} onClick={retry}>
            Tentar de novo
          </Button>
        )}
        <Chip tone={st.tone} className="h-[22px]">
          {st.label}
        </Chip>
        {cancellable && !confirming && (
          <Button size="xs" icon="close" iconSize={16} className="text-danger" onClick={() => setConfirming(true)}>
            Cancelar
          </Button>
        )}
      </div>
      {cancellable && confirming && (
        <div className="flex flex-wrap items-center gap-2.5 rounded-rs border border-danger px-3.5 py-2.5">
          <span className="flex-1 text-13 leading-normal">
            Cancelar o download? {status === 'DOWNLOADING' ? 'O que já foi baixado é descartado e a' : 'A'} linha sai da fila.
          </span>
          <Button size="xs" onClick={() => setConfirming(false)}>
            Voltar
          </Button>
          <Button size="xs" variant="danger-solid" loading={cancel.isPending} onClick={doCancel}>
            Cancelar download
          </Button>
        </div>
      )}
      <Progress
        value={pct}
        className="h-1"
        color={status === 'FAILED' ? 'var(--err-fg)' : status === 'COMPLETED' ? 'var(--ok-fg)' : undefined}
      />
      <div className="flex gap-4 font-mono text-xs text-muted">
        <span className="flex-1 truncate">
          {status === 'FAILED'
            ? (live?.error ?? 'O download falhou.')
            : status === 'QUEUED'
              ? `Aguardando · ${formatBytes(total)}`
              : starting
                ? `Conectando ao provedor · ${formatBytes(total)}`
                : `${formatBytes(live?.bytes ?? 0)} de ${formatBytes(total)}${live?.eta != null ? ` · faltam ${Math.ceil(live.eta / 60)} min` : ''}`}
        </span>
        {status === 'DOWNLOADING' && <span>{live?.speed ? `${formatBytes(live.speed)}/s` : '—'}</span>}
        <span>{Math.round(pct)}%</span>
      </div>
    </div>
  )
}

const CACHED_COLS = 'grid-cols-[minmax(220px,1.8fr)_minmax(160px,1.4fr)_80px_90px_110px_36px]'

function CachedRow({ item: c }: { item: CacheItem }) {
  const info = useCacheItemInfo(c)
  const navigate = useNavigate()
  const vf = c.videoFile
  const del = useDeleteCacheItem()
  const [confirming, setConfirming] = useState(false)
  // A linha some da lista pelo evento DELETED; o invalidate cobre o caso do stream fechado.
  const remove = () =>
    del.mutate(
      { itemId: c.id },
      {
        onSuccess: async () => {
          await invalidate.cache()
          toast.success('Arquivo removido do cache')
        },
        onError: (e) => {
          setConfirming(false)
          toastError(e)
        },
      },
    )
  return (
    <div className="border-b border-line last:border-b-0">
      <div
        onClick={() => info.folderId && navigate(`/catalogo/${info.folderId}/reproducao`)}
        className={`grid cursor-pointer ${CACHED_COLS} items-center gap-3 px-5 py-[11px] transition-colors hover:bg-hover`}
      >
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="truncate font-medium">{info.title}</span>
          <span className="font-mono text-sm text-muted">{info.ep ?? 'sem par'}</span>
        </div>
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-13">{info.provider ?? '—'}</span>
          <span className="truncate font-mono text-xs text-muted">{vf?.name}</span>
        </div>
        <span className="font-mono text-sm">{vf ? quality(vf.name, vf.format) : '—'}</span>
        <span className="font-mono text-sm">{formatBytes(vf?.sizeBytes)}</span>
        <span className="text-sm text-muted">{formatRelative(c.queuedAt)}</span>
        <button
          type="button"
          aria-label="Remover do cache"
          title="Remover do cache"
          onClick={(e) => {
            e.stopPropagation()
            setConfirming(true)
          }}
          className="flex h-8 w-8 items-center justify-center rounded-rs text-danger transition-colors hover:bg-side-hover"
        >
          <Icon name="delete" size={18} />
        </button>
      </div>
      {confirming && (
        <div className="mx-5 mb-3 flex flex-wrap items-center gap-2.5 rounded-rs border border-danger px-3.5 py-2.5">
          <span className="flex-1 text-13 leading-normal">
            Remover <b>{info.ep ? `${info.title} ${info.ep}` : (vf?.name ?? info.title)}</b> do cache? O arquivo é apagado do
            disco e precisa ser baixado de novo para reproduzir.
          </span>
          <Button size="xs" onClick={() => setConfirming(false)}>
            Voltar
          </Button>
          <Button size="xs" variant="danger-solid" loading={del.isPending} onClick={remove}>
            Remover
          </Button>
        </div>
      )}
    </div>
  )
}

/** Todas as linhas do cache, página a página (a listagem da tela é limitada). */
async function fetchAllRows() {
  const rows: CacheItem[] = []
  for (let page = 0; ; page++) {
    const res = await listCaches({ page, size: 200 })
    rows.push(...res.data)
    if (page + 1 >= res.totalPages) return rows
  }
}

const BULK = {
  cancel: {
    button: 'Cancelar tudo',
    icon: 'cancel',
    title: 'Cancelar todos os downloads',
    body: (n: number) =>
      `${n} ${n === 1 ? 'download sai' : 'downloads saem'} da fila. O que já foi baixado é descartado e o download em andamento é interrompido.`,
    confirm: 'Cancelar downloads',
    done: 'cancelados',
    // Fila antes do que está baixando: cancelar o download primeiro deixaria o scheduler iniciar o próximo.
    pick: (rows: CacheItem[]) => [
      ...rows.filter((r) => r.status === 'QUEUED').sort((a, b) => a.queuedAt.localeCompare(b.queuedAt)),
      ...rows.filter((r) => r.status === 'DOWNLOADING'),
    ],
  },
  delete: {
    button: 'Deletar tudo',
    icon: 'delete_sweep',
    title: 'Deletar todos os arquivos em cache',
    body: (n: number) =>
      `${n} ${n === 1 ? 'arquivo é apagado' : 'arquivos são apagados'} do disco e ${n === 1 ? 'precisa' : 'precisam'} ser baixados de novo para reproduzir.`,
    confirm: 'Deletar arquivos',
    done: 'deletados',
    pick: (rows: CacheItem[]) => rows.filter((r) => r.status === 'COMPLETED'),
  },
} as const

/**
 * Ação em massa sobre o cache: não há endpoint em lote, então chama o DELETE de cada linha, uma
 * por vez. Linhas que mudaram de estado no meio (400) ou já sumiram (404) contam como ignoradas.
 */
function BulkDelete({ kind, count }: { kind: keyof typeof BULK; count: number }) {
  const cfg = BULK[kind]
  const [open, setOpen] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)

  const run = async () => {
    let ok = 0
    let skipped = 0
    let failed = 0
    let firstError: unknown
    try {
      const targets = cfg.pick(await fetchAllRows())
      setProgress({ done: 0, total: targets.length })
      for (const [i, row] of targets.entries()) {
        try {
          await deleteCacheItem(row.id)
          ok++
        } catch (e) {
          const status = errorStatus(e)
          if (status === 400 || status === 404) skipped++
          else {
            failed++
            firstError ??= e
          }
        }
        setProgress({ done: i + 1, total: targets.length })
      }
    } catch (e) {
      firstError ??= e
      failed++
    }
    await invalidate.cache()
    setProgress(null)
    setOpen(false)
    const extra = [skipped && `${skipped} ignorados`, failed && `${failed} com erro`].filter(Boolean).join(' · ')
    if (failed) toastError(firstError, `${ok} ${cfg.done}${extra ? ` · ${extra}` : ''}`)
    else toast.success(`${ok} ${cfg.done}${extra ? ` · ${extra}` : ''}`)
  }

  return (
    <>
      <Button
        size="xs"
        icon={cfg.icon}
        iconSize={16}
        className="text-danger"
        disabled={count === 0}
        onClick={() => setOpen(true)}
      >
        {cfg.button}
      </Button>
      <Dialog open={open} onOpenChange={(o) => !progress && setOpen(o)}>
        {open && (
          <DialogContent title={cfg.title} width={460}>
            <div className="flex flex-col gap-3 px-5 py-4 text-13 leading-normal">
              <span>{cfg.body(count)}</span>
              {progress && (
                <div className="flex items-center gap-2.5">
                  <Progress value={progress.total ? (progress.done / progress.total) * 100 : 100} className="flex-1" />
                  <span className="font-mono text-sm text-muted">
                    {progress.done} de {progress.total}
                  </span>
                </div>
              )}
            </div>
            <div className="flex justify-end gap-2 border-t border-line px-5 py-3">
              <Button size="sm" disabled={!!progress} onClick={() => setOpen(false)}>
                Voltar
              </Button>
              <Button size="sm" variant="danger-solid" loading={!!progress} onClick={run}>
                {cfg.confirm}
              </Button>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
