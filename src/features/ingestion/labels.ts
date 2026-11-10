import type {
  IngestionEventType,
  IngestionStatus,
  IngestionStep,
  IngestionStepStatus,
  IngestionTaskStatus,
  IngestionTaskSummary,
} from '@/api/generated/model'
import type { Tone } from '@/components/ui/chip'

export const INGESTION_STATUS: Record<IngestionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Na fila', tone: 'neutral' },
  RUNNING: { label: 'Em andamento', tone: 'info' },
  COMPLETED: { label: 'Concluída', tone: 'ok' },
  COMPLETED_WITH_ERRORS: { label: 'Concluída com falhas', tone: 'err' },
  FAILED: { label: 'Falhou', tone: 'err' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}

export const TASK_STATUS: Record<IngestionTaskStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Na fila', tone: 'neutral' },
  RUNNING: { label: 'Rodando', tone: 'info' },
  WAITING_CURATION: { label: 'Aguarda curadoria', tone: 'warn' },
  RESOLVED: { label: 'Resolvida à mão', tone: 'ok' },
  COMPLETED: { label: 'Concluída', tone: 'ok' },
  FAILED: { label: 'Falhou', tone: 'err' },
  CANCELLED: { label: 'Cancelada', tone: 'neutral' },
}

/** Cor da barra para as tarefas resolvidas à mão: o verde das concluídas, mais apagado. */
export const RESOLVED_COLOR = 'color-mix(in oklch, var(--ok-fg) 50%, transparent)'

/** Etapas na ordem em que rodam, com a aba do item (`/catalogo/:folderId/:tab`) onde cada uma é resolvida à mão. */
export const STEPS: { step: IngestionStep; label: string; title: string; tab: string }[] = [
  { step: 'ANILIST_SYNC', label: 'AniList', title: 'Vínculo com a AniList', tab: 'anilist' },
  { step: 'TMDB_BIND', label: 'TMDB', title: 'Vínculo com o TMDB', tab: 'tmdb' },
  { step: 'TMDB_OVERRIDES', label: 'Overrides', title: 'Título, sinopse e imagens do TMDB', tab: 'overrides' },
  { step: 'TMDB_FILEPAIR', label: 'Episódios', title: 'Pareamento dos episódios', tab: 'pareamento' },
]

export const stepInfo = (step: IngestionStep) => STEPS.find((s) => s.step === step)!

export const STEP_STATUS: Record<IngestionStepStatus, { label: string; tone: Tone }> = {
  PENDING: { label: 'Na fila', tone: 'neutral' },
  RUNNING: { label: 'Rodando', tone: 'info' },
  COMPLETED: { label: 'Concluída', tone: 'ok' },
  SKIPPED: { label: 'Não se aplica', tone: 'neutral' },
  UNRESOLVED: { label: 'Precisa de curadoria', tone: 'warn' },
  FAILED: { label: 'Falhou', tone: 'err' },
}

/** Ícone de cada evento: glifo simples, sem círculo próprio — o círculo vem do marcador da linha do tempo. */
export const EVENT: Record<IngestionEventType, { icon: string; tone: Tone }> = {
  STARTED: { icon: 'play_arrow', tone: 'neutral' },
  REQUEST_SENT: { icon: 'arrow_outward', tone: 'neutral' },
  RESPONSE_RECEIVED: { icon: 'south_west', tone: 'neutral' },
  RESULTS_FOUND: { icon: 'list', tone: 'neutral' },
  MATCH_SELECTED: { icon: 'check', tone: 'ok' },
  MATCH_NOT_FOUND: { icon: 'question_mark', tone: 'warn' },
  WARNING: { icon: 'priority_high', tone: 'warn' },
  ERROR: { icon: 'close', tone: 'err' },
  COMPLETED: { icon: 'done_all', tone: 'ok' },
  SKIPPED: { icon: 'redo', tone: 'neutral' },
}

/** Cor (texto) de cada tom, para marcadores fora de um `Chip`. */
export const toneColor = (tone: Tone) => (tone === 'neutral' ? 'var(--muted)' : `var(--${tone}-fg)`)

/**
 * Onde resolver uma tarefa parada: a aba do item da etapa que ficou `UNRESOLVED` (ou `FAILED`).
 * `null` se nenhuma etapa parou.
 */
export function blockedStep(task: IngestionTaskSummary) {
  const s = task.steps.find((x) => x.status === 'UNRESOLVED' || x.status === 'FAILED')
  return s ? { ...stepInfo(s.step), status: s.status } : null
}

export const needsAttention = (task: IngestionTaskSummary) => task.status === 'WAITING_CURATION' || task.status === 'FAILED'

export const isFinished = (status: IngestionStatus) => status !== 'PENDING' && status !== 'RUNNING'

/** Duração legível entre dois instantes (`fim` ausente = agora). */
export function formatElapsed(start?: string | null, end?: string | null, now = Date.now()) {
  if (!start) return '—'
  const s = Math.max(0, Math.round(((end ? new Date(end).getTime() : now) - new Date(start).getTime()) / 1000))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h) return `${h} h ${m} min`
  if (m) return `${m} min ${sec} s`
  return sec ? `${sec} s` : '< 1 s'
}
