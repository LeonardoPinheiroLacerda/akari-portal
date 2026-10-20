import { useSyncExternalStore } from 'react'
import { checkStorageProviderHealth } from '@/api/generated/endpoints/storage-provider/storage-provider'
import { errorMessage } from '@/api/errors'

export type HealthState =
  { state: 'testing'; at?: string } | { state: 'ok'; at: string } | { state: 'fail'; at: string; reason?: string }

/*
 * O backend não guarda o resultado do teste de conexão; o último resultado de cada
 * provedor fica neste navegador (conveniência local, não é estado compartilhado).
 */
const KEY = 'akari.providerHealth'
type Store = Record<number, HealthState>

let store: Store = load()
const listeners = new Set<() => void>()

function load(): Store {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? '{}') as Store
    // "Testando" de uma sessão anterior não faz sentido ao recarregar.
    for (const k of Object.keys(raw)) if (raw[+k]?.state === 'testing') delete raw[+k]
    return raw
  } catch {
    return {}
  }
}

function set(id: number, value: HealthState | null) {
  store = { ...store }
  if (value) store[id] = value
  else delete store[id]
  try {
    localStorage.setItem(KEY, JSON.stringify(store))
  } catch {
    /* armazenamento indisponível */
  }
  listeners.forEach((l) => l())
}

const subscribe = (l: () => void) => {
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useProviderHealth(): Store {
  return useSyncExternalStore(subscribe, () => store)
}

export function forgetProviderHealth(id: number) {
  set(id, null)
}

/** Roda o teste de conexão e guarda o resultado. */
export async function testProvider(id: number): Promise<boolean> {
  const prev = store[id]
  set(id, { state: 'testing', at: prev?.at })
  try {
    const res = await checkStorageProviderHealth(id)
    set(id, res.healthy ? { state: 'ok', at: new Date().toISOString() } : { state: 'fail', at: new Date().toISOString() })
    return res.healthy
  } catch (e) {
    set(id, { state: 'fail', at: new Date().toISOString(), reason: errorMessage(e) })
    return false
  }
}

export const healthChip = (h?: HealthState) => {
  if (!h) return { label: 'Não testado', tone: 'neutral' as const, icon: 'help' }
  if (h.state === 'testing') return { label: 'Testando…', tone: 'info' as const, icon: 'progress_activity' }
  if (h.state === 'ok') return { label: 'Conectado', tone: 'ok' as const, icon: 'check_circle' }
  return { label: 'Sem conexão', tone: 'err' as const, icon: 'error' }
}
