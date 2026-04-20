import { api } from './client'
import type { ApiClosure, ClosureReason } from './types'

export interface ListClosuresParams {
  location_id?: string
  date_from?: string
  date_to?: string
}

export interface CreateClosureBody {
  location_id: string
  closure_date: string   // YYYY-MM-DD, must be Mon-Fri
  reason: ClosureReason
  notes: string
}

export function listClosures(params: ListClosuresParams = {}): Promise<{ items: ApiClosure[]; total: number }> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<{ items: ApiClosure[]; total: number }>(`/closures${qs ? `?${qs}` : ''}`)
}

export function createClosure(body: CreateClosureBody): Promise<ApiClosure> {
  return api.post<ApiClosure>('/closures', body)
}
