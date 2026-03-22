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
  return new Date().toISOString().split('T')[0]
}
export function isPastDate(date: string) {
  return date < todayStr()
}
export function isFutureDate(date: string) {
  return date > todayStr()
}
