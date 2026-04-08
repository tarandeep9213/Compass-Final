// =============================================================================
// Alarm Testing Module — API Layer (real backend)
// =============================================================================

import { api } from './client'
import { getToken } from './client'

import type {
  AlarmBuilding,
  AlarmZone,
  AlarmTest,
  AlarmTestZone,
  AlarmTestAttachment,
  BiannualCheck,
  ComplianceRules,
  AlarmUser,
} from '../mock/alarmData'

// ---------------------------------------------------------------------------
// camelCase ↔ snake_case mapping
// ---------------------------------------------------------------------------

function snakeToCamel(s: string): string {
  return s.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function camelToSnake(s: string): string {
  return s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`)
}

function mapKeys(obj: unknown, fn: (k: string) => string): unknown {
  if (Array.isArray(obj)) return obj.map(item => mapKeys(item, fn))
  if (obj !== null && typeof obj === 'object' && !(obj instanceof Date)) {
    const mapped: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      mapped[fn(k)] = mapKeys(v, fn)
    }
    return mapped
  }
  return obj
}

function fromApi<T>(data: unknown): T {
  return mapKeys(data, snakeToCamel) as T
}

function toApi(data: unknown): unknown {
  return mapKeys(data, camelToSnake)
}

// ---------------------------------------------------------------------------
// Return-type interfaces (used by frontend components)
// ---------------------------------------------------------------------------

export interface AlarmOverviewData {
  summary: {
    totalBuildings: number
    compliant: number
    pendingReview: number
    overdue: number
    exempt: number
    complianceRate: number
  }
  buildings: BuildingComplianceRow[]
  monthlyHistory: { month: string; compliant: number; total: number }[]
}

export interface BuildingComplianceRow {
  buildingId: string
  buildingName: string
  region: string
  status: 'compliant' | 'pending' | 'overdue' | 'exempt'
  lastTestDate?: string
  lastTestStatus?: string
  approverName?: string
}

export interface OverdueBuilding {
  buildingId: string
  buildingName: string
  region: string
  daysSinceLastTest: number
  assignedTesters: string[]
  escalationTier?: number
}

export interface AlarmTrendData {
  months: {
    month: string
    compliant: number
    total: number
    complianceRate: number
  }[]
}

export interface BiannualStatusRow {
  buildingId: string
  buildingName: string
  region: string
  cellularStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING' | 'NO_CHECK'
  cellularNextDue?: string
  cameraStatus: 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING' | 'NO_CHECK'
  cameraNextDue?: string
}

// ---------------------------------------------------------------------------
// Buildings (Screen 13)
// ---------------------------------------------------------------------------

export function listAlarmBuildings(): Promise<AlarmBuilding[]> {
  return api.get<unknown[]>('/alarm/buildings').then(data => data.map(b => fromApi<AlarmBuilding>(b)))
}

export function createBuilding(data: Partial<AlarmBuilding>): Promise<AlarmBuilding> {
  return api.post<unknown>('/alarm/buildings', toApi(data)).then(r => fromApi<AlarmBuilding>(r))
}

export function updateBuildingSetup(id: string, data: Partial<AlarmBuilding>): Promise<AlarmBuilding> {
  return api.put<unknown>(`/alarm/buildings/${id}`, toApi(data)).then(r => fromApi<AlarmBuilding>(r))
}

export function importBuildings(rows: Partial<AlarmBuilding>[]): Promise<AlarmBuilding[]> {
  return api.post<unknown>('/alarm/buildings/import', { buildings: rows.map(r => toApi(r)) })
    .then(r => ((r as { buildings: unknown[] }).buildings || []).map(b => fromApi<AlarmBuilding>(b)))
}

export function resetBuildings(): Promise<void> {
  return api.post<unknown>('/alarm/buildings/reset', {}).then(() => undefined)
}

// ---------------------------------------------------------------------------
// Zones (Screen 12)
// ---------------------------------------------------------------------------

export function listZones(buildingId: string): Promise<AlarmZone[]> {
  return api.get<unknown[]>(`/alarm/zones?building_id=${buildingId}`).then(data => data.map(z => fromApi<AlarmZone>(z)))
}

export function createZone(data: Partial<AlarmZone>): Promise<AlarmZone> {
  return api.post<unknown>('/alarm/zones', toApi(data)).then(r => fromApi<AlarmZone>(r))
}

export function updateZone(id: string, data: Partial<AlarmZone>): Promise<AlarmZone> {
  return api.put<unknown>(`/alarm/zones/${id}`, toApi(data)).then(r => fromApi<AlarmZone>(r))
}

export function deleteZone(id: string): Promise<void> {
  return api.delete<unknown>(`/alarm/zones/${id}`).then(() => undefined)
}

// ---------------------------------------------------------------------------
// Tests (Screens 1, 3, 5, 6)
// ---------------------------------------------------------------------------

export function listTests(params: {
  buildingId?: string
  month?: string
  status?: string
  testerId?: string
}): Promise<AlarmTest[]> {
  const qs = new URLSearchParams()
  if (params.buildingId) qs.set('building_id', params.buildingId)
  if (params.month) qs.set('month', params.month)
  if (params.status) qs.set('status', params.status)
  if (params.testerId) qs.set('tester_id', params.testerId)
  const q = qs.toString()
  return api.get<unknown[]>(`/alarm/tests${q ? '?' + q : ''}`).then(data => data.map(t => fromApi<AlarmTest>(t)))
}

export function getTest(
  id: string,
): Promise<{ test: AlarmTest; zones: AlarmTestZone[]; attachments: AlarmTestAttachment[] }> {
  return api.get<unknown>(`/alarm/tests/${id}`).then(r => {
    const d = r as Record<string, unknown>
    return {
      test: fromApi<AlarmTest>(d.test),
      zones: (d.zones as unknown[]).map(z => fromApi<AlarmTestZone>(z)),
      attachments: (d.attachments as unknown[]).map(a => fromApi<AlarmTestAttachment>(a)),
    }
  })
}

export function createTest(data: Partial<AlarmTest>): Promise<AlarmTest> {
  return api.post<unknown>('/alarm/tests', toApi(data)).then(r => fromApi<AlarmTest>(r))
}

export function updateTest(id: string, data: Partial<AlarmTest>): Promise<AlarmTest> {
  return api.put<unknown>(`/alarm/tests/${id}`, toApi(data)).then(r => fromApi<AlarmTest>(r))
}

export function saveTestZones(
  testId: string,
  results: Record<string, { result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'; notes: string }>,
): Promise<void> {
  return api.post<unknown>(`/alarm/tests/${testId}/zones`, { results }).then(() => undefined)
}

export function submitTest(id: string): Promise<AlarmTest> {
  return api.post<unknown>(`/alarm/tests/${id}/submit`, {}).then(r => fromApi<AlarmTest>(r))
}

export function approveTest(id: string): Promise<AlarmTest> {
  return api.post<unknown>(`/alarm/tests/${id}/approve`, { notes: '' }).then(r => fromApi<AlarmTest>(r))
}

export function rejectTest(id: string, reason: string): Promise<AlarmTest> {
  return api.post<unknown>(`/alarm/tests/${id}/reject`, { reason }).then(r => fromApi<AlarmTest>(r))
}

export function reopenTest(id: string): Promise<AlarmTest> {
  return api.post<unknown>(`/alarm/tests/${id}/reopen`, {}).then(r => fromApi<AlarmTest>(r))
}

// ---------------------------------------------------------------------------
// Attachments (Screen 2)
// ---------------------------------------------------------------------------

export function listAttachments(testId: string): Promise<AlarmTestAttachment[]> {
  return api.get<unknown[]>(`/alarm/tests/${testId}/attachments`).then(data => data.map(a => fromApi<AlarmTestAttachment>(a)))
}

export function uploadAttachment(testId: string, file: File): Promise<AlarmTestAttachment> {
  const BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? 'http://localhost:8006/v1'
  const formData = new FormData()
  formData.append('file', file)
  const token = getToken()
  return fetch(`${BASE_URL}/alarm/tests/${testId}/attachments`, {
    method: 'POST',
    headers: token ? { 'Authorization': `Bearer ${token}` } : {},
    body: formData,
  }).then(async res => {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).detail || 'Upload failed')
    return fromApi<AlarmTestAttachment>(await res.json())
  })
}

export function deleteAttachment(testId: string, attachmentId: string): Promise<void> {
  return api.delete<unknown>(`/alarm/tests/${testId}/attachments/${attachmentId}`).then(() => undefined)
}

// ---------------------------------------------------------------------------
// Dashboard (Screens 8-11)
// ---------------------------------------------------------------------------

export function getAlarmOverview(region?: string, month?: string): Promise<AlarmOverviewData> {
  const qs = new URLSearchParams()
  if (region) qs.set('region', region)
  if (month) qs.set('month', month)
  const q = qs.toString()
  return api.get<unknown>(`/alarm/dashboard/overview${q ? '?' + q : ''}`).then(r => fromApi<AlarmOverviewData>(r))
}

export function getOverdueBuildings(): Promise<OverdueBuilding[]> {
  return api.get<unknown[]>('/alarm/escalation/overdue').then(data => data.map(b => fromApi<OverdueBuilding>(b)))
}

export function getAlarmTrends(months = 12): Promise<AlarmTrendData> {
  return api.get<unknown>(`/alarm/dashboard/trends?months=${months}`).then(r => fromApi<AlarmTrendData>(r))
}

// ---------------------------------------------------------------------------
// Biannual (Screen 4)
// ---------------------------------------------------------------------------

export function listBiannualChecks(buildingId?: string): Promise<BiannualCheck[]> {
  const q = buildingId ? `?building_id=${buildingId}` : ''
  return api.get<unknown[]>(`/alarm/biannual${q}`).then(data => data.map(c => fromApi<BiannualCheck>(c)))
}

export function createBiannualCheck(data: Partial<BiannualCheck>): Promise<BiannualCheck> {
  return api.post<unknown>('/alarm/biannual', toApi(data)).then(r => fromApi<BiannualCheck>(r))
}

export function approveBiannualCheck(id: string): Promise<BiannualCheck> {
  return api.post<unknown>(`/alarm/biannual/${id}/approve`, { notes: '' }).then(r => fromApi<BiannualCheck>(r))
}

export function rejectBiannualCheck(id: string, reason: string): Promise<BiannualCheck> {
  return api.post<unknown>(`/alarm/biannual/${id}/reject`, { reason }).then(r => fromApi<BiannualCheck>(r))
}

export function getBiannualStatus(): Promise<BiannualStatusRow[]> {
  return api.get<unknown[]>('/alarm/biannual/status').then(data => data.map(r => fromApi<BiannualStatusRow>(r)))
}

// ---------------------------------------------------------------------------
// Compliance Rules (Screen 14)
// ---------------------------------------------------------------------------

export function getComplianceRules(): Promise<ComplianceRules> {
  return api.get<unknown>('/alarm/rules').then(r => fromApi<ComplianceRules>(r))
}

export function updateComplianceRules(data: ComplianceRules): Promise<ComplianceRules> {
  return api.put<unknown>('/alarm/rules', toApi(data)).then(r => fromApi<ComplianceRules>(r))
}

// ---------------------------------------------------------------------------
// Users / Access (Screen 15)
// ---------------------------------------------------------------------------

export function listAlarmUsers(): Promise<AlarmUser[]> {
  return api.get<unknown[]>('/alarm/users').then(data => data.map(u => fromApi<AlarmUser>(u)))
}

// ---------------------------------------------------------------------------
// Escalation (Screen 7) — send reminder
// ---------------------------------------------------------------------------

export function sendEscalationReminder(buildingId: string, tier: number): Promise<{ sent: boolean }> {
  return api.post<{ sent: boolean }>('/alarm/escalation/remind', { building_id: buildingId, tier })
}
