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
    what: 'How many locations have been physically verified by a controller this month.',
    how: 'If this number is low, controllers may be behind on their visit schedule. Check the Controller Activity table below to see who needs to catch up.',
    flag: 'Every location should be visited at least once per week. Below 70% coverage by mid-month needs immediate attention.',
  },
  dgmVisits: {
    what: 'How many locations have received a DGM physical visit this month.',
    how: 'DGMs are required to visit each location once per month. Locations without a visit will appear in the Pending Locations column below.',
    flag: 'Locations without a DGM visit by the 25th of the month should be escalated immediately.',
  },
  pendingQueue: {
    what: 'Submissions waiting for controller review, grouped by how long they have been waiting.',
    how: 'Submissions in the "> 48h" bucket have already breached the SLA. Contact the responsible controller immediately. The "24–48h" bucket is approaching the deadline.',
    flag: 'Aim for zero submissions over 48 hours. Check Slowest Approvers to identify bottlenecks.',
  },
  atRisk: {
    what: 'The locations most likely to have compliance issues right now.',
    how: 'Each location is scored based on missing submissions, overdue approvals, rejected counts, variance exceptions, and missing visits. The higher the score, the more urgent the follow-up.',
    flag: 'Red locations (score ≥ 50) need same-day escalation. Amber locations should be followed up within 48 hours.',
  },
  avgTimeToSubmit: {
    what: 'How long operators typically take to submit their daily cash count after shift start.',
    how: 'A high number (over 4 hours) means operators are delaying their counts, which increases the risk of errors and overnight discrepancies.',
    flag: 'Operators should submit within 2–3 hours of shift start. Persistent delays warrant a conversation with the location supervisor.',
  },
  lateSubmitters: {
    what: 'Operators who consistently submit their cash count after 6 PM or the following day.',
    how: 'Late submissions mean cash discrepancies could go undetected overnight. These operators need reminders or supervisory follow-up.',
    flag: 'Same-day submission is required. Persistent late submitters should be addressed with their supervisor.',
  },
  draftUsage: {
    what: 'How many operators save a draft before finalising their count.',
    how: 'Some draft usage is normal (operator interrupted mid-count). Very high usage may indicate confusion about the form or process.',
    flag: 'Above 40% suggests operators may need additional training on the submission process.',
  },
  platformUsage: {
    what: 'Whether operators are using the online form or uploading an Excel file.',
    how: 'High Excel usage may indicate the online form isn\'t meeting operator needs. Consider whether the form workflow needs improvement.',
    flag: 'Monitor for sudden shifts in usage patterns — they may signal a process issue.',
  },
  rejectedOperators: {
    what: 'Operators whose cash counts are most frequently rejected by controllers.',
    how: 'Repeat rejections usually mean the operator needs additional training. Two or more rejections in a month warrants a one-on-one review.',
    flag: 'Focus on the top reason for each operator — it tells you exactly what they need help with.',
  },
  rejectionReasons: {
    what: 'The most common reasons controllers reject cash count submissions.',
    how: 'Understanding the top reasons helps you target training and process improvements where they will have the most impact.',
    flag: '"Variance unexplained" is the most actionable — the operator counted a different amount but didn\'t explain why.',
  },
  slowestApprovers: {
    what: 'Controllers ranked by how long they take to review submissions.',
    how: 'Every submission must be reviewed within 48 hours. Controllers consistently above 24 hours should be coached. Above 48 hours means they are causing SLA breaches.',
    flag: 'Contact controllers with breaches directly. Persistent delays may require workload rebalancing.',
  },
  controllerActivity: {
    what: 'How each controller is performing on their verification visits this month.',
    how: 'Look for controllers with missed visits (compliance risk) or low completion rates. A controller who misses visits without explanation needs follow-up.',
    flag: 'Every controller should maintain at least 80% completion rate. Missed visits must have documented reasons.',
  },
  dowRotation: {
    what: 'Whether a controller is visiting the same location on the same weekday repeatedly.',
    how: 'Predictable visit patterns reduce the effectiveness of inspections. Controllers should vary their visit days so staff cannot anticipate when they will arrive.',
    flag: 'Two or more visits on the same weekday triggers a warning. The controller should acknowledge and rotate.',
  },
  dgmCoverage: {
    what: 'Which DGMs have completed their monthly rounds and which locations are still waiting.',
    how: 'Every active location must receive a DGM visit each calendar month. DGMs with low coverage need to prioritise their remaining locations.',
    flag: 'Any location without a visit by the 25th should be escalated. 100% coverage is the target.',
  },
  dgmFindings: {
    what: 'Whether DGM visits are finding real discrepancies during their physical counts.',
    how: 'Some variance is normal and expected. A DGM who consistently records zero variance across all visits may not be performing thorough counts.',
    flag: 'Zero variance across all visits is a quality signal — investigate whether the DGM is conducting genuine independent counts.',
  },
  healthRed: {
    what: 'NON-COMPLIANT — This location needs immediate attention.',
    how: 'Red means one or more critical failures:\n• No cash count submitted today\n• Submission was rejected\n• Approval overdue beyond the SLA deadline',
    flag: 'Contact the location supervisor and assigned controller today. Do not wait for the next review cycle.',
  },
  healthAmber: {
    what: 'AT RISK — This location has gaps that could worsen.',
    how: 'Amber means the location is functional but has issues:\n• Submission pending approval (not yet overdue)\n• No controller visit this month\n• Controller overdue > 14 days\n• No DGM visit this month',
    flag: 'Follow up within 48 hours. Left unattended, amber locations typically turn red.',
  },
  healthGreen: {
    what: 'COMPLIANT — This location is operating as expected.',
    how: 'Green means everything is in order:\n• Today\'s cash count submitted and approved\n• Controller visit up to date\n• DGM visit completed this month',
    flag: 'No action needed. The goal is to maximise green locations across the region.',
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

