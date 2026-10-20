import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import {
  useIngestProviderSubtree,
  useListAvailableFolders,
  useRemoveIngestedSubtree,
} from '@/api/generated/endpoints/ingestion/ingestion'
import type { AvailableFolderNode, MediaType } from '@/api/generated/model'
import { errorCode, toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { RadioDot } from '@/components/ui/radio'
import { Segmented } from '@/components/ui/segmented'
import { EmptyState, ErrorState, Loading } from '@/components/ui/states'
import { healthChip, useProviderHealth } from '@/features/providers/health'
import { providerName, providerTypeDef } from '@/features/providers/types'
import { useProviders } from '@/features/providers/useProviders'
import { useSetting } from '@/features/settings/useSetting'
import { cn } from '@/lib/utils'

const TYPE_LABEL: Record<MediaType, string> = { ANIME: 'anime', TV: 'série', MOVIE: 'filme' }
const STEPS = [
  'Lista as pastas do diretório no provedor',
  'Remove do catálogo o que não existe mais lá',
  'Cria as pastas e arquivos novos',
  'Vincula cada pasta: AniList, TMDB e episódios',
]

const normalize = (p: string) => p.trim().replace(/^\/+|\/+$/g, '')

export function IngestionPage() {
  usePageMeta('Ingestão')
  const navigate = useNavigate()
  const { providers, isLoading } = useProviders()
  const health = useProviderHealth()
  const { setting: apiKey } = useSetting('tmdb.api-key')
  const keyMissing = apiKey != null && !apiKey.configured

  const [providerId, setProviderId] = useState<number | null>(null)
  const [mediaType, setMediaType] = useState<MediaType>('ANIME')
  const [dir, setDir] = useState('')
  const [browse, setBrowse] = useState(false)
  const [removeOpen, setRemoveOpen] = useState(false)
  const [started, setStarted] = useState<{ target: string; at: string } | null>(null)
  const [removed, setRemoved] = useState<string | null>(null)

  useEffect(() => {
    if (providerId == null && providers.length) setProviderId(providers[0].id)
  }, [providers, providerId])

  const provider = providers.find((p) => p.id === providerId)
  const provName = provider ? providerName(provider) : '—'
  const rootPath = normalize(dir)
  const target = `${provName} · ${rootPath || 'raiz inteira'}`

  const ingest = useIngestProviderSubtree()
  const remove = useRemoveIngestedSubtree()

  const start = () => {
    if (!provider) return
    ingest.mutate(
      { providerId: provider.id, data: { mediaType, rootPath: rootPath || null } },
      {
        onSuccess: () => {
          setStarted({ target, at: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) })
          setRemoved(null)
        },
        onError: (e) => {
          if (errorCode(e) === 'BUSINESS_RULE_VIOLATION' || errorCode(e) === 'VALIDATION_ERROR')
            toastError(e, 'A ingestão não foi aceita')
          else toastError(e)
        },
      },
    )
  }

  const doRemove = () => {
    if (!provider) return
    remove.mutate(
      { providerId: provider.id, params: rootPath ? { rootPath } : undefined },
      {
        onSuccess: async () => {
          setRemoveOpen(false)
          setStarted(null)
          setRemoved(target)
          await Promise.all([invalidate.catalog(), invalidate.anime()])
          toast.success('Removido do catálogo')
        },
        onError: (e) => toastError(e),
      },
    )
  }

  if (isLoading) return <Loading />
  if (!providers.length)
    return (
      <EmptyState
        dashed
        icon="dns"
        title="Cadastre um provedor primeiro"
        description="A ingestão lê os vídeos de um provedor. Cadastre um MEGA ou disco local para continuar."
        action={
          <Button variant="primary" icon="add" onClick={() => navigate('/provedores')}>
            Ir para Provedores
          </Button>
        }
      />
    )

  const can = !!provider && !keyMissing

  return (
    <>
      {keyMissing && (
        <div className="flex flex-wrap items-center gap-3 rounded-r border border-[var(--warn-fg)] bg-[var(--warn-bg)] px-[18px] py-3.5">
          <Icon name="key_off" size={20} className="text-[var(--warn-fg)]" />
          <span className="min-w-[240px] flex-1 text-13 leading-[1.45]">
            <b>Token do TMDB não configurado.</b> A ingestão não é aceita sem ele, porque nenhum anime completaria o vínculo
            automático.
          </span>
          <Button
            size="sm"
            className="border-[var(--warn-fg)] bg-transparent"
            onClick={() => navigate('/preferencias?filtro=tmdb')}
          >
            Configurar em Preferências
          </Button>
        </div>
      )}

      <section className="card flex flex-col gap-5 p-5">
        <div className="flex flex-col gap-1">
          <h3 className="m-0 text-15 font-semibold">Nova ingestão</h3>
          <p className="m-0 text-13 leading-normal text-muted">
            Sincroniza um diretório do provedor com o catálogo e vincula cada pasta automaticamente. Roda em segundo plano; o
            resultado chega em Notificações.
          </p>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">1. Provedor</span>
          <div role="radiogroup" className="grid gap-2.5 [grid-template-columns:repeat(auto-fill,minmax(min(100%,220px),1fr))]">
            {providers.map((p) => {
              const on = p.id === providerId
              const def = providerTypeDef(p.type)
              const chip = healthChip(health[p.id])
              return (
                <button
                  key={p.id}
                  type="button"
                  role="radio"
                  aria-checked={on}
                  onClick={() => {
                    setProviderId(p.id)
                    setBrowse(false)
                  }}
                  className={cn(
                    'flex items-center gap-2.5 rounded-rs border px-3.5 py-3 text-left transition-colors',
                    on ? 'border-accent bg-tint' : 'border-line bg-bg hover:bg-hover',
                  )}
                >
                  <RadioDot checked={on} className="h-4 w-4" />
                  <Icon name={def.icon} size={20} className="text-muted" />
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="font-semibold">{providerName(p)}</span>
                    <span className="text-xs text-muted">{def.kind}</span>
                  </span>
                  <Chip tone={chip.tone} className="h-5 text-xs">
                    {chip.label}
                  </Chip>
                </button>
              )
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">2. Tipo do conteúdo</span>
          <div className="flex flex-wrap items-center gap-3">
            <Segmented
              size="md"
              aria-label="Tipo do conteúdo"
              value={mediaType}
              onChange={setMediaType}
              className="[&_button]:px-3.5 [&_button]:text-13"
              options={[
                { value: 'ANIME', label: 'Anime' },
                { value: 'TV', label: 'Série' },
                { value: 'MOVIE', label: 'Filme' },
              ]}
            />
            <span className="text-sm text-muted">Aplicado às pastas novas. Pastas já no catálogo mantêm o tipo que têm.</span>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-muted">3. Diretório raiz</span>
          <div className="flex flex-wrap gap-2.5">
            <div className="flex h-10 min-w-[280px] flex-1 items-center overflow-hidden rounded-rs border border-line bg-bg focus-within:border-accent">
              <span className="flex h-full items-center whitespace-nowrap bg-raised px-3 text-sm text-muted">{provName}</span>
              <input
                value={dir}
                onChange={(e) => setDir(e.target.value)}
                placeholder="Vazio ingere o provedor inteiro"
                aria-label="Diretório raiz"
                className="h-full min-w-0 flex-1 border-0 bg-transparent px-3 font-mono text-13 text-text outline-none placeholder:font-sans placeholder:text-muted"
              />
            </div>
            <Button
              size="lg"
              icon="folder_open"
              iconSize={19}
              className={cn(browse && 'border-accent bg-tint')}
              onClick={() => setBrowse((v) => !v)}
            >
              Procurar
            </Button>
          </div>
          {browse && provider && (
            <FolderBrowser
              providerId={provider.id}
              initial={rootPath}
              onCancel={() => setBrowse(false)}
              onUse={(p) => {
                setDir(p)
                setBrowse(false)
              }}
            />
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-1">
          <span className="mt-3 min-w-[240px] flex-1 text-sm text-muted">
            Ingerir {target} como {TYPE_LABEL[mediaType]}.
          </span>
          <Button size="lg" className="mt-3 text-danger" onClick={() => setRemoveOpen(true)}>
            Remover do catálogo
          </Button>
          <Button size="lg" variant="primary" className="mt-3" disabled={!can} loading={ingest.isPending} onClick={start}>
            Iniciar ingestão
          </Button>
        </div>
        {removeOpen && (
          <div className="flex flex-col gap-2.5 rounded-rs border border-danger px-4 py-3.5">
            <span className="text-13 leading-normal">
              Remover <b className="font-mono">{target}</b> do catálogo? As pastas, arquivos e vínculos de metadata desse trecho
              saem do catálogo. Nada é apagado no provedor.
            </span>
            <div className="flex justify-end gap-2">
              <Button onClick={() => setRemoveOpen(false)}>Cancelar</Button>
              <Button variant="danger-solid" loading={remove.isPending} onClick={doRemove}>
                Remover
              </Button>
            </div>
          </div>
        )}
      </section>

      {started && (
        <section className="flex flex-col gap-3.5 rounded-r border border-[var(--ok-fg)] bg-panel px-5 py-[18px]">
          <div className="flex items-start gap-3">
            <Icon name="rocket_launch" size={22} className="text-[var(--ok-fg)]" />
            <div className="flex flex-1 flex-col gap-[3px]">
              <span className="font-semibold">Ingestão iniciada em segundo plano</span>
              <span className="text-13 text-muted">
                {started.target} · pedido às {started.at}. Você recebe uma notificação a cada falha de vínculo e uma ao terminar.
              </span>
            </div>
            <Button size="sm" onClick={() => navigate('/notificacoes')}>
              Ver notificações
            </Button>
          </div>
          <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,200px),1fr))]">
            {STEPS.map((t, i) => (
              <div key={t} className="flex gap-2.5 rounded-rs bg-bg px-3 py-2.5">
                <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full bg-raised text-sm font-bold">
                  {i + 1}
                </span>
                <span className="text-sm leading-[1.45] text-muted">{t}</span>
              </div>
            ))}
          </div>
          <span className="text-sm text-muted">
            Se já houver uma ingestão desse mesmo diretório em andamento, o novo pedido é ignorado.
          </span>
        </section>
      )}
      {removed && (
        <div className="flex items-center gap-2.5 rounded-r border border-line bg-panel px-4 py-3 text-13">
          <Icon name="check_circle" size={18} className="text-[var(--ok-fg)]" />
          {removed} removido do catálogo.
        </div>
      )}
    </>
  )
}

type Row = { node: AvailableFolderNode; depth: number }

function FolderBrowser({
  providerId,
  initial,
  onCancel,
  onUse,
}: {
  providerId: number
  initial: string
  onCancel: () => void
  onUse: (path: string) => void
}) {
  const tree = useListAvailableFolders(providerId, undefined, { query: { staleTime: 60_000 } })
  const [open, setOpen] = useState<Set<string>>(() => {
    // Abre os ancestrais do diretório atual.
    const parts = initial.split('/').filter(Boolean)
    return new Set(parts.map((_, i) => parts.slice(0, i + 1).join('/')))
  })
  const [sel, setSel] = useState(initial)

  const rows = useMemo(() => {
    const out: Row[] = []
    const walk = (nodes: AvailableFolderNode[], depth: number) => {
      for (const n of [...nodes].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }))) {
        out.push({ node: n, depth })
        if (open.has(normalize(n.path)) && n.children.length) walk(n.children, depth + 1)
      }
    }
    const root = tree.data
    if (root) walk(root.path && root.name ? [root] : root.children, 0)
    return out
  }, [tree.data, open])

  return (
    <div className="overflow-hidden rounded-rs border border-line bg-bg">
      <div className="flex items-center gap-2.5 border-b border-line px-3.5 py-2.5">
        <Icon name="account_tree" size={18} className="text-muted" />
        <span className="min-w-0 flex-1 truncate font-mono text-sm text-muted">{sel || '/ (raiz do provedor)'}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-[var(--ok-fg)]" />
          No catálogo
        </span>
      </div>
      <div className="max-h-[300px] overflow-y-auto p-1.5">
        {tree.isLoading && <Loading label="Lendo as pastas do provedor…" />}
        {tree.isError && <ErrorState error={tree.error} onRetry={() => tree.refetch()} />}
        {tree.data && rows.length === 0 && <div className="px-3 py-4 text-13 text-muted">O provedor não tem pastas.</div>}
        {rows.map(({ node: n, depth }) => {
          const path = normalize(n.path)
          const on = sel === path
          const isOpen = open.has(path)
          const kids = n.children.length
          return (
            <div
              key={path}
              onClick={() => setSel(path)}
              className={cn(
                'flex h-[34px] cursor-pointer items-center gap-1.5 rounded-rxs pr-2.5',
                on ? 'bg-[var(--tint-strong)]' : 'hover:bg-hover',
              )}
              style={{ paddingLeft: 6 + depth * 20 }}
            >
              <button
                type="button"
                aria-label={isOpen ? 'Recolher' : 'Expandir'}
                onClick={(e) => {
                  e.stopPropagation()
                  setOpen((s) => {
                    const next = new Set(s)
                    if (next.has(path)) next.delete(path)
                    else next.add(path)
                    return next
                  })
                }}
                className={cn('flex h-6 w-6 shrink-0 items-center justify-center text-muted', !kids && 'invisible')}
              >
                <Icon name={isOpen ? 'expand_more' : 'chevron_right'} size={18} />
              </button>
              <Icon name={isOpen ? 'folder_open' : 'folder'} size={18} fill className={on ? 'text-accent' : 'text-muted'} />
              <span className={cn('min-w-0 flex-1 truncate font-mono text-13', on ? 'font-semibold' : 'font-normal')}>
                {n.name}
              </span>
              {n.ingested && (
                <Chip tone="ok" className="h-5 text-xs">
                  No catálogo
                </Chip>
              )}
              <span className="min-w-[72px] whitespace-nowrap text-right text-sm text-muted">
                {kids ? `${kids} ${kids === 1 ? 'subpasta' : 'subpastas'}` : ''}
              </span>
            </div>
          )
        })}
      </div>
      <div className="flex flex-wrap items-center gap-2 border-t border-line px-3.5 py-2.5">
        <span className="min-w-[200px] flex-1 text-sm text-muted">
          A ingestão percorre o diretório escolhido e todos os subdiretórios.
        </span>
        <Button onClick={onCancel}>Cancelar</Button>
        <Button variant="primary" onClick={() => onUse(sel)}>
          Usar este diretório
        </Button>
      </div>
    </div>
  )
}
