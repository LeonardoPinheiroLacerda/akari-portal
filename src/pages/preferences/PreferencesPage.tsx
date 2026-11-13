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
import { ISO639_2, TMDB_LOCALES } from '@/features/item/labels'
import { formatRelative, humanizeIsoDuration } from '@/lib/format'
import { useDebounced } from '@/lib/useDebounced'
import { cn } from '@/lib/utils'

type Kind = 'path' | 'bytes' | 'duration' | 'enum' | 'secret' | 'locale' | 'tmdbLang' | 'langList' | 'trackLang' | 'bool' | 'text'
type Meta = {
  label: string
  hint: string
  kind: Kind
  width?: number
  placeholder?: string
  options?: string[]
  /** Rótulo de cada opção do `enum`; sem ele, a opção mostra o próprio valor. */
  optionLabels?: Record<string, string>
  /** Rótulo da opção vazia do `trackLang`/`tmdbLang`, quando vazio é um valor válido (não "não configurado"). */
  emptyLabel?: string
}

/** A ordem das chaves aqui é a ordem em que aparecem na tela, dentro de cada grupo. */
const META: Record<string, Meta> = {
  'tmdb.api-key': { label: 'Token de API', hint: 'Necessário para buscas e pareamento no TMDB.', kind: 'secret', width: 280 },
  'tmdb.default-language': {
    label: 'Idioma padrão',
    hint: 'Idioma das buscas e metadados retornados pelo TMDB.',
    kind: 'locale',
    width: 260,
  },
  'tmdb.include-adult': { label: 'Incluir conteúdo adulto', hint: 'Inclui resultados adultos nas buscas do TMDB.', kind: 'bool' },
  'tmdb.override.title-language': {
    label: 'Idioma do título',
    hint: 'Título que a ingestão traz do TMDB. Sem tradução nesse idioma, usa o de fallback; "Manter o da AniList" não preenche.',
    kind: 'tmdbLang',
    width: 260,
    emptyLabel: 'Manter o da AniList',
  },
  'tmdb.override.synopsis-language': {
    label: 'Idioma da sinopse',
    hint: 'Sinopse que a ingestão traz do TMDB. Sem tradução nesse idioma, usa o de fallback; "Manter a da AniList" não preenche.',
    kind: 'tmdbLang',
    width: 260,
    emptyLabel: 'Manter a da AniList',
  },
  'tmdb.episode.name-language': {
    label: 'Idioma do nome dos episódios',
    hint: 'Nome que o pareamento de episódios traz do TMDB. Sem tradução nesse idioma, usa o de fallback. Episódios já pareados mudam na próxima ingestão.',
    kind: 'tmdbLang',
    width: 260,
    emptyLabel: 'Padrão do TMDB (inglês)',
  },
  'tmdb.episode.synopsis-language': {
    label: 'Idioma da sinopse dos episódios',
    hint: 'Sinopse que o pareamento de episódios traz do TMDB. Sem tradução nesse idioma, usa o de fallback. Episódios já pareados mudam na próxima ingestão.',
    kind: 'tmdbLang',
    width: 260,
    emptyLabel: 'Padrão do TMDB (inglês)',
  },
  'tmdb.override.fallback-language': {
    label: 'Idioma de fallback',
    hint: 'Usado no título, na sinopse, no backdrop e nos episódios quando o TMDB não tem opção no idioma escolhido.',
    kind: 'tmdbLang',
    width: 260,
    emptyLabel: 'Sem fallback',
  },
  'tmdb.image.logo-language': {
    label: 'Idiomas do logo',
    hint: 'Ordem de preferência do logo que a ingestão traz do TMDB: fica o do primeiro idioma que tiver logo. Não usa o fallback.',
    kind: 'langList',
    width: 260,
  },
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
  'playback.default.audio-language': {
    label: 'Idioma do áudio padrão',
    hint: 'Áudio escolhido quando a reprodução começa sem faixa pedida: a primeira faixa nesse idioma; sem nenhuma, a padrão do arquivo.',
    kind: 'trackLang',
    width: 260,
  },
  'playback.default.subtitle-language': {
    label: 'Idioma da legenda padrão',
    hint: 'Legenda escolhida quando a reprodução começa sem faixa pedida; sem faixa nesse idioma, ou com "Sem legenda", começa sem legenda.',
    kind: 'trackLang',
    width: 260,
    emptyLabel: 'Sem legenda',
  },
  'playback.default.subtitle-forced': {
    label: 'Tipo da legenda padrão',
    hint: 'Completa ou forçada (só letreiros e músicas). Sem faixa desse tipo no idioma, usa a do outro tipo.',
    kind: 'enum',
    options: ['false', 'true'],
    optionLabels: { false: 'Completa', true: 'Forçada' },
  },
  'playback.transcode.hardware-acceleration': {
    label: 'Aceleração de hardware',
    hint: 'Método usado pelo FFmpeg no transcode durante a reprodução.',
    kind: 'enum',
    options: ['NONE', 'VIDEOTOOLBOX', 'NVENC', 'QSV', 'VAAPI'],
  },
  'playback.work.base-dir': {
    label: 'Diretório de trabalho',
    hint: 'Base onde as sessões de reprodução gravam arquivos temporários.',
    kind: 'path',
    width: 320,
    placeholder: '/var/lib/akari/playback',
  },
  'playback.session.heartbeat-ttl': {
    label: 'Tempo da sessão sem sinal',
    hint: 'Quanto tempo uma reprodução continua ativa sem sinal do player (ISO-8601, ex.: PT30S).',
    kind: 'duration',
    width: 160,
  },
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
}

const GROUPS: [string, string][] = [
  ['tmdb', 'TMDB'],
  ['anilist', 'AniList'],
  ['playback', 'Reprodução'],
  ['cache', 'Cache de vídeo'],
]

const ORDER = Object.keys(META)
/** Chaves do `META` na ordem dele; as desconhecidas vão para o fim, na ordem da API. */
const rank = (key: string) => {
  const i = ORDER.indexOf(key)
  return i < 0 ? ORDER.length : i
}

const TMDB_LANG_OPTIONS = TMDB_LOCALES.map(([v, l]) => ({ value: v, label: `${v} · ${l}` }))
/** `none` é o logo sem idioma. */
const LOGO_LANG_OPTIONS = [{ value: 'none', label: 'none · Sem idioma (sem texto)' }, ...TMDB_LANG_OPTIONS]

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
  const settings = [...(query.data ?? [])].sort((a, b) => rank(a.key) - rank(b.key))
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
  const empty = !s.configured && meta.emptyLabel == null
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
          className={cn(!meta.optionLabels && '[&_button]:font-mono [&_button]:text-xs')}
          options={(meta.options ?? []).map((o) => ({ value: o, label: meta.optionLabels?.[o] ?? o }))}
        />
      )
      break
    case 'langList':
      control = (
        <LangList
          value={value}
          onChange={(v) => {
            setValue(v)
            setError(null)
          }}
          label={meta.label}
          width={meta.width}
        />
      )
      break
    case 'locale':
    case 'tmdbLang':
    case 'trackLang': {
      const opts = [
        ...(meta.emptyLabel != null ? [{ value: '', label: meta.emptyLabel }] : []),
        ...(meta.kind === 'trackLang' ? ISO639_2.map(([v, l]) => ({ value: v, label: `${v} · ${l}` })) : TMDB_LANG_OPTIONS),
      ]
      if (value && !opts.some((o) => o.value === value)) opts.push({ value, label: value })
      control = (
        <div style={{ width: meta.width }} className="max-w-full">
          <Select
            value={value}
            onChange={(v) => {
              setValue(v)
              setError(null)
            }}
            options={opts}
            aria-label={meta.label}
            className="h-9"
          />
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

const splitLangs = (v: string) =>
  v
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)

/** Lista ordenada de idiomas, gravada como `en-US,ja,none`. */
function LangList({
  value,
  onChange,
  label,
  width,
}: {
  value: string
  onChange: (value: string) => void
  label: string
  width?: number
}) {
  const langs = splitLangs(value)
  const set = (next: string[]) => onChange(next.join(','))
  const move = (i: number, d: -1 | 1) => {
    const next = [...langs]
    ;[next[i], next[i + d]] = [next[i + d], next[i]]
    set(next)
  }
  const labelOf = (v: string) => LOGO_LANG_OPTIONS.find((o) => o.value === v)?.label ?? v
  const addable = LOGO_LANG_OPTIONS.filter((o) => !langs.includes(o.value))

  return (
    <div style={{ width }} className="flex max-w-full flex-col gap-1.5">
      {langs.length === 0 && <span className="text-sm text-muted">Nenhum idioma: o logo não é preenchido.</span>}
      {langs.map((l, i) => (
        <div key={l} className="flex h-8 items-center gap-1 rounded-rs border border-line bg-bg pl-2.5 pr-1 text-13">
          <span className="w-4 text-xs text-muted">{i + 1}</span>
          <span className="min-w-0 flex-1 truncate">{labelOf(l)}</span>
          <Button
            size="icon-sm"
            variant="ghost"
            iconSize={16}
            icon="arrow_upward"
            aria-label={`Subir ${l}`}
            disabled={i === 0}
            onClick={() => move(i, -1)}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            iconSize={16}
            icon="arrow_downward"
            aria-label={`Descer ${l}`}
            disabled={i === langs.length - 1}
            onClick={() => move(i, 1)}
          />
          <Button
            size="icon-sm"
            variant="ghost"
            iconSize={16}
            icon="close"
            aria-label={`Remover ${l}`}
            onClick={() => set(langs.filter((x) => x !== l))}
          />
        </div>
      ))}
      <Select
        value=""
        onChange={(v) => v && set([...langs, v])}
        options={addable}
        placeholder="Adicionar idioma"
        aria-label={`Adicionar a ${label}`}
        size="sm"
      />
    </div>
  )
}
