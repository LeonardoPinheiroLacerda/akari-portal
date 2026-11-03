import { useState } from 'react'
import { toast } from 'sonner'
import { createFranchise, deleteFranchise, setAnimeFranchise } from '@/api/generated/endpoints/anime-franchise/anime-franchise'
import type { FranchiseDetail } from '@/api/generated/model'
import { toastError } from '@/api/errors'
import { invalidate } from '@/api/query'

export type Work = { anilistId: number; title: string }

/** Título de um resumo de anime, com o id quando não há título. */
export const titleOf = (b: { anilistId: number; title?: string | null }) => b.title ?? `AniList ${b.anilistId}`

/**
 * Ações de organização das franquias, com aviso de sucesso ou erro e recarga de tudo que depende
 * delas (outras franquias, a franquia de cada anime, as raízes listadas). `busy` é a chave da ação
 * em andamento, para o botão certo mostrar que está carregando.
 */
export function useFranchiseActions() {
  const [busy, setBusy] = useState<string | null>(null)

  const run = async <T>(key: string, fn: () => Promise<T>, ok: string, fail: string): Promise<T | undefined> => {
    setBusy(key)
    try {
      const result = await fn()
      toast.success(ok)
      return result
    } catch (e) {
      toastError(e, fail)
      return undefined
    } finally {
      await invalidate.franchises()
      setBusy(null)
    }
  }

  return {
    busy,
    /** Põe a obra (e o galho automático dela) na franquia de `root`. Devolve a franquia de destino. */
    moveTo: (w: Work, root: Work) =>
      run<FranchiseDetail | undefined>(
        `move-${w.anilistId}`,
        () => setAnimeFranchise(w.anilistId, { assignment: 'MANUAL_MEMBER', rootId: root.anilistId }),
        `${w.title} agora está na franquia de ${root.title}`,
        'Não foi possível mover a obra',
      ),
    hide: (w: Work) =>
      run(
        `hide-${w.anilistId}`,
        () => setAnimeFranchise(w.anilistId, { assignment: 'HIDDEN' }),
        `${w.title} oculta`,
        'Não foi possível ocultar a obra',
      ),
    toAuto: (w: Work) =>
      run(
        `auto-${w.anilistId}`,
        () => setAnimeFranchise(w.anilistId, { assignment: 'AUTO' }),
        `${w.title} voltou à franquia automática`,
        'Não foi possível voltar ao automático',
      ),
    /** Cria uma franquia manual com a obra como início. */
    ownFranchise: (w: Work) =>
      run(
        `own-${w.anilistId}`,
        () => createFranchise({ rootAnilistId: w.anilistId }),
        `${w.title} agora é o início de uma franquia própria`,
        'Não foi possível criar a franquia',
      ),
    /**
     * Troca o início da franquia por outra obra dela, em duas chamadas: a obra vira franquia
     * manual (sai com as que estão abaixo dela) e a franquia antiga é juntada à nova. O contrato
     * não tem uma operação única para isso; se a segunda falhar, as duas franquias ficam separadas
     * e o aviso diz como terminar.
     */
    makeRoot: async (w: Work, oldRoot: Work) => {
      setBusy(`root-${w.anilistId}`)
      try {
        await createFranchise({ rootAnilistId: w.anilistId })
        try {
          await setAnimeFranchise(oldRoot.anilistId, { assignment: 'MANUAL_MEMBER', rootId: w.anilistId })
        } catch (e) {
          toastError(
            e,
            `${w.title} virou o início de uma franquia, mas o resto de ${oldRoot.title} não foi junto. Use "Juntar a outra franquia" em ${oldRoot.title}.`,
          )
          return false
        }
        toast.success(`${w.title} agora é o início da franquia`)
        return true
      } catch (e) {
        toastError(e, 'Não foi possível trocar o início da franquia')
        return false
      } finally {
        await invalidate.franchises()
        setBusy(null)
      }
    },
    deleteFranchise: (root: Work) =>
      run(
        `delete-${root.anilistId}`,
        () => deleteFranchise(root.anilistId),
        `Franquia de ${root.title} excluída`,
        'Não foi possível excluir a franquia',
      ),
  }
}

export type FranchiseActions = ReturnType<typeof useFranchiseActions>
