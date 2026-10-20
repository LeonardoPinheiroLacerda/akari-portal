import { useNavigate } from 'react-router-dom'
import { useListCaches } from '@/api/generated/endpoints/cache/cache'
import { useListFolders } from '@/api/generated/endpoints/media-folder/media-folder'
import { useListNotifications } from '@/api/generated/endpoints/notification/notification'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Section } from '@/components/ui/section'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import { REVIEW } from '@/features/item/labels'
import { useNotificationsLive } from '@/features/notifications/NotificationsProvider'
import { LEVEL, notificationHead } from '@/features/notifications/level'
import { useProviderHealth } from '@/features/providers/health'
import { useProviders } from '@/features/providers/useProviders'
import { formatRelative, pluralize } from '@/lib/format'
import { cn } from '@/lib/utils'

/** Quantos títulos pendentes de curadoria a Home lista. */
const ATTENTION = 5

function Stat({ label, value, note }: { label: string; value: React.ReactNode; note: React.ReactNode }) {
  return (
    <div className="card flex flex-col gap-2 px-5 py-[18px]">
      <span className="text-sm text-muted">{label}</span>
      <span className="text-stat font-semibold tracking-[-.02em]">{value}</span>
      <span className="text-sm text-muted">{note}</span>
    </div>
  )
}

export function HomePage() {
  usePageMeta('Visão geral')
  const navigate = useNavigate()
  const { unread } = useNotificationsLive()

  const folders = useListFolders({ page: 0, size: 1 })
  const boundQ = useListFolders({ page: 0, size: 1, hasAnilist: true })
  // Títulos pendentes de curadoria, mais recentes primeiro; parciais antes dos aguardando revisão.
  const partial = useListFolders({ page: 0, size: ATTENTION, reviewStatus: 'PARTIAL', sort: ['createdAt:desc'] })
  const toReview = useListFolders({ page: 0, size: ATTENTION, reviewStatus: 'PENDING_REVIEW', sort: ['createdAt:desc'] })
  const pending = useListCaches({ page: 0, size: 200, pendingOnly: true })
  const notifs = useListNotifications({ page: 0, size: 50 })
  const { providers } = useProviders()
  const health = useProviderHealth()

  const bound = boundQ.data?.totalElements
  const downloading = pending.data?.data.filter((c) => c.status === 'DOWNLOADING').length ?? 0
  const queued = pending.data?.data.filter((c) => c.status === 'QUEUED').length ?? 0
  const failed = pending.data?.data.filter((c) => c.status === 'FAILED').length ?? 0
  const list = notifs.data?.data ?? []
  const unreadErrors = list.filter((n) => !n.read && n.level === 'ERROR').length
  const connected = providers.filter((p) => health[p.id]?.state === 'ok').length
  const untested = providers.filter((p) => !health[p.id]).length
  const offline = providers.filter((p) => health[p.id]?.state === 'fail').length
  const attention = [
    ...(partial.data?.data ?? []).map((f) => ({ folder: f, status: 'PARTIAL' as const })),
    ...(toReview.data?.data ?? []).map((f) => ({ folder: f, status: 'PENDING_REVIEW' as const })),
  ].slice(0, ATTENTION)
  const attentionLoaded = partial.data != null && toReview.data != null

  return (
    <>
      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(200px,1fr))]">
        <Stat
          label="Pastas no catálogo"
          value={folders.data?.totalElements.toLocaleString('pt-BR') ?? '—'}
          note={bound != null ? `${bound.toLocaleString('pt-BR')} com anime vinculado` : 'Contando vínculos…'}
        />
        <Stat
          label="Downloads pendentes"
          value={pending.data ? downloading + queued + failed : '—'}
          note={`${downloading} baixando · ${queued} na fila${failed ? ` · ${failed} com falha` : ''}`}
        />
        <Stat
          label="Notificações não lidas"
          value={unread}
          note={unreadErrors ? pluralize(unreadErrors, 'erro', 'erros') : 'Nenhum erro'}
        />
        <Stat
          label="Provedores conectados"
          value={providers.length ? `${connected} / ${providers.length}` : '0'}
          note={
            !providers.length
              ? 'Nenhum provedor cadastrado'
              : [offline && `${offline} sem conexão`, untested && `${untested} sem teste`].filter(Boolean).join(' · ') ||
                'Todos respondendo'
          }
        />
      </div>

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr))]">
        <Section
          title="Notificações recentes"
          actions={
            <Button variant="link" onClick={() => navigate('/notificacoes')}>
              Ver todas
            </Button>
          }
        >
          {notifs.isLoading && <Loading />}
          {notifs.isError && <ErrorState error={notifs.error} onRetry={() => notifs.refetch()} />}
          {notifs.data && list.length === 0 && (
            <div className="px-5 py-[18px] text-13 text-muted">Nenhuma notificação ainda.</div>
          )}
          {list.slice(0, 4).map((n) => (
            <div key={n.id} className="flex gap-3 border-b border-line px-5 py-3 last:border-b-0">
              <span
                className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-rs"
                style={{ background: `var(--${LEVEL[n.level].tone}-bg)`, color: `var(--${LEVEL[n.level].tone}-fg)` }}
              >
                <Icon name={LEVEL[n.level].icon} size={18} />
              </span>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className={cn('text-13', n.read ? 'font-medium' : 'font-semibold')}>{notificationHead(n)}</span>
                <span className="truncate text-sm text-muted">{n.message}</span>
              </div>
              <span className="whitespace-nowrap text-xs text-muted">{formatRelative(n.createdAt)}</span>
            </div>
          ))}
        </Section>

        <Section
          title="Títulos que precisam de atenção"
          subtitle={
            attentionLoaded
              ? `${pluralize(partial.data!.totalElements, 'parcial', 'parciais')} · ${toReview.data!.totalElements.toLocaleString('pt-BR')} aguardando revisão`
              : 'Parciais e aguardando revisão'
          }
          actions={
            <>
              <Button variant="link" onClick={() => navigate('/catalogo?reviewStatus=PARTIAL')}>
                Ver parciais
              </Button>
              <Button variant="link" onClick={() => navigate('/catalogo?reviewStatus=PENDING_REVIEW')}>
                Ver aguardando revisão
              </Button>
            </>
          }
        >
          {(partial.isLoading || toReview.isLoading) && <Loading />}
          {partial.isError && <ErrorState error={partial.error} onRetry={() => partial.refetch()} />}
          {attentionLoaded && attention.length === 0 && (
            <div className="flex items-center gap-2.5 px-5 py-[18px] text-13 text-muted">
              <Icon name="task_alt" size={18} className="text-[var(--ok-fg)]" />
              Nada pendente. Todos os títulos foram revisados.
            </div>
          )}
          {attention.map(({ folder: f, status }) => {
            const r = REVIEW[status]
            return (
              <button
                key={f.id}
                type="button"
                onClick={() => navigate(`/catalogo/${f.id}/anilist`)}
                className="flex w-full items-center gap-3.5 border-b border-line px-5 py-3 text-left transition-colors last:border-b-0 hover:bg-hover"
              >
                <Thumb src={f.animeBinding?.thumbnail} width={34} ratio="34/48" />
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate font-medium">{f.animeBinding?.title ?? f.name}</span>
                  <span className="truncate font-mono text-xs text-muted">{f.path}</span>
                </div>
                <Chip tone={r.tone} className="h-5 text-xs">
                  {r.label}
                </Chip>
                <Icon name="chevron_right" size={20} className="text-muted" />
              </button>
            )
          })}
        </Section>
      </div>
    </>
  )
}
