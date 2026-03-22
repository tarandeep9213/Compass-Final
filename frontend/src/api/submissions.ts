import { api } from './client'
import type {
  ApiSubmission,
  ApiSubmissionDetail,
  Paginated,
  CreateSubmissionBody,
  ApproveBody,
  RejectBody,
  ApproveResponse,
  MissedSubmission,
  CreateMissedBody,
} from './types'

export interface ListSubmissionsParams {
  location_id?: string
  status?: string
  date_from?: string
  date_to?: string
  operator_id?: string
  page?: number
  page_size?: number
}

export function listSubmissions(params: ListSubmissionsParams = {}): Promise<Paginated<ApiSubmission>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<ApiSubmission>>(`/submissions${qs ? `?${qs}` : ''}`)
}

export function getSubmission(id: string): Promise<ApiSubmissionDetail> {
  return api.get<ApiSubmissionDetail>(`/submissions/${id}`)
}

export function createSubmission(body: CreateSubmissionBody): Promise<ApiSubmission> {
  return api.post<ApiSubmission>('/submissions', body)
}

export function updateDraft(id: string, body: CreateSubmissionBody): Promise<ApiSubmission> {
  return api.put<ApiSubmission>(`/submissions/${id}`, body)
}

export function submitDraft(id: string, varianceNote: string | null): Promise<ApiSubmission> {
  return api.post<ApiSubmission>(`/submissions/${id}/submit`, { variance_note: varianceNote })
}

export function approveSubmission(id: string, body: ApproveBody = {}): Promise<ApproveResponse> {
  return api.post<ApproveResponse>(`/submissions/${id}/approve`, body)
}

export function rejectSubmission(id: string, body: RejectBody): Promise<ApproveResponse> {
  return api.post<ApproveResponse>(`/submissions/${id}/reject`, body)
}

// Missed submission endpoints
export function logMissedSubmission(body: CreateMissedBody): Promise<MissedSubmission> {
  return api.post<MissedSubmission>('/missed-submissions', body)
}

export interface ListMissedParams {
  location_id?: string
  date_from?: string
  date_to?: string
  page?: number
  page_size?: number
}

export function listMissedSubmissions(params: ListMissedParams = {}): Promise<Paginated<MissedSubmission>> {
  const q = new URLSearchParams()
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) q.set(k, String(v)) })
  const qs = q.toString()
  return api.get<Paginated<MissedSubmission>>(`/missed-submissions${qs ? `?${qs}` : ''}`)
}
