import { useState } from 'react'
import { toast } from 'sonner'
import { useStartTorrentDownload } from '@/api/generated/endpoints/torrent-download/torrent-download'
import type { TorrentProviderType, TorrentReleaseResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { DOWNLOAD_STATUS } from '@/features/torrents/labels'
import { formatRelative } from '@/lib/format'

/** Releases de uma edição (uma por episódio), com o estado de download de cada uma e o botão de baixar. */
export function EditionReleases({
  releases,
  provider,
  anilistId,
}: {
  releases: TorrentReleaseResponse[]
  provider: TorrentProviderType
  anilistId: number
}) {
  const [pending, setPending] = useState<string | null>(null)
  const start = useStartTorrentDownload()

  const download = (r: TorrentReleaseResponse) => {
    setPending(r.infoHash)
    start.mutate(
      { data: { provider, magnetUri: r.magnetUri, title: r.title, anilistId } },
      {
        // Baixar cria a pasta do anime na biblioteca e o vínculo com ele, se ainda não existiam.
        onSuccess: async () => {
          await Promise.all([invalidate.torrents(), invalidate.catalog(), invalidate.anime(anilistId)])
          toast.success(r.episode != null ? `Episódio ${r.episode} enviado para download` : 'Pacote enviado para download')
        },
        onError: (e) => toastError(e, 'Não foi possível baixar a release'),
        onSettled: () => setPending(null),
      },
    )
  }

  if (!releases.length) return <div className="px-5 py-5 text-13 text-muted">Nenhuma release nesta edição.</div>

  return (
    <div className="flex flex-col">
      {releases.map((r) => {
        // NEW = saiu do qBittorrent antes de terminar: pode ser baixada de novo.
        const status = r.downloadStatus && r.downloadStatus !== 'NEW' ? DOWNLOAD_STATUS[r.downloadStatus] : null
        const meta = [r.size, r.seeders != null && `${r.seeders} seeders`, r.publishedAt && formatRelative(r.publishedAt)]
          .filter(Boolean)
          .join(' · ')
        return (
          <div key={r.infoHash} className="flex items-center gap-3 border-b border-line px-5 py-2.5 last:border-b-0">
            <span className="w-16 shrink-0 font-mono text-13">{r.episode != null ? `Ep ${r.episode}` : 'Pacote'}</span>
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate text-13" title={r.title}>
                {r.title}
              </span>
              <span className="font-mono text-xs text-muted">{meta}</span>
            </div>
            {r.pageUrl && (
              <a
                href={r.pageUrl}
                target="_blank"
                rel="noreferrer"
                title="Ver no provedor"
                aria-label="Ver no provedor"
                className="flex h-[30px] w-[30px] items-center justify-center rounded-rs text-muted transition-colors hover:bg-hover"
              >
                <Icon name="open_in_new" size={16} />
              </a>
            )}
            {status ? (
              <Chip tone={status.tone} icon={status.icon}>
                {status.label}
              </Chip>
            ) : (
              <Button
                size="sm"
                icon="download"
                loading={pending === r.infoHash}
                disabled={pending != null}
                onClick={() => download(r)}
              >
                Baixar
              </Button>
            )}
          </div>
        )
      })}
    </div>
  )
}
