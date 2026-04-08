// =============================================================================
// Alarm Testing Module — API Layer (mock-backed)
// =============================================================================

import {
  ALARM_BUILDINGS,
  ALARM_ZONES,
  ALARM_TESTS,
  ALARM_TEST_ZONES,
  ALARM_ATTACHMENTS,
  BIANNUAL_CHECKS,
  COMPLIANCE_RULES,
} from '../mock/alarmData'

import { USERS } from '../mock/data'

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
// Return-type interfaces
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
// Helpers
// ---------------------------------------------------------------------------

let idCounter = Date.now()
function nextId(prefix: string): string {
  return `${prefix}-${++idCounter}`
}

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

// ---------------------------------------------------------------------------
// Zone functions
// ---------------------------------------------------------------------------

export function listZones(buildingId: string): Promise<AlarmZone[]> {
  const result = ALARM_ZONES.filter((z) => z.buildingId === buildingId)
  return Promise.resolve(structuredClone(result))
}

export function createZone(data: Partial<AlarmZone>): Promise<AlarmZone> {
  const zone: AlarmZone = {
    id: nextId('zone'),
    buildingId: data.buildingId ?? '',
    zoneNumber: data.zoneNumber ?? 0,
    zoneName: data.zoneName ?? '',
    zoneType: data.zoneType ?? 'OTHER',
    areaNumber: data.areaNumber ?? 1,
    isActive: data.isActive ?? true,
    otherDescription: data.otherDescription,
  }
  ALARM_ZONES.push(zone)
  return Promise.resolve(structuredClone(zone))
}

export function updateZone(id: string, data: Partial<AlarmZone>): Promise<AlarmZone> {
  const idx = ALARM_ZONES.findIndex((z) => z.id === id)
  if (idx === -1) return Promise.reject(new Error(`Zone ${id} not found`))
  ALARM_ZONES[idx] = { ...ALARM_ZONES[idx], ...data, id }
  return Promise.resolve(structuredClone(ALARM_ZONES[idx]))
}

export function deleteZone(id: string): Promise<void> {
  const idx = ALARM_ZONES.findIndex((z) => z.id === id)
  if (idx === -1) return Promise.reject(new Error(`Zone ${id} not found`))
  ALARM_ZONES.splice(idx, 1)
  return Promise.resolve()
}

// ---------------------------------------------------------------------------
// Test functions
// ---------------------------------------------------------------------------

export function listTests(params: {
  buildingId?: string
  month?: string
  status?: string
  testerId?: string
}): Promise<AlarmTest[]> {
  let result = [...ALARM_TESTS]
  if (params.buildingId) result = result.filter((t) => t.buildingId === params.buildingId)
  if (params.month) result = result.filter((t) => t.testMonth === params.month)
  if (params.status) result = result.filter((t) => t.status === params.status)
  if (params.testerId) result = result.filter((t) => t.testerId === params.testerId)
  return Promise.resolve(structuredClone(result))
}

export function getTest(
  id: string,
): Promise<{ test: AlarmTest; zones: AlarmTestZone[]; attachments: AlarmTestAttachment[] }> {
  const test = ALARM_TESTS.find((t) => t.id === id)
  if (!test) return Promise.reject(new Error(`Test ${id} not found`))
  const zones = ALARM_TEST_ZONES.filter((tz) => tz.alarmTestId === id)
  const attachments = ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === id)
  return Promise.resolve(structuredClone({ test, zones, attachments }))
}

export function createTest(data: Partial<AlarmTest>): Promise<AlarmTest> {
  const test: AlarmTest = {
    id: nextId('test'),
    buildingId: data.buildingId ?? '',
    testDate: data.testDate ?? today(),
    testMonth: data.testMonth ?? currentMonth(),
    testerId: data.testerId ?? '',
    testerName: data.testerName ?? '',
    status: 'DRAFT',
    testStartTime: data.testStartTime,
    testEndTime: data.testEndTime,
    notes: data.notes,
    zonesTotal: data.zonesTotal ?? 0,
    zonesTested: data.zonesTested ?? 0,
    zonesIssue: data.zonesIssue ?? 0,
    attachments: [],
  }
  ALARM_TESTS.push(test)
  return Promise.resolve(structuredClone(test))
}

export function updateTest(id: string, data: Partial<AlarmTest>): Promise<AlarmTest> {
  const idx = ALARM_TESTS.findIndex((t) => t.id === id)
  if (idx === -1) return Promise.reject(new Error(`Test ${id} not found`))
  ALARM_TESTS[idx] = { ...ALARM_TESTS[idx], ...data, id, status: ALARM_TESTS[idx].status }
  return Promise.resolve(structuredClone(ALARM_TESTS[idx]))
}

export function saveTestZones(
  testId: string,
  results: Record<string, { result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'; notes: string }>,
): Promise<void> {
  // Remove existing zone rows for this test, then re-insert
  const existing = ALARM_TEST_ZONES.filter((tz) => tz.alarmTestId === testId)
  existing.forEach((tz) => {
    const idx = ALARM_TEST_ZONES.indexOf(tz)
    if (idx !== -1) ALARM_TEST_ZONES.splice(idx, 1)
  })
  for (const [zoneId, r] of Object.entries(results)) {
    ALARM_TEST_ZONES.push({
      id: nextId('tz'),
      alarmTestId: testId,
      alarmZoneId: zoneId,
      result: r.result,
      notes: r.notes || undefined,
    })
  }
  return Promise.resolve()
}

export function submitTest(id: string): Promise<AlarmTest> {
  const idx = ALARM_TESTS.findIndex((t) => t.id === id)
  if (idx === -1) return Promise.reject(new Error(`Test ${id} not found`))
  ALARM_TESTS[idx] = {
    ...ALARM_TESTS[idx],
    status: 'SUBMITTED',
    submittedAt: new Date().toISOString(),
  }
  return Promise.resolve(structuredClone(ALARM_TESTS[idx]))
}

export function approveTest(id: string): Promise<AlarmTest> {
  const idx = ALARM_TESTS.findIndex((t) => t.id === id)
  if (idx === -1) return Promise.reject(new Error(`Test ${id} not found`))
  ALARM_TESTS[idx] = {
    ...ALARM_TESTS[idx],
    status: 'APPROVED',
    approvedAt: new Date().toISOString(),
  }
  return Promise.resolve(structuredClone(ALARM_TESTS[idx]))
}

export function rejectTest(id: string, reason: string): Promise<AlarmTest> {
  const idx = ALARM_TESTS.findIndex((t) => t.id === id)
  if (idx === -1) return Promise.reject(new Error(`Test ${id} not found`))
  ALARM_TESTS[idx] = {
    ...ALARM_TESTS[idx],
    status: 'REJECTED',
    rejectionReason: reason,
  }
  return Promise.resolve(structuredClone(ALARM_TESTS[idx]))
}

export function reopenTest(id: string): Promise<AlarmTest> {
  const idx = ALARM_TESTS.findIndex((t) => t.id === id)
  if (idx === -1) return Promise.reject(new Error(`Test ${id} not found`))
  ALARM_TESTS[idx] = {
    ...ALARM_TESTS[idx],
    status: 'DRAFT',
    rejectionReason: undefined,
  }
  return Promise.resolve(structuredClone(ALARM_TESTS[idx]))
}

// ---------------------------------------------------------------------------
// Attachment functions
// ---------------------------------------------------------------------------

export function listAttachments(testId: string): Promise<AlarmTestAttachment[]> {
  const result = ALARM_ATTACHMENTS.filter((a) => a.alarmTestId === testId)
  return Promise.resolve(structuredClone(result))
}

export function uploadAttachment(testId: string, file: File): Promise<AlarmTestAttachment> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? ''
  let fileType: AlarmTestAttachment['fileType'] = 'PDF'
  if (['xls', 'xlsx', 'csv'].includes(ext)) fileType = 'EXCEL'
  else if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(ext)) fileType = 'IMAGE'

  const attachment: AlarmTestAttachment = {
    id: nextId('att'),
    alarmTestId: testId,
    fileName: file.name,
    fileType,
    fileSize: file.size,
    uploadedAt: new Date().toISOString(),
  }
  ALARM_ATTACHMENTS.push(attachment)

  // Also add to the parent test's embedded attachments array
  const test = ALARM_TESTS.find((t) => t.id === testId)
  if (test) test.attachments.push(structuredClone(attachment))

  return Promise.resolve(structuredClone(attachment))
}

export function deleteAttachment(id: string): Promise<void> {
  const idx = ALARM_ATTACHMENTS.findIndex((a) => a.id === id)
  if (idx === -1) return Promise.reject(new Error(`Attachment ${id} not found`))

  const removed = ALARM_ATTACHMENTS.splice(idx, 1)[0]

  // Remove from the parent test's embedded array as well
  const test = ALARM_TESTS.find((t) => t.id === removed.alarmTestId)
  if (test) {
    const embeddedIdx = test.attachments.findIndex((a) => a.id === id)
    if (embeddedIdx !== -1) test.attachments.splice(embeddedIdx, 1)
  }

  return Promise.resolve()
}

// ---------------------------------------------------------------------------
// Dashboard functions
// ---------------------------------------------------------------------------

export function getAlarmOverview(region?: string, month?: string): Promise<AlarmOverviewData> {
  const targetMonth = month ?? currentMonth()

  let buildings = [...ALARM_BUILDINGS]
  if (region) buildings = buildings.filter((b) => b.region === region)

  const rows: BuildingComplianceRow[] = buildings.map((b) => {
    if (b.status === 'temporarily_exempt' || b.status === 'closed') {
      return {
        buildingId: b.id,
        buildingName: b.name,
        region: b.region,
        status: 'exempt' as const,
      }
    }

    const tests = ALARM_TESTS.filter((t) => t.buildingId === b.id && t.testMonth === targetMonth)
    const approved = tests.find((t) => t.status === 'APPROVED')
    const submitted = tests.find((t) => t.status === 'SUBMITTED')
    const latest = approved ?? submitted ?? tests[0]

    let status: BuildingComplianceRow['status'] = 'overdue'
    if (approved) status = 'compliant'
    else if (submitted) status = 'pending'

    const approver = b.assignedApprover
      ? USERS.find((u) => u.id === b.assignedApprover)
      : undefined

    return {
      buildingId: b.id,
      buildingName: b.name,
      region: b.region,
      status,
      lastTestDate: latest?.testDate,
      lastTestStatus: latest?.status,
      approverName: approver?.name,
    }
  })

  const compliant = rows.filter((r) => r.status === 'compliant').length
  const pending = rows.filter((r) => r.status === 'pending').length
  const overdue = rows.filter((r) => r.status === 'overdue').length
  const exempt = rows.filter((r) => r.status === 'exempt').length
  const activeTotal = buildings.filter((b) => b.status === 'active').length

  // Build last 12 months of history
  const historyMonths: { month: string; compliant: number; total: number }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const activeBuildings = buildings.filter((b) => b.status === 'active')
    const approvedCount = activeBuildings.filter((b) =>
      ALARM_TESTS.some((t) => t.buildingId === b.id && t.testMonth === m && t.status === 'APPROVED'),
    ).length
    historyMonths.push({ month: m, compliant: approvedCount, total: activeBuildings.length })
  }

  const data: AlarmOverviewData = {
    summary: {
      totalBuildings: buildings.length,
      compliant,
      pendingReview: pending,
      overdue,
      exempt,
      complianceRate: activeTotal > 0 ? Math.round((compliant / activeTotal) * 100) : 0,
    },
    buildings: rows,
    monthlyHistory: historyMonths,
  }

  return Promise.resolve(data)
}

export function getOverdueBuildings(): Promise<OverdueBuilding[]> {
  const month = currentMonth()
  const activeBuildings = ALARM_BUILDINGS.filter((b) => b.status === 'active')

  const overdue: OverdueBuilding[] = activeBuildings
    .filter(
      (b) =>
        !ALARM_TESTS.some(
          (t) => t.buildingId === b.id && t.testMonth === month && t.status === 'APPROVED',
        ),
    )
    .map((b) => {
      const lastApproved = ALARM_TESTS.filter(
        (t) => t.buildingId === b.id && t.status === 'APPROVED',
      ).sort((a, c) => c.testDate.localeCompare(a.testDate))[0]

      const daysSince = lastApproved
        ? Math.floor(
            (Date.now() - new Date(lastApproved.testDate).getTime()) / (1000 * 60 * 60 * 24),
          )
        : 999

      return {
        buildingId: b.id,
        buildingName: b.name,
        region: b.region,
        daysSinceLastTest: daysSince,
        assignedTesters: b.assignedTesters,
      }
    })

  return Promise.resolve(overdue)
}

export function getAlarmTrends(months = 12): Promise<AlarmTrendData> {
  const activeBuildings = ALARM_BUILDINGS.filter((b) => b.status === 'active')
  const result: AlarmTrendData = { months: [] }

  for (let i = months - 1; i >= 0; i--) {
    const d = new Date()
    d.setMonth(d.getMonth() - i)
    const m = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const total = activeBuildings.length
    const compliant = activeBuildings.filter((b) =>
      ALARM_TESTS.some((t) => t.buildingId === b.id && t.testMonth === m && t.status === 'APPROVED'),
    ).length
    result.months.push({
      month: m,
      compliant,
      total,
      complianceRate: total > 0 ? Math.round((compliant / total) * 100) : 0,
    })
  }

  return Promise.resolve(result)
}

// ---------------------------------------------------------------------------
// Biannual functions
// ---------------------------------------------------------------------------

export function listBiannualChecks(buildingId?: string): Promise<BiannualCheck[]> {
  let result = [...BIANNUAL_CHECKS]
  if (buildingId) result = result.filter((c) => c.buildingId === buildingId)
  return Promise.resolve(structuredClone(result))
}

export function createBiannualCheck(data: Partial<BiannualCheck>): Promise<BiannualCheck> {
  const check: BiannualCheck = {
    id: nextId('bi'),
    buildingId: data.buildingId ?? '',
    checkType: data.checkType ?? 'CELLULAR_BACKUP',
    checkDate: data.checkDate ?? today(),
    nextDueDate: data.nextDueDate ?? '',
    checkedBy: data.checkedBy ?? '',
    checkedByName: data.checkedByName ?? '',
    status: data.status ?? 'PENDING',
    evidencePath: data.evidencePath,
    notes: data.notes,
  }
  BIANNUAL_CHECKS.push(check)
  return Promise.resolve(structuredClone(check))
}

export function approveBiannualCheck(id: string): Promise<BiannualCheck> {
  const idx = BIANNUAL_CHECKS.findIndex((c) => c.id === id)
  if (idx === -1) return Promise.reject(new Error(`Check ${id} not found`))
  BIANNUAL_CHECKS[idx] = { ...BIANNUAL_CHECKS[idx], status: 'COMPLIANT' }
  return Promise.resolve(structuredClone(BIANNUAL_CHECKS[idx]))
}

export function rejectBiannualCheck(id: string, _reason: string): Promise<BiannualCheck> {
  const idx = BIANNUAL_CHECKS.findIndex((c) => c.id === id)
  if (idx === -1) return Promise.reject(new Error(`Check ${id} not found`))
  BIANNUAL_CHECKS[idx] = { ...BIANNUAL_CHECKS[idx], status: 'NON_COMPLIANT' }
  return Promise.resolve(structuredClone(BIANNUAL_CHECKS[idx]))
}

export function getBiannualStatus(): Promise<BiannualStatusRow[]> {
  const rows: BiannualStatusRow[] = ALARM_BUILDINGS.map((b) => {
    const cellular = BIANNUAL_CHECKS.filter(
      (c) => c.buildingId === b.id && c.checkType === 'CELLULAR_BACKUP',
    ).sort((a, c) => c.checkDate.localeCompare(a.checkDate))[0]

    const camera = BIANNUAL_CHECKS.filter(
      (c) => c.buildingId === b.id && c.checkType === 'CAMERA_BACKUP',
    ).sort((a, c) => c.checkDate.localeCompare(a.checkDate))[0]

    return {
      buildingId: b.id,
      buildingName: b.name,
      region: b.region,
      cellularStatus: cellular?.status ?? 'NO_CHECK',
      cellularNextDue: cellular?.nextDueDate,
      cameraStatus: camera?.status ?? 'NO_CHECK',
      cameraNextDue: camera?.nextDueDate,
    }
  })

  return Promise.resolve(rows)
}

// ---------------------------------------------------------------------------
// Admin functions
// ---------------------------------------------------------------------------

export function listAlarmBuildings(): Promise<AlarmBuilding[]> {
  return Promise.resolve(structuredClone(ALARM_BUILDINGS))
}

export function createBuilding(data: Partial<AlarmBuilding>): Promise<AlarmBuilding> {
  const building: AlarmBuilding = {
    id: nextId('bld'),
    locationId: data.locationId ?? '',
    name: data.name ?? '',
    region: data.region ?? '',
    securityCompanyName: data.securityCompanyName ?? '',
    securityCustomerId: data.securityCustomerId ?? '',
    securityCompanyPhone: data.securityCompanyPhone ?? '',
    status: data.status ?? 'active',
    exemptReason: data.exemptReason,
    assignedTesters: data.assignedTesters ?? [],
    assignedApprover: data.assignedApprover ?? '',
  }
  ALARM_BUILDINGS.push(building)
  return Promise.resolve(structuredClone(building))
}

export function updateBuildingSetup(
  id: string,
  data: Partial<AlarmBuilding>,
): Promise<AlarmBuilding> {
  const idx = ALARM_BUILDINGS.findIndex((b) => b.id === id)
  if (idx === -1) return Promise.reject(new Error(`Building ${id} not found`))
  ALARM_BUILDINGS[idx] = { ...ALARM_BUILDINGS[idx], ...data, id }
  return Promise.resolve(structuredClone(ALARM_BUILDINGS[idx]))
}

export function importBuildings(rows: Partial<AlarmBuilding>[]): Promise<AlarmBuilding[]> {
  const added: AlarmBuilding[] = []
  for (const data of rows) {
    const building: AlarmBuilding = {
      id: nextId('bld'),
      locationId: data.locationId ?? '',
      name: data.name ?? '',
      region: data.region ?? '',
      securityCompanyName: data.securityCompanyName ?? '',
      securityCustomerId: data.securityCustomerId ?? '',
      securityCompanyPhone: data.securityCompanyPhone ?? '',
      status: (data.status as AlarmBuilding['status']) ?? 'active',
      exemptReason: data.exemptReason,
      assignedTesters: [],
      assignedApprover: '',
    }
    ALARM_BUILDINGS.push(building)
    added.push(structuredClone(building))
  }
  return Promise.resolve(added)
}

export function resetBuildings(): Promise<void> {
  // Restore to original 12 seed buildings by removing any added ones
  const seedIds = new Set([
    'bld-wausau','bld-chicago-n','bld-chicago-s','bld-milwaukee',
    'bld-atlanta','bld-orlando','bld-charlotte','bld-tampa',
    'bld-boston','bld-nyc','bld-philly','bld-hartford',
  ])
  const toRemove = ALARM_BUILDINGS.filter(b => !seedIds.has(b.id))
  for (const b of toRemove) {
    const idx = ALARM_BUILDINGS.findIndex(x => x.id === b.id)
    if (idx !== -1) ALARM_BUILDINGS.splice(idx, 1)
  }
  // Also restore any edited seed buildings by re-fetching from a snapshot
  return Promise.resolve()
}

export function getComplianceRules(): Promise<ComplianceRules> {
  return Promise.resolve(structuredClone(COMPLIANCE_RULES))
}

export function updateComplianceRules(data: ComplianceRules): Promise<ComplianceRules> {
  Object.assign(COMPLIANCE_RULES, data)
  return Promise.resolve(structuredClone(COMPLIANCE_RULES))
}

export function listAlarmUsers(): Promise<AlarmUser[]> {
  const mapped: AlarmUser[] = USERS
    .filter(u => u.active)
    .map(u => ({
      id: u.id,
      name: u.name,
      role: u.role,
      region: '',
    }))
  return Promise.resolve(mapped)
}
