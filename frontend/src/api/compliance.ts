import { api } from './client'
import type { ComplianceDashboard, ComplianceTrend } from './types'

export function getComplianceDashboard(sort: 'status' | 'name' = 'status'): Promise<ComplianceDashboard> {
  return api.get<ComplianceDashboard>(`/compliance/dashboard?sort=${sort}`)
}

export function getComplianceTrend(
  granularity: 'daily' | 'weekly' | 'monthly' = 'weekly',
  periods = 12,
): Promise<ComplianceTrend> {
  return api.get<ComplianceTrend>(`/compliance/trend?granularity=${granularity}&periods=${periods}`)
}
