import { api } from './client'
import type { ComplianceDashboard } from './types'

export function getComplianceDashboard(sort: 'status' | 'name' = 'status'): Promise<ComplianceDashboard> {
  return api.get<ComplianceDashboard>(`/compliance/dashboard?sort=${sort}`)
}
