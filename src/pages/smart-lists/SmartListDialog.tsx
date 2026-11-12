import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { toast } from 'sonner'
import { z } from 'zod'
import { createSmartList, updateSmartList } from '@/api/generated/endpoints/smart-list/smart-list'
import type { SmartListResponse, SmartListSortField, SortDirection } from '@/api/generated/model'
import { applyFieldErrors, toastError } from '@/api/errors'
import { isHttpError } from '@/api/http'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { Input } from '@/components/ui/input'
import { Segmented } from '@/components/ui/segmented'
import { Select } from '@/components/ui/select'
import {
  clearFilter,
  describeFilter,
  directionLabel,
  EMPTY_FILTERS,
  FILTERS,
  filterDef,
  fromCriteria,
  isActive,
  SORT_FIELDS,
  SORT_HINTS,
  toCriteria,
  type FilterKey,
  type FilterValues,
} from './criteria'
import { FilterEditor, FilterMenu, FilterPill } from './FilterEditor'

/** `position` é a do cadastro: a lista nova vai para o fim; a editada mantém a sua. */
export type SmartListDialogState = { mode: 'create'; position: number } | { mode: 'edit'; list: SmartListResponse } | null

type Values = { name: string; sortField: SmartListSortField; sortDirection: SortDirection }

const schema = z.object({
  name: z.string().trim().min(1, 'Dê um nome à lista'),
  sortField: z.string(),
  sortDirection: z.string(),
})

/** O que está aberto abaixo das pílulas: a escolha do tipo de filtro ou o editor de um filtro. */
type Panel = { mode: 'pick' } | { mode: 'edit'; key: FilterKey; isNew: boolean } | null

export function SmartListDialog({
  state,
  onClose,
  onSaved,
}: {
  state: SmartListDialogState
  onClose: () => void
  onSaved: (list: SmartListResponse) => void
}) {
  return (
    <Dialog open={state != null} onOpenChange={(o) => !o && onClose()}>
      {state && (
        <SmartListForm
          key={state.mode === 'edit' ? `e${state.list.id}` : 'new'}
          state={state}
          onClose={onClose}
          onSaved={onSaved}
        />
      )}
    </Dialog>
  )
}

function SmartListForm({
  state,
  onClose,
  onSaved,
}: {
  state: NonNullable<SmartListDialogState>
  onClose: () => void
  onSaved: (list: SmartListResponse) => void
}) {
  const editing = state.mode === 'edit' ? state.list : null
  const form = useForm<Values>({
    resolver: zodResolver(schema) as never,
    defaultValues: {
      name: editing?.name ?? '',
      sortField: editing?.sortField ?? 'SCORE',
      sortDirection: editing?.sortDirection ?? 'DESC',
    },
  })
  const errors = form.formState.errors
  const sortField = useWatch({ control: form.control, name: 'sortField' })
  const [filters, setFilters] = useState<FilterValues>(editing ? fromCriteria(editing.criteria) : EMPTY_FILTERS)
  const [panel, setPanel] = useState<Panel>(null)
  const [filterErrors, setFilterErrors] = useState<string[]>([])

  const criteria = toCriteria(filters)
  const active = FILTERS.filter((f) => isActive(f.key, filters))
  const allUsed = active.length === FILTERS.length

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await form.handleSubmit(async (values) => {
      setFilterErrors([])
      try {
        const body = {
          ...values,
          position: editing ? editing.position : state.mode === 'create' ? state.position : 0,
          criteria,
        }
        const saved = editing ? await updateSmartList(editing.id, body) : await createSmartList(body)
        await invalidate.smartLists()
        toast.success(editing ? 'Lista salva' : `Lista ${saved.name} criada`)
        onSaved(saved)
      } catch (err) {
        // Erros de `VALIDATION_ERROR`: `name` volta ao campo; `criteria.*` aparece com o nome do filtro.
        const nameApplied = applyFieldErrors(err, form.setError, (f) => (f === 'name' ? 'name' : undefined))
        const details = isHttpError(err) && err.body?.code === 'VALIDATION_ERROR' ? (err.body.details ?? []) : []
        const fromCriteriaField = details
          .filter((d) => d.field.startsWith('criteria.'))
          .map((d) => {
            const field = d.field.replace(/^criteria\./, '')
            const def = FILTERS.find((f) => (f.fields as string[]).includes(field))
            return `${def?.label ?? field}: ${d.error}`
          })
        setFilterErrors(fromCriteriaField)
        if (!nameApplied && !fromCriteriaField.length) toastError(err)
      }
    })()
  }

  const removeFilter = (key: FilterKey) => {
    setFilters((v) => clearFilter(key, v))
    if (panel?.mode === 'edit' && panel.key === key) setPanel(null)
  }

  return (
    <DialogContent
      width={620}
      // Esc fecha primeiro as sugestões de um campo, depois o painel de filtro aberto, e só então o diálogo.
      onEscapeKeyDown={(e) => {
        if (e.target instanceof HTMLElement && e.target.getAttribute('aria-expanded') === 'true') e.preventDefault()
        else if (panel) {
          e.preventDefault()
          setPanel(null)
        }
      }}
      title={editing ? `Editar ${editing.name}` : 'Nova lista'}
      description="A lista guarda filtros e uma ordem, não títulos: o backend recalcula os títulos a cada consulta."
    >
      <form onSubmit={onSubmit} className="flex min-h-0 flex-col" noValidate>
        <div className="flex flex-col gap-6 overflow-y-auto p-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-13 font-medium">Nome</span>
            <Input {...form.register('name')} placeholder="Ex.: Comédias recentes" aria-invalid={!!errors.name} autoFocus />
            {errors.name && <span className="text-sm text-danger">{errors.name.message}</span>}
          </label>

          <div className="flex flex-col gap-2.5">
            <span className="text-13 font-medium">Filtros</span>
            <div className="flex flex-wrap gap-1.5">
              {active.map((f) => (
                <FilterPill
                  key={f.key}
                  text={describeFilter(f.key, criteria) ?? f.label}
                  scope={f.scope}
                  negative={f.negative}
                  active={panel?.mode === 'edit' && panel.key === f.key}
                  onEdit={() => setPanel({ mode: 'edit', key: f.key, isNew: false })}
                  onRemove={() => removeFilter(f.key)}
                />
              ))}
              {!allUsed && !panel && (
                <button
                  type="button"
                  onClick={() => setPanel({ mode: 'pick' })}
                  className="flex h-8 items-center gap-1 rounded-chip border border-dashed border-line px-3 text-13 font-semibold text-accent-text transition-colors hover:border-accent hover:bg-tint"
                >
                  <Icon name="add" size={17} />
                  Adicionar filtro
                </button>
              )}
            </div>
            {active.length === 0 && !panel && (
              <span className="text-sm text-muted">Sem filtros, todas as franquias da coleção entram na lista.</span>
            )}
            {filterErrors.map((m) => (
              <span key={m} className="text-sm text-danger">
                {m}
              </span>
            ))}
            {panel?.mode === 'pick' && (
              <FilterMenu
                used={(key) => isActive(key, filters)}
                onPick={(key) => setPanel({ mode: 'edit', key, isNew: true })}
                onCancel={() => setPanel(null)}
              />
            )}
            {panel?.mode === 'edit' && (
              <FilterEditor
                key={panel.key}
                filterKey={panel.key}
                values={filters}
                isNew={panel.isNew}
                onApply={(draft) => {
                  setFilters((v) => {
                    const next = { ...v }
                    for (const f of filterDef(panel.key).fields) (next as Record<string, unknown>)[f] = draft[f]
                    return next
                  })
                  setFilterErrors([])
                  setPanel(null)
                }}
                onCancel={() => setPanel(null)}
              />
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-medium">Ordenar por</span>
              <Controller
                control={form.control}
                name="sortField"
                render={({ field }) => (
                  <Select
                    aria-label="Ordenar por"
                    value={field.value}
                    onChange={(v) => field.onChange(v as SmartListSortField)}
                    options={(Object.keys(SORT_FIELDS) as SmartListSortField[]).map((k) => ({
                      value: k,
                      label: SORT_FIELDS[k],
                      hint: SORT_HINTS[k],
                    }))}
                  />
                )}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-13 font-medium">Direção</span>
              <Controller
                control={form.control}
                name="sortDirection"
                render={({ field }) => (
                  <Segmented<SortDirection>
                    size="md"
                    className="self-start"
                    aria-label="Direção"
                    value={field.value}
                    onChange={field.onChange}
                    options={(['DESC', 'ASC'] as SortDirection[]).map((d) => ({ value: d, label: directionLabel(sortField, d) }))}
                  />
                )}
              />
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
          {panel && <span className="mr-auto text-sm text-muted">Conclua ou cancele o filtro aberto para salvar.</span>}
          <Button type="button" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="primary" disabled={!!panel} loading={form.formState.isSubmitting}>
            {editing ? 'Salvar' : 'Criar lista'}
          </Button>
        </div>
      </form>
    </DialogContent>
  )
}
