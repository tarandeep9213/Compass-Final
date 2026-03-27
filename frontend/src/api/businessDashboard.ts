import { api } from './client'

// ── Controller Activity ───────────────────────────────────────────────────────

export interface ControllerActivityItem {
  name: string
  completed: number
  missed: number
  scheduled: number
  completionRate: number
  avgVarianceFound: number
  dowWarnings: number
}

export interface ControllerActivityResponse {
  month_year: string
  items: ControllerActivityItem[]
}

export function getControllerActivity(): Promise<ControllerActivityResponse> {
  return api.get<ControllerActivityResponse>('/business-dashboard/controller-activity')
}

// ── Operator Behaviour ────────────────────────────────────────────────────────

export interface OperatorBehaviourResponse {
  month_year: string
  total_submissions: number
  avgHoursToSubmit: number
  lateSubmitters: number
  platformSplit: { form: number; excel: number }
  draftUsageRate: number
}

export function getOperatorBehaviour(): Promise<OperatorBehaviourResponse> {
  return api.get<OperatorBehaviourResponse>('/business-dashboard/operator-behaviour')
}

// ── Rejections ────────────────────────────────────────────────────────────────

export interface RejectedOperatorItem {
  name: string
  location: string
  rejections: number
  topReason: string
}

export interface RejectionReasonItem {
  reason: string
  count: number
  pct: number
}

export interface RejectionsResponse {
  month_year: string
  total_rejections: number
  avgRejectionsBeforeApproval: number
  repeatRejecters: number
  operators: RejectedOperatorItem[]
  reasons: RejectionReasonItem[]
}

export function getRejections(): Promise<RejectionsResponse> {
  return api.get<RejectionsResponse>('/business-dashboard/rejections')
}

// ── DGM Coverage ──────────────────────────────────────────────────────────────

export interface DgmCoverageRow {
  name: string
  locationsAssigned: number
  locationsVisited: number
  coveragePct: number
  avgVarianceFound: number
  pendingLocations: string[]
}

export interface DgmPendingLocation {
  name: string
  daysLeft: number
}

export interface DgmCoverageResponse {
  month_year: string
  daysLeft: number
  dgms: DgmCoverageRow[]
  pendingLocations: DgmPendingLocation[]
}

export function getDgmCoverage(): Promise<DgmCoverageResponse> {
  return api.get<DgmCoverageResponse>('/business-dashboard/dgm-coverage')
}
