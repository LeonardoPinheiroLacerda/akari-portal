import { zodResolver } from '@hookform/resolvers/zod'
import { useMemo, useState } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { z } from 'zod'
import { createStorageProvider, updateStorageProviderConfig } from '@/api/generated/endpoints/storage-provider/storage-provider'
import type { StorageProviderType } from '@/api/generated/model'
import { applyFieldErrors, toastError } from '@/api/errors'
import { invalidate } from '@/api/query'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Icon } from '@/components/ui/icon'
import { SearchInput } from '@/components/ui/input'
import { testProvider } from '@/features/providers/health'
import {
  CATEGORY_LABEL,
  PROVIDER_TYPES,
  providerTypeDef,
  type ProviderCategory,
  type ProviderField,
  type ProviderTypeDef,
} from '@/features/providers/types'
import { cn } from '@/lib/utils'

export type ProviderDialogState = { mode: 'create' } | { mode: 'edit'; id: number; type: StorageProviderType } | null

type Step = 'type' | 'form' | 'result'

function schemaFor(def: ProviderTypeDef) {
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const f of def.fields) {
    let s = z.string().trim()
    if (f.required) s = s.min(1, `${f.label} é obrigatório`)
    if (f.kind === 'email') shape[f.key] = s.email('Informe um e-mail válido')
    else if (f.kind === 'path') shape[f.key] = s.refine((v) => v.startsWith('/'), 'Use um caminho absoluto, começando com /')
    else shape[f.key] = s
  }
  return z.object(shape)
}

export function ProviderDialog({ state, onClose }: { state: ProviderDialogState; onClose: () => void }) {
  return (
    <Dialog open={state != null} onOpenChange={(o) => !o && onClose()}>
      {state && <ProviderDialogBody key={state.mode === 'edit' ? `e${state.id}` : 'new'} state={state} onClose={onClose} />}
    </Dialog>
  )
}

function ProviderDialogBody({ state, onClose }: { state: NonNullable<ProviderDialogState>; onClose: () => void }) {
  const editing = state.mode === 'edit'
  const [step, setStep] = useState<Step>(editing ? 'form' : 'type')
  const [type, setType] = useState<StorageProviderType | null>(editing ? state.type : null)
  const [result, setResult] = useState<{ healthy: boolean } | null>(null)
  const [savedId, setSavedId] = useState<number | null>(editing ? state.id : null)
  const def = type ? providerTypeDef(type) : null

  const title = editing
    ? `Editar ${providerTypeDef(state.type).label} #${state.id}`
    : step === 'type'
      ? 'Novo provedor'
      : step === 'form'
        ? `Configurar ${def?.label}`
        : (def?.label ?? '')
  const stepLabel = step === 'type' ? 'Passo 1 de 2 · Tipo' : step === 'form' ? 'Passo 2 de 2 · Configuração' : 'Resultado'

  return (
    <DialogContent
      width={560}
      title={
        <span className="flex flex-col gap-1">
          <span className="font-mono text-xs font-normal uppercase tracking-[.06em] text-muted">{stepLabel}</span>
          {title}
        </span>
      }
    >
      {step === 'type' && (
        <TypeStep
          onPick={(t) => {
            setType(t)
            setStep('form')
          }}
          onCancel={onClose}
        />
      )}
      {step === 'form' && def && (
        <FormStep
          def={def}
          editingId={editing ? state.id : savedId}
          canChangeType={!editing && savedId == null}
          onBack={() => setStep('type')}
          onCancel={onClose}
          onSaved={(id, healthy) => {
            setSavedId(id)
            setResult({ healthy })
            setStep('result')
          }}
        />
      )}
      {step === 'result' && def && result && (
        <>
          <div className="flex flex-col items-center gap-3 px-5 py-7 text-center">
            <span
              className="flex h-14 w-14 items-center justify-center rounded-full"
              style={{
                background: `var(--${result.healthy ? 'ok' : 'err'}-bg)`,
                color: `var(--${result.healthy ? 'ok' : 'err'}-fg)`,
              }}
            >
              <Icon name={result.healthy ? 'check' : 'error'} size={30} />
            </span>
            <span className="text-base font-semibold" style={{ fontSize: 16 }}>
              {result.healthy
                ? editing
                  ? 'Configuração salva e conectada'
                  : 'Provedor cadastrado e conectado'
                : editing
                  ? 'Salvo, mas sem conexão'
                  : 'Cadastrado, mas sem conexão'}
            </span>
            <span className="max-w-[420px] text-13 leading-normal text-muted">
              {result.healthy
                ? def.type === 'MEGA'
                  ? 'A conta MEGA respondeu. Você já pode usar este provedor na Ingestão.'
                  : 'O diretório foi encontrado no servidor. Você já pode usar este provedor na Ingestão.'
                : def.type === 'MEGA'
                  ? 'O MEGA não aceitou as credenciais ou está fora do ar. Revise o e-mail e a senha.'
                  : 'O caminho informado não é um diretório acessível no servidor. Revise o caminho.'}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
            {result.healthy ? (
              <Button variant="primary" onClick={onClose}>
                Concluir
              </Button>
            ) : (
              <>
                <Button onClick={onClose}>Fechar</Button>
                <Button variant="primary" onClick={() => setStep('form')}>
                  Editar configuração
                </Button>
              </>
            )}
          </div>
        </>
      )}
    </DialogContent>
  )
}

function TypeStep({ onPick, onCancel }: { onPick: (t: StorageProviderType) => void; onCancel: () => void }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<ProviderCategory | ''>('')
  const match = (t: ProviderTypeDef) =>
    (!q || `${t.label} ${t.description}`.toLowerCase().includes(q.toLowerCase())) && (!cat || t.category === cat)
  const cats = Object.entries(CATEGORY_LABEL) as [ProviderCategory, string][]
  const groups = cats
    .map(([k, label]) => ({ k, label, items: PROVIDER_TYPES.filter((t) => t.category === k && match(t)) }))
    .filter((g) => g.items.length)

  return (
    <>
      <div className="flex flex-col gap-3 overflow-y-auto px-5 pb-5 pt-4">
        <SearchInput
          height={40}
          placeholder="Buscar tipo de provedor"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <div className="flex flex-wrap gap-1.5">
          {([['', 'Todos'], ...cats] as [ProviderCategory | '', string][]).map(([k, label]) => {
            const on = cat === k
            return (
              <button
                key={k || 'all'}
                type="button"
                onClick={() => setCat(k)}
                className={cn(
                  'flex h-7 items-center gap-1.5 rounded-chip border px-2.5 text-sm',
                  on ? 'border-text bg-text text-bg' : 'border-line hover:bg-raised',
                )}
              >
                {label}
                <span className="font-mono text-2xs opacity-70">
                  {PROVIDER_TYPES.filter((t) => !k || t.category === k).length}
                </span>
              </button>
            )
          })}
        </div>
        <div className="flex max-h-[340px] flex-col overflow-y-auto rounded-rs border border-line">
          {groups.map((g) => (
            <div key={g.k}>
              <div className="sticky top-0 bg-raised px-3 py-2 text-xs uppercase tracking-[.06em] text-muted">{g.label}</div>
              {g.items.map((t) => (
                <button
                  key={t.type}
                  type="button"
                  onClick={() => onPick(t.type)}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-hover"
                >
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-rs bg-raised text-accent">
                    <Icon name={t.icon} size={18} />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-px">
                    <span className="text-base font-semibold">{t.label}</span>
                    <span className="truncate text-sm text-muted">{t.description}</span>
                  </span>
                  <Icon name="chevron_right" size={20} className="text-muted" />
                </button>
              ))}
            </div>
          ))}
          {groups.length === 0 && <div className="px-3 py-[18px] text-13 text-muted">Nenhum tipo encontrado.</div>}
        </div>
        <span className="text-sm text-muted">O tipo não pode ser alterado depois de cadastrado.</span>
      </div>
      <div className="flex items-center justify-end gap-2 border-t border-line px-5 py-3.5">
        <Button onClick={onCancel}>Cancelar</Button>
      </div>
    </>
  )
}

function FormStep({
  def,
  editingId,
  canChangeType,
  onBack,
  onCancel,
  onSaved,
}: {
  def: ProviderTypeDef
  editingId: number | null
  canChangeType: boolean
  onBack: () => void
  onCancel: () => void
  onSaved: (id: number, healthy: boolean) => void
}) {
  const schema = useMemo(() => schemaFor(def), [def])
  const form = useForm<Record<string, string>>({
    resolver: zodResolver(schema) as unknown as Resolver<Record<string, string>>,
    defaultValues: Object.fromEntries(def.fields.map((f) => [f.key, ''])),
  })
  const [showPw, setShowPw] = useState(false)
  const keys = new Set(def.fields.map((f) => f.key))

  // Erros por campo vêm de `details` do VALIDATION_ERROR (`config.email` → `email`).
  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    await form.handleSubmit(async (values) => {
      try {
        let id = editingId
        if (id != null) await updateStorageProviderConfig(id, { config: values })
        else id = (await createStorageProvider({ type: def.type, config: values })).id
        await invalidate.providers()
        const healthy = await testProvider(id)
        onSaved(id, healthy)
      } catch (err) {
        const applied = applyFieldErrors(err, form.setError, (f) => {
          const k = f.replace(/^config\./, '')
          return keys.has(k) ? k : undefined
        })
        if (!applied) toastError(err)
      }
    })()
  }
  const fieldInput = (f: ProviderField) => {
    const err = form.formState.errors[f.key]?.message
    const isPw = f.kind === 'password'
    return (
      <label key={f.key} className="flex flex-col gap-1.5">
        <span className="text-13 font-medium">{f.label}</span>
        <div
          className={cn(
            'flex h-10 items-center overflow-hidden rounded-rs border bg-bg focus-within:border-accent',
            err ? 'border-danger' : 'border-line',
          )}
        >
          <input
            {...form.register(f.key)}
            type={isPw ? (showPw ? 'text' : 'password') : f.kind === 'email' ? 'email' : 'text'}
            placeholder={f.placeholder}
            autoComplete={isPw ? 'new-password' : 'off'}
            aria-invalid={!!err}
            className={cn(
              'h-full min-w-0 flex-1 border-0 bg-transparent px-3 text-base text-text outline-none placeholder:text-muted',
              f.kind === 'path' && 'font-mono text-13',
            )}
          />
          {isPw && (
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              aria-label={showPw ? 'Ocultar senha' : 'Mostrar senha'}
              className="flex h-full w-10 items-center justify-center border-l border-line text-muted hover:text-text"
            >
              <Icon name={showPw ? 'visibility_off' : 'visibility'} size={18} />
            </button>
          )}
        </div>
        {err && <span className="text-sm text-danger">{err}</span>}
        {f.hint && <span className="text-sm leading-[1.4] text-muted">{f.hint}</span>}
      </label>
    )
  }

  return (
    <form onSubmit={onSubmit} className="flex min-h-0 flex-col" noValidate>
      <div className="flex flex-col gap-[18px] overflow-y-auto p-5">
        <div className="flex items-center gap-2.5 rounded-rs bg-code px-3 py-2.5">
          <Icon name={def.icon} size={20} className="text-accent" />
          <span className="flex-1 text-13">
            {def.label} · {def.fieldsSummary.toLowerCase()}
          </span>
          {canChangeType && (
            <button type="button" onClick={onBack} className="text-sm font-semibold text-accent-text hover:underline">
              Trocar tipo
            </button>
          )}
        </div>
        {editingId != null && (
          <span className="text-13 leading-[1.45] text-muted">
            Por segurança, a configuração atual não é exibida. Informe todos os valores novamente; o tipo não pode ser alterado.
          </span>
        )}
        {def.fields.map(fieldInput)}
      </div>
      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-line px-5 py-3.5">
        {canChangeType ? (
          <Button type="button" onClick={onBack}>
            Voltar
          </Button>
        ) : (
          <Button type="button" onClick={onCancel}>
            Cancelar
          </Button>
        )}
        <Button type="submit" variant="primary" loading={form.formState.isSubmitting}>
          {editingId != null ? 'Salvar e testar' : 'Cadastrar e testar'}
        </Button>
      </div>
    </form>
  )
}
