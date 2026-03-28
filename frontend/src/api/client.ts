// Base HTTP client — JWT token management + fetch wrapper

const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8001/v1'

let _token: string | null = null

export function setToken(t: string | null): void {
  _token = t
  if (t) localStorage.setItem('ccs_token', t)
  else   localStorage.removeItem('ccs_token')
}

export function getToken(): string | null {
  if (_token) return _token
  _token = localStorage.getItem('ccs_token')
  return _token
}

export class ApiError extends Error {
  status: number
  body: unknown
  constructor(message: string, status: number, body: unknown) {
    super(message)
    this.status = status
    this.body   = body
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const token = getToken()
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }))
    throw new ApiError(
      (err as { detail?: string }).detail ?? res.statusText,
      res.status,
      err,
    )
  }

  if (res.status === 204) return undefined as T
  return res.json() as Promise<T>
}

export const api = {
  get:    <T>(path: string)                => request<T>('GET',    path),
  post:   <T>(path: string, body: unknown) => request<T>('POST',   path, body),
  put:    <T>(path: string, body: unknown) => request<T>('PUT',    path, body),
  patch:  <T>(path: string, body: unknown) => request<T>('PATCH',  path, body),
  delete: <T>(path: string)               => request<T>('DELETE', path),
}
