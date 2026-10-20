import { useListSettings } from '@/api/generated/endpoints/setting/setting'

/** Lê uma preferência pela chave (lista todas e filtra; a lista é pequena e fica em cache). */
export function useSetting(key: string) {
  const q = useListSettings(undefined, { query: { staleTime: 60_000 } })
  return { ...q, setting: q.data?.find((s) => s.key === key) }
}
