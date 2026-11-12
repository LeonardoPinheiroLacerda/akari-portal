import type { SmartListCriteria, SmartListResponse, SmartListSortField, SortDirection } from '@/api/generated/model'

/** Rótulo em português dos gêneros de `ANILIST_GENRES`; um gênero sem rótulo aparece com o nome da AniList. */
export const GENRE_LABEL: Record<string, string> = {
  Action: 'Ação',
  Adventure: 'Aventura',
  Comedy: 'Comédia',
  Drama: 'Drama',
  Ecchi: 'Ecchi',
  Fantasy: 'Fantasia',
  Hentai: 'Hentai',
  Horror: 'Terror',
  'Mahou Shoujo': 'Garota mágica',
  Mecha: 'Mecha',
  Music: 'Música',
  Mystery: 'Mistério',
  Psychological: 'Psicológico',
  Romance: 'Romance',
  'Sci-Fi': 'Ficção científica',
  'Slice of Life': 'Cotidiano',
  Sports: 'Esportes',
  Supernatural: 'Sobrenatural',
  Thriller: 'Suspense',
}

export const genreLabel = (g: string) => GENRE_LABEL[g] ?? g

/** Status da obra na AniList (`Media.status`). */
export const STATUSES: [string, string][] = [
  ['RELEASING', 'Em exibição'],
  ['FINISHED', 'Finalizado'],
  ['NOT_YET_RELEASED', 'Não lançado'],
  ['HIATUS', 'Em hiato'],
  ['CANCELLED', 'Cancelado'],
]

/** Formatos da AniList (`AnilistFormat`), sem o `UNKNOWN`, que não serve de filtro. */
export const FORMATS: [string, string][] = [
  ['TV', 'Série de TV'],
  ['TV_SHORT', 'TV curta'],
  ['MOVIE', 'Filme'],
  ['SPECIAL', 'Especial'],
  ['OVA', 'OVA'],
  ['ONA', 'ONA'],
  ['MUSIC', 'Clipe musical'],
]

export const SORT_FIELDS: Record<SmartListSortField, string> = {
  SCORE: 'Nota',
  MEAN_SCORE: 'Nota média',
  POPULARITY: 'Popularidade',
  YEAR: 'Ano',
  TITLE: 'Título',
}

export const SORT_HINTS: Record<SmartListSortField, string> = {
  SCORE: 'Média ponderada da AniList',
  MEAN_SCORE: 'Média simples da AniList',
  POPULARITY: 'Quantos usuários da AniList têm a obra na lista',
  YEAR: 'Ano da temporada de lançamento',
  TITLE: 'Título exibido, com o título personalizado quando houver',
}

/** Rótulo da direção conforme o campo: "A → Z" para título, "Mais recentes" para ano, etc. */
export function directionLabel(field: SmartListSortField, dir: SortDirection) {
  if (field === 'TITLE') return dir === 'ASC' ? 'A → Z' : 'Z → A'
  if (field === 'YEAR') return dir === 'ASC' ? 'Mais antigos' : 'Mais recentes'
  return dir === 'ASC' ? 'Menor primeiro' : 'Maior primeiro'
}

export function sortLabel(l: Pick<SmartListResponse, 'sortField' | 'sortDirection'>) {
  const dir = directionLabel(l.sortField, l.sortDirection)
  return `${SORT_FIELDS[l.sortField]} · ${l.sortField === 'TITLE' ? dir : dir.toLowerCase()}`
}

/*
 * Filtros da lista. Cada filtro do formulário cobre um ou dois campos de `SmartListCriteria`, e o
 * escopo segue a regra do backend: os de franquia trazem a raiz se algum membro casar todos ao mesmo
 * tempo; os de raiz valem só para a obra de início.
 */

export type Adult = 'ALL' | 'ONLY' | 'NONE'

/** O filtro como o formulário o edita: listas e textos (números digitados, com vírgula decimal). */
export type FilterValues = {
  includeGenres: string[]
  excludeGenres: string[]
  includeTags: string[]
  excludeTags: string[]
  studios: string[]
  statuses: string[]
  adult: Adult
  formats: string[]
  yearFrom: string
  yearTo: string
  minScore: string
  minMeanScore: string
  minPopularity: string
}

export type FilterKey =
  | 'includeGenres'
  | 'excludeGenres'
  | 'includeTags'
  | 'excludeTags'
  | 'studios'
  | 'statuses'
  | 'adult'
  | 'formats'
  | 'year'
  | 'minScore'
  | 'minMeanScore'
  | 'minPopularity'

export type FilterScope = 'franchise' | 'root'

export const SCOPES: Record<FilterScope, { icon: string; label: string; hint: string }> = {
  franchise: {
    icon: 'account_tree',
    label: 'Em qualquer obra da franquia',
    hint: 'A franquia entra se alguma obra dela, incluindo a de início, atender a todos estes filtros ao mesmo tempo.',
  },
  root: { icon: 'flag', label: 'Na obra de início', hint: 'Valem só para a obra de início da franquia.' },
}

/**
 * Os filtros na ordem do menu e das pílulas. `fields` são os campos de `FilterValues` que cada um
 * edita; `negative` marca os que excluem (aparecem em vermelho).
 */
export const FILTERS: {
  key: FilterKey
  label: string
  hint: string
  scope: FilterScope
  fields: (keyof FilterValues)[]
  negative?: boolean
}[] = [
  {
    key: 'includeGenres',
    label: 'Gênero',
    hint: 'A obra precisa ter todos os gêneros marcados.',
    scope: 'franchise',
    fields: ['includeGenres'],
  },
  {
    key: 'excludeGenres',
    label: 'Sem gênero',
    hint: 'A obra não pode ter nenhum dos gêneros marcados.',
    scope: 'franchise',
    fields: ['excludeGenres'],
    negative: true,
  },
  { key: 'includeTags', label: 'Tag', hint: 'A obra precisa ter todas as tags.', scope: 'franchise', fields: ['includeTags'] },
  {
    key: 'excludeTags',
    label: 'Sem tag',
    hint: 'A obra não pode ter nenhuma das tags.',
    scope: 'franchise',
    fields: ['excludeTags'],
    negative: true,
  },
  {
    key: 'studios',
    label: 'Estúdio',
    hint: 'O estúdio principal da obra precisa ser um destes.',
    scope: 'franchise',
    fields: ['studios'],
  },
  {
    key: 'statuses',
    label: 'Status',
    hint: 'A obra precisa estar em um destes status.',
    scope: 'franchise',
    fields: ['statuses'],
  },
  {
    key: 'adult',
    label: 'Conteúdo adulto',
    hint: 'Se a obra precisa ser adulta ou não adulta.',
    scope: 'franchise',
    fields: ['adult'],
  },
  {
    key: 'formats',
    label: 'Formato',
    hint: 'Precisa ter um destes formatos.',
    scope: 'root',
    fields: ['formats'],
  },
  {
    key: 'year',
    label: 'Ano de lançamento',
    hint: 'Ano da temporada de lançamento. Preencha um ou os dois.',
    scope: 'root',
    fields: ['yearFrom', 'yearTo'],
  },
  {
    key: 'minScore',
    label: 'Nota mínima',
    hint: 'Média ponderada da AniList, de 0 a 10.',
    scope: 'root',
    fields: ['minScore'],
  },
  {
    key: 'minMeanScore',
    label: 'Nota média mínima',
    hint: 'Média simples da AniList, de 0 a 10.',
    scope: 'root',
    fields: ['minMeanScore'],
  },
  {
    key: 'minPopularity',
    label: 'Popularidade mínima',
    hint: 'Quantos usuários da AniList têm a obra na lista.',
    scope: 'root',
    fields: ['minPopularity'],
  },
]

export const filterDef = (key: FilterKey) => FILTERS.find((f) => f.key === key)!

/** Aceita vírgula decimal ("7,5"). */
const toNumber = (v: string) => Number(v.trim().replace(',', '.'))
const isInt = (v: string) => /^\d+$/.test(v.trim())
const isScore = (v: string) => /^\d+([.,]\d+)?$/.test(v.trim()) && toNumber(v) <= 10

/** Campo de um filtro preenchido. */
export function isActive(key: FilterKey, v: FilterValues) {
  if (key === 'adult') return v.adult !== 'ALL'
  return filterDef(key).fields.some((f) => {
    const x = v[f]
    return Array.isArray(x) ? x.length > 0 : x.trim() !== ''
  })
}

/** Mensagem do primeiro problema do filtro, ou `null` se ele pode ser aplicado. */
export function validateFilter(key: FilterKey, v: FilterValues): string | null {
  if (key === 'year') {
    if (v.yearFrom.trim() && !isInt(v.yearFrom)) return 'Informe o ano inicial, como 2010.'
    if (v.yearTo.trim() && !isInt(v.yearTo)) return 'Informe o ano final, como 2020.'
    if (v.yearFrom.trim() && v.yearTo.trim() && Number(v.yearFrom) > Number(v.yearTo)) return 'O ano final vem antes do inicial.'
  }
  if ((key === 'minScore' || key === 'minMeanScore') && !isScore(v[key])) return 'Use uma nota de 0 a 10, como 7,5.'
  if (key === 'minPopularity' && !isInt(v.minPopularity)) return 'Use um número inteiro, como 50000.'
  return null
}

export const EMPTY_FILTERS: FilterValues = {
  includeGenres: [],
  excludeGenres: [],
  includeTags: [],
  excludeTags: [],
  studios: [],
  statuses: [],
  adult: 'ALL',
  formats: [],
  yearFrom: '',
  yearTo: '',
  minScore: '',
  minMeanScore: '',
  minPopularity: '',
}

/** Tira os campos de um filtro (volta ao vazio). */
export function clearFilter(key: FilterKey, v: FilterValues): FilterValues {
  const next = { ...v }
  for (const f of filterDef(key).fields) (next as Record<string, unknown>)[f] = EMPTY_FILTERS[f]
  return next
}

export function fromCriteria(c: SmartListCriteria): FilterValues {
  const str = (n?: number | null) => (n == null ? '' : String(n).replace('.', ','))
  return {
    includeGenres: c.includeGenres ?? [],
    excludeGenres: c.excludeGenres ?? [],
    includeTags: c.includeTags ?? [],
    excludeTags: c.excludeTags ?? [],
    studios: c.studios ?? [],
    statuses: c.statuses ?? [],
    adult: c.adult === true ? 'ONLY' : c.adult === false ? 'NONE' : 'ALL',
    formats: c.formats ?? [],
    yearFrom: str(c.yearFrom),
    yearTo: str(c.yearTo),
    minScore: str(c.minScore),
    minMeanScore: str(c.minMeanScore),
    minPopularity: str(c.minPopularity),
  }
}

/** Campo vazio sai do filtro: o portal não envia a chave, e o backend trata ausente como "não filtra". */
export function toCriteria(v: FilterValues): SmartListCriteria {
  const list = (a: string[]) => (a.length ? a : undefined)
  const num = (s: string) => (s.trim() === '' ? undefined : toNumber(s))
  return {
    includeGenres: list(v.includeGenres),
    excludeGenres: list(v.excludeGenres),
    includeTags: list(v.includeTags),
    excludeTags: list(v.excludeTags),
    studios: list(v.studios),
    statuses: list(v.statuses),
    formats: list(v.formats),
    yearFrom: num(v.yearFrom),
    yearTo: num(v.yearTo),
    minScore: num(v.minScore),
    minMeanScore: num(v.minMeanScore),
    minPopularity: num(v.minPopularity),
    adult: v.adult === 'ALL' ? undefined : v.adult === 'ONLY',
  }
}

const labelOf = (table: [string, string][], v: string) => table.find(([k]) => k === v)?.[1] ?? v

/** "Ação", "Ação e Comédia", "Ação, Comédia e Drama" (ou com "ou" no lugar do "e"). */
function joinList(values: string[], word: 'e' | 'ou') {
  if (values.length <= 1) return values.join('')
  return `${values.slice(0, -1).join(', ')} ${word} ${values[values.length - 1]}`
}

const has = (v?: string[] | null): v is string[] => !!v && v.length > 0
const num = (n: number) => n.toLocaleString('pt-BR')
const plural = (values: string[], one: string, many: string) => (values.length === 1 ? one : many)

/** O filtro em uma frase (pílula do formulário e linha do detalhe), ou `null` se não está em uso. */
export function describeFilter(key: FilterKey, c: SmartListCriteria): string | null {
  switch (key) {
    case 'includeGenres':
      return has(c.includeGenres)
        ? `${plural(c.includeGenres, 'Gênero', 'Gêneros')}: ${joinList(c.includeGenres.map(genreLabel), 'e')}`
        : null
    case 'excludeGenres':
      return has(c.excludeGenres)
        ? `Sem ${plural(c.excludeGenres, 'o gênero', 'os gêneros')} ${joinList(c.excludeGenres.map(genreLabel), 'e')}`
        : null
    case 'includeTags':
      return has(c.includeTags) ? `${plural(c.includeTags, 'Tag', 'Tags')}: ${joinList(c.includeTags, 'e')}` : null
    case 'excludeTags':
      return has(c.excludeTags) ? `Sem ${plural(c.excludeTags, 'a tag', 'as tags')} ${joinList(c.excludeTags, 'e')}` : null
    case 'studios':
      return has(c.studios) ? `Estúdio: ${joinList(c.studios, 'ou')}` : null
    case 'statuses':
      return has(c.statuses)
        ? `Status: ${joinList(
            c.statuses.map((s) => labelOf(STATUSES, s)),
            'ou',
          ).toLowerCase()}`
        : null
    case 'adult':
      return c.adult == null ? null : c.adult ? 'Conteúdo adulto' : 'Conteúdo não adulto'
    case 'formats':
      return has(c.formats)
        ? `Formato: ${joinList(
            c.formats.map((f) => labelOf(FORMATS, f)),
            'ou',
          )}`
        : null
    case 'year':
      if (c.yearFrom != null && c.yearTo != null)
        return c.yearFrom === c.yearTo ? `Lançada em ${c.yearFrom}` : `Lançada entre ${c.yearFrom} e ${c.yearTo}`
      if (c.yearFrom != null) return `Lançada a partir de ${c.yearFrom}`
      if (c.yearTo != null) return `Lançada até ${c.yearTo}`
      return null
    case 'minScore':
      return c.minScore != null ? `Nota a partir de ${num(c.minScore)}` : null
    case 'minMeanScore':
      return c.minMeanScore != null ? `Nota média a partir de ${num(c.minMeanScore)}` : null
    case 'minPopularity':
      return c.minPopularity != null ? `Popularidade a partir de ${num(c.minPopularity)}` : null
  }
}

export type CriteriaLine = { text: string; negative: boolean }

/** O filtro em frases, nos dois grupos da regra do backend. */
export function describeCriteria(c: SmartListCriteria) {
  const lines = (scope: FilterScope) =>
    FILTERS.filter((f) => f.scope === scope).flatMap((f): CriteriaLine[] => {
      const text = describeFilter(f.key, c)
      return text ? [{ text, negative: !!f.negative }] : []
    })
  return { franchise: lines('franchise'), root: lines('root') }
}
