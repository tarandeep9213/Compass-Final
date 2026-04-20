// API response types — matches API_DOCS.md v1.0

// ── Enums ────────────────────────────────────────────────────────────────────

export type ApiRole =
  | 'OPERATOR'
  | 'CONTROLLER'
  | 'DGM'
  | 'ADMIN'
  | 'AUDITOR'
  | 'REGIONAL_CONTROLLER'

export type SubmissionStatus = 'draft' | 'pending_approval' | 'approved' | 'rejected'
export type SubmissionSource = 'FORM' | 'CHAT' | 'EXCEL'
export type VerificationStatus = 'scheduled' | 'completed' | 'missed' | 'cancelled'
export type VerificationType = 'CONTROLLER' | 'DGM'

export type MissedReason =
  | 'Illness'
  | 'Technical Issue'
  | 'Emergency'
  | 'Public Holiday'
  | 'Training'
  | 'Other'

export type DowWarningReason = 'operational' | 'requested' | 'followup' | 'other'

// ── Pagination ───────────────────────────────────────────────────────────────

export interface Paginated<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: string
  name: string
  email: string
  role: ApiRole
  location_ids: string[]
  access_grants: ('operator' | 'controller')[]
  active: boolean
}

export interface LoginResponse {
  access_token: string
  refresh_token: string
  token_type: 'bearer'
  expires_in: number
  user: AuthUser
}

// ── Locations ────────────────────────────────────────────────────────────────

export interface ApiLocation {
  id: string
  name: string
  cost_center: string | null
  city: string
  expected_cash: number
  tolerance_pct: number
  effective_tolerance_pct: number
  sla_hours: number
  active: boolean
  has_override: boolean
  created_at: string
  updated_at: string
}

// ── Submissions ───────────────────────────────────────────────────────────────

export interface SectionDetail {
  total: number
  denominations: Record<string, number | { rows: Array<{ qty: number; amount: number }> }>
}

export interface ApiSubmission {
  id: string
  location_id: string
  location_name: string
  operator_id: string
  operator_name: string
  submission_date: string
  status: SubmissionStatus
  source: SubmissionSource
  total_cash: number
  expected_cash: number
  variance: number
  variance_pct: number
  variance_exception: boolean
  variance_note: string | null
  approved_by: string | null
  approved_by_name: string | null
  approved_at: string | null
  rejection_reason: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export interface ApiSubmissionDetail extends ApiSubmission {
  sections: Record<string, SectionDetail>
}

export interface CreateSubmissionBody {
  location_id: string
  submission_date: string
  source: SubmissionSource
  sections: Record<string, unknown>
  variance_note: string | null
  save_as_draft: boolean
}

export interface ApproveBody {
  notes?: string
}

export interface RejectBody {
  reason: string
}

export interface ApproveResponse {
  id: string
  status: SubmissionStatus
  approved_by: string
  approved_by_name: string
  approved_at: string
}

// ── Missed Submissions ────────────────────────────────────────────────────────

export interface MissedSubmission {
  id: string
  location_id: string
  missed_date: string
  reason: MissedReason
  detail: string
  supervisor_name: string
  logged_at: string
}

export interface CreateMissedBody {
  location_id: string
  missed_date: string
  reason: MissedReason
  detail: string
  supervisor_name: string
}

// ── Verifications ─────────────────────────────────────────────────────────────

export interface ApiVerification {
  id: string
  location_id: string
  location_name: string
  verifier_id: string
  verifier_name: string
  verification_type: VerificationType
  status: VerificationStatus
  verification_date: string
  scheduled_time: string | null
  day_of_week: number
  day_name: string
  warning_flag: boolean
  warning_reason: DowWarningReason | null
  observed_total: number | null
  variance_vs_imprest: number | null
  variance_pct: number | null
  notes: string
  missed_reason: string | null
  month_year: string | null
  signature_data?: string | null
  created_at: string
  updated_at: string
}

export interface DowCheckResponse {
  warning: boolean
  day_name?: string
  match_count?: number
  previous_dates?: string[]
  lookback_weeks?: number
}

export interface ScheduleControllerBody {
  location_id: string
  date: string
  scheduled_time: '09:00' | '11:00' | '13:00' | '15:00' | '17:00'
  dow_warning_acknowledged: boolean
  dow_warning_reason: DowWarningReason | null
  notes?: string | null
}

export interface CompleteVerificationBody {
  observed_total?: number
  signature_data: string
  notes?: string
  dow_warning_reason?: DowWarningReason | null
}

export interface MissVerificationBody {
  missed_reason: string
  notes?: string
}

export interface ScheduleDgmBody {
  location_id: string
  date: string
  notes?: string | null
}

// ── Users ─────────────────────────────────────────────────────────────────────

export interface ApiUser {
  id: string
  name: string
  email: string
  role: ApiRole
  location_ids: string[]
  location_names: string[]
  active: boolean
  created_at: string
}

export interface CreateUserBody {
  name: string
  email: string
  password: string
  role: ApiRole
  location_ids?: string[]
}

export interface UpdateUserBody {
  name?: string
  email?: string
  password?: string | null
  role?: ApiRole
  location_ids?: string[]
}

// ── Access Grants ─────────────────────────────────────────────────────────────

export interface ApiAccessGrant {
  id: string
  user_id: string
  user_name: string
  user_email: string
  user_role: ApiRole
  access_type: 'operator' | 'controller'
  note: string
  granted_by: string
  granted_by_name: string
  granted_at: string
}

// ── Config ────────────────────────────────────────────────────────────────────

export interface GlobalConfig {
  default_tolerance_pct: number
  approval_sla_hours: number
  dow_lookback_weeks: 4 | 6
  daily_reminder_time: string
  data_retention_years: number
}

export interface LocationOverride {
  location_id: string
  location_name: string
  tolerance_pct: number
  updated_at: string
}

export interface AdminConfig {
  global: GlobalConfig
  location_overrides: LocationOverride[]
}

// ── Roster Import ─────────────────────────────────────────────────────────────

export interface ImportRow {
  location_code: string
  location_name: string
  district?: string
  cashroom_lead?: string
  cashroom_lead_email?: string
  daily_reviewer?: string
  controller?: string
  controller_email?: string
  dgm?: string
  dgm_email?: string
  regional_controller?: string
  regional_controller_email?: string
  division_contacts?: string
  division_contacts_email?: string
}

export interface ImportResponse {
  locations_created: number
  locations_updated: number
  users_created: number
  users_updated: number
  assignments_created: number
  skipped_duplicates: number
  warnings: string[]
}

// ── Compliance Dashboard ──────────────────────────────────────────────────────

export interface LocationCompliance {
  id: string
  name: string
  health: 'green' | 'amber' | 'red'
  submission: {
    status: SubmissionStatus
    total_cash: number
    variance: number
    variance_pct: number
    submitted_at: string
  } | null
  submission_rate_30d: number
  controller_visit: {
    last_date: string | null
    days_since: number | null
    warning_flag: boolean
    next_scheduled_date: string | null
  }
  dgm_visit: {
    status: VerificationStatus | null
    visit_date: string | null
    observed_total: number | null
  }
}

export interface ComplianceDashboard {
  generated_at: string
  summary: {
    overall_compliance_pct: number
    submitted_today: number
    total_locations: number
    overdue_count: number
    variance_exceptions_today: number
    controller_issues: number
    dgm_coverage_this_month: number
  }
  locations: LocationCompliance[]
}

// ── Reports ───────────────────────────────────────────────────────────────────

export interface ReportSummary {
  date_from: string
  date_to: string
  total_submissions: number
  approved: number
  rejected: number
  pending: number
  approval_rate_pct: number
  variance_exceptions: number
  avg_variance_pct: number
  controller_verifications: number
  dgm_visits: number
}

export interface SectionTrendPoint {
  period: string
  avg_total: number
}

export interface SectionTrends {
  section: string
  granularity: string
  location_id: string | null
  data: SectionTrendPoint[]
  summary: {
    latest_value: number
    previous_value: number
    change_pct: number
    period_avg: number
    peak: number
  }
}

// ── Audit Trail ───────────────────────────────────────────────────────────────

export interface ApiAuditEvent {
  id: string
  event_type: string
  actor_id: string
  actor_name: string
  actor_role: ApiRole
  location_id: string | null
  location_name: string | null
  entity_id: string | null
  entity_type: string | null
  detail: string
  old_value: string | null
  new_value: string | null
  ip_address: string | null
  created_at: string
}

export interface AuditFilterOptions {
  actors: { id: string; name: string }[]
  locations: { id: string; name: string }[]
}

// ── Compliance Trend ──────────────────────────────────────────────────────────

export interface ComplianceTrendPoint {
  period: string
  start: string
  end: string
  submission_rate_pct: number
  approval_rate_pct: number
  exception_count: number
  dgm_coverage_pct: number
  total_submissions: number
  locations_submitted: number
  total_locations: number
}

export interface ComplianceTrend {
  granularity: string
  periods: number
  data: ComplianceTrendPoint[]
}

// ── SLA Summary ───────────────────────────────────────────────────────────────

export interface SlaApprover {
  name: string
  count: number
  within_sla: number
  avg_hours: number
}

export interface SlaSummary {
  sla_compliance_pct: number | null
  approvers: SlaApprover[]
}

// ── Alarm Testing ────────────────────────────────────────────────────────────

export type AlarmZoneType =
  | 'ENTRY_EXIT'
  | 'INTERIOR_MOTION'
  | 'PANIC_SILENT'
  | 'HOLDUP'
  | 'FIRE_SMOKE'
  | 'OTHER'

export type AlarmTestStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

export type AlarmTestZoneResult = 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'

export type AlarmBuildingStatus = 'active' | 'temporarily_exempt' | 'closed'

export type AlarmAttachmentFileType = 'PDF' | 'EXCEL' | 'IMAGE'

export type BiannualCheckType = 'CELLULAR_BACKUP' | 'CAMERA_BACKUP'

export type BiannualCheckStatus = 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING'

export type BiannualStatusValue = 'COMPLIANT' | 'NON_COMPLIANT' | 'PENDING' | 'NO_CHECK'

export interface AlarmUser {
  id: string
  name: string
  role: string
  region: string
}

export interface AlarmBuilding {
  id: string
  locationId: string
  name: string
  region: string
  securityCompanyName: string
  securityCustomerId: string
  securityCompanyPhone: string
  status: AlarmBuildingStatus
  exemptReason?: string
  assignedTesters: string[]
  assignedApprover: string
}

export interface AlarmZone {
  id: string
  buildingId: string
  zoneNumber: number
  zoneName: string
  zoneType: AlarmZoneType
  areaNumber: number
  isActive: boolean
  otherDescription?: string
}

export interface AlarmTestAttachment {
  id: string
  alarmTestId: string
  fileName: string
  fileType: AlarmAttachmentFileType
  fileSize: number
  uploadedAt: string
}

export interface AlarmTest {
  id: string
  buildingId: string
  testDate: string
  testMonth: string
  testerId: string
  testerName: string
  status: AlarmTestStatus
  submittedAt?: string
  approvedBy?: string
  approvedByName?: string
  approvedAt?: string
  rejectionReason?: string
  testStartTime?: string
  testEndTime?: string
  notes?: string
  zonesTotal: number
  zonesTested: number
  zonesIssue: number
  attachments: AlarmTestAttachment[]
}

export interface AlarmTestZone {
  id: string
  alarmTestId: string
  alarmZoneId: string
  result: AlarmTestZoneResult
  alarmTriggeredAt?: string
  alarmRestoredAt?: string
  notes?: string
}

export interface BiannualCheck {
  id: string
  buildingId: string
  checkType: BiannualCheckType
  checkDate: string
  nextDueDate: string
  checkedBy: string
  checkedByName: string
  status: BiannualCheckStatus
  evidencePath?: string
  notes?: string
}

export interface ComplianceRules {
  monthlyDeadlineDay: number
  approvalSlaDays: number
  requireAllZonesTested: boolean
  requireReportUpload: boolean
  requireApproverSignoff: boolean
  escalation: {
    tier1: { daysBefore: number; recipients: string[] }
    tier2: { daysAfter: number; recipients: string[] }
    tier3: { daysAfter: number; recipients: string[] }
  }
  biannual: {
    cellularFrequencyMonths: number
    cameraCheckFrequencyDays: number
    reminderDaysBefore: number
  }
}

// ── Alarm Dashboard / API Return Types ───────────────────────────────────────

export interface BuildingComplianceRow {
  buildingId: string
  buildingName: string
  region: string
  status: 'compliant' | 'pending' | 'overdue' | 'exempt'
  lastTestDate?: string
  lastTestStatus?: string
  approverName?: string
}

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
  cellularStatus: BiannualStatusValue
  cellularNextDue?: string
  cameraStatus: BiannualStatusValue
  cameraNextDue?: string
}
