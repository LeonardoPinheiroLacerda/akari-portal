import { toast } from 'sonner'
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form'
import { isHttpError } from './http'

/** Mensagem amigável a partir de qualquer erro (prefere `ApiError.message`). */
export function errorMessage(error: unknown): string {
  if (isHttpError(error)) {
    if (error.body?.message) return error.body.message
    if (error.status >= 500) return 'O servidor não conseguiu concluir a operação. Tente de novo em instantes.'
    return error.message
  }
  if (error instanceof TypeError) return 'Não foi possível falar com o servidor. Verifique se o Akari está no ar.'
  if (error instanceof Error) return error.message
  return 'Algo deu errado.'
}

export const toastError = (error: unknown, title?: string) =>
  toast.error(title ?? errorMessage(error), title ? { description: errorMessage(error) } : undefined)

export const errorCode = (error: unknown) => (isHttpError(error) ? error.body?.code : undefined)
export const errorStatus = (error: unknown) => (isHttpError(error) ? error.status : undefined)

/**
 * Mapeia `details[].field` de um `VALIDATION_ERROR` para os campos do formulário.
 * `fieldMap` traduz o caminho do backend (ex.: `config.password`) para o nome do campo.
 * Devolve `true` quando algum campo recebeu erro.
 */
export function applyFieldErrors<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fieldMap: (field: string) => string | undefined = (f) => f,
) {
  if (!isHttpError(error) || error.body?.code !== 'VALIDATION_ERROR') return false
  let applied = false
  for (const d of error.body.details ?? []) {
    const name = fieldMap(d.field)
    if (name) {
      setError(name as Path<T>, { type: 'server', message: d.error })
      applied = true
    }
  }
  return applied
}
