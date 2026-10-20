import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { getListSettingsQueryKey, useListSettings, useUpdateSetting } from '@/api/generated/endpoints/setting/setting'
import type { SettingResponse } from '@/api/generated/model'
import { errorCode, errorMessage, toastError } from '@/api/errors'
import { invalidate, queryClient } from '@/api/query'
import { usePageMeta } from '@/components/layout/PageMeta'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Icon } from '@/components/ui/icon'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import { ErrorState, Loading } from '@/components/ui/states'
import { Switch } from '@/components/ui/switch'
import { ISO639, TMDB_LOCALES } from '@/features/item/labels'
import { formatRelative, humanizeIsoDuration } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

type Kind = 'path' | 'bytes' | 'duration' | 'enum' | 'secret' | 'locale' | 'lang' | 'bool' | 'text'
type Meta = { label: string; hint: string; kind: Kind; width?: number; placeholder?: string; options?: string[] }

const META: Record<string, Meta> = {
  'cache.dir': {
    label: 'Diretório do cache',
    hint: 'Onde os arquivos de vídeo baixados são guardados.',
    kind: 'path',
    width: 320,
    placeholder: '/var/lib/akari/cache',
  },
  'cache.max-size-bytes': {
    label: 'Tamanho máximo do cache',
    hint: 'Orçamento de espaço em disco para o cache local, em bytes.',
    kind: 'bytes',
    width: 260,
  },
  'playback.transcode.hardware-acceleration': {
    label: 'Aceleração de hardware',
    hint: 'Método usado pelo FFmpeg no transcode durante a reprodução.',
    kind: 'enum',
    options: ['NONE', 'VIDEOTOOLBOX', 'NVENC', 'QSV', 'VAAPI'],
  },
  'playback.session.heartbeat-ttl': {
    label: 'Tempo da sessão sem sinal',
    hint: 'Quanto tempo uma reprodução continua ativa sem sinal do player (ISO-8601, ex.: PT30S).',
    kind: 'duration',
    width: 160,
  },
  'playback.work.base-dir': {
    label: 'Diretório de trabalho',
    hint: 'Base onde as sessões de reprodução gravam arquivos temporários.',
    kind: 'path',
    width: 320,
    placeholder: '/var/lib/akari/playback',
  },
  'tmdb.api-key': { label: 'Token de API', hint: 'Necessário para buscas e pareamento no TMDB.', kind: 'secret', width: 280 },
  'tmdb.default-language': {
    label: 'Idioma padrão',
    hint: 'Idioma das buscas e metadados retornados pelo TMDB.',
    kind: 'locale',
    width: 260,
  },
  'tmdb.image.logo-language': {
    label: 'Idioma do logo',
    hint: 'Idioma preferido para o logo do título.',
    kind: 'lang',
    width: 260,
  },
  'tmdb.image.backdrop-language': {
    label: 'Idioma do backdrop',
    hint: 'Vazio usa backdrops sem texto.',
    kind: 'lang',
    width: 260,
  },
  'tmdb.include-adult': { label: 'Incluir conteúdo adulto', hint: 'Inclui resultados adultos nas buscas do TMDB.', kind: 'bool' },
  'tmdb.cache.ttl': {
    label: 'Validade do cache de respostas',
    hint: 'Por quanto tempo as respostas do TMDB ficam em cache (ISO-8601, ex.: P7D).',
    kind: 'duration',
    width: 160,
  },
  'anilist.cache.ttl': {
    label: 'Validade do cache de respostas',
    hint: 'Por quanto tempo as respostas da AniList ficam em cache (ISO-8601, ex.: P7D).',
    kind: 'duration',
    width: 160,
  },
}

const GROUPS: [string, string][] = [
  ['cache', 'Cache de vídeo'],
  ['playback', 'Reprodução'],
  ['tmdb', 'TMDB'],
  ['anilist', 'AniList'],
]

const metaFor = (s: SettingResponse): Meta =>
  META[s.key] ??
  (s.secret ? { label: s.key, hint: '', kind: 'secret', width: 280 } : { label: s.key, hint: '', kind: 'text', width: 280 })

export function PreferencesPage() {
  usePageMeta('Preferências')
  const [sp, setSp] = useSearchParams()
  const [q, setQ] = useState(sp.get('filtro') ?? '')
  const name = useDebounced(q.trim(), 250)
  useEffect(() => {
    setSp(name ? { filtro: name } : {}, { replace: true })
  }, [name, setSp])

  const query = useListSettings(name ? { name } : undefined, { query: { placeholderData: (p) => p } })
  const settings = query.data ?? []
  const groups = [
    ...GROUPS.map(([prefix, title]) => ({ prefix, title, items: settings.filter((s) => s.key.startsWith(`${prefix}.`)) })),
    {
      prefix: '',
      title: 'Outras',
      items: settings.filter((s) => !GROUPS.some(([p]) => s.key.startsWith(`${p}.`))),
    },
  ].filter((g) => g.items.length)

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 min-w-[260px] flex-1 leading-normal text-muted">
          Preferências administráveis do sistema. Cada valor é salvo individualmente.
        </p>
        <label className="flex h-9 w-[280px] max-w-full items-center gap-2 rounded-rs border border-line bg-panel px-3 text-muted focus-within:border-accent">
          <Icon name="filter_list" size={18} />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Filtrar por chave"
            aria-label="Filtrar por chave"
            className="min-w-0 flex-1 border-0 bg-transparent font-mono text-sm text-text outline-none placeholder:font-sans placeholder:text-muted"
          />
        </label>
      </div>

      {query.isLoading && <Loading />}
      {query.isError && <ErrorState error={query.error} onRetry={() => query.refetch()} />}
      {query.data && settings.length === 0 && (
        <div className="card px-5 py-6 text-13 text-muted">Nenhuma preferência com “{name}” na chave.</div>
      )}

      {groups.map((g) => (
        <section key={g.prefix || 'other'} className="card overflow-hidden">
          <div className="flex items-baseline gap-2.5 border-b border-line px-5 py-3.5">
            <h3 className="m-0 text-15 font-semibold">{g.title}</h3>
            {g.prefix && <span className="font-mono text-sm text-muted">{g.prefix}.*</span>}
          </div>
          {g.items.map((s) => (
            <SettingRow key={s.key} setting={s} />
          ))}
        </section>
      ))}
    </>
  )
}

function SettingRow({ setting: s }: { setting: SettingResponse }) {
  const meta = metaFor(s)
  const initial = s.secret ? '' : (s.value ?? '')
  const [value, setValue] = useState(initial)
  const [error, setError] = useState<string | null>(null)
  const mutation = useUpdateSetting()
  useEffect(() => setValue(s.secret ? '' : (s.value ?? '')), [s.value, s.secret])

  const dirty = s.secret ? value.length > 0 : value !== (s.value ?? '')
  const empty = !s.configured
  const showChip = empty || s.secret

  const save = () =>
    mutation.mutate(
      { key: s.key, data: { value } },
      {
        onSuccess: (updated) => {
          setError(null)
          queryClient.setQueriesData<SettingResponse[]>({ queryKey: [getListSettingsQueryKey()[0]] }, (old) =>
            old?.map((x) => (x.key === updated.key ? updated : x)),
          )
          invalidate.settings()
          toast.success(`${meta.label} salvo`)
        },
        onError: (e) => {
          if (errorCode(e) === 'VALIDATION_ERROR' || errorCode(e) === 'BUSINESS_RULE_VIOLATION') setError(errorMessage(e))
          else toastError(e)
        },
      },
    )

  const inputBox = (suffix?: string | null, type = 'text', placeholder?: string) => (
    <div
      className={cn(
        'flex h-9 max-w-full items-center overflow-hidden rounded-rs border bg-bg focus-within:border-accent',
        error ? 'border-danger' : 'border-line',
      )}
      style={{ width: meta.width ?? 280 }}
    >
      <input
        type={type}
        value={value}
        onChange={(e) => {
          setValue(e.target.value)
          setError(null)
        }}
        onKeyDown={(e) => e.key === 'Enter' && dirty && save()}
        placeholder={placeholder}
        aria-label={meta.label}
        autoComplete="off"
        className="h-full min-w-0 flex-1 border-0 bg-transparent px-2.5 font-mono text-sm text-text outline-none placeholder:font-sans placeholder:text-muted"
      />
      {suffix && <span className="flex h-full items-center whitespace-nowrap bg-raised px-2.5 text-sm text-muted">{suffix}</span>}
    </div>
  )

  let control: React.ReactNode
  switch (meta.kind) {
    case 'bool':
      control = <Switch checked={value === 'true'} onCheckedChange={(v) => setValue(String(v))} aria-label={meta.label} />
      break
    case 'enum':
      control = (
        <Segmented
          aria-label={meta.label}
          value={value}
          onChange={setValue}
          className="[&_button]:font-mono [&_button]:text-xs"
          options={(meta.options ?? []).map((o) => ({ value: o, label: o }))}
        />
      )
      break
    case 'locale':
    case 'lang': {
      const opts =
        meta.kind === 'locale'
          ? TMDB_LOCALES.map(([v, l]) => ({ value: v, label: `${v} · ${l}` }))
          : [{ value: '', label: 'Sem idioma (sem texto)' }, ...ISO639.map(([v, l]) => ({ value: v, label: `${v} · ${l}` }))]
      if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: value })
      control = (
        <div style={{ width: meta.width }} className="max-w-full">
          <Select value={value} onChange={setValue} options={opts} aria-label={meta.label} className="h-9" />
        </div>
      )
      break
    }
    case 'bytes': {
      const n = Number(value)
      const gb =
        value && Number.isFinite(n) ? `≈ ${(n / 1024 ** 3).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} GB` : null
      control = inputBox(gb, 'text')
      break
    }
    case 'duration':
      control = inputBox(humanizeIsoDuration(value) ?? (value ? '?' : null), 'text', 'PT30S')
      break
    case 'secret':
      control = inputBox(null, 'password', s.configured ? 'Digite para substituir' : 'Cole o token')
      break
    default:
      control = inputBox(null, 'text', meta.placeholder)
  }

  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-3 border-b border-line px-5 py-3.5 last:border-b-0">
      <div className="flex min-w-[240px] flex-1 flex-col gap-[3px]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-medium">{meta.label}</span>
          {showChip && (
            <Chip tone={empty ? 'warn' : 'ok'} className="h-5 text-xs">
              {empty ? 'Não configurado' : 'Configurado'}
            </Chip>
          )}
        </div>
        <span className="font-mono text-sm text-muted">{s.key}</span>
        {meta.hint && <span className="text-sm leading-[1.4] text-muted">{meta.hint}</span>}
      </div>
      <div className="flex flex-wrap items-center gap-2.5">
        {control}
        <Button size="sm" variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} loading={mutation.isPending} onClick={save}>
          Salvar
        </Button>
      </div>
      <span className={cn('basis-full text-xs', error ? 'text-danger' : 'text-muted')}>
        {error ?? `Atualizado ${formatRelative(s.updatedAt)}`}
      </span>
    </div>
  )
}
