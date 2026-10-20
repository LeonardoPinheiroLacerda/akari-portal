import type { ApiError } from './generated/model'

/** Erro HTTP com o corpo `ApiError` do backend (quando houver). */
export class HttpError extends Error {
  readonly status: number
  readonly body: ApiError | null

  constructor(status: number, body: ApiError | null) {
    super(body?.message ?? `Falha na requisição (${status})`)
    this.status = status
    this.body = body
  }

  get code() {
    return this.body?.code
  }
}

export const isHttpError = (e: unknown): e is HttpError => e instanceof HttpError

/** Base da API. Vazio = mesma origem (em dev o Vite faz proxy de /v1). */
export const API_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined) ?? ''

export const apiUrl = (path: string) => `${API_BASE}${path}`

/** Mutator usado pelos clientes gerados pelo Orval. Devolve só o corpo da resposta. */
export async function http<T>(url: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(apiUrl(url), {
    ...options,
    headers: { Accept: 'application/json', ...options.headers },
  })

  if (!res.ok) {
    let body: ApiError | null
    try {
      body = (await res.json()) as ApiError
    } catch {
      body = null
    }
    throw new HttpError(res.status, body)
  }

  if (res.status === 204 || res.headers.get('content-length') === '0') {
    return undefined as T
  }
  const type = res.headers.get('content-type') ?? ''
  if (type.includes('json')) return (await res.json()) as T
  return (await res.text()) as T
}

export default http
