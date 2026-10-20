import type { TmdbFilePairingSchema, TmdbFilePairingSchemaEpisode, VideoFileResponse } from '@/api/generated/model'

export type EpisodeRef = { season: number; episode: number }
export type AutoPairStatus = 'sequence' | 'new-season' | 'used' | 'end'

export type AutoPairRow = {
  file: VideoFileResponse
  after: VideoFileResponse
  target: (EpisodeRef & { ep: TmdbFilePairingSchemaEpisode }) | null
  status: AutoPairStatus
  usedBy?: string
  /** Marcado por padrão (sequência / nova temporada). */
  selectable: boolean
}

export const dirOf = (path: string) => path.slice(0, path.lastIndexOf('/') + 1)
export const byName = (a: VideoFileResponse, b: VideoFileResponse) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })

const keyOf = (r: EpisodeRef) => `${r.season}:${r.episode}`

/** Episódio seguinte na estrutura da série; no fim da temporada vai para o E01 da próxima (nunca S00). */
export function nextEpisode(schema: TmdbFilePairingSchema, from: EpisodeRef) {
  const seasons = (schema.seasons ?? [])
    .filter((s) => s.seasonNumber != null && s.seasonNumber > 0)
    .sort((a, b) => a.seasonNumber! - b.seasonNumber!)
  const si = seasons.findIndex((s) => s.seasonNumber === from.season)
  if (si === -1) return null
  const eps = (seasons[si].episodes ?? [])
    .filter((e) => e.episodeNumber != null)
    .sort((a, b) => a.episodeNumber! - b.episodeNumber!)
  const after = eps.find((e) => e.episodeNumber! > from.episode)
  if (after) return { season: from.season, episode: after.episodeNumber!, ep: after, newSeason: false }
  for (const s of seasons.slice(si + 1)) {
    const first = (s.episodes ?? []).filter((e) => e.episodeNumber != null).sort((a, b) => a.episodeNumber! - b.episodeNumber!)[0]
    if (first) return { season: s.seasonNumber!, episode: first.episodeNumber!, ep: first, newSeason: true }
  }
  return null
}

/**
 * Proposta de auto-pair (calculada no cliente, nada é gravado aqui).
 * Arquivos agrupados por diretório e ordenados por nome; cada arquivo sem par recebe o
 * episódio seguinte ao do arquivo anterior. S00 não serve de ponto de partida.
 */
export function proposeAutoPair(files: VideoFileResponse[], schema: TmdbFilePairingSchema): AutoPairRow[] {
  const used = new Map<string, string>()
  for (const f of files) {
    const p = f.tmdbPairing
    if (p?.seasonNumber != null && p.episodeNumber != null)
      used.set(keyOf({ season: p.seasonNumber, episode: p.episodeNumber }), f.name)
  }

  const groups = new Map<string, VideoFileResponse[]>()
  for (const f of files) {
    const d = dirOf(f.path)
    groups.set(d, [...(groups.get(d) ?? []), f])
  }

  const rows: AutoPairRow[] = []
  for (const list of groups.values()) {
    list.sort(byName)
    let prev: { file: VideoFileResponse; ref: EpisodeRef } | null = null
    for (const f of list) {
      const p = f.tmdbPairing
      if (p?.seasonNumber != null && p.episodeNumber != null) {
        prev = { file: f, ref: { season: p.seasonNumber, episode: p.episodeNumber } }
        continue
      }
      if (!prev || prev.ref.season === 0) continue
      const next = nextEpisode(schema, prev.ref)
      if (!next) {
        rows.push({ file: f, after: prev.file, target: null, status: 'end', selectable: false })
        prev = null
        continue
      }
      const ref = { season: next.season, episode: next.episode }
      const by = used.get(keyOf(ref))
      if (by) {
        rows.push({ file: f, after: prev.file, target: { ...ref, ep: next.ep }, status: 'used', usedBy: by, selectable: false })
      } else {
        used.set(keyOf(ref), f.name)
        rows.push({
          file: f,
          after: prev.file,
          target: { ...ref, ep: next.ep },
          status: next.newSeason ? 'new-season' : 'sequence',
          selectable: true,
        })
      }
      prev = { file: f, ref }
    }
  }
  return rows
}
