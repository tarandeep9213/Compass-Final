import { api } from './client'
import type {
  ApiVerification,
  Paginated,
  DowCheckResponse,
  ScheduleControllerBody,
  CompleteVerificationBody,
  MissVerificationBody,
  ScheduleDgmBody,
} from './types'

// ── Controller verifications ──────────────────────────────────────────────────

export function checkDow(location_id: string, date: string): Promise<DowCheckResponse> {
  return api.get<DowCheckResponse>(
    `/verifications/controller/check-dow?location_id=${encodeURIComponent(location_id)}&date=${date}`,
  )
}

export function scheduleControllerVisit(body: ScheduleControllerBody): Promise<ApiVerification> {
  return api.post<ApiVerification>('/verifications/controller', body)
}

export interface ListControllerParams {
  location_id?: string
  status?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export function listControllerVerifications(
  params: ListControllerParams = {},
): Promise<Paginated<ApiVerification>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<ApiVerification>>(`/verifications/controller${qs ? `?${qs}` : ''}`)
}

export function completeControllerVisit(
  id: string,
  body: CompleteVerificationBody,
): Promise<ApiVerification> {
  return api.patch<ApiVerification>(`/verifications/controller/${id}/complete`, body)
}

export function missControllerVisit(id: string, body: MissVerificationBody): Promise<ApiVerification> {
  return api.patch<ApiVerification>(`/verifications/controller/${id}/miss`, body)
}

// ── DGM verifications ─────────────────────────────────────────────────────────

export function scheduleDgmVisit(body: ScheduleDgmBody): Promise<ApiVerification> {
  return api.post<ApiVerification>('/verifications/dgm', body)
}

export interface ListDgmParams {
  location_id?: string
  status?: string
  month_year?: string
  year?: number
  page?: number
  page_size?: number
}

export function listDgmVerifications(params: ListDgmParams = {}): Promise<Paginated<ApiVerification>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<ApiVerification>>(`/verifications/dgm${qs ? `?${qs}` : ''}`)
}

export function completeDgmVisit(
  id: string,
  body: CompleteVerificationBody,
): Promise<ApiVerification> {
  return api.patch<ApiVerification>(`/verifications/dgm/${id}/complete`, body)
}

export function missDgmVisit(id: string, body: MissVerificationBody): Promise<ApiVerification> {
  return api.patch<ApiVerification>(`/verifications/dgm/${id}/miss`, body)
}
