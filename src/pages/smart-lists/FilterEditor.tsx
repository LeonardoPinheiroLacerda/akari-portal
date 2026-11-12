import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { cn } from '@/lib/utils'
import { ANILIST_GENRES } from './anilistGenres'
import { ANILIST_STUDIOS } from './anilistStudios'
import { ANILIST_TAGS } from './anilistTags'
import {
  FILTERS,
  filterDef,
  FORMATS,
  genreLabel,
  isActive,
  SCOPES,
  STATUSES,
  validateFilter,
  type Adult,
  type FilterKey,
  type FilterScope,
  type FilterValues,
} from './criteria'

const UNKNOWN_TAG = 'Não é uma tag da AniList: nenhuma obra vai tê-la.'
const UNKNOWN_STUDIO = 'Não é um estúdio da AniList: nenhuma obra vai tê-lo.'

const pill = 'flex h-7 items-center gap-1 rounded-chip border px-2.5 text-sm transition-colors'

/** Um filtro em uso, numa pílula: clicar edita, o "x" tira. */
export function FilterPill({
  text,
  scope,
  negative,
  active,
  onEdit,
  onRemove,
}: {
  text: string
  scope: FilterScope
  negative?: boolean
  active: boolean
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <span
      className={cn(
        'flex h-8 max-w-full items-center rounded-chip border text-13 transition-colors',
        negative
          ? cn('bg-[var(--err-bg)] text-[var(--err-fg)]', active ? 'border-[var(--err-fg)]' : 'border-transparent')
          : active
            ? 'border-accent bg-tint'
            : 'border-line bg-raised hover:border-muted',
      )}
    >
      <button
        type="button"
        onClick={onEdit}
        title={`${SCOPES[scope].label}. Clique para editar.`}
        className="flex min-w-0 items-center gap-1.5 pl-2.5 pr-1 font-medium"
      >
        <Icon name={negative ? 'block' : SCOPES[scope].icon} size={15} className={cn('shrink-0', !negative && 'text-muted')} />
        <span className="truncate">{text}</span>
      </button>
      <button
        type="button"
        aria-label={`Tirar o filtro ${text}`}
        onClick={onRemove}
        className={cn(
          'mr-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-hover',
          negative ? 'opacity-80 hover:opacity-100' : 'text-muted hover:text-text',
        )}
      >
        <Icon name="close" size={15} />
      </button>
    </span>
  )
}

/** Escolha do tipo de filtro a adicionar, nos dois grupos da regra do backend. Os em uso não aparecem. */
export function FilterMenu({
  used,
  onPick,
  onCancel,
}: {
  used: (key: FilterKey) => boolean
  onPick: (key: FilterKey) => void
  onCancel: () => void
}) {
  return (
    <div className="flex flex-col gap-4 rounded-r border border-line bg-code p-4">
      {(Object.keys(SCOPES) as FilterScope[]).map((scope) => {
        const items = FILTERS.filter((f) => f.scope === scope && !used(f.key))
        if (!items.length) return null
        return (
          <div key={scope} className="flex flex-col gap-2">
            <div className="flex items-start gap-2">
              <Icon name={SCOPES[scope].icon} size={17} className="mt-px text-accent" />
              <div className="flex flex-col gap-0.5">
                <span className="text-13 font-semibold">{SCOPES[scope].label}</span>
                <span className="text-sm leading-[1.4] text-muted">{SCOPES[scope].hint}</span>
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {items.map((f) => (
                <button
                  key={f.key}
                  type="button"
                  onClick={() => onPick(f.key)}
                  className={cn(pill, 'border-line bg-panel hover:bg-raised', f.negative && 'text-[var(--err-fg)]')}
                >
                  <Icon name={f.negative ? 'block' : 'add'} size={15} />
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
      <div className="flex justify-end">
        <Button type="button" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </div>
  )
}

/**
 * Editor de um filtro, sobre um rascunho: só muda o formulário ao aplicar. Enter num campo simples
 * aplica; os campos com sugestões tratam o próprio Enter.
 */
export function FilterEditor({
  filterKey,
  values,
  isNew,
  onApply,
  onCancel,
}: {
  filterKey: FilterKey
  values: FilterValues
  isNew: boolean
  onApply: (draft: FilterValues) => void
  onCancel: () => void
}) {
  const def = filterDef(filterKey)
  const [draft, setDraft] = useState(values)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<FilterValues>) => {
    setDraft((d) => ({ ...d, ...patch }))
    setError(null)
  }
  const ready = isActive(filterKey, draft)
  const apply = () => {
    const problem = validateFilter(filterKey, draft)
    if (problem) setError(problem)
    else if (ready) onApply(draft)
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-r border bg-code p-4',
        def.negative ? 'border-[var(--err-fg)]' : 'border-accent',
      )}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && e.target instanceof HTMLInputElement && e.target.getAttribute('role') !== 'combobox') {
          e.preventDefault()
          apply()
        }
      }}
    >
      <div className="flex items-start gap-2">
        <Icon
          name={def.negative ? 'block' : SCOPES[def.scope].icon}
          size={17}
          className={cn('mt-px', def.negative ? 'text-[var(--err-fg)]' : 'text-accent')}
        />
        <div className="flex flex-col gap-0.5">
          <span className={cn('text-13 font-semibold', def.negative && 'text-[var(--err-fg)]')}>{def.label}</span>
          <span className="text-sm leading-[1.4] text-muted">
            {SCOPES[def.scope].label}: {def.hint.charAt(0).toLowerCase() + def.hint.slice(1)}
          </span>
        </div>
      </div>
      <FilterBody filterKey={filterKey} draft={draft} set={set} />
      {error && <span className="text-sm text-danger">{error}</span>}
      <div className="flex justify-end gap-2">
        <Button type="button" size="sm" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="button" size="sm" variant="primary" disabled={!ready} onClick={apply}>
          {isNew ? 'Adicionar' : 'Aplicar'}
        </Button>
      </div>
    </div>
  )
}

const GENRE_OPTIONS: [string, string][] = ANILIST_GENRES.map((g) => [g, genreLabel(g)])

function FilterBody({
  filterKey,
  draft,
  set,
}: {
  filterKey: FilterKey
  draft: FilterValues
  set: (patch: Partial<FilterValues>) => void
}) {
  switch (filterKey) {
    case 'includeGenres':
    case 'excludeGenres': {
      const other = filterKey === 'includeGenres' ? draft.excludeGenres : draft.includeGenres
      return (
        <MultiPicker
          negative={filterKey === 'excludeGenres'}
          options={GENRE_OPTIONS.filter(([g]) => !other.includes(g))}
          value={draft[filterKey]}
          onChange={(v) => set({ [filterKey]: v })}
        />
      )
    }
    case 'includeTags':
    case 'excludeTags':
      return (
        <TokenInput
          autoFocus
          negative={filterKey === 'excludeTags'}
          value={draft[filterKey]}
          onChange={(v) => set({ [filterKey]: v })}
          placeholder={filterKey === 'includeTags' ? 'Comece a digitar, ex.: Isekai' : 'Comece a digitar, ex.: Gore'}
          suggestions={ANILIST_TAGS}
          taken={filterKey === 'includeTags' ? draft.excludeTags : draft.includeTags}
          unknownHint={UNKNOWN_TAG}
        />
      )
    case 'studios':
      return (
        <TokenInput
          autoFocus
          value={draft.studios}
          onChange={(v) => set({ studios: v })}
          placeholder="Comece a digitar, ex.: MAPPA"
          suggestions={ANILIST_STUDIOS}
          unknownHint={UNKNOWN_STUDIO}
        />
      )
    case 'statuses':
      return <MultiPicker options={STATUSES} value={draft.statuses} onChange={(v) => set({ statuses: v })} />
    case 'formats':
      return <MultiPicker options={FORMATS} value={draft.formats} onChange={(v) => set({ formats: v })} />
    case 'adult':
      return (
        <Segmented<Adult>
          size="md"
          className="self-start"
          aria-label="Conteúdo adulto"
          value={draft.adult}
          onChange={(v) => set({ adult: v })}
          options={[
            { value: 'NONE', label: 'Não adulta' },
            { value: 'ONLY', label: 'Adulta' },
          ]}
        />
      )
    case 'year':
      return (
        <div className="grid grid-cols-2 gap-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">A partir de</span>
            <Input
              autoFocus
              inputMode="numeric"
              placeholder="Ex.: 2010"
              value={draft.yearFrom}
              onChange={(e) => set({ yearFrom: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm text-muted">Até</span>
            <Input
              inputMode="numeric"
              placeholder="Ex.: 2020"
              value={draft.yearTo}
              onChange={(e) => set({ yearTo: e.target.value })}
            />
          </label>
        </div>
      )
    case 'minScore':
    case 'minMeanScore':
    case 'minPopularity':
      return (
        <Input
          autoFocus
          className="max-w-[200px]"
          inputMode={filterKey === 'minPopularity' ? 'numeric' : 'decimal'}
          placeholder={filterKey === 'minPopularity' ? 'Ex.: 50000' : 'Ex.: 7,5'}
          value={draft[filterKey]}
          onChange={(e) => set({ [filterKey]: e.target.value })}
        />
      )
  }
}

/** Seleção múltipla em pílulas; a ordem do valor segue a das opções. `negative` marca em vermelho. */
function MultiPicker({
  options,
  value,
  onChange,
  negative,
}: {
  options: [string, string][]
  value: string[]
  onChange: (v: string[]) => void
  negative?: boolean
}) {
  const known = new Set(options.map(([k]) => k))
  const all = [...options, ...value.filter((v) => !known.has(v)).map((v): [string, string] => [v, v])]
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map(([k, label]) => {
        const on = value.includes(k)
        return (
          <button
            key={k}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() =>
              onChange(on ? value.filter((x) => x !== k) : all.map(([x]) => x).filter((x) => x === k || value.includes(x)))
            }
            className={cn(
              pill,
              !on && 'border-line hover:bg-raised',
              on && !negative && 'border-text bg-text font-semibold text-bg',
              on && negative && 'border-transparent bg-[var(--err-bg)] font-semibold text-[var(--err-fg)]',
            )}
          >
            {on && <Icon name={negative ? 'block' : 'check'} size={14} />}
            {label}
          </button>
        )
      })}
    </div>
  )
}

const MAX_SUGGESTIONS = 8

/**
 * Valores digitados: Enter ou vírgula adiciona, Backspace no campo vazio tira o último. Com
 * `suggestions`, mostra as que casam com o texto (as que começam com ele primeiro), corrige a caixa
 * do que bate com uma só delas (nomes que só diferem na caixa ficam como digitados) e marca o valor
 * que não está na lista. `taken` são valores que não devem ser sugeridos (os já escolhidos no campo
 * oposto).
 */
function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions,
  taken = [],
  unknownHint,
  autoFocus,
  negative,
}: {
  value: string[]
  onChange: (v: string[]) => void
  placeholder?: string
  suggestions?: string[]
  taken?: string[]
  unknownHint?: string
  autoFocus?: boolean
  negative?: boolean
}) {
  const [text, setText] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const listId = useId()
  const { known, lowered, canonical } = useMemo(() => {
    const lowered = (suggestions ?? []).map((s) => [s, s.toLowerCase()] as const)
    const canonical = new Map<string, string | null>()
    for (const [s, l] of lowered) canonical.set(l, canonical.has(l) ? null : s)
    return { known: new Set(suggestions), lowered, canonical }
  }, [suggestions])

  const q = text.trim().toLowerCase()
  const matches = useMemo(() => {
    if (!suggestions || !q) return []
    const free = lowered.filter(([s]) => !value.includes(s) && !taken.includes(s))
    const starts = free.filter(([, l]) => l.startsWith(q))
    const contains = free.filter(([, l]) => !l.startsWith(q) && l.includes(q))
    return [...starts, ...contains].slice(0, MAX_SUGGESTIONS).map(([s]) => s)
  }, [suggestions, lowered, q, value, taken])
  const showList = open && matches.length > 0
  const listRef = useRef<HTMLUListElement>(null)
  // O campo pode estar no fim da área rolável do diálogo; rola até as sugestões ficarem visíveis.
  useEffect(() => {
    if (showList) listRef.current?.scrollIntoView({ block: 'nearest' })
  }, [showList, matches.length])

  const add = (raw: string) => {
    const t = raw.trim()
    const v = canonical.get(t.toLowerCase()) ?? t
    if (v && !value.includes(v)) onChange([...value, v])
    setText('')
    setActive(0)
  }
  const unknown = (v: string) => !!suggestions && !known.has(v)

  return (
    <div className="relative">
      <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-rs border border-line bg-bg px-1.5 py-1 transition-colors focus-within:border-accent">
        {value.map((v) => (
          <span
            key={v}
            title={unknown(v) ? unknownHint : undefined}
            className={cn(
              'flex h-[26px] items-center gap-1 rounded-chip pl-2.5 pr-1 text-sm font-semibold',
              unknown(v)
                ? 'bg-[var(--warn-bg)] text-[var(--warn-fg)]'
                : negative
                  ? 'bg-[var(--err-bg)] text-[var(--err-fg)]'
                  : 'bg-raised',
            )}
          >
            {unknown(v) && <Icon name="help" size={14} className="-ml-1" />}
            {v}
            <button
              type="button"
              aria-label={`Remover ${v}`}
              onClick={() => onChange(value.filter((x) => x !== v))}
              className="flex h-5 w-5 items-center justify-center rounded-full opacity-70 hover:bg-hover hover:opacity-100"
            >
              <Icon name="close" size={14} />
            </button>
          </span>
        ))}
        <input
          value={text}
          role={suggestions ? 'combobox' : undefined}
          aria-expanded={suggestions ? showList : undefined}
          aria-controls={suggestions ? listId : undefined}
          aria-activedescendant={showList ? `${listId}-${active}` : undefined}
          aria-autocomplete={suggestions ? 'list' : undefined}
          onChange={(e) => {
            setText(e.target.value)
            setOpen(true)
            setActive(0)
          }}
          onKeyDown={(e) => {
            if (showList && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
              e.preventDefault()
              setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length)
            } else if (e.key === 'Enter' || e.key === ',') {
              e.preventDefault()
              add(showList ? matches[active] : text)
            } else if (e.key === 'Escape' && showList) {
              setOpen(false)
            } else if (e.key === 'Backspace' && !text && value.length) onChange(value.slice(0, -1))
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            setOpen(false)
            add(text)
          }}
          placeholder={value.length ? '' : placeholder}
          autoFocus={autoFocus}
          className="h-[26px] min-w-[96px] flex-1 border-0 bg-transparent px-1.5 text-13 text-text outline-none placeholder:text-muted"
        />
      </div>
      {showList && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-10 m-0 mt-1 list-none overflow-hidden rounded-rs border border-line bg-panel p-1 shadow-modal"
        >
          {matches.map((m, i) => (
            <li
              key={m}
              id={`${listId}-${i}`}
              role="option"
              aria-selected={i === active}
              // mousedown, não click: o click viria depois do blur do campo, que já teria adicionado o texto digitado.
              onMouseDown={(e) => {
                e.preventDefault()
                add(m)
              }}
              onMouseEnter={() => setActive(i)}
              className={cn('flex h-8 cursor-pointer items-center rounded-rxs px-2.5 text-13', i === active && 'bg-raised')}
            >
              {m}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
