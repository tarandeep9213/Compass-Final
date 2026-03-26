/**
 * POC mock data for the Business Dashboard screen.
 * All values are illustrative — swap this import for real API calls when going live.
 */

export interface TipContent {
  what: string
  how: string
  formula?: string
  flag?: string
}

// ── Alert Banner ─────────────────────────────────────────────────────────────

export const ALERTS = [
  { type: 'red',   message: '2 submissions breached 48h SLA', details: ['ELGIN — Burnham Ave (52h, no reviewer)', 'OMAHA — Westroads Mall (pending since yesterday)'] },
  { type: 'amber', message: '3 locations have not submitted today', details: ['OMAHA — Westroads Mall', 'AURORA — Fox Valley Mall', 'ELGIN — Burnham Ave'] },
  { type: 'amber', message: '1 location is rated HIGH risk', details: ['OMAHA — Westroads Mall (score 75)'] },
]

// ── Core KPI Cards ───────────────────────────────────────────────────────────

export interface KpiDelta {
  label: string
  value: string
  raw: number
  delta: number        // positive = improvement
  deltaLabel: string
  unit: 'pct' | 'gbp' | 'count'
  redBelow?: number
  amberBelow?: number
  tooltip: TipContent
}

export const CORE_KPIS: KpiDelta[] = [
  {
    label: 'Compliance Rate',
    value: '78%',
    raw: 78,
    delta: 3,
    deltaLabel: 'vs last month',
    unit: 'pct',
    redBelow: 70,
    amberBelow: 80,
    tooltip: {
      what: 'Percentage of active locations that submitted a cash count AND had it approved within the selected period.',
      how: 'Divides the number of locations with at least one approved submission by total active locations, then multiplies by 100.',
      formula: '(Locations with approved submission ÷ Total active locations) × 100',
      flag: 'Green ≥ 80% · Amber 70–79% · Red < 70%. A drop here usually means either submission or approval is breaking down.',
    },
  },
  {
    label: 'Approval Rate',
    value: '91%',
    raw: 91,
    delta: -2,
    deltaLabel: 'vs last month',
    unit: 'pct',
    redBelow: 80,
    amberBelow: 85,
    tooltip: {
      what: 'Percentage of submitted cash counts that were approved by a manager (vs rejected).',
      how: 'Counts approved submissions and divides by total non-draft submissions in the period.',
      formula: '(Approved submissions ÷ Total submitted) × 100',
      flag: 'A low approval rate signals accuracy problems at the operator level — operators are submitting incorrect counts. Target ≥ 85%.',
    },
  },
  {
    label: 'Cash at Risk',
    value: '$4,230',
    raw: 4230,
    delta: -800,
    deltaLabel: 'vs last month',
    unit: 'gbp',
    tooltip: {
      what: 'Total dollar variance across all submissions that exceeded the 5% tolerance threshold — the financial exposure from unexplained cash discrepancies.',
      how: 'Sums the absolute variance dollar amount (actual cash minus imprest balance) for every submission flagged as a variance exception.',
      formula: 'Σ |actual cash − imprest balance| for all variance exception submissions',
      flag: 'This is the number to report to finance. A rising trend here indicates systemic cash handling issues, not one-off errors.',
    },
  },
  {
    label: 'Variance Exceptions',
    value: '7',
    raw: 7,
    delta: -2,
    deltaLabel: 'vs last month',
    unit: 'count',
    tooltip: {
      what: 'Number of submissions where the cash count deviated from the imprest balance by more than 5% — the tolerance threshold.',
      how: 'Each submission\'s variance % is calculated as |actual − imprest| ÷ imprest × 100. Any result above 5% is counted as an exception.',
      formula: 'COUNT(submissions where |actual − imprest| ÷ imprest > 5%)',
      flag: 'Operators must provide a written explanation for every exception. Repeat exceptions at the same location indicate a training or process gap.',
    },
  },
]

// ── Coverage This Month ───────────────────────────────────────────────────────

export const COVERAGE = {
  totalLocations: 20,
  controllerVisits: { done: 14, pct: 70 },
  dgmVisits:        { done: 8,  pct: 40 },
  pendingQueue: {
    under24h: 2,
    between24and48h: 1,
    over48h: 1,           // SLA breach
  },
}

// ── Compliance Trend (8 weeks) ────────────────────────────────────────────────

export interface TrendPoint {
  week: string
  submissionRate: number
  approvalRate: number
  exceptions: number
}

export const TREND_DATA: TrendPoint[] = [
  { week: 'W8',  submissionRate: 72, approvalRate: 88, exceptions: 9  },
  { week: 'W9',  submissionRate: 68, approvalRate: 85, exceptions: 11 },
  { week: 'W10', submissionRate: 75, approvalRate: 87, exceptions: 8  },
  { week: 'W11', submissionRate: 80, approvalRate: 90, exceptions: 6  },
  { week: 'W12', submissionRate: 76, approvalRate: 91, exceptions: 7  },
  { week: 'W13', submissionRate: 74, approvalRate: 89, exceptions: 8  },
  { week: 'W14', submissionRate: 78, approvalRate: 91, exceptions: 7  },
  { week: 'W15', submissionRate: 81, approvalRate: 93, exceptions: 5  },
]

// ── At-Risk Locations ─────────────────────────────────────────────────────────

export interface AtRiskLocation {
  rank: number
  name: string
  score: number
  health: 'red' | 'amber'
  flags: string[]
}

export const AT_RISK_LOCATIONS: AtRiskLocation[] = [
  {
    rank: 1,
    name: 'OMAHA — Westroads Mall',
    score: 75,
    health: 'red',
    flags: ['No submission today', 'SLA breach', 'Variance >5%'],
  },
  {
    rank: 2,
    name: 'BELVIDERE — Factory Outlet',
    score: 60,
    health: 'red',
    flags: ['Rejected submission', 'No controller visit'],
  },
  {
    rank: 3,
    name: 'APPLETON — Fox River Mall',
    score: 45,
    health: 'amber',
    flags: ['No DGM visit this month', 'Variance >5%'],
  },
  {
    rank: 4,
    name: 'ROCKFORD — CherryVale',
    score: 40,
    health: 'amber',
    flags: ['Controller overdue >14 days'],
  },
  {
    rank: 5,
    name: 'AURORA — Fox Valley Mall',
    score: 35,
    health: 'amber',
    flags: ['No submission today'],
  },
]

// ── Operator Behaviour ────────────────────────────────────────────────────────

export const OPERATOR_BEHAVIOUR = {
  avgHoursToSubmit: 2.4,
  lateSubmitters: 3,          // submit after 18:00 or next day
  platformSplit: {
    form: 72,
    excel: 28,
  },
  draftUsageRate: 34,         // % of submissions that were started as drafts
}

// ── Rejection & Resubmission Patterns ────────────────────────────────────────

export const REJECTION_SUMMARY = {
  avgRejectionsBeforeApproval: 1.2,
  repeatRejecters: 2,
}

export interface RejectedOperator {
  name: string
  location: string
  rejections: number
  topReason: string
}

export const MOST_REJECTED_OPERATORS: RejectedOperator[] = [
  { name: 'Laura Diehl',    location: 'OMAHA',     rejections: 4, topReason: 'Variance unexplained' },
  { name: 'Mike Torres',    location: 'BELVIDERE', rejections: 3, topReason: 'Wrong section total'  },
  { name: 'Justin Weaver',  location: 'APPLETON',  rejections: 2, topReason: 'Missing variance note' },
]

export const REJECTION_REASONS = [
  { reason: 'Variance unexplained', count: 9,  pct: 45 },
  { reason: 'Wrong section total',  count: 6,  pct: 30 },
  { reason: 'Missing variance note',count: 3,  pct: 15 },
  { reason: 'Other',                count: 2,  pct: 10 },
]

// ── Slowest Approvers ─────────────────────────────────────────────────────────

export interface SlowApprover {
  name: string
  avgHours: number
  slaBreaches: number
  reviewed: number
}

export const SLOWEST_APPROVERS: SlowApprover[] = [
  { name: 'John Smith',   avgHours: 38, slaBreaches: 2, reviewed: 18 },
  { name: 'Sarah Lee',    avgHours: 31, slaBreaches: 1, reviewed: 22 },
  { name: 'David Patel',  avgHours: 19, slaBreaches: 0, reviewed: 15 },
  { name: 'Emma Clarke',  avgHours: 11, slaBreaches: 0, reviewed: 20 },
]

// ── Section Tooltips ──────────────────────────────────────────────────────────

export const TIPS: Record<string, TipContent> = {
  controllerVisits: {
    what: 'Number of locations that have received at least one completed controller verification visit so far this calendar month.',
    how: 'Counts distinct locations with a completed controller verification where the date falls within the current month.',
    formula: 'COUNT(distinct locations with completed controller visit this month) ÷ total active locations',
    flag: 'Controllers must visit every location at least once per month. Below 70% by mid-month is a warning sign.',
  },
  dgmVisits: {
    what: 'Number of locations that have received a completed DGM physical visit this calendar month.',
    how: 'Counts distinct locations with a completed DGM verification within the current month. Only one DGM visit per location per month is required.',
    formula: 'COUNT(distinct locations with completed DGM visit this month) ÷ total active locations',
    flag: 'DGM coverage is a compliance requirement. Locations without a DGM visit by month-end will be flagged in the audit trail.',
  },
  pendingQueue: {
    what: 'Submissions currently awaiting manager approval, segmented by how long they have been waiting.',
    how: 'Filters all submissions with status "pending_approval" and calculates hours since submitted_at. Grouped into < 24h (normal), 24–48h (approaching SLA), > 48h (SLA breach).',
    formula: 'NOW() − submitted_at in hours, grouped by threshold',
    flag: 'Any submission in the "> 48h" bucket has already breached the SLA. The responsible manager should be contacted immediately.',
  },
  atRisk: {
    what: 'The five locations with the highest composite risk score, calculated from multiple compliance signals.',
    how: 'Each location is scored: No submission today (+30), SLA breach (+25), Rejected submission (+20), No controller visit (+15), Variance >5% (+15), Controller overdue >14 days (+10), No DGM visit this month (+10). Top 5 shown.',
    formula: 'Risk score = sum of applicable signal weights. Max possible score = 125.',
    flag: 'Red = score ≥ 50 (HIGH risk). Amber = score 20–49 (MEDIUM risk). A location scoring above 50 should be escalated.',
  },
  avgTimeToSubmit: {
    what: 'The average number of hours between shift start (09:00) and the time an operator submits their cash count.',
    how: 'Calculates (submitted_at − 09:00 on submission_date) in hours for all submissions in the period, then averages.',
    formula: 'AVG(submitted_at − 09:00 on submission_date) across all submissions',
    flag: 'A high average (> 4h) suggests operators are submitting at the end of the day or the following morning — a process discipline issue.',
  },
  lateSubmitters: {
    what: 'Count of operators who regularly submit after 18:00 or submit for a prior date (next-day submission).',
    how: 'Flags any submission where submitted_at is after 18:00 on the submission date, or where submitted_at date differs from submission_date.',
    flag: 'Late submissions increase the risk of discrepancies going undetected overnight. Supervisors should enforce same-day submission.',
  },
  draftUsage: {
    what: 'Percentage of submissions that were first saved as a draft before being finalised and submitted.',
    how: 'Counts submissions that passed through "draft" status before reaching "pending_approval", divided by total submissions.',
    formula: 'COUNT(submissions with draft history) ÷ total submissions × 100',
    flag: 'A high draft rate (> 40%) may indicate operators are interrupted mid-count or are uncertain about entries — consider additional training.',
  },
  platformUsage: {
    what: 'Breakdown of which submission method operators are using: the online FORM or an EXCEL upload.',
    how: 'Groups submissions by their "source" field (FORM or EXCEL) and calculates the percentage split.',
    formula: 'COUNT(submissions by source) ÷ total submissions × 100',
    flag: 'If EXCEL usage is unexpectedly high, operators may be working around the online form. Investigate whether the form is meeting their workflow needs.',
  },
  rejectedOperators: {
    what: 'Operators with the most rejected submissions in the current period, along with the most common reason for their rejections.',
    how: 'Groups rejected submissions by operator name, counts rejections per operator, and extracts the most frequent rejection_reason text.',
    flag: 'Repeat rejections from the same operator usually indicate a training gap. Two or more rejections in a period warrants a one-to-one review.',
  },
  rejectionReasons: {
    what: 'The most common reasons managers cited when rejecting a submission, ranked by frequency.',
    how: 'Extracts the rejection_reason field from all rejected submissions and groups by reason text. Shows top 4 categories.',
    flag: '"Variance unexplained" is the most actionable — it means the operator submitted an out-of-tolerance count without providing the required written explanation.',
  },
  slowestApprovers: {
    what: 'Managers ranked by their average time from submission receipt to approval or rejection, slowest first.',
    how: 'Calculates (approved_at − submitted_at) in hours for each reviewed submission, grouped by approver. Sorted descending by average hours.',
    formula: 'AVG(approved_at − submitted_at) per manager, for all reviewed submissions in the period',
    flag: 'The 48h SLA applies to every submission. Managers consistently above 24h should be coached; above 48h means they are causing SLA breaches for operators.',
  },
  controllerActivity: {
    what: 'Per-controller breakdown of verification visits this period — completed, missed, and still scheduled.',
    how: 'Groups verifications by verifier_id (controller type only). Counts by status: completed, missed, scheduled. Calculates completion rate and avg variance found during completed visits.',
    formula: 'Completion rate = completed ÷ (completed + missed) × 100',
    flag: 'A controller with missed visits and no explanation is a compliance risk. A controller who never flags variance during visits may not be conducting them properly.',
  },
  dowRotation: {
    what: 'Whether a controller is visiting the same location on the same day of the week repeatedly — a pattern the system flags as a risk.',
    how: 'Checks the last 4–6 visits per controller per location. If 2 or more fall on the same weekday, the system raises a DOW warning.',
    flag: 'Predictable visit days make it easier for staff to "prepare" for inspections. Controllers should rotate visit days to maintain the integrity of verification.',
  },
  dgmCoverage: {
    what: 'DGM visit completion this calendar month — which DGMs have completed their rounds and which locations are still waiting.',
    how: 'Groups completed DGM verifications by verifier. Compares against the list of active locations assigned to each DGM.',
    formula: 'Coverage % = locations visited ÷ locations assigned × 100',
    flag: 'Every active location must receive a DGM visit each calendar month. Locations without a visit by the 25th of the month should be escalated immediately.',
  },
  dgmFindings: {
    what: 'The variance between the cash observed by the DGM during a physical visit and the imprest balance — a measure of whether DGM visits are catching real discrepancies.',
    how: 'For each completed DGM visit, calculates |observed_total − imprest_balance|. Averages across all completed visits this period.',
    flag: 'A DGM who consistently records zero variance may not be performing a genuine count. Some variance is normal — zero variance across all visits is a quality signal to investigate.',
  },
  healthRed: {
    what: 'NON-COMPLIANT — This location has one or more critical compliance failures that require immediate attention.',
    how: 'A location is marked RED (Non-Compliant) when ANY of these conditions are true:\n• No submission today\n• Submission rejected\n• Manager approval overdue beyond 48h SLA\n• Variance exception (>5%) with no written explanation',
    flag: 'Red locations need same-day escalation. Contact the location supervisor, the responsible manager, and the assigned controller. Do not wait for the next review cycle.',
  },
  healthAmber: {
    what: 'AT RISK — This location is functional but has compliance gaps that could worsen if not addressed.',
    how: 'A location is marked AMBER (At Risk) when it is not RED but has one or more of these:\n• Submission pending approval (not yet breached SLA)\n• No controller visit this month\n• Controller overdue >14 days\n• No DGM visit this month\n• DOW rotation warning on controller visits',
    flag: 'Amber locations should be followed up within 48 hours. They are not in crisis, but left unattended they will likely turn red.',
  },
  healthGreen: {
    what: 'COMPLIANT — This location has submitted today, the submission was approved, and all verification visits are up to date.',
    how: 'A location is GREEN (Compliant) when ALL of these are true:\n• Today\'s submission exists and is approved\n• Manager approved within 48h SLA\n• Controller visit within the last 14 days\n• DGM visit completed this month',
    flag: 'No action needed. Green locations are operating as designed. The goal is to maximise the number of green locations across the region.',
  },
}

// ── Controller Activity ───────────────────────────────────────────────────────

export interface ControllerRow {
  name: string
  completed: number
  missed: number
  scheduled: number
  completionRate: number
  avgVarianceFound: number   // avg $ variance observed during completed visits
  dowWarnings: number        // visits flagged for same-weekday pattern
}

export const CONTROLLER_ACTIVITY: ControllerRow[] = [
  { name: 'Marcus Webb',    completed: 8,  missed: 0, scheduled: 2, completionRate: 100, avgVarianceFound: 42,  dowWarnings: 0 },
  { name: 'Priya Sharma',   completed: 6,  missed: 1, scheduled: 3, completionRate: 86,  avgVarianceFound: 118, dowWarnings: 1 },
  { name: 'Tom Gallagher',  completed: 5,  missed: 2, scheduled: 3, completionRate: 71,  avgVarianceFound: 67,  dowWarnings: 2 },
  { name: 'Dana Kowalski',  completed: 4,  missed: 0, scheduled: 4, completionRate: 100, avgVarianceFound: 29,  dowWarnings: 0 },
]

// ── DGM Coverage ──────────────────────────────────────────────────────────────

export interface DgmRow {
  name: string
  locationsAssigned: number
  locationsVisited: number
  coveragePct: number
  avgVarianceFound: number
  pendingLocations: string[]
}

export const DGM_ROWS: DgmRow[] = [
  {
    name: 'Rachel Okonkwo',
    locationsAssigned: 8,
    locationsVisited: 7,
    coveragePct: 88,
    avgVarianceFound: 95,
    pendingLocations: ['AURORA — Fox Valley Mall'],
  },
  {
    name: 'James Tillman',
    locationsAssigned: 7,
    locationsVisited: 4,
    coveragePct: 57,
    avgVarianceFound: 210,
    pendingLocations: ['ROCKFORD — CherryVale', 'BELVIDERE — Factory Outlet', 'ELGIN — Burnham Ave'],
  },
  {
    name: 'Sunita Patel',
    locationsAssigned: 5,
    locationsVisited: 5,
    coveragePct: 100,
    avgVarianceFound: 44,
    pendingLocations: [],
  },
]

export const DGM_PENDING_LOCATIONS = [
  { name: 'AURORA — Fox Valley Mall',       dgm: 'Rachel Okonkwo', daysLeft: 6 },
  { name: 'ROCKFORD — CherryVale',          dgm: 'James Tillman',  daysLeft: 6 },
  { name: 'BELVIDERE — Factory Outlet',     dgm: 'James Tillman',  daysLeft: 6 },
  { name: 'ELGIN — Burnham Ave',            dgm: 'James Tillman',  daysLeft: 6 },
]

// ── Location Compliance Table (Layer 3) ───────────────────────────────────────

export type LocHealth = 'green' | 'amber' | 'red'
export type SubStatus = 'approved' | 'rejected' | 'pending' | 'overdue' | 'none'

export interface LocationComplianceRow {
  id: string
  name: string
  health: LocHealth
  // Submission
  subStatus: SubStatus
  subOperator: string | null
  subCash: number | null
  subVariancePct: number | null
  subVarianceException: boolean
  // Manager approval
  approvedBy: string | null         // manager who approved/rejected, null if pending/none
  approvedHoursAgo: number | null   // hours since submitted_at → approved_at, null if not yet reviewed
  // Controller
  ctrlLastDays: number | null       // days since last visit, null = never
  ctrlNextDate: string | null       // next scheduled, null = none
  ctrlMissed: number
  ctrlDowWarning: boolean
  // DGM
  dgmVisitDate: string | null       // null = no visit this month
  dgmObservedVariance: number | null
}

export const LOCATION_COMPLIANCE: LocationComplianceRow[] = [
  {
    id: 'LOC-001', name: 'OMAHA — Westroads Mall', health: 'red',
    subStatus: 'none', subOperator: null, subCash: null, subVariancePct: null, subVarianceException: false,
    approvedBy: null, approvedHoursAgo: null,
    ctrlLastDays: 18, ctrlNextDate: null, ctrlMissed: 1, ctrlDowWarning: false,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-002', name: 'BELVIDERE — Factory Outlet', health: 'red',
    subStatus: 'rejected', subOperator: 'Mike Torres', subCash: 9210, subVariancePct: -3.81, subVarianceException: false,
    approvedBy: 'John Smith', approvedHoursAgo: 6,
    ctrlLastDays: null, ctrlNextDate: '2026-03-28', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-003', name: 'APPLETON — Fox River Mall', health: 'amber',
    subStatus: 'approved', subOperator: 'Laura Diehl', subCash: 10080, subVariancePct: 5.27, subVarianceException: true,
    approvedBy: 'Emma Clarke', approvedHoursAgo: 4,
    ctrlLastDays: 16, ctrlNextDate: '2026-03-26', ctrlMissed: 0, ctrlDowWarning: true,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-004', name: 'ROCKFORD — CherryVale', health: 'amber',
    subStatus: 'pending', subOperator: 'Justin Weaver', subCash: 9600, subVariancePct: 0.26, subVarianceException: false,
    approvedBy: null, approvedHoursAgo: null,
    ctrlLastDays: 15, ctrlNextDate: null, ctrlMissed: 0, ctrlDowWarning: true,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-005', name: 'AURORA — Fox Valley Mall', health: 'amber',
    subStatus: 'none', subOperator: null, subCash: null, subVariancePct: null, subVarianceException: false,
    approvedBy: null, approvedHoursAgo: null,
    ctrlLastDays: 3, ctrlNextDate: '2026-04-02', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-006', name: 'ELGIN — Burnham Ave', health: 'amber',
    subStatus: 'overdue', subOperator: 'Operator Scope B', subCash: 9410, subVariancePct: -1.72, subVarianceException: false,
    approvedBy: null, approvedHoursAgo: 52,
    ctrlLastDays: 8, ctrlNextDate: null, ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: null, dgmObservedVariance: null,
  },
  {
    id: 'LOC-007', name: 'NAPERVILLE — Main St', health: 'green',
    subStatus: 'approved', subOperator: 'Laura Diehl', subCash: 9590, subVariancePct: 0.16, subVarianceException: false,
    approvedBy: 'Sarah Lee', approvedHoursAgo: 2,
    ctrlLastDays: 2, ctrlNextDate: '2026-04-01', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: '2026-03-18', dgmObservedVariance: 35,
  },
  {
    id: 'LOC-008', name: 'JOLIET — Louis Joliet Mall', health: 'green',
    subStatus: 'approved', subOperator: 'Justin Weaver', subCash: 9560, subVariancePct: -0.16, subVarianceException: false,
    approvedBy: 'David Patel', approvedHoursAgo: 8,
    ctrlLastDays: 5, ctrlNextDate: '2026-03-31', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: '2026-03-20', dgmObservedVariance: 15,
  },
  {
    id: 'LOC-009', name: 'PEORIA — Northwoods Mall', health: 'green',
    subStatus: 'approved', subOperator: 'Mike Torres', subCash: 9540, subVariancePct: -0.37, subVarianceException: false,
    approvedBy: 'Emma Clarke', approvedHoursAgo: 3,
    ctrlLastDays: 4, ctrlNextDate: '2026-03-29', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: '2026-03-15', dgmObservedVariance: 22,
  },
  {
    id: 'LOC-010', name: 'SPRINGFIELD — White Oaks', health: 'green',
    subStatus: 'approved', subOperator: 'Laura Diehl', subCash: 9580, subVariancePct: 0.05, subVarianceException: false,
    approvedBy: 'Sarah Lee', approvedHoursAgo: 1,
    ctrlLastDays: 1, ctrlNextDate: '2026-04-03', ctrlMissed: 0, ctrlDowWarning: false,
    dgmVisitDate: '2026-03-22', dgmObservedVariance: 8,
  },
]

