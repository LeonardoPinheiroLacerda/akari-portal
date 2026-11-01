import type { VideoFileResponse } from '@/api/generated/model'

/** Ordena arquivos de vídeo pelo nome, com trechos numéricos comparados como número (`Ep 2` antes de `Ep 10`). */
export const byName = (a: VideoFileResponse, b: VideoFileResponse) =>
  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
