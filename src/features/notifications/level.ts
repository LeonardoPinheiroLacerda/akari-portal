import type { NotificationLevel, NotificationResponse } from '@/api/generated/model'
import type { Tone } from '@/components/ui/chip'

export const LEVEL: Record<NotificationLevel, { label: string; tone: Tone; icon: string }> = {
  INFO: { label: 'Info', tone: 'info', icon: 'info' },
  WARNING: { label: 'Aviso', tone: 'warn', icon: 'warning' },
  ERROR: { label: 'Erro', tone: 'err', icon: 'error' },
}

/** Título exibido: o do título, ou "Ingestão"/"Falha na ingestão" quando não é sobre um título. */
export const notificationHead = (n: NotificationResponse) => n.title ?? (n.level === 'ERROR' ? 'Falha na ingestão' : 'Ingestão')
