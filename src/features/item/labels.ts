import type { AnimeReviewStatus, FranchiseRootCuration, MediaType } from '@/api/generated/model'
import type { Tone } from '@/components/ui/chip'

/** Tipo da pasta como aparece na interface. */
export const MEDIA_TYPE_LABEL: Record<MediaType, string> = { ANIME: 'Anime', TV: 'Série', MOVIE: 'Filme' }

export const REVIEW: Record<AnimeReviewStatus, { label: string; tone: Tone }> = {
  PENDING_REVIEW: { label: 'Aguardando revisão', tone: 'info' },
  PARTIAL: { label: 'Parcial', tone: 'warn' },
  REVIEWED: { label: 'Revisado', tone: 'ok' },
}

export const reviewInfo = (s?: AnimeReviewStatus | null) => (s ? REVIEW[s] : { label: 'Processando', tone: 'neutral' as Tone })

export const FRANCHISE_ROOT: Record<FranchiseRootCuration, { label: string; hint: string }> = {
  AUTO: {
    label: 'Automático',
    hint: 'Decidido pelas relações da AniList: é o início se não tiver temporada anterior nem obra principal.',
  },
  MANUAL_ROOT: {
    label: 'Sempre o início',
    hint: 'Mostrar este anime como entrada principal, mesmo sendo continuação de outro.',
  },
  MANUAL_NOT_ROOT: {
    label: 'Nunca o início',
    hint: 'Agrupar este anime dentro de outra franquia, mesmo sem temporada anterior.',
  },
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

export const ISO639: [string, string][] = [
  ['ja', 'Japonês'],
  ['en', 'Inglês'],
  ['pt', 'Português'],
  ['es', 'Espanhol'],
  ['fr', 'Francês'],
  ['de', 'Alemão'],
  ['it', 'Italiano'],
  ['ko', 'Coreano'],
  ['zh', 'Chinês'],
  ['ru', 'Russo'],
  ['ar', 'Árabe'],
  ['hi', 'Hindi'],
  ['th', 'Tailandês'],
  ['id', 'Indonésio'],
  ['pl', 'Polonês'],
  ['tr', 'Turco'],
]
