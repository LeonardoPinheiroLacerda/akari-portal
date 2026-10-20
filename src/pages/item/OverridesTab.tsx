import DOMPurify from 'dompurify'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import {
  getGetTmdbOverridesSchemaQueryKey,
  getGetTmdbStateQueryKey,
  getTmdbOverridesSchema,
  useGetTmdbOverridesSchema,
  useUpdateTmdbOverrides,
} from '@/api/generated/endpoints/anime-tmdb/anime-tmdb'
import type { TmdbImageOption, TmdbOverrides, TmdbOverridesSchema } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate, queryClient } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Chip } from '@/components/ui/chip'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Input, Textarea } from '@/components/ui/input'
import { RadioDot } from '@/components/ui/radio'
import { ErrorState, Loading } from '@/components/ui/states'
import { Thumb } from '@/components/ui/thumb'
import type { ItemState } from '@/features/item/useItem'
import { formatRelative } from '@/lib/format'
import { cn } from '@/lib/utils'

type FieldKey = 'title' | 'synopsis' | 'posterPath' | 'backdropPath' | 'logoPath'
type Draft = Record<FieldKey, string | null>

type FieldDef = {
  k: FieldKey
  label: string
  icon: string
  kind: 'text' | 'longtext' | 'image'
  ratio?: string
  min?: number
  desc: string
}

const FIELDS: FieldDef[] = [
  { k: 'title', label: 'Título', icon: 'title', kind: 'text', desc: 'Título principal exibido no app.' },
  { k: 'synopsis', label: 'Sinopse', icon: 'notes', kind: 'longtext', desc: 'Texto da página do título.' },
  {
    k: 'posterPath',
    label: 'Pôster',
    icon: 'image',
    kind: 'image',
    ratio: '2/3',
    min: 120,
    desc: 'Capa vertical usada nas listagens.',
  },
  {
    k: 'backdropPath',
    label: 'Backdrop',
    icon: 'panorama',
    kind: 'image',
    ratio: '16/9',
    min: 200,
    desc: 'Imagem de fundo da página do título.',
  },
  {
    k: 'logoPath',
    label: 'Logo',
    icon: 'branding_watermark',
    kind: 'image',
    ratio: '3/1',
    min: 170,
    desc: 'Logo sobreposto ao backdrop.',
  },
]
const KEYS = FIELDS.map((f) => f.k)

const toDraft = (o?: TmdbOverrides | null): Draft => ({
  title: o?.title ?? null,
  synopsis: o?.synopsis ?? null,
  posterPath: o?.posterPath ?? null,
  backdropPath: o?.backdropPath ?? null,
  logoPath: o?.logoPath ?? null,
})

const stripHtml = (html?: string | null) => (html ? DOMPurify.sanitize(html, { ALLOWED_TAGS: [] }) : '')

export function OverridesTab({ item }: { item: ItemState }) {
  const anilistId = item.anilistId!
  const anime = item.anime.data
  const saved = useMemo(() => toDraft(item.tmdb.data?.overrides), [item.tmdb.data?.overrides])
  const [draft, setDraft] = useState<Draft>(saved)
  const [field, setField] = useState<FieldKey>('title')
  const [customOn, setCustomOn] = useState<Partial<Record<FieldKey, boolean>>>({})
  const [refreshing, setRefreshing] = useState(false)
  const schema = useGetTmdbOverridesSchema(anilistId, undefined, { query: { staleTime: 5 * 60_000 } })
  const save = useUpdateTmdbOverrides()

  useEffect(() => setDraft(saved), [saved])

  const dirtyKeys = KEYS.filter((k) => (draft[k] ?? null) !== (saved[k] ?? null))
  const dirty = dirtyKeys.length > 0
  const savedCount = KEYS.filter((k) => saved[k] != null).length

  // previewUrl por caminho (opções do schema + URLs já resolvidas dos overrides salvos)
  const previewOf = useMemo(() => {
    const map = new Map<string, string>()
    const o = item.tmdb.data?.overrides
    if (o?.posterPath && o.posterPreviewUrl) map.set(o.posterPath, o.posterPreviewUrl)
    if (o?.backdropPath && o.backdropPreviewUrl) map.set(o.backdropPath, o.backdropPreviewUrl)
    if (o?.logoPath && o.logoPreviewUrl) map.set(o.logoPath, o.logoPreviewUrl)
    for (const k of ['posterPath', 'backdropPath', 'logoPath'] as const)
      for (const opt of schema.data?.[k] ?? []) if (opt.value && opt.previewUrl) map.set(opt.value, opt.previewUrl)
    return (path: string | null) => (path ? (map.get(path) ?? null) : null)
  }, [item.tmdb.data?.overrides, schema.data])

  const defaults: Record<FieldKey, string> = {
    title: `Usa o título da AniList: ${anime?.titles?.main ?? '—'}`,
    synopsis: 'Usa a sinopse da AniList',
    posterPath: 'Pôster da AniList',
    backdropPath: 'Sem backdrop',
    logoPath: 'Sem logo',
  }

  const refresh = async () => {
    setRefreshing(true)
    try {
      const data = await getTmdbOverridesSchema(anilistId, { forceRefresh: true })
      queryClient.setQueryData(getGetTmdbOverridesSchemaQueryKey(anilistId), data)
      toast.success('Opções do TMDB recarregadas')
    } catch (e) {
      toastError(e)
    } finally {
      setRefreshing(false)
    }
  }

  const onSave = () => {
    const body = Object.fromEntries(KEYS.map((k) => [k, draft[k]?.trim() ? draft[k] : null])) as TmdbOverrides
    save.mutate(
      { anilistId, data: body },
      {
        onSuccess: async (state) => {
          queryClient.setQueryData(getGetTmdbStateQueryKey(anilistId), state)
          setCustomOn({})
          await Promise.all([invalidate.anime(anilistId), invalidate.catalog()])
          toast.success('Overrides salvos')
        },
        onError: (e) => toastError(e),
      },
    )
  }

  const cur = FIELDS.find((f) => f.k === field)!
  const setValue = (k: FieldKey, v: string | null) => setDraft((d) => ({ ...d, [k]: v }))

  const subOf = (f: FieldDef) => {
    const v = draft[f.k]
    if (v == null) return 'Padrão'
    if (f.kind === 'image') return v
    return v
  }

  return (
    <>
      <section className="card flex flex-wrap items-center gap-x-3.5 gap-y-2.5 px-5 py-3.5">
        <div className="flex min-w-[240px] flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="m-0 text-15 font-semibold">Overrides TMDB</h3>
            {dirty && (
              <Chip tone="warn" className="h-5 text-xs">
                Alterações não salvas
              </Chip>
            )}
          </div>
          <span className="text-sm text-muted">
            {savedCount} de 5 campos sobrepostos
            {schema.dataUpdatedAt
              ? ` · opções do TMDB carregadas ${formatRelative(new Date(schema.dataUpdatedAt).toISOString())}`
              : ''}
          </span>
        </div>
        <Button size="sm" icon="refresh" loading={refreshing} onClick={refresh}>
          Recarregar opções
        </Button>
        <Button size="sm" disabled={KEYS.every((k) => draft[k] == null)} onClick={() => setDraft(toDraft(null))}>
          Limpar todos
        </Button>
        <Button size="sm" disabled={!dirty} onClick={() => setDraft(saved)}>
          Descartar
        </Button>
        <Button size="sm" variant="primary" disabled={!dirty} loading={save.isPending} onClick={onSave}>
          Salvar overrides
        </Button>
      </section>

      <div className="flex flex-wrap items-start gap-4">
        <nav className="flex max-w-[260px] flex-[1_1_210px] flex-col gap-1">
          {FIELDS.map((f) => {
            const on = f.k === field
            const isSaved = saved[f.k] != null
            const changed = dirtyKeys.includes(f.k)
            return (
              <button
                key={f.k}
                type="button"
                onClick={() => setField(f.k)}
                className={cn(
                  'flex items-center gap-2.5 rounded-rs border px-3 py-2.5 text-left transition-colors',
                  on ? 'border-accent bg-tint' : 'border-line bg-panel hover:bg-raised',
                )}
              >
                <Icon name={f.icon} size={20} className={on ? 'text-accent' : 'text-muted'} />
                <span className="flex min-w-0 flex-1 flex-col gap-px">
                  <span className="text-13 font-semibold">{f.label}</span>
                  <span className={cn('truncate text-xs text-muted', f.kind === 'image' && draft[f.k] && 'font-mono')}>
                    {subOf(f)}
                  </span>
                </span>
                <span
                  className="h-2 w-2 shrink-0 rounded-full border-[1.5px]"
                  style={{
                    background: changed ? 'transparent' : isSaved ? 'var(--accent)' : 'transparent',
                    borderColor: changed || isSaved ? 'var(--accent)' : 'transparent',
                  }}
                />
              </button>
            )
          })}
          <div className="flex flex-col gap-1 px-1 pt-2.5 text-xs text-muted">
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full bg-accent" />
              Override ativo
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-[7px] w-[7px] rounded-full border-[1.5px] border-accent" />
              Alterado, não salvo
            </span>
          </div>
        </nav>

        <section className="card min-w-0 flex-[3_1_420px] overflow-hidden">
          <div className="flex flex-col gap-[3px] border-b border-line px-5 py-4">
            <div className="flex items-baseline gap-2.5">
              <h3 className="m-0 text-15 font-semibold">{cur.label}</h3>
              <span className="font-mono text-sm text-muted">{cur.k}</span>
            </div>
            <span className="text-13 text-muted">{cur.desc}</span>
          </div>
          {schema.isLoading && <Loading label="Carregando opções do TMDB…" />}
          {schema.isError && <ErrorState error={schema.error} onRetry={() => schema.refetch()} />}
          {schema.data &&
            (cur.kind === 'image' ? (
              <ImageEditor
                key={cur.k}
                def={cur}
                options={schema.data[cur.k as 'posterPath'] ?? []}
                value={draft[cur.k]}
                defaultLabel={defaults[cur.k]}
                onChange={(v) => setValue(cur.k, v)}
              />
            ) : (
              <TextEditor
                key={cur.k}
                def={cur}
                options={(schema.data as TmdbOverridesSchema)[cur.k as 'title'] ?? []}
                value={draft[cur.k]}
                defaultLabel={defaults[cur.k]}
                customOn={!!customOn[cur.k]}
                setCustomOn={(on) => setCustomOn((c) => ({ ...c, [cur.k]: on }))}
                onChange={(v) => setValue(cur.k, v)}
              />
            ))}
        </section>

        <aside className="flex flex-[1_1_100%] flex-col gap-2.5">
          <span className="text-sm text-muted">Pré-visualização (rascunho)</span>
          <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
            <div className="card overflow-hidden">
              <div className="stripe relative flex aspect-video items-end overflow-hidden p-3">
                {previewOf(draft.backdropPath) && (
                  <img src={previewOf(draft.backdropPath)!} alt="" className="absolute inset-0 h-full w-full object-cover" />
                )}
                <div className="relative flex aspect-[3/1] w-[46%] items-center justify-center">
                  {previewOf(draft.logoPath) ? (
                    <img src={previewOf(draft.logoPath)!} alt="" className="max-h-full max-w-full object-contain drop-shadow" />
                  ) : (
                    <span className="flex h-full w-full items-center justify-center rounded border border-dashed border-white/40 bg-black/25 px-1.5 text-center font-mono text-2xs text-[#f3ece4]">
                      sem logo
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-3 p-3.5">
                <Thumb
                  src={previewOf(draft.posterPath) ?? anime?.thumbnails?.large}
                  width={64}
                  className="-mt-10 border-2 border-panel"
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <span className="text-15 font-semibold leading-tight">{draft.title?.trim() || anime?.titles?.main}</span>
                  <span className="line-clamp-4 text-sm leading-normal text-muted">
                    {draft.synopsis?.trim() || stripHtml(anime?.synopsis)}
                  </span>
                </div>
              </div>
            </div>
            <div className="card self-start">
              {FIELDS.map((f) => {
                const ov = draft[f.k] != null && (f.kind === 'image' || !!draft[f.k]?.trim())
                return (
                  <div key={f.k} className="flex justify-between gap-2.5 border-b border-line px-3 py-2 text-sm last:border-b-0">
                    <span className="text-muted">{f.label}</span>
                    <span className={cn('font-semibold', ov ? 'text-accent-text' : 'text-muted')}>
                      {ov ? 'Override' : 'Padrão'}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </aside>
      </div>
    </>
  )
}

function OptionRow({ checked, onClick, children }: { checked: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      onClick={onClick}
      className={cn('flex items-start gap-3 rounded-rs p-3 text-left transition-colors', checked ? 'bg-tint' : 'hover:bg-hover')}
    >
      <RadioDot checked={checked} className="mt-0.5 h-4 w-4" />
      {children}
    </button>
  )
}

function TextEditor({
  def,
  options,
  value,
  defaultLabel,
  customOn,
  setCustomOn,
  onChange,
}: {
  def: FieldDef
  options: { value?: string | null; language?: string | null }[]
  value: string | null
  defaultLabel: string
  customOn: boolean
  setCustomOn: (on: boolean) => void
  onChange: (v: string | null) => void
}) {
  const matchIdx = value == null ? -1 : options.findIndex((o) => o.value === value)
  const isCustom = customOn || (value != null && matchIdx === -1)
  const [custom, setCustom] = useState(isCustom ? (value ?? '') : '')

  const pickCustom = () => {
    setCustomOn(true)
    onChange(custom)
  }

  return (
    <div role="radiogroup" className="flex flex-col p-2">
      <OptionRow
        checked={value == null && !customOn}
        onClick={() => {
          setCustomOn(false)
          onChange(null)
        }}
      >
        <span className="flex flex-col gap-0.5">
          <span className="font-semibold">Sem override</span>
          <span className="text-sm text-muted">{defaultLabel}</span>
        </span>
      </OptionRow>
      {options.map((o, i) => (
        <OptionRow
          key={i}
          checked={!isCustom && matchIdx === i}
          onClick={() => {
            setCustomOn(false)
            onChange(o.value ?? null)
          }}
        >
          <span className="min-w-[30px] shrink-0 rounded-chip bg-raised px-1.5 py-0.5 text-center font-mono text-xs font-bold">
            {o.language ?? '—'}
          </span>
          <span className="line-clamp-3 min-w-0 flex-1 leading-normal [text-wrap:pretty]">{o.value}</span>
        </OptionRow>
      ))}
      {options.length === 0 && <span className="px-3 py-2 text-13 text-muted">O TMDB não tem traduções para este campo.</span>}
      <div className={cn('flex items-start gap-3 rounded-rs p-3', isCustom && 'bg-tint')}>
        <button
          type="button"
          role="radio"
          aria-checked={isCustom}
          aria-label="Texto personalizado"
          onClick={pickCustom}
          className="mt-0.5"
        >
          <RadioDot checked={isCustom} className="h-4 w-4" />
        </button>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="font-semibold">Texto personalizado</span>
          {def.kind === 'longtext' ? (
            <Textarea
              rows={4}
              placeholder="Escreva a sinopse…"
              value={custom}
              onFocus={pickCustom}
              onChange={(e) => {
                setCustom(e.target.value)
                setCustomOn(true)
                onChange(e.target.value)
              }}
              className="resize-y"
            />
          ) : (
            <Input
              className="h-[38px]"
              placeholder="Escreva o título…"
              value={custom}
              onFocus={pickCustom}
              onChange={(e) => {
                setCustom(e.target.value)
                setCustomOn(true)
                onChange(e.target.value)
              }}
            />
          )}
        </div>
      </div>
    </div>
  )
}

function ImageEditor({
  def,
  options,
  value,
  defaultLabel,
  onChange,
}: {
  def: FieldDef
  options: TmdbImageOption[]
  value: string | null
  defaultLabel: string
  onChange: (v: string | null) => void
}) {
  const [lang, setLang] = useState<string>('*')
  const langs = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of options) counts.set(o.language ?? '', (counts.get(o.language ?? '') ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [options])
  const shown = options.filter((o) => lang === '*' || (o.language ?? '') === lang)
  const [viewing, setViewing] = useState<number | null>(null)

  const chip = (key: string, label: string, count: number) => {
    const on = lang === key
    return (
      <button
        key={key}
        type="button"
        onClick={() => setLang(key)}
        className={cn(
          'flex h-7 items-center gap-1.5 rounded-chip border px-2.5 text-sm transition-colors',
          on ? 'border-text bg-text text-bg' : 'border-line hover:bg-raised',
        )}
      >
        {label}
        <span className="font-mono text-2xs opacity-70">{count}</span>
      </button>
    )
  }

  return (
    <>
      <div className="flex flex-wrap gap-1.5 border-b border-line px-5 py-3">
        {chip('*', 'Todos', options.length)}
        {langs.map(([k, n]) => chip(k, k ? k : 'Sem idioma', n))}
      </div>
      <div className="grid gap-3 px-5 pb-5 pt-4" style={{ gridTemplateColumns: `repeat(auto-fill,minmax(${def.min}px,1fr))` }}>
        <button type="button" onClick={() => onChange(null)} className="flex flex-col gap-2 text-left">
          <div
            className={cn(
              'flex flex-col items-center justify-center gap-1 rounded-rs border-2 border-dashed p-2 text-center text-muted',
              value == null ? 'border-accent' : 'border-line',
            )}
            style={{ aspectRatio: def.ratio }}
          >
            <Icon name="auto_awesome" size={22} />
            <span className="text-xs leading-tight">Sem override</span>
          </div>
          <span className="text-xs leading-tight text-muted">{defaultLabel}</span>
        </button>
        {shown.map((o) => {
          const on = o.value != null && o.value === value
          return (
            <div key={o.value} className="group relative flex flex-col gap-2">
              <button type="button" onClick={() => onChange(o.value ?? null)} className="flex flex-col gap-2 text-left">
                <div
                  className="stripe relative overflow-hidden rounded-rs"
                  style={{
                    aspectRatio: def.ratio,
                    outline: `2px solid ${on ? 'var(--accent)' : 'transparent'}`,
                    outlineOffset: 2,
                  }}
                >
                  {o.previewUrl && (
                    <img
                      src={o.previewUrl}
                      alt=""
                      loading="lazy"
                      className={cn('h-full w-full', def.k === 'logoPath' ? 'object-contain p-2' : 'object-cover')}
                    />
                  )}
                  {on && (
                    <span className="absolute right-1.5 top-1.5 flex h-[22px] w-[22px] items-center justify-center rounded-full bg-accent text-accent-ink">
                      <Icon name="check" size={16} />
                    </span>
                  )}
                </div>
                <span className="flex items-center gap-1.5 text-xs">
                  <span className="rounded-chip bg-raised px-1.5 py-px font-mono font-bold">{o.language ?? '—'}</span>
                  <span className="font-mono text-muted">{o.width && o.height ? `${o.width}×${o.height}` : ''}</span>
                </span>
              </button>
              {o.previewUrl && (
                <button
                  type="button"
                  aria-label="Ver ampliada"
                  title="Ver ampliada"
                  onClick={() => setViewing(shown.indexOf(o))}
                  className="absolute left-1.5 top-1.5 flex h-7 w-7 items-center justify-center rounded-rs bg-black/60 text-white opacity-0 transition-opacity hover:bg-black/80 focus-visible:opacity-100 group-hover:opacity-100"
                >
                  <Icon name="open_in_full" size={16} />
                </button>
              )}
            </div>
          )
        })}
      </div>
      {options.length === 0 && <div className="px-5 pb-5 text-13 text-muted">O TMDB não tem imagens para este campo.</div>}
      {viewing != null && shown[viewing] && (
        <ImageViewer
          def={def}
          options={shown}
          index={viewing}
          value={value}
          onIndex={setViewing}
          onPick={(v) => {
            onChange(v)
            setViewing(null)
          }}
          onClose={() => setViewing(null)}
        />
      )}
    </>
  )
}

/** O preview do TMDB vem reduzido (w342, w500…); ampliado, pede o tamanho original. */
const fullSize = (url: string) => url.replace(/\/t\/p\/[^/]+\//, '/t/p/original/')

function ImageViewer({
  def,
  options,
  index,
  value,
  onIndex,
  onPick,
  onClose,
}: {
  def: FieldDef
  options: TmdbImageOption[]
  index: number
  value: string | null
  onIndex: (i: number) => void
  onPick: (v: string | null) => void
  onClose: () => void
}) {
  const o = options[index]
  const on = o.value != null && o.value === value
  const prev = index > 0 ? index - 1 : null
  const next = index < options.length - 1 ? index + 1 : null

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && prev != null) onIndex(prev)
      if (e.key === 'ArrowRight' && next != null) onIndex(next)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [prev, next, onIndex])

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        width={def.k === 'posterPath' ? 720 : 1200}
        className="max-h-[calc(100vh-32px)]"
        title={def.label}
        description={[
          o.language ?? 'sem idioma',
          o.width && o.height ? `${o.width}×${o.height}` : null,
          `${index + 1} de ${options.length}`,
        ]
          .filter(Boolean)
          .join(' · ')}
      >
        <div className={cn('flex min-h-0 flex-1 items-center justify-center p-4', def.k === 'logoPath' ? 'stripe' : 'bg-code')}>
          <img
            key={o.value}
            src={fullSize(o.previewUrl!)}
            alt=""
            className="max-h-[calc(100vh-220px)] max-w-full object-contain"
            style={{ aspectRatio: o.width && o.height ? `${o.width}/${o.height}` : def.ratio }}
          />
        </div>
        <div className="flex items-center gap-2 border-t border-line px-5 py-3">
          <Button size="sm" icon="chevron_left" disabled={prev == null} onClick={() => prev != null && onIndex(prev)}>
            Anterior
          </Button>
          <Button size="sm" disabled={next == null} onClick={() => next != null && onIndex(next)}>
            Próxima
            <Icon name="chevron_right" size={18} />
          </Button>
          <div className="flex-1" />
          {on ? (
            <Chip tone="ok" icon="check">
              Selecionada
            </Chip>
          ) : (
            <Button size="sm" variant="primary" onClick={() => onPick(o.value ?? null)}>
              Usar esta imagem
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
