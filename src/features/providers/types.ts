import type { StorageProviderResponse, StorageProviderType } from '@/api/generated/model'

export type ProviderCategory = 'cloud' | 'local'

export type ProviderField = {
  /** Chave no mapa `config` enviado ao backend. */
  key: string
  label: string
  kind: 'text' | 'email' | 'password' | 'path'
  placeholder?: string
  hint?: string
  required: boolean
}

export type ProviderTypeDef = {
  type: StorageProviderType
  label: string
  icon: string
  category: ProviderCategory
  description: string
  /** Rótulo curto no card ("MEGA · nuvem"). */
  kind: string
  /** Comportamento exibido no card. */
  behavior: string
  behaviorIcon: string
  /** Resumo dos campos no formulário ("Pede e-mail e senha"). */
  fieldsSummary: string
  fields: ProviderField[]
}

/*
 * Catálogo de tipos dirigido por dados. A API ainda não expõe esse catálogo
 * (limitação nº 3 do handoff); quando expuser, esta lista passa a vir de lá.
 */
export const PROVIDER_TYPES: ProviderTypeDef[] = [
  {
    type: 'MEGA',
    label: 'MEGA',
    icon: 'cloud',
    category: 'cloud',
    description: 'Nuvem · arquivos passam pelo cache antes de tocar',
    kind: 'MEGA · nuvem',
    behavior: 'Arquivos passam pelo cache antes de tocar',
    behaviorIcon: 'download',
    fieldsSummary: 'Pede e-mail e senha',
    fields: [
      {
        key: 'email',
        label: 'E-mail da conta MEGA',
        kind: 'email',
        placeholder: 'voce@exemplo.com',
        hint: 'A conta precisa ter acesso às pastas de vídeo.',
        required: true,
      },
      {
        key: 'password',
        label: 'Senha',
        kind: 'password',
        required: true,
        placeholder: '••••••••',
        hint: 'A senha é protegida antes de ser salva e nunca é exibida de novo.',
      },
    ],
  },
  {
    type: 'LOCAL',
    label: 'Disco local',
    icon: 'hard_drive',
    category: 'local',
    description: 'Diretório no servidor · arquivos lidos direto, sem cache',
    kind: 'Disco local',
    behavior: 'Arquivos lidos direto do disco, sem cache',
    behaviorIcon: 'bolt',
    fieldsSummary: 'Pede o diretório raiz',
    fields: [
      {
        key: 'rootPath',
        label: 'Diretório raiz no servidor',
        kind: 'path',
        placeholder: '/mnt/media/anime',
        hint: 'Caminho absoluto no disco do servidor. Arquivos locais são lidos direto, sem passar pelo cache.',
        required: true,
      },
    ],
  },
]

export const CATEGORY_LABEL: Record<ProviderCategory, string> = {
  cloud: 'Nuvem',
  local: 'Local e rede',
}

export const providerTypeDef = (type: StorageProviderType) =>
  PROVIDER_TYPES.find((t) => t.type === type) ?? {
    type,
    label: type,
    icon: 'storage',
    category: 'cloud' as const,
    description: '',
    kind: type,
    behavior: '',
    behaviorIcon: 'info',
    fieldsSummary: '',
    fields: [],
  }

/** A API não tem nome de provedor: deriva do tipo + id ("MEGA #1", "Disco local #3"). */
export const providerName = (p: Pick<StorageProviderResponse, 'id' | 'type'>) => `${providerTypeDef(p.type).label} #${p.id}`

/** Provedores remotos usam o cache de vídeo; LOCAL não. */
export const usesCache = (type?: StorageProviderType) => type !== 'LOCAL'
