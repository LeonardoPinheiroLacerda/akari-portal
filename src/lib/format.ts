const dateFmt = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
const dateTimeFmt = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})
const timeFmt = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })

export const formatDate = (iso?: string | null) => (iso ? dateFmt.format(new Date(iso)) : '—')
export const formatDateTime = (iso?: string | null) => (iso ? dateTimeFmt.format(new Date(iso)) : '—')
export const formatTime = (d: Date | number) => timeFmt.format(d)

/** "há 12 min", "há 3 h", "ontem", "12/10/2026". */
export function formatRelative(iso?: string | null, now = Date.now()) {
  if (!iso) return '—'
  const t = new Date(iso).getTime()
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'agora'
  const m = Math.round(s / 60)
  if (m < 60) return `há ${m} min`
  const h = Math.round(m / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.round(h / 24)
  if (d === 1) return 'ontem'
  if (d < 7) return `há ${d} dias`
  return formatDate(iso)
}

const UNITS = ['B', 'KB', 'MB', 'GB', 'TB']
export function formatBytes(bytes?: number | null, digits = 1) {
  if (bytes == null) return '—'
  let v = bytes
  let i = 0
  while (v >= 1024 && i < UNITS.length - 1) {
    v /= 1024
    i++
  }
  return `${v.toLocaleString('pt-BR', { maximumFractionDigits: i === 0 ? 0 : digits })} ${UNITS[i]}`
}

export function formatBitrate(bps?: number | null) {
  if (bps == null) return '—'
  if (bps >= 1_000_000) return `${(bps / 1_000_000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} Mb/s`
  return `${Math.round(bps / 1000).toLocaleString('pt-BR')} kb/s`
}

/** 1452.3 → "24:12"; 3725 → "1:02:05". */
export function formatClock(seconds?: number | null) {
  if (seconds == null || !Number.isFinite(seconds)) return '—'
  const s = Math.max(0, Math.floor(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`
}

/** "mm:ss" ou "h:mm:ss" → segundos; null se inválido. */
export function parseClock(value: string): number | null {
  const parts = value
    .trim()
    .split(':')
    .map((p) => p.trim())
  if (parts.length === 0 || parts.length > 3 || parts.some((p) => !/^\d+(\.\d+)?$/.test(p))) return null
  return parts.reduce((acc, p) => acc * 60 + Number(p), 0)
}

/** Código de episódio S01E03. */
export function episodeCode(season?: number | null, episode?: number | null) {
  if (season == null || episode == null) return null
  return `S${String(season).padStart(2, '0')}E${String(episode).padStart(2, '0')}`
}

export const pluralize = (n: number, one: string, many: string) => `${n.toLocaleString('pt-BR')} ${n === 1 ? one : many}`

/** Duração ISO-8601 (PT30S, P7D, PT1H30M) → texto curto ("30 s", "7 d", "1 h 30 min"). */
export function humanizeIsoDuration(value?: string | null) {
  if (!value) return null
  const m = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+(?:\.\d+)?)S)?)?$/i.exec(value.trim())
  if (!m) return null
  const [, d, h, min, s] = m
  const parts = [d && `${d} d`, h && `${h} h`, min && `${min} min`, s && `${s} s`].filter(Boolean)
  return parts.length ? parts.join(' ') : null
}
