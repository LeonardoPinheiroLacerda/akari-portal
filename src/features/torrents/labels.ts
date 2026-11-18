import type { TorrentDownloadStatus, TorrentTrackType } from '@/api/generated/model'
import type { Tone } from '@/components/ui/chip'

export const DOWNLOAD_STATUS: Record<TorrentDownloadStatus, { label: string; tone: Tone; icon: string }> = {
  NEW: { label: 'Fora do qBittorrent', tone: 'neutral', icon: 'cloud_off' },
  DOWNLOADING: { label: 'Baixando', tone: 'info', icon: 'downloading' },
  READY: { label: 'Na biblioteca', tone: 'ok', icon: 'check_circle' },
}

/** Nome de uma edição para a tela: "SubsPlease · 1080p". */
export const editionName = (group: string | null | undefined, label: string) => `${group ?? 'Sem grupo'} · ${label}`

/** Rótulo das faixas em mais de um idioma, para o áudio e para a legenda. */
export const AUDIO_TYPE_LABEL: Record<TorrentTrackType, string> = { MULTI: 'Multi-áudio', DUAL: 'Áudio duplo' }
export const SUBTITLE_TYPE_LABEL: Record<TorrentTrackType, string> = { MULTI: 'Multi-legenda', DUAL: 'Legenda dupla' }

/**
 * Serviços de streaming de origem (`source` da edição): nome e cor da marca, nos tokens `--brand-*`
 * do `index.css`. Códigos fora da lista aparecem como vieram, sem cor.
 */
export const SOURCE: Record<string, { name: string; color: string }> = {
  CR: { name: 'Crunchyroll', color: 'var(--brand-crunchyroll)' },
  NF: { name: 'Netflix', color: 'var(--brand-netflix)' },
  AMZN: { name: 'Prime Video', color: 'var(--brand-prime-video)' },
  DSNP: { name: 'Disney+', color: 'var(--brand-disney-plus)' },
  HULU: { name: 'Hulu', color: 'var(--brand-hulu)' },
  ATVP: { name: 'Apple TV+', color: 'var(--brand-apple-tv)' },
  MAX: { name: 'Max', color: 'var(--brand-max)' },
  BILI: { name: 'Bilibili', color: 'var(--brand-bilibili)' },
  ABEMA: { name: 'Abema', color: 'var(--brand-abema)' },
  VRV: { name: 'VRV', color: 'var(--brand-vrv)' },
  FUNI: { name: 'Funimation', color: 'var(--brand-funimation)' },
  ADN: { name: 'ADN', color: 'var(--brand-adn)' },
}
