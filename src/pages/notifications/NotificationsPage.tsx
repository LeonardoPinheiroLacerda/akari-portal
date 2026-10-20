import { useInfiniteQuery, type InfiniteData } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  getGetUnreadCountQueryKey,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/api/generated/endpoints/notification/notification'
import type { NotificationPage, NotificationResponse, UnreadCountResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate, queryClient } from '@/api/query'
import { NotificationAvatar } from '@/components/domain/NotificationAvatar'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { NOTIFICATIONS_INFINITE_KEY, useNotificationsLive } from '@/features/notifications/NotificationsProvider'
import { LEVEL, notificationHead } from '@/features/notifications/level'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

const PAGE_SIZE = 20

function dayGroup(iso: string) {
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const diff = Math.round((start(new Date()) - start(new Date(iso))) / 86_400_000)
  return diff <= 0 ? 'Hoje' : diff === 1 ? 'Ontem' : 'Anteriores'
}

function patchRead(predicate: (n: NotificationResponse) => boolean) {
  queryClient.setQueryData<InfiniteData<NotificationPage, number>>(NOTIFICATIONS_INFINITE_KEY, (old) =>
    old
      ? { ...old, pages: old.pages.map((p) => ({ ...p, data: p.data.map((n) => (predicate(n) ? { ...n, read: true } : n)) })) }
      : old,
  )
}

export function NotificationsPage() {
  usePageMeta('Notificações')
  const navigate = useNavigate()
  const { unread, status, fresh } = useNotificationsLive()

  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_INFINITE_KEY,
    initialPageParam: 0,
    queryFn: ({ pageParam, signal }) => listNotifications({ page: pageParam, size: PAGE_SIZE }, { signal }),
    getNextPageParam: (last) => (last.page + 1 < last.totalPages ? last.page + 1 : undefined),
  })
  const items = (query.data?.pages.flatMap((p) => p.data) ?? []).filter((n, i, arr) => arr.findIndex((x) => x.id === n.id) === i)
  const groups = ['Hoje', 'Ontem', 'Anteriores']
    .map((label) => ({ label, items: items.filter((n) => dayGroup(n.createdAt) === label) }))
    .filter((g) => g.items.length)

  const markRead = async (n: NotificationResponse) => {
    if (n.read) return
    patchRead((x) => x.id === n.id)
    queryClient.setQueryData<UnreadCountResponse>(getGetUnreadCountQueryKey(), (old) => ({
      count: Math.max(0, (old?.count ?? 1) - 1),
    }))
    try {
      await markNotificationRead(n.id)
    } catch (e) {
      toastError(e)
    } finally {
      invalidate.notifications()
    }
  }

  const readAll = async () => {
    try {
      await markAllNotificationsRead()
      patchRead(() => true)
      queryClient.setQueryData<UnreadCountResponse>(getGetUnreadCountQueryKey(), { count: 0 })
      toast.success('Todas as notificações foram marcadas como lidas')
    } catch (e) {
      toastError(e)
    } finally {
      invalidate.notifications()
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-x-3.5 gap-y-2.5">
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-semibold">{unread}</span>
          <span className="text-muted">{unread === 1 ? 'não lida' : 'não lidas'}</span>
        </div>
        <span
          className="flex h-[26px] items-center gap-[7px] rounded-chip px-2.5 text-sm font-semibold"
          style={{
            background: status === 'open' ? 'var(--ok-bg)' : 'var(--warn-bg)',
            color: status === 'open' ? 'var(--ok-fg)' : 'var(--warn-fg)',
          }}
        >
          <span className={cn('h-[7px] w-[7px] rounded-full bg-current', status !== 'open' && 'animate-pulse-dot')} />
          {status === 'open' ? 'Ao vivo' : 'Reconectando…'}
        </span>
        <div className="flex-1" />
        <Button icon="done_all" disabled={unread === 0} onClick={readAll}>
          Marcar todas como lidas
        </Button>
      </div>

      {query.isLoading && <Loading />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && items.length === 0 && (
        <EmptyState
          dashed
          icon="notifications_off"
          title="Nenhuma notificação"
          description="Os resultados das ingestões e os avisos de vínculo aparecem aqui assim que acontecem."
          action={
            <Button variant="primary" icon="download" onClick={() => navigate('/ingestao')}>
              Iniciar uma ingestão
            </Button>
          }
        />
      )}

      {groups.map((g) => (
        <div key={g.label} className="flex flex-col gap-2">
          <span className="group-label">{g.label}</span>
          <section className="card overflow-hidden">
            {g.items.map((n) => {
              const level = LEVEL[n.level]
              const isFresh = fresh.has(n.id)
              return (
                <div
                  key={n.id}
                  onClick={() => markRead(n)}
                  className={cn(
                    'flex gap-3.5 border-b border-line px-[18px] py-3.5 transition-colors duration-500 last:border-b-0',
                    isFresh ? 'bg-[var(--tint-strong)]' : !n.read ? 'bg-tint' : '',
                    !n.read && 'cursor-pointer',
                  )}
                >
                  <NotificationAvatar n={n} />
                  <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={n.read ? 'font-medium' : 'font-semibold'}>{notificationHead(n)}</span>
                      <Chip tone={level.tone} className="h-[18px] px-[7px] text-xs">
                        {level.label}
                      </Chip>
                    </div>
                    <span className="text-13 leading-[1.45] text-muted [text-wrap:pretty]">{n.message}</span>
                    {n.folderId != null && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          markRead(n)
                          navigate(`/catalogo/${n.folderId}/anilist`)
                        }}
                        className="mt-0.5 flex items-center gap-1 self-start text-sm font-semibold text-accent-text hover:underline"
                      >
                        {n.title ? 'Revisar título' : 'Abrir pasta no catálogo'}
                        <Icon name="arrow_forward" size={15} />
                      </button>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="whitespace-nowrap text-sm text-muted">{formatRelative(n.createdAt)}</span>
                    <span
                      title={n.read ? undefined : 'Não lida'}
                      className="h-[9px] w-[9px] rounded-full"
                      style={{ background: n.read ? 'transparent' : 'var(--accent)' }}
                    />
                  </div>
                </div>
              )
            })}
          </section>
        </div>
      ))}

      {query.hasNextPage ? (
        <Button className="self-center px-[18px]" loading={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>
          Ver mais
        </Button>
      ) : (
        items.length > 0 && <span className="self-center text-sm text-muted">Não há notificações mais antigas.</span>
      )}
    </>
  )
}
