// ── Mock data for CashRoom Compliance System ──────────────────────────────

export interface Location {
  id: string
  name: string
  cost_center?: string | null
  city: string
  expectedCash: number
  tolerancePct: number
  effectiveTolerancePct?: number  // from location_config_overrides; falls back to tolerancePct
  slaHours?: number               // default 48
  active: boolean
  createdAt?: string
  updatedAt?: string
}

export interface Submission {
  id: string
  locationId: string
  operatorName: string
  date: string           // YYYY-MM-DD
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected'
  source?: 'FORM' | 'CHAT' | 'EXCEL'
  totalCash: number
  expectedCash?: number  // snapshotted at submission time
  variance: number
  variancePct: number
  submittedAt: string
  approvedBy?: string
  approvedByName?: string
  rejectionReason?: string
  sectionReviews?: Record<string, { decision: string; note: string }>
  sections: SectionTotals
  // Variance exception: set when |variancePct| > location tolerancePct at submission time
  varianceException?: boolean
  varianceNote?: string
}

export interface SectionTotals {
  A: number; B: number; C: number; D: number; E: number
  F: number; G: number; H: number; I: number
}

export interface Draft {
  id: string
  locationId: string
  date: string
  savedAt: string
  sections: Partial<SectionTotals>
  totalSoFar: number
}

export interface VerificationRecord {
  id: string
  locationId: string
  verifierName: string
  type: 'controller' | 'dgm'
  date: string           // YYYY-MM-DD — scheduled or actual visit date
  monthYear?: string
  observedTotal?: number // undefined for scheduled / missed records
  notes: string
  dayOfWeek: number
  warningFlag: boolean
  status: 'scheduled' | 'completed' | 'missed' | 'cancelled'
  missedReason?: string
  scheduledTime?: string  // e.g. "09:00" — set at booking time, undefined for older records
  signatureData?: string  // base64 data URL of the controller's signature
  varianceVsImprest?: number
  variancePct?: number
}

export interface AuditEvent {
  id: string
  eventType: string
  actor: string         // display name (mock only — API uses actor_id + actor_name)
  actorId?: string      // UUID in real API
  actorRole?: string
  locationId?: string
  entityId?: string     // maps to API entity_id
  entityType?: string   // maps to API entity_type
  submissionId?: string // legacy alias for entityId when entityType='submission'
  detail: string
  timestamp: string
  oldValue?: string
  newValue?: string
  ipAddress?: string
}

export interface User {
  id: string
  name: string
  email: string
  role: 'operator' | 'controller' | 'dgm' | 'admin' | 'regional-controller'
  locationIds: string[]
  active: boolean
  createdAt?: string
}

export interface SecReview {
  decision: 'accept' | 'reject'
  note: string
}

export interface SubmissionReview {
  submissionId: string
  outcome: 'approved' | 'rejected'
  reviewedAt: string
  reviewedBy: string
  sections: Record<string, SecReview>
}

// ── Persistence helpers ────────────────────────────────────────────────────
function loadStored<T>(key: string, fallback: T[]): T[] {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T[]) : fallback
  } catch { return fallback }
}
function loadStoredMap<V>(key: string, fallback: Record<string, V>): Record<string, V> {
  try {
    const raw = localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as Record<string, V>) : fallback
  } catch { return fallback }
}
export function saveStored(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* quota exceeded */ }
}

// ── Submission Reviews (section-level controller review results) ───────────
export const SUBMISSION_REVIEWS: Record<string, SubmissionReview> =
  loadStoredMap<SubmissionReview>('compass_submission_reviews', {})

export function saveSubmissionReview(review: SubmissionReview) {
  SUBMISSION_REVIEWS[review.submissionId] = review
  saveStored('compass_submission_reviews', SUBMISSION_REVIEWS)
}

// ── Verification Reviews (section-level review recorded during visit completion) ─
export interface VerificationReview {
  verificationId: string
  outcome: 'approved' | 'rejected'
  reviewedAt: string
  reviewedBy: string
  sections: Record<string, SecReview>
}

export const VERIFICATION_REVIEWS: Record<string, VerificationReview> =
  loadStoredMap<VerificationReview>('compass_verification_reviews', {})

export function saveVerificationReview(review: VerificationReview) {
  VERIFICATION_REVIEWS[review.verificationId] = review
  saveStored('compass_verification_reviews', VERIFICATION_REVIEWS)
}

// ── Locations ─────────────────────────────────────────────────────────────
// Populated via Admin → Import Roster (persisted in localStorage)
export const LOCATIONS: Location[] = loadStored<Location>('compass_locations', [])

export const IMPREST = 9575.00



// ── Submissions ─────────────────────────────────────────────────────────────
// Populated at runtime via form submissions
export const SUBMISSIONS: Submission[] = []

// ── Drafts ────────────────────────────────────────────────────────────────
// Cleared by default — drafts are created during form entry sessions
export const DRAFTS: Draft[] = []

// ── Verifications ─────────────────────────────────────────────────────────
// Populated at runtime via controller/DGM log screens
export const VERIFICATIONS: VerificationRecord[] = []

// ── Audit Events ──────────────────────────────────────────────────────────
export const AUDIT_EVENTS: AuditEvent[] = []

// Tracks dates where the operator submitted an absence explanation (key: `${locationId}|${date}`)
export const EXPLAINED_MISSED = new Set<string>()

// Stores the submitted explanation data for view-only display
export interface ExplanationData { reason: string; detail: string; supervisorName: string }
export const MISSED_EXPLANATIONS = new Map<string, ExplanationData>()

// ── Users ─────────────────────────────────────────────────────────────────
// Only the system admin account exists at startup.
// All other users are populated via Admin → Import Roster (persisted in localStorage).
const DEFAULT_USERS: User[] = [
  { id: 'U5', name: 'T. Admin', email: 'admin@compass.com', role: 'admin', locationIds: [], active: true },
]
export const USERS: User[] = loadStored<User>('compass_users', DEFAULT_USERS)

// ── Helpers ───────────────────────────────────────────────────────────────
export function getSubmission(locationId: string, date: string) {
  return SUBMISSIONS.find(s => s.locationId === locationId && s.date === date) ?? null
}
export function getLocation(id: string) {
  return LOCATIONS.find(l => l.id === id) ?? null
}
export function formatCurrency(n: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n)
}
export function todayStr() {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
export function isPastDate(date: string) {
  return date < todayStr()
}
export function isFutureDate(date: string) {
  return date > todayStr()
}

export interface LocationGroup {
  group: string         // cost center as group key
  costCenter: string
  label: string         // display label e.g. "APPLETON / WAUSAU"
  subLocs: { id: string; label: string; imprest: number }[]
  defaultFactor: number // 1.25 single, 1.50 multiple
}

export const LOCATION_GROUPS: LocationGroup[] = [
  {
    group: '5082', costCenter: '5082', label: 'APPLETON / WAUSAU',
    subLocs: [
      { id: 'APL-01', label: 'APPLETON', imprest: 9575 },
      { id: 'WAS-02', label: 'WAUSAU', imprest: 8921 },
    ],
    defaultFactor: 1.50,
  },
  {
    group: '5104', costCenter: '5104', label: 'CENTRAL IL',
    subLocs: [{ id: 'CIL-03', label: 'CENTRAL IL', imprest: 5385 }],
    defaultFactor: 1.25,
  },
  {
    group: '5117', costCenter: '5117', label: 'BLOOMINGDALE',
    subLocs: [{ id: 'BLM-04', label: 'BLOOMINGDALE', imprest: 18880 }],
    defaultFactor: 1.25,
  },
  {
    group: '5132', costCenter: '5132', label: 'ROMEOVILLE',
    subLocs: [{ id: 'ROM-05', label: 'ROMEOVILLE', imprest: 3500 }],
    defaultFactor: 1.25,
  },
]

/** Mock daily submission data for reasonableness calculations */
export interface RtSubmission {
  loc: string
  date: string
  sA: number  // Section A — Currency (loose currency)
  sF: number  // Line F — Uncounted Funds
  sH: number  // Line H — Outstanding Changers
  sJ: number  // Line J — Replenishment / Coin Purchase
  total: number // Total Cashier's Fund
}

// Seed ~60 days of mock submissions for each location
function seedRtSubmissions(): RtSubmission[] {
  const locs: Record<string, { sA: number; sF: number; sH: number; sJ: number; total: number }> = {
    'APL-01': { sA: 429, sF: 800,  sH: 2502, sJ: 150, total: 9800  },
    'WAS-02': { sA: 300, sF: 0,    sH: 2000, sJ: 200, total: 8500  },
    'CIL-03': { sA: 200, sF: 0,    sH: 1200, sJ: 100, total: 5600  },
    'BLM-04': { sA: 1200, sF: 500, sH: 4000, sJ: 800, total: 19200 },
    'ROM-05': { sA: 600, sF: 0,    sH: 500,  sJ: 50,  total: 3700  },
  }
  const subs: RtSubmission[] = []
  const today = new Date()
  for (let d = 0; d < 60; d++) {
    const dt = new Date(today)
    dt.setDate(dt.getDate() - d)
    const ds = dt.toISOString().slice(0, 10)
    const dow = dt.getDay()
    if (dow === 0 || dow === 6) continue // skip weekends
    for (const [loc, base] of Object.entries(locs)) {
      // ~8% chance of missing a day
      if (Math.random() < 0.08) continue
      const jitter = (seed: number) => Math.round(seed * (0.8 + Math.random() * 0.4))
      subs.push({
        loc, date: ds,
        sA: jitter(base.sA),
        sF: jitter(base.sF),
        sH: jitter(base.sH),
        sJ: jitter(base.sJ),
        total: jitter(base.total),
      })
    }
  }
  return subs
}

export const RT_SUBMISSIONS: RtSubmission[] = seedRtSubmissions()

export interface RtMaxValues {
  maxF: number
  maxH: number
  maxJ: number
  maxK: number
  total: number
  actualFund: number
  sectionAData: { date: string; sA: number }[]
  avgSA: number
  count: number
}

export function rtGetMaxValues(loc: string, fromDate: string, toDate: string): RtMaxValues | null {
  const subs = RT_SUBMISSIONS.filter(s => s.loc === loc && s.date >= fromDate && s.date <= toDate)
  if (!subs.length) return null
  const maxF = Math.max(...subs.map(s => s.sF))
  const maxH = Math.max(...subs.map(s => s.sH))
  const maxJ = Math.max(...subs.map(s => s.sJ))
  const maxK = 0 // defaults to $0 per spec
  const total = maxF + maxH + maxJ + maxK
  const actualFund = Math.max(...subs.map(s => s.total))
  const sectionAData = subs.map(s => ({ date: s.date, sA: s.sA })).sort((a, b) => a.date.localeCompare(b.date))
  const avgSA = sectionAData.reduce((acc, d) => acc + d.sA, 0) / sectionAData.length
  return { maxF, maxH, maxJ, maxK, total, actualFund, sectionAData, avgSA, count: subs.length }
}

/** Stored reasonableness reports (mock — later replaced by API) */
export interface RtLocReport {
  locId: string
  locLabel: string
  total: number
  expectedFund: number
  actualFund: number
  over: number
  cushion: number
  net: number
  status: 'Reasonable' | 'Overfunded'
  conclusion: string
  requiredActions: string
  actionDetails: string
}

export interface RtReport {
  id: string
  group: string
  cc: string
  locLabels: string
  fromDate: string
  toDate: string
  factor: number
  preparer: string
  scope: string
  locReports: RtLocReport[]
  status: 'Reasonable' | 'Overfunded'
  savedAt: string
  savedBy: string
}

// Pre-seeded reports for demo — realistic data matching active locations
function seedRtReports(): RtReport[] {
  const reports: RtReport[] = []

  // ── Report 1: APPLETON / WAUSAU (Q2 FY2026, P4–P5) — Overfunded ──
  reports.push({
    id: 'rt_demo_1',
    group: '5082', cc: '5082',
    locLabels: 'APPLETON / WAUSAU',
    fromDate: '2026-01-01', toDate: '2026-02-28',
    factor: 1.50,
    preparer: 'Lisa Chen',
    scope: 'Daily Cashroom Reconciliations for P4 and P5, FY2026',
    locReports: [
      {
        locId: 'APL-01', locLabel: 'APPLETON',
        total: 3452, expectedFund: 5178, actualFund: 9800,
        over: 4622, cushion: -5000, net: -378,
        status: 'Reasonable',
        conclusion: 'Funds are reasonable after cushion applied. Driver bags were reduced due to updated Loomis schedule. Room balance trending down as expected.',
        requiredActions: 'no', actionDetails: '',
      },
      {
        locId: 'WAS-02', locLabel: 'WAUSAU',
        total: 2200, expectedFund: 3300, actualFund: 8500,
        over: 5200, cushion: -5000, net: 200,
        status: 'Overfunded',
        conclusion: 'Wausau is slightly overfunded by $200 after cushion. The excess is due to seasonal driver route additions in January that have since normalized.',
        requiredActions: 'yes', actionDetails: 'Will deposit excess $1,200 by March 15, 2026. Adjusted imprest target discussed with Jamie.',
      },
    ],
    status: 'Overfunded',
    savedAt: '2026-03-10T14:22:00.000Z',
    savedBy: 'Lisa Chen',
  })

  // ── Report 2: CENTRAL IL (Q2 FY2026, P4–P5) — Reasonable ──
  reports.push({
    id: 'rt_demo_2',
    group: '5104', cc: '5104',
    locLabels: 'CENTRAL IL',
    fromDate: '2026-01-01', toDate: '2026-02-28',
    factor: 1.25,
    preparer: 'Lisa Chen',
    scope: 'Daily Cashroom Reconciliations for P4 and P5, FY2026',
    locReports: [
      {
        locId: 'CIL-03', locLabel: 'CENTRAL IL',
        total: 1300, expectedFund: 1625, actualFund: 5600,
        over: 3975, cushion: -5000, net: -1025,
        status: 'Reasonable',
        conclusion: 'Central IL fund is well within acceptable range. Operations stable, no changes to driver routes or coin requirements.',
        requiredActions: 'no', actionDetails: '',
      },
    ],
    status: 'Reasonable',
    savedAt: '2026-03-11T09:45:00.000Z',
    savedBy: 'Lisa Chen',
  })

  // ── Report 3: BLOOMINGDALE (Q2 FY2026, P4–P5) — Overfunded ──
  reports.push({
    id: 'rt_demo_3',
    group: '5117', cc: '5117',
    locLabels: 'BLOOMINGDALE',
    fromDate: '2026-01-01', toDate: '2026-02-28',
    factor: 1.25,
    preparer: 'Lisa Chen',
    scope: 'Daily Cashroom Reconciliations for P4 and P5, FY2026',
    locReports: [
      {
        locId: 'BLM-04', locLabel: 'BLOOMINGDALE',
        total: 5300, expectedFund: 6625, actualFund: 19200,
        over: 12575, cushion: -5000, net: 7575,
        status: 'Overfunded',
        conclusion: 'Bloomingdale is significantly overfunded. The high balance is due to a delayed bank deposit in early February and accumulated coin purchase inventory. Action required.',
        requiredActions: 'yes', actionDetails: 'Immediate deposit of $8,000 scheduled for March 18, 2026. Coin purchase schedule being revised with bank to reduce in-transit amounts. Target room balance: $12,000.',
      },
    ],
    status: 'Overfunded',
    savedAt: '2026-03-12T11:10:00.000Z',
    savedBy: 'Lisa Chen',
  })

  // ── Report 4: ROMEOVILLE (Q2 FY2026, P4–P5) — Reasonable ──
  reports.push({
    id: 'rt_demo_4',
    group: '5132', cc: '5132',
    locLabels: 'ROMEOVILLE',
    fromDate: '2026-01-01', toDate: '2026-02-28',
    factor: 1.25,
    preparer: 'Lisa Chen',
    scope: 'Daily Cashroom Reconciliations for P4 and P5, FY2026',
    locReports: [
      {
        locId: 'ROM-05', locLabel: 'ROMEOVILLE',
        total: 550, expectedFund: 687.50, actualFund: 3700,
        over: 3012.50, cushion: -5000, net: -1987.50,
        status: 'Reasonable',
        conclusion: 'Romeoville is well within range. Smallest cash room in the district — low volume, consistent operations.',
        requiredActions: 'no', actionDetails: '',
      },
    ],
    status: 'Reasonable',
    savedAt: '2026-03-12T15:30:00.000Z',
    savedBy: 'Lisa Chen',
  })

  // ── Report 5: APPLETON / WAUSAU Q1 (older quarter for history) ──
  reports.push({
    id: 'rt_demo_5',
    group: '5082', cc: '5082',
    locLabels: 'APPLETON / WAUSAU',
    fromDate: '2025-10-01', toDate: '2025-12-31',
    factor: 1.50,
    preparer: 'Lisa Chen',
    scope: 'Daily Cashroom Reconciliations for P1 through P3, FY2026',
    locReports: [
      {
        locId: 'APL-01', locLabel: 'APPLETON',
        total: 3100, expectedFund: 4650, actualFund: 9200,
        over: 4550, cushion: -5000, net: -450,
        status: 'Reasonable',
        conclusion: 'Q1 test completed. Appleton fund within acceptable range. Holiday period saw slightly elevated cash but within tolerance.',
        requiredActions: 'no', actionDetails: '',
      },
      {
        locId: 'WAS-02', locLabel: 'WAUSAU',
        total: 1950, expectedFund: 2925, actualFund: 8100,
        over: 5175, cushion: -5000, net: 175,
        status: 'Overfunded',
        conclusion: 'Wausau marginally overfunded in Q1 due to holiday coin inventory buildup. Deposited $500 in late December.',
        requiredActions: 'yes', actionDetails: 'Deposited excess $500 on Dec 28, 2025. Room balance now aligned.',
      },
    ],
    status: 'Overfunded',
    savedAt: '2026-01-08T10:15:00.000Z',
    savedBy: 'Lisa Chen',
  })

  return reports
}

export const RTEST_STORE: RtReport[] = seedRtReports()
