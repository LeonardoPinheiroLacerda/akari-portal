import { useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { useListCaches, useQueueCacheDownload } from '@/api/generated/endpoints/cache/cache'
import { useGetMediaProbe } from '@/api/generated/endpoints/media-probe/media-probe'
import { useListVideoFiles } from '@/api/generated/endpoints/video-file/video-file'
import type { MediaInfoResponse, SubtitleTrack } from '@/api/generated/model'
import { errorStatus, toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Chip, type Tone } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/misc'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import type { ItemState } from '@/features/item/useItem'
import { usePlaybackSession, type Profile } from '@/features/playback/usePlaybackSession'
import { providerName, usesCache } from '@/features/providers/types'
import { useProviders } from '@/features/providers/useProviders'
import { byName } from '@/features/item/autoPair'
import { episodeCode, formatBitrate, formatBytes, formatClock, formatTime, parseClock } from '@/lib/format'
import { cn } from '@/lib/utils'

const PROFILES: { value: Profile; hint: string }[] = [
  { value: 'WEB', hint: 'Navegador (hls.js)' },
  { value: 'TV', hint: 'TV / set-top box' },
  { value: 'MOBILE', hint: 'Dispositivo móvel' },
]

const isSoft = (codec?: string | null) => codec === 'subrip' || codec === 'srt'
const subLabel = (s: SubtitleTrack) => s.title ?? s.language ?? s.codec ?? 'Legenda'

export function PlaybackTab({ item, folderId }: { item: ItemState; folderId: number }) {
  const filesQ = useListVideoFiles({ folderId, size: 1000 })
  const files = useMemo(() => [...(filesQ.data?.data ?? [])].sort(byName), [filesQ.data])
  const { byId } = useProviders()
  const provider = item.folder.data ? byId.get(item.folder.data.storageProviderId) : undefined
  const remote = usesCache(provider?.type)

  const [fileId, setFileId] = useState<number | null>(null)
  useEffect(() => {
    if (fileId == null && files.length) setFileId(files[0].id)
  }, [files, fileId])
  const file = files.find((f) => f.id === fileId)

  // A API não filtra o cache por arquivo; a listagem é pequena (linhas do cache local).
  const caches = useListCaches(
    { page: 0, size: 500 },
    {
      query: {
        enabled: remote,
        refetchInterval: (q) =>
          q.state.data?.data.some((c) => c.videoFile?.id === fileId && (c.status === 'QUEUED' || c.status === 'DOWNLOADING'))
            ? 5000
            : false,
      },
    },
  )
  const cacheRow = caches.data?.data.find((c) => c.videoFile?.id === fileId)
  const cacheState: { label: string; tone: Tone; ready: boolean; canQueue: boolean } = !remote
    ? { label: 'Leitura direta do disco', tone: 'ok', ready: true, canQueue: false }
    : cacheRow?.status === 'COMPLETED'
      ? { label: 'Em cache', tone: 'ok', ready: true, canQueue: false }
      : cacheRow?.status === 'QUEUED' || cacheRow?.status === 'DOWNLOADING'
        ? {
            label: cacheRow.status === 'DOWNLOADING' ? 'Baixando' : 'Na fila de download',
            tone: 'info',
            ready: false,
            canQueue: false,
          }
        : cacheRow?.status === 'FAILED'
          ? { label: 'Falha no download', tone: 'err', ready: false, canQueue: true }
          : { label: 'Fora do cache', tone: 'warn', ready: false, canQueue: true }

  const queue = useQueueCacheDownload()
  const probe = useGetMediaProbe(fileId ?? 0, { query: { enabled: fileId != null && cacheState.ready } })

  if (filesQ.isLoading) return <Loading />
  if (filesQ.isError) return <ErrorState error={filesQ.error} onRetry={() => filesQ.refetch()} />
  if (!files.length)
    return (
      <EmptyState
        dashed
        icon="video_file"
        title="Pasta sem arquivos de vídeo"
        description="Não há o que reproduzir nesta pasta."
      />
    )

  const fileLabel = (f: (typeof files)[number]) =>
    `${episodeCode(f.tmdbPairing?.seasonNumber, f.tmdbPairing?.episodeNumber) ?? 'sem par'} · ${f.name}`

  return (
    <>
      <section className="card flex flex-wrap items-end gap-3 px-5 py-3.5">
        <label className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
          <span className="text-xs text-muted">Arquivo</span>
          <Select
            value={fileId != null ? String(fileId) : ''}
            onChange={(v) => setFileId(Number(v))}
            options={files.map((f) => ({ value: String(f.id), label: fileLabel(f) }))}
            aria-label="Arquivo"
          />
        </label>
        <div className="flex flex-col gap-1">
          <span className="text-xs text-muted">Disponibilidade</span>
          <div className="flex h-9 items-center gap-2">
            <Chip tone={cacheState.tone}>{cacheState.label}</Chip>
            {provider && <span className="text-sm text-muted">{providerName(provider)}</span>}
            {cacheState.canQueue && (
              <Button
                size="xs"
                className="border-accent"
                loading={queue.isPending}
                onClick={() =>
                  queue.mutate(
                    { data: { fileId: fileId! } },
                    {
                      onSuccess: async () => {
                        await invalidate.cache()
                        toast.success('Download enfileirado')
                      },
                      onError: (e) => toastError(e),
                    },
                  )
                }
              >
                Enfileirar download
              </Button>
            )}
          </div>
        </div>
      </section>

      {!cacheState.ready ? (
        <div className="flex items-start gap-3 rounded-r border border-dashed border-line px-5 py-4 text-13 leading-normal text-muted">
          <Icon name="hourglass_empty" size={20} />
          <span>
            {cacheState.canQueue
              ? 'Este arquivo ainda não está em cache. Enfileire o download para ver as informações técnicas e testar a reprodução.'
              : 'Download na fila. As informações técnicas e a reprodução ficam disponíveis quando o arquivo terminar de baixar; acompanhe na tela Cache.'}
          </span>
        </div>
      ) : probe.isLoading ? (
        <Loading label="Lendo as informações do arquivo…" />
      ) : probe.isError ? (
        errorStatus(probe.error) === 404 ? (
          <div className="flex items-start gap-3 rounded-r border border-dashed border-line px-5 py-4 text-13 text-muted">
            <Icon name="hourglass_empty" size={20} />
            <span>O arquivo ainda não está disponível no servidor. Tente de novo em instantes.</span>
          </div>
        ) : (
          <ErrorState error={probe.error} onRetry={() => probe.refetch()} />
        )
      ) : (
        probe.data && file && <Player key={file.id} fileId={file.id} fileName={file.name} probe={probe.data} />
      )}
    </>
  )
}

function Player({ fileId, fileName, probe }: { fileId: number; fileName: string; probe: MediaInfoResponse }) {
  const video = useRef<HTMLVideoElement>(null)
  const pb = usePlaybackSession(video)
  const defaultAudio = Math.max(
    0,
    probe.audio.findIndex((a) => a.defaultTrack),
  )
  const [profile, setProfile] = useState<Profile>('WEB')
  const [audio, setAudio] = useState(String(defaultAudio))
  const [sub, setSub] = useState('')
  const [seekVal, setSeekVal] = useState('00:00')
  const [now, setNow] = useState(Date.now())

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [])

  const active = pb.session != null && pb.status !== 'expired' && pb.status !== 'idle'
  const tracks = { audio: Number(audio), subtitle: sub === '' ? null : Number(sub) }
  const changed = active && (pb.session!.tracks.audio !== tracks.audio || pb.session!.tracks.subtitle !== tracks.subtitle)
  const subSel = sub === '' ? null : probe.subtitles[Number(sub)]
  const duration = probe.container.durationSeconds ?? 0
  const hbLeft = pb.expiresAt ? Math.max(0, Math.round((pb.expiresAt - now) / 1000)) : null

  const start = () => pb.start(fileId, profile, tracks).catch(() => undefined)

  return (
    <>
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex min-w-0 flex-[2_1_520px] flex-col gap-3">
          <div className="relative aspect-video overflow-hidden rounded-r border border-line bg-[repeating-linear-gradient(135deg,#1b1714_0_10px,#221d19_10px_20px)]">
            <video ref={video} controls={active} playsInline className={cn('h-full w-full bg-black', !active && 'invisible')} />
            {!active && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2.5 text-[#bfb4a8]">
                <button
                  type="button"
                  onClick={start}
                  disabled={pb.status === 'starting'}
                  aria-label="Iniciar sessão"
                  className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff6900] text-[#160a00] transition-transform hover:scale-105"
                >
                  <Icon
                    name={pb.status === 'starting' ? 'progress_activity' : 'play_arrow'}
                    size={36}
                    fill
                    className={pb.status === 'starting' ? 'animate-spin' : ''}
                  />
                </button>
                <span className="px-4 text-center font-mono text-sm">
                  {pb.status === 'expired' ? 'Sessão expirada · inicie de novo' : fileName}
                </span>
              </div>
            )}
            {active && pb.status === 'loading' && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-2 bg-black/40 font-mono text-sm text-[#f3ece4]">
                <Icon name="progress_activity" size={20} className="animate-spin" />
                Preparando o vídeo…
              </div>
            )}
          </div>
          {active && (
            <div className="flex items-center gap-2.5 font-mono text-xs text-muted">
              <span>{formatClock(pb.position)}</span>
              <Progress value={duration ? (pb.position / duration) * 100 : 0} className="h-1 flex-1" />
              <span>{formatClock(duration)}</span>
            </div>
          )}

          <div className="flex flex-wrap items-end gap-2.5">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted">Perfil de transcode</span>
              <Segmented
                size="md"
                aria-label="Perfil de transcode"
                value={profile}
                onChange={setProfile}
                options={PROFILES.map((p) => ({
                  value: p.value,
                  label: (
                    <span className="font-mono" title={p.hint}>
                      {p.value}
                    </span>
                  ),
                }))}
              />
            </div>
            <label className="flex min-w-0 flex-[1_1_200px] flex-col gap-1">
              <span className="text-xs text-muted">Faixa de áudio</span>
              <Select
                aria-label="Faixa de áudio"
                value={audio}
                onChange={setAudio}
                options={probe.audio.map((a, i) => ({
                  value: String(i),
                  label: `${i} · ${a.title ?? a.language ?? 'Áudio'} · ${a.codec ?? ''} ${a.channelLayout ?? ''}`.trim(),
                }))}
              />
            </label>
            <label className="flex min-w-0 flex-[1_1_240px] flex-col gap-1">
              <span className="text-xs text-muted">Legenda</span>
              <Select
                aria-label="Legenda"
                value={sub}
                onChange={setSub}
                options={[
                  { value: '', label: 'Sem legenda' },
                  ...probe.subtitles.map((s, i) => ({
                    value: String(i),
                    label: `${i} · ${subLabel(s)} · ${isSoft(s.codec) ? 'soft' : 'queimada'}`,
                  })),
                ]}
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button variant="primary" onClick={start} loading={pb.status === 'starting'}>
              {active ? 'Reiniciar sessão' : 'Iniciar sessão'}
            </Button>
            {active && (
              <>
                <Button disabled={!changed} className={cn(changed && 'border-accent')} onClick={() => pb.switchTracks(tracks)}>
                  Trocar faixas
                </Button>
                <form
                  className="flex h-9 items-center overflow-hidden rounded-rs border border-line"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const s = parseClock(seekVal)
                    if (s == null) return toast.error('Use o formato mm:ss')
                    pb.seek(Math.min(s, duration || s))
                  }}
                >
                  <Input
                    mono
                    value={seekVal}
                    onChange={(e) => setSeekVal(e.target.value)}
                    aria-label="Posição (mm:ss)"
                    className="h-full w-[72px] rounded-none border-0 px-2.5"
                  />
                  <button type="submit" className="h-full border-l border-line bg-raised px-3 text-sm hover:brightness-110">
                    Seek
                  </button>
                </form>
              </>
            )}
            <span className="min-w-[200px] flex-1 text-sm text-muted">
              {subSel
                ? isSoft(subSel.codec)
                  ? 'SRT vira faixa WebVTT soft, selecionável no player.'
                  : `${(subSel.codec ?? 'Esta legenda').toUpperCase()} é queimada no vídeo (hardsub).`
                : ''}
            </span>
          </div>
        </div>

        <section className="card min-w-0 flex-[1_1_300px] overflow-hidden">
          <div className="flex items-center gap-2 border-b border-line px-[18px] py-3.5">
            <h3 className="m-0 flex-1 text-15 font-semibold">Sessão</h3>
            <Chip tone={active ? 'ok' : pb.status === 'expired' ? 'warn' : 'neutral'} className="h-5 text-xs">
              {active ? 'Ativa' : pb.status === 'expired' ? 'Expirada' : 'Sem sessão'}
            </Chip>
          </div>
          {(pb.session
            ? [
                ['ID da sessão', `${pb.session.id.slice(0, 13)}…`],
                ['Perfil', pb.session.profile],
                [
                  'Faixa de áudio',
                  probe.audio[pb.session.tracks.audio]?.title ||
                    probe.audio[pb.session.tracks.audio]?.language ||
                    `Faixa ${pb.session.tracks.audio}`,
                ],
                [
                  'Legenda',
                  pb.session.tracks.subtitle == null ? 'Sem legenda' : subLabel(probe.subtitles[pb.session.tracks.subtitle]),
                ],
                ['Início da playlist', formatClock(pb.session.startOffset)],
              ]
            : [['Estado', 'Escolha perfil e faixas e inicie a sessão']]
          ).map(([k, v]) => (
            <div key={k} className="flex justify-between gap-3 border-b border-line px-[18px] py-[9px]">
              <span className="text-13 text-muted">{k}</span>
              <span className="break-all text-right font-mono text-sm" title={k === 'ID da sessão' ? pb.session?.id : undefined}>
                {v}
              </span>
            </div>
          ))}
          {active && hbLeft != null && pb.ttl && (
            <div className="flex flex-col gap-1.5 border-b border-line px-[18px] py-2.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted">Renovação automática · expira em</span>
                <span className="font-mono">{hbLeft} s</span>
              </div>
              <Progress value={(hbLeft / pb.ttl) * 100} className="h-1 [&>div]:duration-1000 [&>div]:ease-linear" />
            </div>
          )}
          <div className="max-h-[200px] overflow-y-auto whitespace-pre-wrap bg-code px-[18px] py-3 font-mono text-xs leading-[1.7] text-muted">
            {pb.log.length ? pb.log.map((l) => `${formatTime(l.at)}  ${l.text}`).join('\n') : 'Nada aconteceu ainda.'}
          </div>
        </section>
      </div>

      <TechInfo probe={probe} audio={Number(audio)} sub={sub === '' ? null : Number(sub)} />
    </>
  )
}

function TechInfo({ probe, audio, sub }: { probe: MediaInfoResponse; audio: number; sub: number | null }) {
  const c = probe.container
  const head = 'grid gap-2.5 border-b border-line px-4 py-2 text-2xs uppercase tracking-[.06em] text-muted'
  const row = 'grid items-center gap-2.5 border-b border-line px-4 py-[9px] font-mono text-sm'
  const def = <Chip className="h-[18px] text-2xs font-bold">default</Chip>
  const V = 'grid-cols-[40px_90px_110px_70px_70px_150px_100px_1fr]'
  const A = 'grid-cols-[40px_70px_90px_100px_90px_90px_1fr]'
  const S = 'grid-cols-[40px_80px_70px_1fr_160px]'

  return (
    <section className="card overflow-x-auto">
      <div className="min-w-[820px]">
        <div className="flex flex-wrap items-baseline gap-x-5 gap-y-2.5 border-b border-line px-4 py-3.5">
          <h3 className="m-0 text-15 font-semibold">Informações técnicas do arquivo</h3>
          <div className="flex-1" />
          {[
            ['Container', c.formatName ?? '—'],
            ['Duração', formatClock(c.durationSeconds)],
            ['Tamanho', formatBytes(c.sizeBytes, 2)],
            ['Bitrate', formatBitrate(c.bitRate)],
          ].map(([k, v]) => (
            <span key={k} className="text-sm text-muted">
              {k} <b className="font-mono font-medium text-text">{v}</b>
            </span>
          ))}
        </div>

        <div className="px-4 pb-1 pt-2.5 text-sm font-semibold">Vídeo</div>
        <div className={cn(head, V)}>
          <span>#</span>
          <span>Codec</span>
          <span>Resolução</span>
          <span>DAR</span>
          <span>FPS</span>
          <span>Pixel / profile</span>
          <span>Bitrate</span>
          <span>Idioma / título</span>
        </div>
        {probe.video.map((v, i) => (
          <div key={i} className={cn(row, V)}>
            <span className="text-muted">{v.index ?? i}</span>
            <span>{v.codec ?? '—'}</span>
            <span>{v.width && v.height ? `${v.width}×${v.height}` : '—'}</span>
            <span>{v.displayAspectRatio ?? '—'}</span>
            <span>{v.frameRate?.toLocaleString('pt-BR', { maximumFractionDigits: 3 }) ?? '—'}</span>
            <span className="truncate">{[v.pixFmt, v.profile].filter(Boolean).join(' · ') || '—'}</span>
            <span>{formatBitrate(v.bitRate)}</span>
            <span className="flex items-center gap-1.5 font-sans">
              {[v.language, v.title].filter(Boolean).join(' · ') || '—'}
              {v.defaultTrack && def}
            </span>
          </div>
        ))}

        <div className="px-4 pb-1 pt-3.5 text-sm font-semibold">Áudio</div>
        <div className={cn(head, A)}>
          <span>Pos.</span>
          <span>Codec</span>
          <span>Canais</span>
          <span>Amostragem</span>
          <span>Bitrate</span>
          <span>Idioma</span>
          <span>Título</span>
        </div>
        {probe.audio.map((a, i) => (
          <div key={i} className={cn(row, A, i === audio && 'bg-tint')}>
            <span className="text-muted">{i}</span>
            <span>{a.codec ?? '—'}</span>
            <span>{[a.channels, a.channelLayout].filter((x) => x != null).join(' · ') || '—'}</span>
            <span>{a.sampleRate ? `${(a.sampleRate / 1000).toLocaleString('pt-BR')} kHz` : '—'}</span>
            <span>{formatBitrate(a.bitRate)}</span>
            <span>{a.language ?? '—'}</span>
            <span className="flex items-center gap-1.5 font-sans">
              {a.title ?? '—'}
              {a.defaultTrack && def}
            </span>
          </div>
        ))}
        {probe.audio.length === 0 && <div className="px-4 py-2.5 text-13 text-muted">Sem faixas de áudio.</div>}

        <div className="px-4 pb-1 pt-3.5 text-sm font-semibold">Legendas</div>
        <div className={cn(head, S)}>
          <span>Pos.</span>
          <span>Codec</span>
          <span>Idioma</span>
          <span>Título</span>
          <span>No playback</span>
        </div>
        {probe.subtitles.map((s, i) => (
          <div key={i} className={cn(row, S, i === sub && 'bg-tint')}>
            <span className="text-muted">{i}</span>
            <span>{s.codec ?? '—'}</span>
            <span>{s.language ?? '—'}</span>
            <span className="flex flex-wrap items-center gap-1.5 font-sans">
              {s.title ?? '—'}
              {s.defaultTrack && def}
              {s.forced && (
                <Chip tone="info" className="h-[18px] text-2xs font-bold">
                  forced
                </Chip>
              )}
              {s.hearingImpaired && (
                <Chip tone="info" className="h-[18px] text-2xs font-bold">
                  SDH
                </Chip>
              )}
            </span>
            <Chip tone={isSoft(s.codec) ? 'ok' : 'warn'} className="h-5 font-sans text-xs">
              {isSoft(s.codec) ? 'Soft · WebVTT' : 'Queimada (hardsub)'}
            </Chip>
          </div>
        ))}
        {probe.subtitles.length === 0 && <div className="px-4 py-2.5 text-13 text-muted">Sem legendas.</div>}
      </div>
    </section>
  )
}
