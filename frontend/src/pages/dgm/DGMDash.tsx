import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { VERIFICATIONS, SUBMISSIONS, getLocation, formatCurrency, IMPREST, todayStr } from '../../mock/data'
import type { VerificationRecord } from '../../mock/data'
import { listDgmVerifications, completeDgmVisit, missDgmVisit } from '../../api/verifications'
import { listSubmissions } from '../../api/submissions'
import type { ApiVerification } from '../../api/types'
import KpiCard from '../../components/KpiCard'

function mapApiVerification(v: ApiVerification): VerificationRecord {
  return {
    id: v.id, locationId: v.location_id, verifierName: v.verifier_name,
    type: v.verification_type === 'CONTROLLER' ? 'controller' : 'dgm',
    date: v.verification_date, monthYear: v.month_year ?? undefined,
    observedTotal: v.observed_total ?? undefined, notes: v.notes,
    dayOfWeek: v.day_of_week, warningFlag: v.warning_flag, status: v.status,
    missedReason: v.missed_reason ?? undefined, scheduledTime: v.scheduled_time ?? undefined,
  }
}

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
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

type StatusFilter = 'all' | 'scheduled' | 'overdue' | 'completed' | 'missed'

type SessionUpdate = {
  status: 'completed' | 'missed' | 'cancelled'
  observedTotal?: number
  missedReason?: string
  notes?: string
}

interface DashRecord extends VerificationRecord {
  isOverdue?: boolean
}

function StatusBadge({ status, isOverdue }: { status: string; isOverdue?: boolean }) {
  if (status === 'scheduled') {
    if (isOverdue) return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#fffbeb', color: '#b45309', border: '1px solid #fcd34d' }}>⚠️ Overdue</span>
    return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>📅 Scheduled</span>
  }
  if (status === 'completed') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)' }}>✅ Completed</span>
  )
  if (status === 'missed') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #fca5a5' }}>❌ Missed</span>
  )
  return <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
}

interface Props {
  dgmName: string
  locationIds: string[]
  ctx?: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function DGMDash({ dgmName, locationIds, ctx, onNavigate }: Props) {
  const today   = todayStr()
  const nowDate = new Date()
  const curYear  = nowDate.getFullYear()
  const curMonth = nowDate.getMonth()

  // ── Filter state ───────────────────────────────────────────────────────
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [page,           setPage]           = useState(0)

  // ── Inline expand state ────────────────────────────────────────────────
  const [expandedId,   setExpandedId]   = useState<string | null>(ctx?.expandVisitId || null)
  const [expandAction, setExpandAction] = useState<'complete' | 'miss' | 'view' | null>((ctx?.expandAction as 'complete' | 'miss' | 'view') || null)
  const [lastCtxVisitId, setLastCtxVisitId] = useState<string | null>(ctx?.expandVisitId || null)

  // Auto-expand if returning to this panel via navigation context (React compliant sync)
  if (ctx?.expandVisitId && ctx.expandVisitId !== lastCtxVisitId) {
    setLastCtxVisitId(ctx.expandVisitId)
    setExpandedId(ctx.expandVisitId)
    setExpandAction(ctx.expandAction as 'complete' | 'miss' | 'view')
  }

  const [cNotes,  setCNotes]  = useState('')
  const [cSig,    setCSig]    = useState('')
  const [cErrors, setCErrors] = useState<Record<string, string>>({})

  const cSigRef    = useRef<HTMLCanvasElement | null>(null)
  const isDrawing  = useRef(false)

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

  const [mReason, setMReason] = useState('')
  const [mNotes,  setMNotes]  = useState('')
  const [mErrors, setMErrors] = useState<Record<string, string>>({})

  // Session updates — NOT persisted to sessionStorage (fresh API fetch on every mount)
  const [sessionUpdates, setSessionUpdates] = useState<Record<string, SessionUpdate>>({})

  // Clear any stale legacy key
  useEffect(() => { sessionStorage.removeItem('dgm_session_updates') }, [])

  const [apiVerifs, setApiVerifs] = useState<VerificationRecord[]>([])
  const [apiSubsMap, setApiSubsMap] = useState<Record<string, { status: string; id: string; totalCash: number }>>({})

  const locIdsJoined = locationIds.join(',')
  useEffect(() => {
    // 1. Fetch Verifications
    listDgmVerifications({ page_size: 100 })
      .then(r => setApiVerifs(r.items.map(mapApiVerification).filter(v => locationIds.includes(v.locationId))))
      .catch(() => { /* fall back to mock */ })

    // 2. Fetch Submissions to check approval status + get IDs for navigation
    if (locationIds.length > 0) {
      Promise.all(locationIds.map(id => listSubmissions({ location_id: id, page_size: 100 }).then(r => r.items)))
        .then(arrays => {
          const map: Record<string, { status: string; id: string; totalCash: number }> = {}
          arrays.flat().forEach(s => {
            map[`${s.location_id}_${s.submission_date}`] = { status: s.status, id: s.id, totalCash: s.total_cash }
          })
          setApiSubsMap(map)
        })
        .catch(() => { /* fall back to mock */ })
    }
  }, [locationIds, locIdsJoined])

  function getSubStatus(locId: string, date: string): string | null {
    const key = `${locId}_${date}`
    if (apiSubsMap[key]) return apiSubsMap[key].status
    const mockSub = SUBMISSIONS.find(s => s.locationId === locId && s.date === date)
    if (mockSub) {
      const override = sessionStorage.getItem(`op_status_${mockSub.id}`) || sessionStorage.getItem(`op_status_${locId}_${date}`)
      if (override) return override
      return mockSub.status
    }
    return null
  }

  function getSubId(locId: string, date: string): string | undefined {
    const key = `${locId}_${date}`
    if (apiSubsMap[key]) return apiSubsMap[key].id
    return SUBMISSIONS.find(s => s.locationId === locId && s.date === date)?.id
  }

  function getSubTotalCash(locId: string, date: string): number | null {
    const key = `${locId}_${date}`
    if (apiSubsMap[key]) return apiSubsMap[key].totalCash
    return SUBMISSIONS.find(s => s.locationId === locId && s.date === date)?.totalCash ?? null
  }

  function closeExpand() {
    setExpandedId(null); setExpandAction(null)
    setCNotes(''); setCSig(''); setCErrors({})
    setMReason(''); setMNotes(''); setMErrors({})
  }

  function openExpand(id: string, action: 'complete' | 'miss' | 'view') {
    if (expandedId === id && expandAction === action) { closeExpand(); return }
    closeExpand()
    setExpandedId(id)
    setExpandAction(action)
  }

  const sourceVerifs = apiVerifs.length > 0 ? apiVerifs : VERIFICATIONS.filter(v => v.type === 'dgm' && locationIds.includes(v.locationId))

  // ── All DGM visits merged with session overrides & overdue logic ───────
  const allRecords = useMemo<DashRecord[]>(() =>
    sourceVerifs
      .map(v => {
        const upd = sessionUpdates[v.id]
        const merged: DashRecord = { ...v }
        if (upd) {
          merged.status = upd.status as 'scheduled' | 'completed' | 'missed' | 'cancelled'
          if (upd.observedTotal !== undefined) merged.observedTotal = upd.observedTotal
          if (upd.missedReason)               merged.missedReason  = upd.missedReason
          if (upd.notes)                      merged.notes         = upd.notes
        }

        // Apply 48-hour overdue & auto-miss logic
        if (merged.status === 'scheduled') {
          const vTime = new Date(merged.date + 'T00:00:00').getTime()
          const tTime = new Date(today + 'T00:00:00').getTime()
          const diffDays = Math.floor((tTime - vTime) / (1000 * 3600 * 24))

          if (diffDays > 2) {
            merged.status = 'missed'
            merged.missedReason = 'Other (documented separately)'
            merged.notes = merged.notes ? merged.notes + ' (Auto-missed after 48h)' : 'Auto-missed after 48h'
          } else if (diffDays > 0) {
            merged.isOverdue = true
          }
        }
        return merged
      })
      .sort((a, b) => b.date.localeCompare(a.date)),
  [sourceVerifs, sessionUpdates, today])

  // ── visitMap for KPIs + completedMap for duplicate-visit warnings ────
  const { visitMap, completedMap } = useMemo(() => {
    const visitMap    = new Set<string>()
    const completedMap = new Map<string, VerificationRecord>()
    allRecords.forEach(v => {
      if (v.status === 'completed') {
        const my  = v.monthYear ?? v.date.slice(0, 7)
        const key = `${v.locationId}|${my}`
        visitMap.add(key)
        if (!completedMap.has(key)) completedMap.set(key, v)
      }
    })
    return { visitMap, completedMap }
  }, [allRecords])

  // ── KPIs ──────────────────────────────────────────────────────────────
  const curMY        = `${curYear}-${String(curMonth + 1).padStart(2, '0')}`
  const visitedNow   = locationIds.filter(id => visitMap.has(`${id}|${curMY}`)).length
  const remainingNow = locationIds.length - visitedNow
  const overdueTotal = locationIds.filter(id => {
    for (let m = 0; m < curMonth; m++) {
      const my = `${curYear}-${String(m + 1).padStart(2, '0')}`
      if (!visitMap.has(`${id}|${my}`)) return true
    }
    return false
  }).length
  const missedCount = allRecords.filter(v => v.status === 'missed').length

  // ── Filtered rows for table ────────────────────────────────────────────
  const dashRows = useMemo(() => {
    let r = allRecords.filter(v => v.status !== 'cancelled') // Hide cancelled visits
    if (locationFilter !== 'all') r = r.filter(v => v.locationId === locationFilter)
    
    if (statusFilter === 'overdue') {
      r = r.filter(v => v.status === 'scheduled' && v.isOverdue)
    } else if (statusFilter === 'scheduled') {
      r = r.filter(v => v.status === 'scheduled' && !v.isOverdue)
    } else if (statusFilter !== 'all') {
      r = r.filter(v => v.status === statusFilter)
    }
    return r
  }, [allRecords, locationFilter, statusFilter])

  const dashCounts = useMemo(() => {
    const base = locationFilter === 'all' 
      ? allRecords.filter(v => v.status !== 'cancelled') 
      : allRecords.filter(v => v.locationId === locationFilter && v.status !== 'cancelled')
      
    return {
      all:       base.length,
      scheduled: base.filter(v => v.status === 'scheduled' && !v.isOverdue).length,
      overdue:   base.filter(v => v.status === 'scheduled' && v.isOverdue).length,
      completed: base.filter(v => v.status === 'completed').length,
      missed:    base.filter(v => v.status === 'missed').length,
    }
  }, [allRecords, locationFilter])

  const totalPages = Math.max(1, Math.ceil(dashRows.length / PAGE_SIZE))
  const pageRows   = dashRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromEntry  = dashRows.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toEntry    = Math.min((page + 1) * PAGE_SIZE, dashRows.length)

  async function handleComplete(id: string) {
    const e: Record<string, string> = {}
    
    // 1. Check if the submission is approved
    const rec = allRecords.find(r => r.id === id)
    if (rec && getSubStatus(rec.locationId, rec.date) !== 'approved') {
      e.approval = "The submission must be approved before confirming visit completion. Please open the form using 'View' and approve it first."
    }

    if (!cSig) e.sig = 'Please sign before confirming.'
    if (Object.keys(e).length) { setCErrors(e); return }

    // Fallback to 0 since observed cash is tracked via the submission form itself now
    const obs = 0 

    try {
      await completeDgmVisit(id, { observed_total: obs, signature_data: cSig, notes: cNotes.trim() || undefined })
    } catch { /* demo mode */ }
    setSessionUpdates(prev => ({ ...prev, [id]: { status: 'completed', observedTotal: obs, notes: cNotes.trim() } }))
    closeExpand()
  }

  async function handleMiss(id: string) {
    const e: Record<string, string> = {}
    if (!mReason) e.reason = 'Please select a reason.'
    if (Object.keys(e).length) { setMErrors(e); return }
    try {
      await missDgmVisit(id, { missed_reason: mReason, notes: mNotes.trim() || undefined })
    } catch { /* demo mode */ }
    setSessionUpdates(prev => ({ ...prev, [id]: { status: 'missed', missedReason: mReason, notes: mNotes.trim() } }))
    closeExpand()
  }

  async function handleCancel(id: string) {
    if (!confirm('Are you sure you want to cancel this scheduled visit?')) return
    // Demo mode: Mark as cancelled in local session
    setSessionUpdates(prev => ({ ...prev, [id]: { status: 'cancelled' } }))
    closeExpand()
  }

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Coverage Dashboard</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Visit schedule across {locationIds.length} {locationIds.length === 1 ? 'location' : 'locations'}
            {locationIds.length === 1
              ? ` · ${getLocation(locationIds[0])?.name ?? locationIds[0]}`
              : ` · ${dgmName}`
            }
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-primary" onClick={() => onNavigate('dgm-log')}>+ Schedule Visit</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-row" style={{ marginBottom: 22, position: 'relative', zIndex: 10, overflow: 'visible' }}>
        <KpiCard
          label="Visited This Month"
          value={<>{visitedNow}<span style={{ fontSize: 16, fontWeight: 400, color: 'var(--ts)' }}> / {locationIds.length}</span></>}
          sub={`${MONTH_FULL[curMonth]} ${curYear}`}
          tooltipAlign="left"
          tooltip={{
            what: "The number of unique locations you have successfully visited and verified during the current calendar month.",
            how: "Calculates the total count of locations assigned to you that contain at least one 'Completed' verification record within the current month."
          }}
        />

        <KpiCard
          label="Remaining"
          value={remainingNow}
          sub="this month"
          highlight={remainingNow > 0 ? 'amber' : false}
          tooltip={{
            what: "Locations assigned to you that still require a verification visit before the end of the current month.",
            how: "Subtracts the number of unique visited locations from the total number of locations assigned to your profile."
          }}
        />

        <KpiCard
          label="Overdue Months"
          value={overdueTotal}
          sub="past months missed"
          highlight={overdueTotal > 0 ? 'red' : false}
          tooltip={{
            what: "The total number of historical months where a required physical verification visit was completely missed for any of your assigned locations.",
            how: "Evaluates all preceding months in the current year and flags any assigned location lacking a 'Completed' verification record.",
            flag: "A high number of overdue months severely impacts regional compliance metrics."
          }}
        />

        <KpiCard
          label="Missed Visits"
          value={missedCount}
          sub="need follow-up"
          highlight={missedCount > 0 ? 'amber' : false}
          tooltipAlign="right"
          tooltip={{
            what: "Scheduled visits that were explicitly canceled or marked as 'Missed' in the system.",
            how: "Sums all verification records currently possessing a 'Missed' status across all your assigned locations.",
            flag: "Missed visits should be rescheduled promptly to maintain coverage requirements."
          }}
        />
      </div>

      {/* ── Filter row ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Status chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['all', 'scheduled', 'overdue', 'completed', 'missed'] as const).map(s => {
            const labels: Record<StatusFilter, string> = {
              all: 'All', scheduled: '📅 Scheduled', overdue: '⚠️ Overdue', completed: '✅ Completed', missed: '❌ Missed',
            }
            const active = statusFilter === s
            return (
              <button
                key={s}
                onClick={() => { setStatusFilter(s); setPage(0); closeExpand(); }}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  border: active ? '2px solid var(--g4)' : '1px solid var(--ow2)',
                  background: active ? 'var(--g7)' : '#fff',
                  color: active ? '#fff' : 'var(--tm)',
                }}
              >
                {labels[s]} · {dashCounts[s]}
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
          <option value="all">📍 All Locations ({locationIds.length})</option>
          {locationIds.map(id => {
            const loc = getLocation(id)
            const cc = (loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'
            return <option key={id} value={id}>{loc?.name ?? id} (CC: {cc})</option>
          })}
        </select>
      </div>

      {/* ── Visit table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Visit Schedule</span>
          <span className="card-sub">
            {dashRows.length} record{dashRows.length !== 1 ? 's' : ''}
            {statusFilter   !== 'all' ? ` · ${statusFilter}` : ''}
            {locationFilter !== 'all' ? ` · ${getLocation(locationFilter)?.name ?? locationFilter}` : ''}
            {dashRows.length > PAGE_SIZE ? ` · page ${page + 1} of ${totalPages}` : ''}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {dashRows.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No records found</div>
              <div style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 16 }}>
                {statusFilter !== 'all'
                  ? `No ${statusFilter} visits for the selected filters.`
                  : 'No visits scheduled or recorded yet.'}
              </div>
              <button className="btn btn-primary" onClick={() => onNavigate('dgm-log')}>+ Schedule a Visit</button>
            </div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'right' }}>Observed Total</th>
                  <th style={{ textAlign: 'right' }}>vs Imprest</th>
                  <th>Notes / Reason</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(v => {
                  const loc        = getLocation(v.locationId)
                  const isFuture   = v.date > today
                  const isExpanded = expandedId === v.id
                  const expCash    = Number((loc as unknown as Record<string, number>)?.expected_cash || (loc as unknown as Record<string, number>)?.expectedCash || IMPREST)
                  const effObsTotal = (v.observedTotal && v.observedTotal > 0) ? v.observedTotal : getSubTotalCash(v.locationId, v.date)
                  const variance   = effObsTotal !== null && effObsTotal !== undefined ? Math.round((effObsTotal - expCash) * 100) / 100 : null
                  const pct        = variance !== null && expCash > 0 ? (variance / expCash) * 100 : null
                  const varCol     = pct !== null
                    ? (Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)')
                    : 'var(--wg)'
                  const dateLabel  = new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                  const my         = v.monthYear ?? v.date.slice(0, 7)
                  const alreadyVisited = v.status === 'scheduled' ? completedMap.get(`${v.locationId}|${my}`) : undefined

                  return (
                    <Fragment key={v.id}>
                      <tr style={{
                        background: isExpanded ? 'var(--g0)' : undefined,
                        borderLeft: isExpanded ? '3px solid var(--g4)' : undefined,
                      }}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{dateLabel}</div>
                          {isFuture && <div style={{ fontSize: 10, color: '#1d4ed8', fontWeight: 700, marginTop: 2 }}>UPCOMING</div>}
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? v.locationId}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)' }}>CC: {(loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'}</div>
                        </td>
                        <td><StatusBadge status={v.status} isOverdue={(v as DashRecord).isOverdue} /></td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                          {effObsTotal !== null && effObsTotal !== undefined
                            ? formatCurrency(effObsTotal)
                            : <span style={{ color: 'var(--wg)', fontFamily: 'inherit', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {variance !== null && pct !== null ? (
                            <>
                              <span style={{ color: varCol, fontWeight: 500, fontSize: 13 }}>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</span>
                              <div style={{ fontSize: 11, color: 'var(--ts)' }}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</div>
                            </>
                          ) : <span style={{ color: 'var(--wg)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, maxWidth: 220 }}>
                          {alreadyVisited && (
                            <div style={{
                              display: 'inline-flex', alignItems: 'flex-start', gap: 5,
                              background: '#fffbeb', border: '1px solid #fcd34d',
                              borderRadius: 6, padding: '4px 8px', marginBottom: v.notes ? 6 : 0,
                              fontSize: 11, color: '#92400e', lineHeight: 1.45,
                            }}>
                              <span style={{ flexShrink: 0, marginTop: 1 }}>⚠️</span>
                              <span>
                                Already visited on{' '}
                                <strong>{new Date(alreadyVisited.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong>
                                {alreadyVisited.notes ? ` — "${alreadyVisited.notes.slice(0, 40)}${alreadyVisited.notes.length > 40 ? '…' : ''}"` : ''}
                              </span>
                            </div>
                          )}
                          {v.missedReason ? (
                            <span style={{ color: 'var(--red)', fontSize: 11 }}>
                              {v.missedReason.length > 42 ? v.missedReason.slice(0, 42) + '…' : v.missedReason}
                            </span>
                          ) : v.notes ? (
                            <span style={{ color: 'var(--ts)' }}>{v.notes.length > 50 ? v.notes.slice(0, 50) + '…' : v.notes}</span>
                          ) : !alreadyVisited ? (
                            <span style={{ color: 'var(--wg)' }}>—</span>
                          ) : null}
                        </td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {v.status === 'completed' ? (
                            <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 12px', color: 'var(--g7)', fontWeight: 600 }} onClick={() => openExpand(v.id, 'view')}>✅ Completed</button>
                          ) : v.status === 'scheduled' ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button className="btn btn-primary" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => openExpand(v.id, 'complete')}>Mark as Completed</button>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 12px', color: 'var(--red)' }} onClick={() => openExpand(v.id, 'miss')}>Mark as Missed</button>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 12px', color: 'var(--ts)' }} onClick={() => handleCancel(v.id)}>⊘ Cancel</button>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* Expand: Complete */}
                      {isExpanded && expandAction === 'complete' && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{ background: 'var(--g0)', borderLeft: '4px solid var(--g4)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g8)' }}>
                                ✓ Complete Visit — {loc?.name ?? v.locationId}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>{dateLabel}</span>
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(() => {
                                    const st  = getSubStatus(v.locationId, v.date)
                                    const sid = getSubId(v.locationId, v.date)
                                    if (!sid) return (
                                      <span style={{ fontSize: 11, color: 'var(--ts)', fontStyle: 'italic' }}>
                                        ⏳ Waiting for operator to submit
                                      </span>
                                    )
                                    return (
                                      <>
                                        <button className="btn btn-ghost"
                                          style={{ fontSize: 11, padding: '6px 12px', height: 'fit-content' }}
                                          onClick={() => onNavigate('op-readonly', {
                                            locationId: v.locationId,
                                            date: v.date,
                                            submissionId: sid,
                                            visitId: v.id,
                                            fromPanel: 'dgm-dash',
                                            expandVisitId: v.id,
                                            expandAction: 'complete'
                                          })}>
                                          👁 View & Approve
                                        </button>
                                        {st === 'approved'         && <span style={{ fontSize: 11, color: 'var(--g7)',  fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Approved</span>}
                                        {st === 'rejected'         && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>❌ Rejected</span>}
                                        {st === 'pending_approval' && <span style={{ fontSize: 11, color: '#b45309',   fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>⏳ Pending approval</span>}
                                      </>
                                    )
                                  })()}
                                </div>

                                <div style={{ flex: '1 1 220px', display: 'flex', flexDirection: 'column' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Notes <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                  </label>
                                  <textarea
                                    className="f-inp"
                                    placeholder="e.g. All sections verified. Minor coin discrepancy noted."
                                    value={cNotes} onChange={e => setCNotes(e.target.value)}
                                    style={{ width: '100%', height: 80, resize: 'none', fontSize: 12, flexGrow: 1 }}
                                  />
                                </div>

                                <div style={{ flex: '0 0 240px', display: 'flex', flexDirection: 'column' }}>
                                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 5 }}>
                                    <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--td)' }}>Digital Signature *</label>
                                    <button
                                      type="button"
                                      onClick={clearSig}
                                      style={{ fontSize: 10, padding: '2px 8px', borderRadius: 4, border: '1px solid var(--ow2)', background: '#fff', color: 'var(--ts)', cursor: 'pointer', fontFamily: 'inherit' }}
                                    >Clear</button>
                                  </div>
                                  <div style={{ position: 'relative', height: 80, flexGrow: 1 }}>
                                    <canvas
                                      ref={cSigRef}
                                      width={240} height={80}
                                      onMouseDown={sigMouseDown}
                                      onMouseMove={sigMouseMove}
                                      onMouseUp={sigEnd}
                                      onMouseLeave={sigEnd}
                                      onTouchStart={sigTouchStart}
                                      onTouchMove={sigTouchMove}
                                      onTouchEnd={sigEnd}
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

                              {/* Validation Error Message */}
                              {cErrors.approval && (
                                <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: -10, fontWeight: 500 }}>
                                  {cErrors.approval}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 8 }}>
                                <button className="btn btn-primary" style={{ fontSize: 12, padding: '7px 20px' }} onClick={() => handleComplete(v.id)}>✓ Confirm Completion</button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>Cancel</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expand: View completed visit (readonly) */}
                      {isExpanded && expandAction === 'view' && v.status === 'completed' && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{ background: 'var(--g0)', borderLeft: '4px solid var(--g4)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g8)' }}>
                                ✅ Completed Visit — {loc?.name ?? v.locationId}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>{dateLabel}</span>
                              </div>

                              {/* View submission link */}
                              <div>
                                <button className="btn btn-ghost"
                                  style={{ fontSize: 11, padding: '6px 12px' }}
                                  onClick={() => onNavigate('op-readonly', {
                                    locationId: v.locationId,
                                    date: v.date,
                                    submissionId: getSubId(v.locationId, v.date) ?? '',
                                    visitId: v.id,
                                    fromPanel: 'dgm-dash',
                                    expandVisitId: v.id,
                                    expandAction: 'view'
                                  })}>
                                  👁 View Submission
                                </button>
                              </div>

                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                                {/* Notes readonly */}
                                <div style={{ flex: '1 1 220px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>Notes</label>
                                  <textarea
                                    className="f-inp" readOnly value={v.notes ?? ''}
                                    style={{ width: '100%', height: 80, resize: 'none', fontSize: 12, background: '#f9fafb', cursor: 'default', color: 'var(--td)' }}
                                  />
                                </div>
                                {/* Signature readonly */}
                                {v.signatureData && (
                                  <div style={{ flex: '0 0 240px' }}>
                                    <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>Digital Signature</label>
                                    <img src={v.signatureData} alt="Signature"
                                      style={{ display: 'block', width: '100%', height: 80, objectFit: 'contain', border: '1px solid var(--ow2)', borderRadius: 6, background: '#fff' }}
                                    />
                                  </div>
                                )}
                              </div>

                              <div>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>Close</button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

                      {/* Expand: Missed */}
                      {isExpanded && expandAction === 'miss' && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{ background: 'var(--red-bg)', borderLeft: '4px solid var(--red)', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14 }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)' }}>
                                ❌ Mark Visit as Missed — {loc?.name ?? v.locationId}
                              </div>
                              <div style={{ fontSize: 12, color: 'var(--td)', lineHeight: 1.55 }}>
                                This visit will be recorded as missed and flagged in compliance reports.
                              </div>
                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                                <div style={{ flex: '0 0 260px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>Reason *</label>
                                  <select
                                    className="f-inp" value={mReason}
                                    onChange={e => { setMReason(e.target.value); setMErrors(p => ({ ...p, reason: '' })) }}
                                    style={{ width: '100%', fontSize: 12 }}
                                  >
                                    <option value="">— Select reason —</option>
                                    {MISSED_REASONS.map(r => <option key={r} value={r}>{r}</option>)}
                                  </select>
                                  {mErrors.reason && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{mErrors.reason}</div>}
                                </div>
                                <div style={{ flex: '1 1 260px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Additional Notes <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                                  </label>
                                  <textarea
                                    className="f-inp" rows={2} placeholder="Any additional context…"
                                    value={mNotes} onChange={e => setMNotes(e.target.value)}
                                    style={{ width: '100%', resize: 'vertical', fontSize: 12 }}
                                  />
                                </div>
                              </div>
                              <div style={{ display: 'flex', gap: 8 }}>
                                <button
                                  className="btn"
                                  style={{ fontSize: 12, padding: '7px 20px', background: 'var(--red)', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600 }}
                                  onClick={() => handleMiss(v.id)}
                                >Confirm Missed</button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>Cancel</button>
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
              <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromEntry}–{toEntry} of {dashRows.length}</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                {pageNums(page, totalPages).map((n, i) => n === 'gap'
                  ? <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>…</span>
                  : <button key={n} onClick={() => setPage(n as number)} style={{ width: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: page === n ? 700 : 400, border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`, background: page === n ? 'var(--g7)' : '#fff', color: page === n ? '#fff' : 'var(--tm)' }}>{(n as number) + 1}</button>
                )}
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}