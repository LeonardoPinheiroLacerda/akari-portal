import { useEffect, useRef, useState } from 'react'
import { apiUrl } from './http'

export type SseStatus = 'connecting' | 'open' | 'idle' | 'error'

/*
 * Os payloads dos streams vêm do contrato (`CacheEvent`, `NotificationEvent` em
 * `generated/model`); o nome de cada evento SSE é o `type` do payload.
 */
type Options<T extends { type: string }> = {
  /** Nomes de evento a escutar — os valores do `type` do payload (ex.: `Object.values(CacheEventType)`). */
  events: readonly T['type'][]
  onMessage: (data: T) => void
  /** Chamado a cada (re)conexão aberta — use para reconciliar via REST. */
  onOpen?: () => void
  enabled?: boolean
  /**
   * Quando devolve `true` para um evento, fecha a conexão e só reconecta depois de
   * `idleRetryMs` (o stream de cache fecha sozinho em `IDLE`).
   */
  closeOn?: (data: T) => boolean
  idleRetryMs?: number
}

/** EventSource com reconexão exponencial. */
export function useEventSource<T extends { type: string }>(
  path: string,
  { events, onMessage, onOpen, enabled = true, closeOn, idleRetryMs = 15_000 }: Options<T>,
) {
  const [status, setStatus] = useState<SseStatus>('connecting')
  const [lastEventAt, setLastEventAt] = useState<Date | null>(null)
  const handlers = useRef({ onMessage, onOpen, closeOn })
  handlers.current = { onMessage, onOpen, closeOn }
  const eventsKey = events.join(',')
  const [wake, setWake] = useState(0)

  useEffect(() => {
    if (!enabled) return
    let es: EventSource | null = null
    let timer: ReturnType<typeof setTimeout> | undefined
    let attempt = 0
    let disposed = false

    const schedule = (ms: number) => {
      clearTimeout(timer)
      timer = setTimeout(connect, ms)
    }

    function connect() {
      if (disposed) return
      setStatus('connecting')
      es = new EventSource(apiUrl(path))
      es.onopen = () => {
        attempt = 0
        setStatus('open')
        handlers.current.onOpen?.()
      }
      const listener = (e: MessageEvent) => {
        let data: T
        try {
          data = JSON.parse(e.data) as T
        } catch {
          return
        }
        setLastEventAt(new Date())
        handlers.current.onMessage(data)
        if (handlers.current.closeOn?.(data)) {
          es?.close()
          setStatus('idle')
          schedule(idleRetryMs)
        }
      }
      for (const name of eventsKey.split(',')) es.addEventListener(name, listener)
      es.onmessage = listener
      es.onerror = () => {
        // Fechamento normal após IDLE também cai aqui; não sobrescreve o estado ocioso.
        if (es?.readyState === EventSource.CLOSED || es?.readyState === EventSource.CONNECTING) {
          es?.close()
          setStatus((s) => (s === 'idle' ? s : 'error'))
          attempt++
          schedule(Math.min(30_000, 1000 * 2 ** Math.min(attempt, 5)))
        }
      }
    }

    connect()
    return () => {
      disposed = true
      clearTimeout(timer)
      es?.close()
    }
  }, [path, eventsKey, enabled, idleRetryMs, wake])

  /** Força reconexão imediata (ex.: depois de enfileirar um download). */
  const reconnect = () => setWake((n) => n + 1)
  return { status, lastEventAt, reconnect }
}
