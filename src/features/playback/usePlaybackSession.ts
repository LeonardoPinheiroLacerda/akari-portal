import Hls from 'hls.js'
import { useCallback, useEffect, useRef, useState } from 'react'
import {
  heartbeatPlaybackSession,
  seekPlaybackSession,
  startPlaybackSession,
  switchPlaybackSessionTracks,
} from '@/api/generated/endpoints/playback/playback'
import type { PlaybackSessionResponse } from '@/api/generated/model'
import { errorMessage, errorStatus } from '@/api/errors'
import { apiUrl } from '@/api/http'
import { formatClock } from '@/lib/format'

export type Profile = 'WEB' | 'TV' | 'MOBILE'
export type Tracks = { audio: number; subtitle: number | null }

export type ActiveSession = {
  id: string
  profile: Profile
  tracks: Tracks
  startOffset: number
  playlistUrl: string
}

type LogLine = { at: Date; text: string }

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * A playlist só existe quando o transcode produz o primeiro segmento; até lá a API responde
 * 404 (mesmo código de "sessão expirada"). Tenta com backoff e devolve o TTL do heartbeat
 * informado no header `X-Playback-Heartbeat-Ttl-Seconds`.
 */
async function waitForPlaylist(url: string, signal: AbortSignal): Promise<number | null> {
  let delay = 500
  for (let i = 0; i < 40; i++) {
    const res = await fetch(apiUrl(url), { signal })
    if (res.ok) {
      const ttl = Number(res.headers.get('X-Playback-Heartbeat-Ttl-Seconds'))
      return Number.isFinite(ttl) && ttl > 0 ? ttl : null
    }
    if (res.status !== 404) throw new Error(`A playlist respondeu ${res.status}`)
    await sleep(delay)
    delay = Math.min(3000, delay * 1.5)
  }
  throw new Error('A playlist não ficou pronta a tempo')
}

export function usePlaybackSession(video: React.RefObject<HTMLVideoElement | null>) {
  const [session, setSession] = useState<ActiveSession | null>(null)
  const [status, setStatus] = useState<'idle' | 'starting' | 'loading' | 'playing' | 'expired' | 'error'>('idle')
  const [ttl, setTtl] = useState<number | null>(null)
  const [expiresAt, setExpiresAt] = useState<number | null>(null)
  const [log, setLog] = useState<LogLine[]>([])
  const [position, setPosition] = useState(0)
  const hls = useRef<Hls | null>(null)
  const hbTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const abort = useRef<AbortController | null>(null)
  const sessionRef = useRef<ActiveSession | null>(null)
  sessionRef.current = session

  const push = useCallback((text: string) => setLog((l) => [...l.slice(-60), { at: new Date(), text }]), [])

  const stopHeartbeat = () => clearTimeout(hbTimer.current)

  const teardown = useCallback(() => {
    stopHeartbeat()
    abort.current?.abort()
    hls.current?.destroy()
    hls.current = null
  }, [])

  useEffect(() => teardown, [teardown])

  // Posição na mídia = início da playlist + currentTime.
  useEffect(() => {
    const v = video.current
    if (!v) return
    const onTime = () => setPosition((sessionRef.current?.startOffset ?? 0) + v.currentTime)
    v.addEventListener('timeupdate', onTime)
    return () => v.removeEventListener('timeupdate', onTime)
  }, [video])

  const scheduleHeartbeat = useCallback(
    (id: string, seconds: number) => {
      stopHeartbeat()
      // Pinga com folga: na metade do prazo (mínimo 2 s).
      const wait = Math.max(2, seconds / 2) * 1000
      hbTimer.current = setTimeout(async () => {
        try {
          const hb = await heartbeatPlaybackSession(id)
          setExpiresAt(Date.now() + hb.expiresInSeconds * 1000)
          scheduleHeartbeat(id, hb.expiresInSeconds)
        } catch (e) {
          if (errorStatus(e) === 404) {
            setStatus('expired')
            push('A sessão expirou. Inicie uma nova para continuar.')
            teardown()
          } else {
            push(`Falha ao renovar a sessão: ${errorMessage(e)}. Tentando de novo…`)
            scheduleHeartbeat(id, 4)
          }
        }
      }, wait)
    },
    [push, teardown],
  )

  /** Carrega (ou recarrega) a playlist no player e posiciona em `target` (segundos da mídia). */
  const attach = useCallback(
    async (s: PlaybackSessionResponse, target: number, meta: Omit<ActiveSession, 'id' | 'startOffset' | 'playlistUrl'>) => {
      const v = video.current
      if (!v) return
      abort.current?.abort()
      const ctrl = new AbortController()
      abort.current = ctrl
      const next: ActiveSession = {
        id: s.sessionId,
        startOffset: s.startOffsetSeconds,
        playlistUrl: s.playlistUrl,
        ...meta,
      }
      setSession(next)
      setStatus('loading')
      const ttlSeconds = await waitForPlaylist(s.playlistUrl, ctrl.signal)
      if (ctrl.signal.aborted) return
      if (ttlSeconds) {
        setTtl(ttlSeconds)
        setExpiresAt(Date.now() + ttlSeconds * 1000)
        scheduleHeartbeat(s.sessionId, ttlSeconds)
      }

      const src = apiUrl(s.playlistUrl)
      const local = Math.max(0, target - s.startOffsetSeconds)
      if (Hls.isSupported()) {
        hls.current?.destroy()
        const h = new Hls({
          // Segmentos ainda não gerados respondem 404: o player tenta de novo na borda ao vivo.
          fragLoadPolicy: {
            default: {
              maxTimeToFirstByteMs: 10_000,
              maxLoadTimeMs: 60_000,
              timeoutRetry: { maxNumRetry: 6, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
              errorRetry: { maxNumRetry: 10, retryDelayMs: 1000, maxRetryDelayMs: 4000 },
            },
          },
          renderTextTracksNatively: true,
        })
        hls.current = h
        h.on(Hls.Events.MANIFEST_PARSED, () => {
          if (local > 0) v.currentTime = local
          if (meta.tracks.subtitle != null && h.subtitleTracks.length) {
            h.subtitleTrack = 0
            h.subtitleDisplay = true
          }
          v.play().catch(() => undefined)
          setStatus('playing')
        })
        h.on(Hls.Events.ERROR, (_e, data) => {
          if (data.fatal) {
            push(`O player encontrou um erro (${data.details}).`)
            setStatus('error')
          }
        })
        h.loadSource(src)
        h.attachMedia(v)
      } else if (v.canPlayType('application/vnd.apple.mpegurl')) {
        v.src = src
        v.addEventListener(
          'loadedmetadata',
          () => {
            if (local > 0) v.currentTime = local
            v.play().catch(() => undefined)
            setStatus('playing')
          },
          { once: true },
        )
      } else {
        push('Este navegador não reproduz HLS.')
        setStatus('error')
      }
    },
    [push, scheduleHeartbeat, video],
  )

  const start = useCallback(
    async (fileId: number, profile: Profile, tracks: Tracks) => {
      teardown()
      setStatus('starting')
      try {
        const s = await startPlaybackSession({
          fileId,
          profile,
          audioTrackIndex: tracks.audio,
          subtitleTrackIndex: tracks.subtitle,
        })
        push(
          `Sessão iniciada · perfil ${profile} · áudio ${tracks.audio}${tracks.subtitle != null ? ` · legenda ${tracks.subtitle}` : ' · sem legenda'}`,
        )
        await attach(s, s.startOffsetSeconds, { profile, tracks })
        push('Playlist pronta')
      } catch (e) {
        if ((e as Error).name === 'AbortError') return
        setStatus('error')
        push(`Não foi possível iniciar: ${errorMessage(e)}`)
        throw e
      }
    },
    [attach, push, teardown],
  )

  const seek = useCallback(
    async (target: number) => {
      const s = sessionRef.current
      const v = video.current
      if (!s || !v) return
      try {
        const res = await seekPlaybackSession(s.id, { positionSeconds: target })
        if (res.startOffsetSeconds !== s.startOffset) {
          push(`Posição movida para ${formatClock(target)} · transcode reiniciado nesse ponto`)
          await attach(res, target, { profile: s.profile, tracks: s.tracks })
        } else {
          v.currentTime = Math.max(0, target - s.startOffset)
          push(`Posição movida para ${formatClock(target)}`)
        }
      } catch (e) {
        if (errorStatus(e) === 404) {
          setStatus('expired')
          push('A sessão expirou. Inicie uma nova para continuar.')
          teardown()
        } else push(`Não foi possível mover: ${errorMessage(e)}`)
      }
    },
    [attach, push, teardown, video],
  )

  const switchTracks = useCallback(
    async (tracks: Tracks) => {
      const s = sessionRef.current
      if (!s) return
      const at = (s.startOffset ?? 0) + (video.current?.currentTime ?? 0)
      try {
        const res = await switchPlaybackSessionTracks(s.id, {
          positionSeconds: at,
          audioTrackIndex: tracks.audio,
          subtitleTrackIndex: tracks.subtitle,
        })
        push(`Faixas trocadas em ${formatClock(at)} · transcode reiniciado`)
        await attach(res, at, { profile: s.profile, tracks })
      } catch (e) {
        if (errorStatus(e) === 404) {
          setStatus('expired')
          push('A sessão expirou. Inicie uma nova para continuar.')
          teardown()
        } else push(`Não foi possível trocar as faixas: ${errorMessage(e)}`)
      }
    },
    [attach, push, teardown, video],
  )

  const reset = useCallback(() => {
    teardown()
    setSession(null)
    setStatus('idle')
    setLog([])
    setTtl(null)
    setExpiresAt(null)
    setPosition(0)
    if (video.current) {
      video.current.removeAttribute('src')
      video.current.load()
    }
  }, [teardown, video])

  return { session, status, ttl, expiresAt, log, position, start, seek, switchTracks, reset }
}
