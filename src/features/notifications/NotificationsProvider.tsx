import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { InfiniteData } from '@tanstack/react-query'
import { getGetUnreadCountQueryKey, useGetUnreadCount } from '@/api/generated/endpoints/notification/notification'
import type { NotificationPage, NotificationResponse, UnreadCountResponse } from '@/api/generated/model'
import { invalidatePrefixes, queryClient } from '@/api/query'
import { useEventSource, type NotificationEvent, type SseStatus } from '@/api/sse'

export const NOTIFICATIONS_INFINITE_KEY = ['/v1/notifications', 'infinite'] as const

type Ctx = {
  unread: number
  status: SseStatus
  /** Ids que chegaram ao vivo há pouco (destaque de acento por ~6s). */
  fresh: Set<number>
  banner: NotificationResponse | null
  dismissBanner: () => void
}

const NotificationsContext = createContext<Ctx | null>(null)

export function NotificationsProvider({ children }: { children: React.ReactNode }) {
  const unreadQuery = useGetUnreadCount({ query: { refetchOnWindowFocus: true, staleTime: 10_000 } })
  const [fresh, setFresh] = useState<Set<number>>(new Set())
  const [banner, setBanner] = useState<NotificationResponse | null>(null)
  const bannerTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const onMessage = useCallback((event: NotificationEvent) => {
    if (event.type !== 'NEW' || !event.notification) return
    const n = event.notification

    queryClient.setQueryData<UnreadCountResponse>(getGetUnreadCountQueryKey(), (old) =>
      n.read ? old : { count: (old?.count ?? 0) + 1 },
    )
    queryClient.setQueryData<InfiniteData<NotificationPage, number>>(NOTIFICATIONS_INFINITE_KEY, (old) => {
      if (!old || old.pages.length === 0) return old
      const [first, ...rest] = old.pages
      if (first.data.some((x) => x.id === n.id)) return old
      return {
        ...old,
        pages: [{ ...first, data: [n, ...first.data], totalElements: first.totalElements + 1 }, ...rest],
      }
    })
    // Listas paginadas simples (ex.: Home) são refeitas.
    queryClient.invalidateQueries({
      predicate: (q) => q.queryKey[0] === '/v1/notifications' && q.queryKey[1] !== 'infinite',
    })

    setFresh((s) => new Set(s).add(n.id))
    setTimeout(
      () =>
        setFresh((s) => {
          const next = new Set(s)
          next.delete(n.id)
          return next
        }),
      6000,
    )

    setBanner(n)
    clearTimeout(bannerTimer.current)
    bannerTimer.current = setTimeout(() => setBanner(null), 6000)
  }, [])

  const { status } = useEventSource<NotificationEvent>('/v1/notifications/events', {
    events: ['NEW'],
    onMessage,
    // Sem replay no reconnect: reconcilia pelo REST.
    onOpen: () => invalidatePrefixes('/v1/notifications'),
  })

  useEffect(() => () => clearTimeout(bannerTimer.current), [])

  const value = useMemo<Ctx>(
    () => ({
      unread: unreadQuery.data?.count ?? 0,
      status,
      fresh,
      banner,
      dismissBanner: () => setBanner(null),
    }),
    [unreadQuery.data, status, fresh, banner],
  )

  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>
}

export function useNotificationsLive() {
  const ctx = useContext(NotificationsContext)
  if (!ctx) throw new Error('useNotificationsLive fora do NotificationsProvider')
  return ctx
}
