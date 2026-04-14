import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { formatCurrency, getLocation } from '../../mock/data'
import type { VerificationRecord } from '../../mock/data'
import { listControllerVerifications, completeControllerVisit, missControllerVisit, cancelControllerVisit } from '../../api/verifications'
import { listSubmissions } from '../../api/submissions'
import { listLocations } from '../../api/locations'
import { api } from '../../api/client'
import type { ApiVerification, ApiLocation, DowWarningReason } from '../../api/types'
import KpiCard from '../../components/KpiCard'
import { DEFAULT_TOLERANCE } from '../../utils/variance'


function mapApiVerification(v: ApiVerification): VerificationRecord {
  return {
    id: v.id,
    locationId: v.location_id,
    verifierName: v.verifier_name,
    type: v.verification_type === 'CONTROLLER' ? 'controller' : 'dgm',
    date: v.verification_date,
    monthYear: v.month_year ?? undefined,
    observedTotal: v.observed_total ?? undefined,
    notes: v.notes,
    dayOfWeek: v.day_of_week,
    warningFlag: v.warning_flag,
    status: v.status,
    missedReason: v.missed_reason ?? undefined,
    scheduledTime: v.scheduled_time ?? undefined,
    signatureData: v.signature_data ?? undefined,
    varianceVsImprest: v.variance_vs_imprest ?? undefined,
    variancePct: v.variance_pct ?? undefined,
  }
}

interface Props {
  controllerName: string
  locationIds: string[]
  ctx?: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PAGE_SIZE  = 10

const MISSED_REASONS = [
  'Location access unavailable',
  'Operational conflict — staff not available',
  'Personal / medical emergency',
  'Travel or transport issue',
  'Rescheduled by area manager',
  'Other (documented separately)',
]

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)         return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'missed' | 'cancelled'

type SessionUpdate = {
  status: 'completed' | 'missed' | 'cancelled'
  observedTotal?: number
  varianceVsImprest?: number
  variancePct?: number
  missedReason?: string
  notes?: string
  warningFlag?: boolean
  signatureData?: string
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'scheduled') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe',
    }}>📅 Scheduled</span>
  )
  if (status === 'completed') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)',
    }}>✅ Completed</span>
  )
  if (status === 'missed') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #fca5a5',
    }}>❌ Missed</span>
  )
  if (status === 'cancelled') return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700,
      background: '#f5f5f5', color: '#737373', border: '1px solid #d4d4d4',
    }}>⊘ Cancelled</span>
  )
  return <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
}

export default function CtrlDashboard({ controllerName, locationIds, ctx, onNavigate }: Props) {
  // FIX: Use state so Date.now() is only called once during initial render, satisfying the purity rule
  const [now] = useState(() => Date.now())

  const [statusFilter,   setStatusFilter]  = useState<StatusFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [page,           setPage]          = useState(0)
  const [apiLocations,   setApiLocations]  = useState<ApiLocation[]>([])
  const [slaHours,       setSlaHours]      = useState(48)
  const [tolerance,      setTolerance]     = useState(DEFAULT_TOLERANCE)

  useEffect(() => {
    listLocations().then(setApiLocations).catch(() => {})
    api.get<{ global_config?: { approval_sla_hours?: number; default_tolerance_pct?: number } }>('/config')
      .then(cfg => {
        if (cfg.global_config?.approval_sla_hours) setSlaHours(cfg.global_config.approval_sla_hours)
        if (cfg.global_config?.default_tolerance_pct != null) setTolerance(cfg.global_config.default_tolerance_pct)
      })
      .catch(() => {})
  }, [])

  // Inline expand state (initialize from ctx if returning from approval)
  const [expandedId,   setExpandedId]   = useState<string | null>(ctx?.expandVisitId || null)
  const [expandAction, setExpandAction] = useState<'complete' | 'miss' | 'view' | null>((ctx?.expandAction as 'complete' | 'miss' | 'view') || null)
  const [prevCtx,      setPrevCtx]      = useState(ctx)

  // Auto-expand if returning to this panel via navigation context (adjusting state during render)
  if (ctx !== prevCtx) {
    setPrevCtx(ctx)
    if (ctx?.expandVisitId && ctx?.expandAction) {
      setExpandedId(ctx.expandVisitId)
      setExpandAction(ctx.expandAction as 'complete' | 'miss')
    }
  }

  // Complete inline form
  const [cNotes,        setCNotes]        = useState('')
  const [cWarnReason,   setCWarnReason]   = useState<DowWarningReason | ''>('')
  const [cSig,          setCSig]          = useState('')
  const [cErrors,       setCErrors]       = useState<Record<string, string>>({})
  const [earlyWarning,  setEarlyWarning]  = useState<string | null>(null)

  const cSigRef   = useRef<HTMLCanvasElement | null>(null)
  const isDrawing = useRef(false)

  function getSigPos(canvas: HTMLCanvasElement, clientX: number, clientY: number) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: (clientX - rect.left) * (canvas.width  / rect.width),
      y: (clientY - rect.top)  * (canvas.height / rect.height),
    }
  }
  function sigMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = cSigRef.current; if (!canvas) return
    isDrawing.current = true
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  function sigMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!isDrawing.current) return
    const canvas = cSigRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { x, y } = getSigPos(canvas, e.clientX, e.clientY)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a'
    ctx.lineTo(x, y); ctx.stroke()
  }
  function sigEnd() {
    if (!isDrawing.current) return
    isDrawing.current = false
    const canvas = cSigRef.current; if (!canvas) return
    setCSig(canvas.toDataURL())
    setCErrors(p => ({ ...p, sig: '' }))
  }
  function sigTouchStart(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const canvas = cSigRef.current; if (!canvas) return
    const t = e.touches[0]; isDrawing.current = true
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const { x, y } = getSigPos(canvas, t.clientX, t.clientY)
    ctx.beginPath(); ctx.moveTo(x, y)
  }
  function sigTouchMove(e: React.TouchEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (!isDrawing.current) return
    const canvas = cSigRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const t = e.touches[0]
    const { x, y } = getSigPos(canvas, t.clientX, t.clientY)
    ctx.lineWidth = 2; ctx.lineCap = 'round'; ctx.strokeStyle = '#1a1a1a'
    ctx.lineTo(x, y); ctx.stroke()
  }
  function clearSig() {
    const canvas = cSigRef.current; if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
    setCSig(''); setCErrors(p => ({ ...p, sig: '' }))
  }

  // Miss inline form
  const [mReason, setMReason] = useState('')
  const [mNotes,  setMNotes]  = useState('')
  const [mErrors, setMErrors] = useState<Record<string, string>>({})

  // Session overrides for optimistic UI only — NOT persisted to sessionStorage.
  // The API fetches fresh status on every mount, so stale sessionStorage is not needed.
  const [sessionUpdates, setSessionUpdates] = useState<Record<string, SessionUpdate>>({})

  // API-fetched verifications — overlay over mock data
  const [apiVerifs, setApiVerifs] = useState<VerificationRecord[]>([])
  // Map of locationId_date to { status, id }
  const [apiSubsMap, setApiSubsMap] = useState<Record<string, { status: string; id: string; totalCash: number; expectedCash: number; variance: number; variancePct: number; submittedByRole: string }>>({})

  // Clear any stale sessionStorage from old code so it doesn't affect other reads
  useEffect(() => {
    sessionStorage.removeItem('ctrl_session_updates')
  }, [])

  // FIX: Extract expression to a variable and include locationIds in dependency array
  const locIdsJoined = locationIds.join(',')
  useEffect(() => {
    // 1. Fetch Verifications
    listControllerVerifications({ page_size: 100 })
      .then(r => {
        const mapped = r.items.map(mapApiVerification).filter(v => locationIds.includes(v.locationId))
        setApiVerifs(mapped)
      })
      .catch(() => { /* fall back to mock */ })

    // 2. Fetch submissions to check approval status
    if (locationIds.length > 0) {
      Promise.all(locationIds.map(id => listSubmissions({ location_id: id, page_size: 100 }).then(r => r.items)))
        .then(arrays => {
          const flats = arrays.flat()
          const map: Record<string, { status: string; id: string; totalCash: number; expectedCash: number; variance: number; variancePct: number; submittedByRole: string }> = {}
          flats.forEach(s => {
            map[`${s.location_id}_${s.submission_date}`] = { status: s.status, id: s.id, totalCash: s.total_cash, expectedCash: s.expected_cash, variance: s.variance, variancePct: s.variance_pct, submittedByRole: s.submitted_by_role || 'OPERATOR' }
          })
          setApiSubsMap(map)
        })
        .catch(() => { /* fall back to mock */ })
    }
  }, [locationIds, locIdsJoined]) 

  // Helper function to get submission status from API data
  function getSubStatus(locId: string, date: string): string | null {
    const key = `${locId}_${date}`
    return apiSubsMap[key]?.status ?? null
  }

  function getSubId(locId: string, date: string): string | undefined {
    const key = `${locId}_${date}`
    return apiSubsMap[key]?.id
  }

  function getSubTotalCash(locId: string, date: string): number | null {
    const key = `${locId}_${date}`
    return apiSubsMap[key]?.totalCash ?? null
  }

  function getSubRole(locId: string, date: string): string {
    const key = `${locId}_${date}`
    return apiSubsMap[key]?.submittedByRole ?? 'OPERATOR'
  }


  // FIX: Removed useEffect to prevent cascading render errors. Resetting state happens inside the click/change handlers now.
  // useEffect(() => { setPage(0); closeExpand() }, [statusFilter, locationFilter])

  function closeExpand() {
    setExpandedId(null); setExpandAction(null)
    setCNotes(''); setCWarnReason(''); setCSig(''); setCErrors({}); setEarlyWarning(null)
    setMReason(''); setMNotes(''); setMErrors({})
  }

  function openExpand(id: string, action: 'complete' | 'miss' | 'view') {
    if (expandedId === id && expandAction === action) { closeExpand(); return }
    closeExpand()
    setExpandedId(id)
    setExpandAction(action)
  }

  const sourceVerifs = apiVerifs

  // All controller records for my locations, merged with session overrides
  const allRecords = useMemo<VerificationRecord[]>(() =>
    sourceVerifs
      .map(v => {
        const upd = sessionUpdates[v.id]
        if (!upd) return v
        const merged: VerificationRecord = { ...v, status: upd.status }
        if (upd.observedTotal !== undefined)    merged.observedTotal    = upd.observedTotal
        if (upd.varianceVsImprest !== undefined) merged.varianceVsImprest = upd.varianceVsImprest
        if (upd.variancePct !== undefined)       merged.variancePct       = upd.variancePct
        if (upd.missedReason)                    merged.missedReason      = upd.missedReason
        if (upd.notes)                      merged.notes         = upd.notes
        if (upd.warningFlag !== undefined)  merged.warningFlag   = upd.warningFlag
        if (upd.signatureData)              merged.signatureData = upd.signatureData
        return merged
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
  [sourceVerifs, sessionUpdates])


  // Filtered rows
  const rows = useMemo(() => {
    let r = allRecords
    if (locationFilter !== 'all') r = r.filter(v => v.locationId === locationFilter)
    if (statusFilter   !== 'all') r = r.filter(v => v.status === statusFilter)
    return r
  }, [allRecords, locationFilter, statusFilter])

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromEntry  = rows.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toEntry    = Math.min((page + 1) * PAGE_SIZE, rows.length)

  // ── KPIs ────────────────────────────────────────────────────────────────
  const thisMonthKey       = new Date().toISOString().slice(0, 7)
  const completedThisMonth = allRecords.filter(v => v.status === 'completed' && v.date.startsWith(thisMonthKey)).length
  const scheduledCount     = allRecords.filter(v => v.status === 'scheduled').length
  const missedCount        = allRecords.filter(v => v.status === 'missed').length

  const avgGap = useMemo(() => {
    // Only consider completed visits within the last 6 months for a meaningful average
    const sixMonthsAgo = new Date()
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)
    const cutoff = sixMonthsAgo.toISOString().split('T')[0]
    const done = allRecords.filter(v => v.status === 'completed' && v.date >= cutoff)
    if (done.length < 2) return null
    const sorted = [...done].sort((a, b) => a.date.localeCompare(b.date))
    let total = 0
    for (let i = 1; i < sorted.length; i++) {
      total += (new Date(sorted[i].date + 'T12:00:00').getTime() - new Date(sorted[i - 1].date + 'T12:00:00').getTime()) / 86400000
    }
    return Math.round(total / (sorted.length - 1))
  }, [allRecords])

  // ── Filter chip counts (location-aware) ─────────────────────────────────
  const counts = useMemo(() => {
    const base = locationFilter === 'all' ? allRecords : allRecords.filter(v => v.locationId === locationFilter)
    return {
      all:       base.length,
      scheduled: base.filter(v => v.status === 'scheduled').length,
      completed: base.filter(v => v.status === 'completed').length,
      missed:    base.filter(v => v.status === 'missed').length,
      cancelled: base.filter(v => v.status === 'cancelled').length,
    }
  }, [allRecords, locationFilter])

  // ── DOW warning for the currently-expanded complete row ──────────────────
  const dowWarning = useMemo(() => {
    if (!expandedId || expandAction !== 'complete') return null
    const rec = allRecords.find(r => r.id === expandedId)
    if (!rec) return null
    const dow    = new Date(rec.date + 'T12:00:00').getDay()
    const cutoff = now - 42 * 86400000
    const matches = allRecords.filter(v =>
      v.id          !== expandedId &&
      v.locationId  === rec.locationId &&
      v.status      === 'completed' &&
      v.dayOfWeek   === dow &&
      new Date(v.date + 'T12:00:00').getTime() >= cutoff
    )
    if (matches.length === 0) return null
    const last = [...matches].sort((a, b) => b.date.localeCompare(a.date))[0]
    return {
      dayLabel: DOW_LABELS[dow],
      lastDate: new Date(last.date + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      count: matches.length,
    }
  }, [expandedId, expandAction, allRecords, now])

  // FIX: Commented out to resolve TypeScript 6133 unused variable error while preserving your code.
  /*
  // Live variance preview inside "Complete" expand form
  const liveVariance = useMemo(() => {
    const n = Number(cObs)
    if (!cObs || isNaN(n) || n <= 0) return null
    const v   = n - IMPREST
    const pct = (v / IMPREST) * 100
    return { v, pct }
  }, [cObs])
  */

  // ── Handle Complete ──────────────────────────────────────────────────────
  async function handleComplete(id: string, earlyAck = false) {
    const e: Record<string, string> = {}

    if (dowWarning && !cWarnReason)       e.warn = 'Please select a reason to proceed.'
    if (!cSig)                            e.sig  = 'Please sign before confirming.'
    if (Object.keys(e).length) { setCErrors(e); return }

    const fullNotes = cNotes.trim()

    // Retrieve per-section review decisions stored by OpReadonly
    let visitSectionReviews: Record<string, { decision: string; note: string }> | undefined
    try {
      const raw = sessionStorage.getItem(`visit_review_${id}`)
      if (raw) visitSectionReviews = JSON.parse(raw)
    } catch { /* ignore parse errors */ }

    // Use submission total as observed total — Path A from operator, Path B from controller's own form
    const rec = allRecords.find(r => r.id === id)
    const subTotal = rec ? getSubTotalCash(rec.locationId, rec.date) : null
    const ctrlFormTotal = sessionStorage.getItem(`verifier_form_total_${id}`)
    const observedTotal = subTotal ?? (ctrlFormTotal ? parseFloat(ctrlFormTotal) : undefined)

    let result: Awaited<ReturnType<typeof completeControllerVisit>>
    try {
      result = await completeControllerVisit(id, { signature_data: cSig, notes: fullNotes || undefined, dow_warning_reason: dowWarning && cWarnReason ? cWarnReason : undefined, visit_section_reviews: visitSectionReviews, observed_total: observedTotal, early_completion_acknowledged: earlyAck || undefined })
    } catch (err: unknown) {
      // 409 = early completion warning — show acknowledgement prompt instead of error
      if (err && typeof err === 'object' && 'status' in err && (err as { status: number }).status === 409) {
        setEarlyWarning((err as { message?: string }).message || 'You are completing this visit before the scheduled time. Proceed anyway?')
        return
      }
      const msg = err instanceof Error ? err.message : 'Failed to complete visit.'
      setCErrors({ api: msg })
      return
    }
    setEarlyWarning(null)

    // Clean up session storage after successful save
    sessionStorage.removeItem(`visit_review_${id}`)
    sessionStorage.removeItem(`ctrl_form_${id}`)
    sessionStorage.removeItem(`verifier_form_total_${id}`)

    setSessionUpdates(prev => ({
      ...prev,
      [id]: {
        status: 'completed',
        observedTotal: result.observed_total ?? subTotal ?? 0,
        varianceVsImprest: result.variance_vs_imprest ?? undefined,
        variancePct: result.variance_pct ?? undefined,
        notes: fullNotes,
        warningFlag: !!dowWarning,
        signatureData: cSig,
      },
    }))
    closeExpand()
  }

  // ── Handle Miss ──────────────────────────────────────────────────────────
  async function handleMiss(id: string) {
    const e: Record<string, string> = {}
    if (!mReason) e.reason = 'Please select a reason.'
    if (Object.keys(e).length) { setMErrors(e); return }

    try {
      await missControllerVisit(id, { missed_reason: mReason, notes: mNotes.trim() || undefined })
    } catch { /* demo mode */ }

    setSessionUpdates(prev => ({
      ...prev,
      [id]: { status: 'missed', missedReason: mReason, notes: mNotes.trim() },
    }))
    closeExpand()
  }

  async function handleCancelVisit(id: string) {
    if (!confirm('Are you sure you want to cancel this scheduled visit?')) return
    try {
      await cancelControllerVisit(id)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to cancel visit.'
      window.alert(msg)
      return
    }
    setSessionUpdates(prev => ({ ...prev, [id]: { status: 'cancelled' } }))
  }

  const _today = new Date()
  const todayStr = `${_today.getFullYear()}-${String(_today.getMonth()+1).padStart(2,'0')}-${String(_today.getDate()).padStart(2,'0')}`

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Weekly Review Dashboard</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Visit schedule &amp; history across your {locationIds.length} {locationIds.length === 1 ? 'location' : 'locations'}
            {locationIds.length === 1
              ? ` · ${apiLocations.find(l => l.id === locationIds[0])?.name ?? getLocation(locationIds[0])?.name ?? locationIds[0]}`
              : ` · ${controllerName}`
            }
          </p>
        </div>
        <div className="ph-right">
          <button
            className="btn btn-primary"
            onClick={() => onNavigate('ctrl-schedule', locationFilter !== 'all' ? { locationId: locationFilter } : {})}
          >
            + Schedule Visit
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Completed This Month"
          value={completedThisMonth}
          sub="visits completed"
          tooltipAlign="left"
          tooltip={{
            what: "The total number of physical verifications you have successfully finalized during the current calendar month.",
            how: "Counts all verification records with status 'Completed' dated within the current month.",
            formula: "COUNT(completed visits in current month)",
          }}
        />
        <KpiCard
          label="Upcoming Visits"
          value={scheduledCount}
          sub="scheduled"
          tooltip={{
            what: "Verification visits that are currently planned but have not yet been carried out.",
            how: "Counts all verification records with status 'Scheduled' that are dated in the future.",
            formula: "COUNT(visits where status = scheduled AND date > today)",
          }}
        />
        <KpiCard
          label="Missed Visits"
          value={missedCount}
          sub="need follow-up"
          accent={missedCount > 0 ? 'var(--red)' : undefined}
          highlight={missedCount > 0 ? 'amber' : false}
          tooltip={{
            what: "Scheduled physical verifications that passed their date without being completed.",
            how: "Sums all verification records currently holding a status of 'Missed'. These usually require re-scheduling.",
            formula: "COUNT(visits where status = missed)",
            flag: "Amber highlighting is applied when any missed visits exist.",
          }}
        />
        <KpiCard
          label="Avg Visit Gap"
          value={avgGap !== null ? `${avgGap}d` : '—'}
          sub="between completed visits"
          tooltipAlign="right"
          tooltip={{
            what: "The average interval of days between your consecutive physical verification visits.",
            how: "Calculates the date differences between chronological completed visits and averages them.",
            formula: "AVERAGE(date_diff(visit_n, visit_n-1))",
          }}
        />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Status filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'scheduled', 'completed', 'missed', 'cancelled'] as const).map(s => {
            const labels: Record<StatusFilter, string> = {
              all: 'All', scheduled: '📅 Scheduled', completed: '✅ Completed', missed: '❌ Missed', cancelled: '⊘ Cancelled',
            }
            const active = statusFilter === s
            return (
              <button
                key={s}
                // FIX: Update status, reset page, and close inline elements manually
                onClick={() => { setStatusFilter(s); setPage(0); closeExpand(); }}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  border: active ? '2px solid var(--g4)' : '1px solid var(--ow2)',
                  background: active ? 'var(--g7)' : '#fff',
                  color: active ? '#fff' : 'var(--tm)',
                }}
              >
                {labels[s]} · {counts[s]}
              </button>
            )
          })}
        </div>

        {/* Location dropdown */}
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          style={{
            padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
            border: '1.5px solid var(--ow2)', borderRadius: 8, background: '#fff', color: 'var(--td)',
            outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', minWidth: 130,
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230d3320' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center',
          }}
        >
          <option value="all" style={{ background: '#fff', color: 'var(--td)' }}>📍 All Locations ({locationIds.length})</option>
          {locationIds.map(id => {
            const loc = getLocation(id)
            const cc = (loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'
            return <option key={id} value={id} style={{ background: '#fff', color: 'var(--td)' }}>{loc?.name ?? id} (CC: {cc})</option>
          })}
        </select>
        

        {/* Location filter — Shared Design System Component
        <div style={{width:1, height:24, background:'#e2e8f0', flexShrink:0, margin:'0 4px'}}/>
        <div style={{
          display:'flex', alignItems:'center', gap:8,
          flexShrink:0,
          background:'#f8fafc', border:'1.5px solid #cbd5e1',
          borderRadius:10, padding:'5px 12px 5px 10px',
        }}>
          <span style={{fontSize:11,fontWeight:700,color:'#475569',whiteSpace:'nowrap',letterSpacing:'0.03em'}}>
            LOCATION
          </span>
          <select
            value={locationFilter}
            onChange={e => { setLocationFilter(e.target.value); setPage(0); closeExpand(); }}
            style={{
              fontSize:13, fontWeight:600, fontFamily:'inherit',
              color: locationFilter !== 'all' ? 'var(--g7)' : '#1e293b',
              background:'transparent', border:'none', outline:'none',
              cursor:'pointer', minWidth:160, maxWidth:220,
            }}
          >
            <option value="all">All Locations ({locationIds.length})</option>
            {locationIds.map(id => {
              const loc = getLocation(id)
              return <option key={id} value={id}>{loc?.name ?? id}</option>
            })}
          </select>
          {locationFilter !== 'all' && (
            <button
              onClick={() => { setLocationFilter('all'); setPage(0); closeExpand(); }}
              style={{
                background:'none', border:'none', cursor:'pointer', padding:0,
                fontSize:14, color:'#94a3b8', lineHeight:1, flexShrink:0,
              }}
              title="Clear location filter"
            >✕</button>
          )}
        </div>
         */}

      </div>

      {/* ── Visit table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Visit Schedule &amp; History</span>
          <span className="card-sub">
            {rows.length} record{rows.length !== 1 ? 's' : ''}
            {statusFilter   !== 'all' ? ` · ${statusFilter}` : ''}
            {locationFilter !== 'all' ? ` · ${apiLocations.find(l => l.id === locationFilter)?.name ?? getLocation(locationFilter)?.name ?? locationFilter}` : ''}
            {rows.length > PAGE_SIZE && ` · page ${page + 1} of ${totalPages}`}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No records found</div>
              <div style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 16 }}>
                {statusFilter !== 'all'
                  ? `No ${statusFilter} visits for the selected filters.`
                  : 'No visits scheduled or recorded yet.'}
              </div>
              <button className="btn btn-primary" onClick={() => onNavigate('ctrl-schedule')}>
                + Schedule a Visit
              </button>
            </div>
          ) : (
            <table className="dt" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: 110 }} />
                <col style={{ width: 80 }} />
                <col style={{ width: 140 }} />
                <col style={{ width: 145 }} />
                <col style={{ width: 120 }} />
                <col style={{ width: 110 }} />
                <col />
                <col style={{ width: 140 }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Total Cash</th>
                  <th style={{ textAlign: 'right' }}>vs Imprest</th>
                  <th>Notes / Reason</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(v => {
                  const loc        = getLocation(v.locationId)
                  const isFuture   = v.date > todayStr
                  const isExpanded = expandedId === v.id
                  // Use API-computed variance — only available for completed visits
                  const hasObserved = v.status === 'completed' && v.observedTotal != null && v.observedTotal > 0
                  const variance   = hasObserved ? (v.varianceVsImprest ?? null) : null
                  const pct        = hasObserved ? (v.variancePct ?? null) : null
                  const varCol     = pct !== null
                    ? (Math.abs(pct) > tolerance ? 'var(--red)' : Math.abs(pct) > tolerance / 2 ? 'var(--amb)' : 'var(--g7)')
                    : 'var(--wg)'
                  const dateLabel  = new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })


                  return (
                    <Fragment key={v.id}>

                      {/* ── Data row ── */}
                      <tr style={{
                        background: isExpanded ? 'var(--g0)' : undefined,
                        borderLeft: isExpanded ? '3px solid var(--g4)' : undefined,
                        opacity: v.status === 'cancelled' ? 0.5 : undefined,
                      }}>

                        {/* Date */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{dateLabel}</div>
                          {isFuture && v.status === 'scheduled' && (
                            <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, marginTop: 2 }}>
                              UPCOMING
                            </div>
                          )}
                        </td>

                        {/* Day */}
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 12,
                            background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)',
                          }}>
                            {DOW_LABELS[v.dayOfWeek]}
                          </span>
                        </td>

                        {/* Location */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? v.locationId}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'monospace' }}>CC: {(loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'}</div>
                        </td>

                        {/* Status + indicators */}
                        <td>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                            <StatusBadge status={v.status} />
                            {v.warningFlag && (
                              <span style={{ fontSize: 10, color: '#92400e', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                                ⚠️ DOW Warning
                              </span>
                            )}
                            {(() => {
                              const vDate = new Date(v.date + 'T12:00:00')
                              const dow = vDate.getDay() // 0=Sun
                              // Compute Friday of the visit's week
                              const fridayOffset = dow === 0 ? -2 : 5 - dow
                              const friday = new Date(vDate)
                              friday.setDate(vDate.getDate() + fridayOffset)
                              const _today = new Date()
                              const todayDate = new Date(_today.getFullYear(), _today.getMonth(), _today.getDate())
                              if ((v.status === 'scheduled' || v.status === 'completed') && todayDate <= friday) {
                                return (
                                  <span style={{ fontSize: 10, color: 'var(--ts)', display: 'flex', alignItems: 'center', gap: 3 }} title={`Location blocked until end of week (${friday.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })})`}>
                                    🔒 Blocked this week
                                  </span>
                                )
                              }
                              return null
                            })()}
                          </div>
                        </td>

                        {/* Observed Total */}
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                          {hasObserved
                            ? formatCurrency(v.observedTotal!)
                            : <span style={{ color: 'var(--wg)', fontFamily: 'inherit', fontSize: 12 }}>—</span>
                          }
                        </td>

                        {/* vs Imprest */}
                        <td style={{ textAlign: 'right' }}>
                          {variance !== null && pct !== null ? (
                            <>
                              <span style={{ color: varCol, fontWeight: 500, fontSize: 13 }}>
                                {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
                              </span>
                              <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                                ({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)
                              </div>
                            </>
                          ) : (
                            <span style={{ color: 'var(--wg)', fontSize: 12 }}>—</span>
                          )}
                        </td>

                        {/* Notes / Reason */}
                        <td style={{ fontSize: 12, maxWidth: 220 }}>
                          {v.missedReason ? (
                            <span style={{ color: 'var(--red)', fontSize: 11 }}>
                              {v.missedReason.length > 42 ? v.missedReason.slice(0, 42) + '…' : v.missedReason}
                              {v.notes && <span style={{ color: 'var(--ts)', display: 'block', marginTop: 2 }}>{v.notes.length > 40 ? v.notes.slice(0, 40) + '…' : v.notes}</span>}
                            </span>
                          ) : v.notes ? (
                            <span style={{ color: 'var(--ts)' }}>
                              {v.notes.length > 50 ? v.notes.slice(0, 50) + '…' : v.notes}
                            </span>
                          ) : (
                            <span style={{ color: 'var(--wg)' }}>—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {v.status === 'scheduled' ? (() => {
                            // Action rules based on date/time and SLA window
                            const vDate = v.date
                            const isPast = vDate < todayStr
                            const isToday = vDate === todayStr
                            let pastScheduledTime = false
                            let pastSlaWindow = false
                            if (isToday && v.scheduledTime) {
                              const [hh, mm] = v.scheduledTime.split(':').map(Number)
                              const schedMs = new Date().setHours(hh, mm, 0, 0)
                              const nowMs = Date.now()
                              pastScheduledTime = nowMs >= schedMs
                              pastSlaWindow = nowMs > schedMs + slaHours * 3600000
                            }
                            const isFuture = vDate > todayStr
                            const showComplete = isToday && !pastSlaWindow
                            const showMiss = isPast
                            const showCancel = isFuture || (isToday && !pastScheduledTime)

                            return (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              {showComplete && (
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }}
                                onClick={() => openExpand(v.id, 'complete')}>
                                Mark as Completed
                              </button>
                              )}
                              {showMiss && (
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 12px', color: 'var(--red)' }}
                                onClick={() => openExpand(v.id, 'miss')}>
                                Mark as Missed
                              </button>
                              )}
                              {showCancel && (
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 12px', color: 'var(--ts)' }}
                                onClick={() => handleCancelVisit(v.id)}>
                                ⊘ Cancel
                              </button>
                              )}
                            </div>
                            )
                          })() : v.status === 'completed' ? (
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '4px 12px', color: 'var(--g7)', borderColor: 'var(--g3)' }}
                              onClick={() => openExpand(v.id, 'view')}
                            >
                              ✅ Completed
                            </button>
                          ) : v.status === 'missed' ? (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '4px 12px', color: 'var(--red)', fontWeight: 600 }}
                              onClick={() => openExpand(v.id, 'view')}
                            >
                              ❌ View Missed
                            </button>
                          ) : v.status === 'cancelled' ? (
                            <span style={{ fontSize: 11, color: '#737373', fontWeight: 600 }}>⊘ Cancelled</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Expand: Complete Visit ── */}
                      {isExpanded && expandAction === 'complete' && (() => {
                        const subStatus = getSubStatus(v.locationId, v.date)
                        const subRole = getSubRole(v.locationId, v.date)
                        // Path A: operator submitted (pending or approved) — controller reviews sections
                        // Path B: no submission, rejected, OR controller/DGM filled the form themselves
                        const isPathA = (subStatus === 'pending_approval' || subStatus === 'approved') && subRole === 'OPERATOR'
                        const isPathB = !subStatus || subStatus === 'rejected' || subRole !== 'OPERATOR'
                        const reviewDone = !!sessionStorage.getItem(`visit_review_${v.id}`)
                        const ctrlFormDone = !!sessionStorage.getItem(`verifier_form_${v.id}`)
                        const canConfirm = isPathA ? (reviewDone && !!cSig) : (ctrlFormDone && !!cSig)

                        return (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{
                              background: 'var(--g0)', borderLeft: '4px solid var(--g4)',
                              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
                            }}>

                              {/* Path A: Submission exists (pending or approved) — View & Approve */}
                              {isPathA && (
                                <div style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <button className="btn btn-ghost"
                                      style={{ fontSize: 11, padding: '6px 12px', height: 'fit-content' }}
                                      onClick={() => onNavigate('op-readonly', {
                                        locationId: v.locationId, date: v.date,
                                        submissionId: getSubId(v.locationId, v.date) ?? '',
                                        visitId: v.id, fromPanel: 'ctrl-dashboard',
                                        expandVisitId: v.id, expandAction: 'complete',
                                        completionMode: 'true',
                                      })}>
                                      👁 View & Approve
                                    </button>
                                    {subStatus === 'approved' && <span style={{ fontSize: 11, color: 'var(--g7)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Approved</span>}
                                    {subStatus === 'pending_approval' && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>⏳ Pending approval</span>}
                                  </div>
                                  {(() => {
                                    const subTotal = getSubTotalCash(v.locationId, v.date)
                                    return subTotal !== null ? (
                                      <div>
                                        <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Submission Total</label>
                                        <div style={{ fontSize: 18, fontFamily: 'DM Serif Display,serif', color: 'var(--g8)' }}>{formatCurrency(subTotal)}</div>
                                        <div style={{ fontSize: 10, color: 'var(--ts)' }}>from operator form</div>
                                      </div>
                                    ) : null
                                  })()}
                                </div>
                              )}

                              {/* Path B: No submission or rejected — Controller fills form */}
                              {isPathB && (
                                <div style={{
                                  background: subStatus === 'rejected' ? '#fff5f5' : '#fffbeb',
                                  border: `1px solid ${subStatus === 'rejected' ? '#fca5a5' : '#fcd34d'}`,
                                  borderRadius: 8, padding: '16px 20px',
                                }}>
                                  <div style={{ fontWeight: 700, fontSize: 12, color: subStatus === 'rejected' ? 'var(--red)' : '#92400e', marginBottom: 6 }}>
                                    {subStatus === 'rejected' ? '❌ Operator\'s form was rejected' : '📋 No operator submission'}
                                  </div>
                                  <div style={{ fontSize: 12, color: 'var(--td)', lineHeight: 1.55, marginBottom: 12 }}>
                                    {subStatus === 'rejected'
                                      ? 'The operator\'s cash count was rejected. Please fill a new cash count form to complete this visit.'
                                      : 'The operator has not submitted a cash count for this date. Please fill the form to complete this visit.'}
                                  </div>
                                  <div style={{ display: 'flex', gap: 8 }}>
                                    {!ctrlFormDone ? (
                                      <button className="btn btn-primary" style={{ fontSize: 12 }}
                                        onClick={() => onNavigate('op-form', {
                                          locationId: v.locationId, date: v.date,
                                          visitId: v.id, from: 'ctrl-dashboard',
                                          verifierFillMode: 'true', verifierRole: 'CONTROLLER',
                                        })}>
                                        📝 Fill Cash Count Form
                                      </button>
                                    ) : (
                                      <span style={{ fontSize: 11, color: 'var(--g7)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Form submitted & auto-approved</span>
                                    )}
                                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>Close</button>
                                  </div>
                                </div>
                              )}

                              {/* Full completion form — when Path A review is done OR Path B form is done */}
                              {((isPathA && reviewDone) || (isPathB && ctrlFormDone)) && (
                                <>
                                  {/* DOW warning */}
                                  {dowWarning && (
                                    <div style={{
                                      background: 'var(--amb-bg)', border: '1px solid #fcd34d',
                                      borderRadius: 8, padding: '12px 16px',
                                    }}>
                                      <div style={{ fontWeight: 700, fontSize: 12, color: '#92400e', marginBottom: 4 }}>
                                        ⚠️ Day-of-week pattern detected
                                      </div>
                                      <div style={{ fontSize: 12, color: 'var(--td)', marginBottom: 10, lineHeight: 1.55 }}>
                                        This location was verified on a <strong>{dowWarning.dayLabel}</strong> as recently
                                        as <strong>{dowWarning.lastDate}</strong>
                                        {dowWarning.count > 1 ? ` (${dowWarning.count}× in past 2 weeks)` : ''}.
                                      </div>
                                      <select
                                        className="f-inp"
                                        value={cWarnReason}
                                        onChange={e => { setCWarnReason(e.target.value as DowWarningReason | ''); setCErrors(p => ({ ...p, warn: '' })) }}
                                        style={{ fontSize: 12, width: 360 }}
                                      >
                                        <option value="">— Select reason to proceed —</option>
                                        <option value="operational">Operational necessity — only available day</option>
                                        <option value="requested">Requested by location / area management</option>
                                        <option value="followup">Follow-up visit after a discrepancy</option>
                                        <option value="other">Other (documented separately)</option>
                                      </select>
                                      {cErrors.warn && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{cErrors.warn}</div>}
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>
                                    {/* Notes */}
                                    <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column' }}>
                                      <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                        Notes <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                      </label>
                                      <textarea
                                        className="f-inp"
                                        placeholder="e.g. All sections verified. Minor coin discrepancy in Section B."
                                        value={cNotes}
                                        onChange={e => setCNotes(e.target.value)}
                                        style={{ width: '100%', height: 80, resize: 'none', fontSize: 12, flexGrow: 1 }}
                                      />
                                    </div>

                                    {/* Digital Signature */}
                                    <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column' }}>
                                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                        <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)' }}>Digital Signature *</label>
                                        <button type="button" onClick={clearSig}
                                          style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--ow2)', background: '#fff', color: 'var(--ts)', cursor: 'pointer', fontFamily: 'inherit' }}
                                        >Clear</button>
                                      </div>
                                      <div style={{ position: 'relative', height: 80, flexGrow: 1 }}>
                                        <canvas
                                          ref={cSigRef}
                                          width={240} height={80}
                                          onMouseDown={sigMouseDown} onMouseMove={sigMouseMove}
                                          onMouseUp={sigEnd} onMouseLeave={sigEnd}
                                          onTouchStart={sigTouchStart} onTouchMove={sigTouchMove} onTouchEnd={sigEnd}
                                          style={{
                                            display: 'block', width: '100%', height: 80,
                                            border: `1px dashed ${cErrors.sig ? 'var(--red)' : 'var(--g3)'}`,
                                            borderRadius: 6, background: '#fff',
                                            cursor: 'crosshair', touchAction: 'none',
                                          }}
                                        />
                                        {!cSig && (
                                          <div style={{
                                            position: 'absolute', inset: 0, display: 'flex',
                                            alignItems: 'center', justifyContent: 'center',
                                            pointerEvents: 'none', fontSize: 11, color: '#bbb', userSelect: 'none',
                                          }}>
                                            Sign here
                                          </div>
                                        )}
                                      </div>
                                      {cErrors.sig && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{cErrors.sig}</div>}
                                    </div>
                                  </div>

                                  {/* Confirm button + helper */}
                                  {cErrors.api && (
                                    <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 500 }}>{cErrors.api}</div>
                                  )}

                                  {earlyWarning && (
                                    <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 8, padding: '10px 14px', marginBottom: 8 }}>
                                      <div style={{ fontSize: 12, fontWeight: 600, color: '#92400e', marginBottom: 6 }}>
                                        Early Completion Warning
                                      </div>
                                      <div style={{ fontSize: 11, color: '#78350f', marginBottom: 8 }}>{earlyWarning}</div>
                                      <button
                                        className="btn btn-primary"
                                        style={{ fontSize: 11, padding: '5px 14px', background: '#d97706' }}
                                        onClick={() => { setEarlyWarning(null); handleComplete(v.id, true) }}
                                      >
                                        Acknowledge &amp; Complete
                                      </button>
                                    </div>
                                  )}

                                  {!canConfirm && (
                                    <div style={{ fontSize: 11, color: 'var(--ts)', fontStyle: 'italic' }}>
                                      Please sign before confirming.
                                    </div>
                                  )}

                                  <div style={{ display: 'flex', gap: 8 }}>
                                    <button
                                      className="btn btn-primary"
                                      style={{ fontSize: 12, padding: '7px 20px', opacity: canConfirm ? 1 : 0.5 }}
                                      onClick={() => handleComplete(v.id)}
                                      disabled={!canConfirm}
                                    >
                                      ✓ Confirm Completion
                                    </button>
                                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                        )
                      })()}

                      {/* ── Expand: Mark Missed ── */}
                      {isExpanded && expandAction === 'miss' && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{
                              background: 'var(--red-bg)', borderLeft: '4px solid var(--red)',
                              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14,
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>
                                ❌ Mark Visit as Missed — {loc?.name ?? v.locationId}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--td)', lineHeight: 1.55 }}>
                                This visit will be recorded as missed and flagged in compliance reports.
                                You can reschedule by creating a new visit from the Dashboard.
                              </div>

                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div style={{ flex: '0 0 260px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Reason *
                                  </label>
                                  <select
                                    className="f-inp"
                                    value={mReason}
                                    onChange={e => { setMReason(e.target.value); setMErrors(p => ({ ...p, reason: '' })) }}
                                    style={{ width: '100%', fontSize: 12 }}
                                  >
                                    <option value="">— Select reason —</option>
                                    {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  {mErrors.reason && (
                                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{mErrors.reason}</div>
                                  )}
                                </div>
                                <div style={{ flex: '1 1 260px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Additional Notes <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                  </label>
                                  <textarea
                                    className="f-inp"
                                    rows={2}
                                    placeholder="Any additional context…"
                                    value={mNotes}
                                    onChange={e => setMNotes(e.target.value)}
                                    style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
                                  />
                                </div>
                              </div>

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn"
                                  style={{
                                    fontSize: 12, padding: '7px 20px',
                                    background: 'var(--red)', color: '#fff',
                                    border: 'none', borderRadius: 8, cursor: 'pointer',
                                    fontFamily: 'inherit', fontWeight: 600,
                                  }}
                                  onClick={() => handleMiss(v.id)}
                                >
                                  Confirm Missed
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Expand: View Completed Visit (readonly) ── */}
                      {isExpanded && expandAction === 'view' && v.status === 'completed' && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{
                              background: 'var(--g0)', borderLeft: '4px solid var(--g4)',
                              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g8)' }}>
                                ✅ Completed Visit — {loc?.name ?? v.locationId}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>
                                  {new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>

                              {/* View submission (readonly link) */}
                              <div>
                                <button className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '6px 12px' }}
                                  onClick={() => onNavigate('op-readonly', {
                                    locationId: v.locationId,
                                    date: v.date,
                                    submissionId: getSubId(v.locationId, v.date) ?? '',
                                    visitId: v.id,
                                    fromPanel: 'ctrl-dashboard',
                                    expandVisitId: v.id,
                                    expandAction: 'view'
                                  })}>
                                  👁 View Submission
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>

                                {/* Notes — readonly */}
                                <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Notes
                                  </label>
                                  <textarea
                                    className="f-inp"
                                    value={v.notes ?? ''}
                                    readOnly
                                    style={{ width: '100%', height: 80, resize: 'none', fontSize: 12, flexGrow: 1, background: '#f9fafb', cursor: 'default', color: 'var(--td)' }}
                                  />
                                </div>

                                {/* Signature — readonly image */}
                                <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Digital Signature
                                  </label>
                                  <div style={{ height: 80, border: '1px dashed var(--g3)', borderRadius: 6, background: '#f9fafb', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                    {v.signatureData ? (
                                      <img src={v.signatureData} alt="Signature" style={{ maxWidth: '100%', maxHeight: 80, objectFit: 'contain' }} />
                                    ) : (
                                      <span style={{ fontSize: 11, color: '#bbb' }}>No signature recorded</span>
                                    )}
                                  </div>
                                </div>
                              </div>

                              <div>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>
                                  Close
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* ── Expand: View Missed Visit (readonly) ── */}
                      {isExpanded && expandAction === 'view' && v.status === 'missed' && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{ background: 'var(--red-bg)', borderLeft: '4px solid var(--red)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>
                                ❌ Missed Visit — {loc?.name ?? v.locationId}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>
                                  {new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>
                              {v.missedReason && (
                                <div>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Reason</label>
                                  <div style={{ fontSize: 13, color: 'var(--red)' }}>{v.missedReason}</div>
                                </div>
                              )}
                              {v.notes && (
                                <div>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Notes</label>
                                  <div style={{ fontSize: 12, color: 'var(--td)', lineHeight: 1.5 }}>{v.notes}</div>
                                </div>
                              )}
                              <div>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>Close</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          )}

          {/* ── Pagination footer ── */}
          {totalPages > 1 && (
            <div style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)',
            }}>
              <span style={{ fontSize: 12, color: 'var(--ts)' }}>
                Showing {fromEntry}–{toEntry} of {rows.length} records
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '4px 12px' }}
                  disabled={page === 0}
                  onClick={() => setPage(p => p - 1)}
                >← Prev</button>
                {pageNums(page, totalPages).map((n, i) =>
                  n === 'gap' ? (
                    <span key={`gap-${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => setPage(n as number)}
                      style={{
                        width: 30, height: 30, borderRadius: 6, fontSize: 12,
                        cursor: 'pointer', fontFamily: 'inherit',
                        fontWeight: page === n ? 700 : 400,
                        border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`,
                        background: page === n ? 'var(--g7)' : '#fff',
                        color: page === n ? '#fff' : 'var(--tm)',
                        transition: 'all 0.12s',
                      }}
                    >{n + 1}</button>
                  )
                )}
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '4px 12px' }}
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage(p => p + 1)}
                >Next →</button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}