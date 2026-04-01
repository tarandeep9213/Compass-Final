import { api } from './client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LocationGroupApi {
  group: string
  cost_center: string
  label: string
  sub_locs: { id: string; label: string; imprest: number }[]
  default_factor: number
}

export interface RtMaxValuesApi {
  loc_id: string
  loc_label: string
  max_f: number
  max_h: number
  max_j: number
  max_k: number
  total: number
  actual_fund: number
  section_a_data: { date: string; sA: number }[]
  avg_sa: number
  count: number
}

export interface GenerateResponse {
  calculations: RtMaxValuesApi[]
}

export interface RtLocReportApi {
  loc_id: string
  loc_label: string
  total: number
  expected_fund: number
  actual_fund: number
  over: number
  cushion: number
  net: number
  status: string
  conclusion: string
  required_actions: string
  action_details: string
}

export interface RtReportApi {
  id: string
  group_key: string
  cost_center: string
  location_labels: string
  from_date: string
  to_date: string
  factor: number
  preparer: string
  scope: string | null
  status: string
  location_reports: RtLocReportApi[]
  saved_by: string
  created_at: string
  updated_at: string
}

export interface PaginatedReports {
  items: RtReportApi[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export function getLocationGroups(): Promise<LocationGroupApi[]> {
  return api.get<LocationGroupApi[]>('/reasonableness/location-groups')
}

export function generateReport(body: {
  location_ids: string[]
  from_date: string
  to_date: string
  factor: number
}): Promise<GenerateResponse> {
  return api.post<GenerateResponse>('/reasonableness/generate', body)
}

export function saveReport(body: {
  group_key: string
  cost_center: string
  location_labels: string
  from_date: string
  to_date: string
  factor: number
  preparer: string
  scope?: string
  status: string
  location_reports: RtLocReportApi[]
}): Promise<RtReportApi> {
  return api.post<RtReportApi>('/reasonableness/reports', body)
}

export function listReports(params?: {
  status?: string
  page?: number
  page_size?: number
}): Promise<PaginatedReports> {
  const q = new URLSearchParams()
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) q.set(k, String(v))
    })
  }
  const qs = q.toString()
  return api.get<PaginatedReports>(`/reasonableness/reports${qs ? `?${qs}` : ''}`)
}

export function getReport(id: string): Promise<RtReportApi> {
  return api.get<RtReportApi>(`/reasonableness/reports/${id}`)
}
