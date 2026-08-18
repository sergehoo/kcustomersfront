const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || 'https://api.kaydanshield.com').replace(/\/$/, '')
let accessToken: string | undefined

/** In-memory only: no JWT is persisted by this public shell. */
export function setAccessToken(token?: string) { accessToken = token }

export class ApiError extends Error {
  constructor(public status: number, public detail: unknown) {
    super(`${status}: ${typeof detail === 'string' ? detail : 'Request failed'}`)
    this.name = 'ApiError'
  }
}

type RequestOptions = Omit<RequestInit, 'body'> & { body?: unknown; signal?: AbortSignal }

function isFormData(body: unknown): body is FormData {
  return typeof FormData !== 'undefined' && body instanceof FormData
}

async function request<T>(path: string, { body, headers, ...init }: RequestOptions = {}): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 15_000)
  const requestHeaders = new Headers(headers)
  let payload: BodyInit | undefined

  if (body !== undefined) {
    payload = isFormData(body) ? body : JSON.stringify(body)
    if (!isFormData(body)) requestHeaders.set('Content-Type', 'application/json')
  }
  requestHeaders.set('Accept', 'application/json')
  if (accessToken) requestHeaders.set('Authorization', `Bearer ${accessToken}`)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...init,
      body: payload,
      headers: requestHeaders,
      signal: init.signal ?? controller.signal,
      credentials: 'include',
    })
    if (!response.ok) {
      const detail = await response.json().catch(() => response.statusText)
      throw new ApiError(response.status, detail)
    }
    if (response.status === 204) return undefined as T
    return response.json() as Promise<T>
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new ApiError(408, 'Le service a mis trop de temps à répondre.')
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}

export async function downloadBlob(path: string): Promise<{ blob: Blob; filename: string }> {
  const response = await fetch(`${API_BASE_URL}${path}`, { credentials: 'include', headers: { Accept: 'application/pdf' } })
  if (!response.ok) throw new ApiError(response.status, await response.json().catch(() => response.statusText))
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const filename = disposition.match(/filename\*?=(?:UTF-8''|")?([^;"]+)/i)?.[1] ?? 'badge-visiteur.pdf'
  return { blob: await response.blob(), filename: decodeURIComponent(filename) }
}

export const apiClient = { request, downloadBlob, baseUrl: API_BASE_URL, setAccessToken }
