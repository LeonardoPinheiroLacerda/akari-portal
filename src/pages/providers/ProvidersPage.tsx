import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useDeleteStorageProvider } from '@/api/generated/endpoints/storage-provider/storage-provider'
import type { StorageProviderResponse } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { ErrorState, Loading } from '@/components/ui/states'
import { forgetProviderHealth, healthChip, testProvider, useProviderHealth, type HealthState } from '@/features/providers/health'
import { providerName, providerTypeDef } from '@/features/providers/types'
import { useProviders } from '@/features/providers/useProviders'
import { formatDate, formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'
import { ProviderDialog, type ProviderDialogState } from './ProviderDialog'

export function ProvidersPage() {
  usePageMeta('Provedores')
  const query = useProviders()
  const { providers } = query
  const health = useProviderHealth()
  const [dialog, setDialog] = useState<ProviderDialogState>(null)

  const bad = providers.filter((p) => health[p.id]?.state === 'fail').length
  const summary = providers.length
    ? `${providers.length} ${providers.length === 1 ? 'provedor cadastrado' : 'provedores cadastrados'}${bad ? ` · ${bad} sem conexão` : ''}`
    : 'Nenhum provedor cadastrado'

  return (
    <>
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="min-w-[240px] flex-1 text-muted">{summary}</span>
        <Button icon="network_check" disabled={!providers.length} onClick={() => providers.forEach((p) => testProvider(p.id))}>
          Testar todos
        </Button>
        <Button variant="primary" icon="add" iconSize={19} onClick={() => setDialog({ mode: 'create' })}>
          Novo provedor
        </Button>
      </div>

      {query.isLoading && <Loading />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}

      {query.data && providers.length === 0 && (
        <section className="flex flex-col items-center gap-3.5 rounded-r border border-dashed border-line bg-panel px-6 py-12 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-raised text-accent">
            <Icon name="dns" size={28} />
          </span>
          <div className="flex max-w-[460px] flex-col gap-1.5">
            <span className="text-17 font-semibold">Nenhum provedor cadastrado</span>
            <span className="leading-normal text-muted [text-wrap:pretty]">
              Provedores são de onde vêm os arquivos de vídeo. Cadastre ao menos um para poder fazer a ingestão de animes no
              catálogo.
            </span>
          </div>
          <div className="flex flex-col gap-2 text-left text-13 text-muted">
            {[
              'Cadastre o provedor (MEGA ou disco local)',
              'Confira se a conexão foi bem-sucedida',
              'Vá em Ingestão e escolha o diretório raiz',
            ].map((t, i) => (
              <span key={t} className="flex items-center gap-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-raised text-sm font-bold text-text">
                  {i + 1}
                </span>
                {t}
              </span>
            ))}
          </div>
          <Button variant="primary" size="lg" icon="add" iconSize={19} onClick={() => setDialog({ mode: 'create' })}>
            Cadastrar primeiro provedor
          </Button>
        </section>
      )}

      <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr))]">
        {providers.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            health={health[p.id]}
            onEdit={() => setDialog({ mode: 'edit', id: p.id, type: p.type })}
          />
        ))}
      </div>

      <ProviderDialog state={dialog} onClose={() => setDialog(null)} />
    </>
  )
}

function ProviderCard({
  provider: p,
  health: h,
  onEdit,
}: {
  provider: StorageProviderResponse
  health?: HealthState
  onEdit: () => void
}) {
  const navigate = useNavigate()
  const def = providerTypeDef(p.type)
  const chip = healthChip(h)
  const [confirming, setConfirming] = useState(false)
  const del = useDeleteStorageProvider()
  const name = providerName(p)

  const remove = () =>
    del.mutate(
      { providerId: p.id },
      {
        onSuccess: async () => {
          forgetProviderHealth(p.id)
          await Promise.all([invalidate.providers(), invalidate.catalog()])
          toast.success(`${name} removido`)
        },
        onError: (e) => toastError(e),
      },
    )

  const action =
    'flex h-10 flex-1 items-center justify-center gap-1.5 border-r border-line text-13 transition-colors hover:bg-hover'

  return (
    <section
      className={cn(
        'flex flex-col overflow-hidden rounded-r border bg-panel',
        h?.state === 'fail' ? 'border-[var(--err-fg)]' : 'border-line',
      )}
    >
      <div className="flex items-center gap-3 px-[18px] py-4">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-rs bg-raised text-accent">
          <Icon name={def.icon} size={22} />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="font-semibold">{name}</span>
          <span className="text-sm text-muted">{def.kind}</span>
        </div>
        <Chip
          tone={chip.tone}
          icon={chip.icon}
          className={cn('h-6 px-[9px]', h?.state === 'testing' && '[&_.icon]:animate-spin')}
        >
          {chip.label}
        </Chip>
      </div>
      <div className="flex flex-col gap-1.5 px-[18px] pb-3.5 text-sm text-muted">
        <span className="flex items-center gap-2">
          <Icon name={def.behaviorIcon} size={16} />
          {def.behavior}
        </span>
        <span className="flex items-center gap-2">
          <Icon name="event" size={16} />
          Cadastrado em {formatDate(p.createdAt)}
        </span>
        <span className="flex items-center gap-2">
          <Icon name="schedule" size={16} />
          {!h
            ? 'Conexão ainda não testada'
            : h.state === 'testing'
              ? 'Testando conexão…'
              : `Último teste ${formatRelative(h.at)}${h.state === 'fail' && h.reason ? ` · ${h.reason}` : ''}`}
        </span>
      </div>
      {confirming && (
        <div className="flex flex-col gap-2.5 border-t border-line bg-[color-mix(in_oklch,var(--danger)_8%,transparent)] px-[18px] py-3">
          <span className="text-13 leading-[1.45]">
            Remover <b>{name}</b>? As pastas e arquivos ingeridos a partir dele também são removidos do catálogo.
          </span>
          <div className="flex gap-2">
            <Button size="sm" className="flex-1" onClick={() => setConfirming(false)}>
              Cancelar
            </Button>
            <Button size="sm" variant="danger-solid" className="flex-1" loading={del.isPending} onClick={remove}>
              Remover
            </Button>
          </div>
        </div>
      )}
      <div className="mt-auto flex border-t border-line">
        <button type="button" className={action} onClick={() => testProvider(p.id)} disabled={h?.state === 'testing'}>
          <Icon name="network_check" size={17} />
          Testar
        </button>
        <button type="button" className={action} onClick={onEdit}>
          <Icon name="edit" size={17} />
          Editar
        </button>
        <button type="button" className={action} onClick={() => navigate(`/catalogo?storageProviderId=${p.id}`)}>
          <Icon name="folder" size={17} />
          Pastas
        </button>
        <button
          type="button"
          aria-label="Remover"
          title="Remover"
          onClick={() => setConfirming(true)}
          className="flex h-10 w-11 items-center justify-center text-danger transition-colors hover:bg-hover"
        >
          <Icon name="delete" size={18} />
        </button>
      </div>
    </section>
  )
}
