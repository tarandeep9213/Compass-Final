import { api } from './client'
import type { ApiAuditEvent, AuditFilterOptions, Paginated } from './types'

export interface ListAuditParams {
  event_type?: string
  actor_id?: string
  location_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export function listAuditEvents(params: ListAuditParams = {}): Promise<Paginated<ApiAuditEvent>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<ApiAuditEvent>>(`/audit${qs ? `?${qs}` : ''}`)
}

export function getAuditFilterOptions(event_type?: string): Promise<AuditFilterOptions> {
  const qs = event_type ? `?event_type=${encodeURIComponent(event_type)}` : ''
  return api.get<AuditFilterOptions>(`/audit/filter-options${qs}`)
}
