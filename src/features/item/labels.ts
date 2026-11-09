import type { AnimeReviewStatus, FranchiseAssignment, MediaType } from '@/api/generated/model'
import type { Tone } from '@/components/ui/chip'

/** Tipo da pasta como aparece na interface. */
export const MEDIA_TYPE_LABEL: Record<MediaType, string> = { ANIME: 'Anime', TV: 'Série', MOVIE: 'Filme' }

export const REVIEW: Record<AnimeReviewStatus, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: 'Aguardando revisão', tone: 'info' },
  PARTIAL: { label: 'Parcial', tone: 'warn' },
  REVIEWED: { label: 'Revisado', tone: 'ok' },
}

export const reviewInfo = (s?: AnimeReviewStatus | null) => (s ? REVIEW[s] : { label: 'Processando', tone: 'neutral' as Tone })

/** Atribuição de franquia de um anime: como ele entra (ou não) numa franquia. */
export const ASSIGNMENT: Record<FranchiseAssignment, { label: string; hint: string; tone: Tone }> = {
  AUTO: {
    label: 'Automática',
    hint: 'Fica na franquia do pai automático (a obra anterior, a principal ou a de que deriva, pelas relações da AniList).',
    tone: 'neutral',
  },
  MANUAL_MEMBER: { label: 'Manual', hint: 'Posta à mão nesta franquia.', tone: 'info' },
  MANUAL_ROOT: { label: 'Manual', hint: 'Início de uma franquia criada à mão.', tone: 'info' },
  HIDDEN: { label: 'Oculta', hint: 'Fora de qualquer franquia: os clientes não a listam.', tone: 'warn' },
}

export const RELATION_LABEL: Record<string, string> = {
  SEQUEL: 'Continuação',
  PREQUEL: 'Anterior',
  SOURCE: 'Obra original',
  SIDE_STORY: 'História paralela',
  SPIN_OFF: 'Spin-off',
  ALTERNATIVE: 'Versão alternativa',
  PARENT: 'Obra principal',
  SUMMARY: 'Resumo',
  COMPILATION: 'Compilação',
  CHARACTER: 'Mesmos personagens',
  ADAPTATION: 'Adaptação',
  CONTAINS: 'Contém',
  OTHER: 'Outra relação',
}

export const relationLabel = (r?: string | null) => (r ? (RELATION_LABEL[r] ?? r) : 'Relação')

export const SEASON_LABEL: Record<string, string> = {
  WINTER: 'Inverno',
  SPRING: 'Primavera',
  SUMMER: 'Verão',
  FALL: 'Outono',
}

export const TMDB_LOCALES: [string, string][] = [
  ['en-US', 'Inglês (EUA)'],
  ['en-GB', 'Inglês (Reino Unido)'],
  ['pt-BR', 'Português (Brasil)'],
  ['pt-PT', 'Português (Portugal)'],
  ['ja-JP', 'Japonês'],
  ['es-ES', 'Espanhol (Espanha)'],
  ['es-MX', 'Espanhol (México)'],
  ['fr-FR', 'Francês'],
  ['de-DE', 'Alemão'],
  ['it-IT', 'Italiano'],
  ['ko-KR', 'Coreano'],
  ['zh-CN', 'Chinês (simplificado)'],
  ['zh-TW', 'Chinês (tradicional)'],
  ['ru-RU', 'Russo'],
  ['ar-SA', 'Árabe'],
  ['hi-IN', 'Hindi'],
  ['th-TH', 'Tailandês'],
  ['id-ID', 'Indonésio'],
  ['pl-PL', 'Polonês'],
  ['tr-TR', 'Turco'],
]

/** Idiomas das faixas de áudio e legenda, no código ISO 639-2/B da tag `language` dos arquivos (Matroska). */
export const ISO639_2: [string, string][] = [
  ['jpn', 'Japonês'],
  ['eng', 'Inglês'],
  ['por', 'Português'],
  ['spa', 'Espanhol'],
  ['fre', 'Francês'],
  ['ger', 'Alemão'],
  ['ita', 'Italiano'],
  ['kor', 'Coreano'],
  ['chi', 'Chinês'],
  ['rus', 'Russo'],
  ['ara', 'Árabe'],
  ['hin', 'Hindi'],
  ['tha', 'Tailandês'],
  ['ind', 'Indonésio'],
  ['pol', 'Polonês'],
  ['tur', 'Turco'],
]
