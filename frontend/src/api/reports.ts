import { api } from './client'
import type { ReportSummary, Paginated, SectionTrends } from './types'

export interface ReportDateRange {
  date_from: string
  date_to: string
}

export function getReportSummary(params: ReportDateRange): Promise<ReportSummary> {
  const q = new URLSearchParams({ date_from: params.date_from, date_to: params.date_to })
  return api.get<ReportSummary>(`/reports/summary?${q}`)
}

export function getLocationReport(
  params: ReportDateRange & { page?: number; page_size?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  return api.get(`/reports/locations?${q}`)
}

export function getActorReport(
  params: ReportDateRange & { role: 'OPERATOR' | 'CONTROLLER' | 'DGM'; page?: number; page_size?: number },
): Promise<{ role: string; items: Record<string, unknown>[] }> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  return api.get(`/reports/actors?${q}`)
}

export function getExceptionReport(
  params: ReportDateRange & { page?: number; page_size?: number },
): Promise<Paginated<Record<string, unknown>>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  return api.get(`/reports/exceptions?${q}`)
}

export function getSectionTrends(params: {
  section: string
  granularity?: 'weekly' | 'monthly' | 'quarterly'
  periods?: number
  location_id?: string
}): Promise<SectionTrends> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  return api.get<SectionTrends>(`/reports/section-trends?${q}`)
}

export function exportReport(params: ReportDateRange): string {
  // Returns the URL for direct download — open in new tab or set window.location
  const q = new URLSearchParams({ date_from: params.date_from, date_to: params.date_to })
  const base = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8000/v1'
  return `${base}/reports/export?${q}`
}
