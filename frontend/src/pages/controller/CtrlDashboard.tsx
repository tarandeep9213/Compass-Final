import { useState, useMemo, useEffect, useRef, Fragment } from 'react'
import { VERIFICATIONS, SUBMISSIONS, formatCurrency, IMPREST, getLocation } from '../../mock/data'
import type { VerificationRecord } from '../../mock/data'
import { listControllerVerifications, completeControllerVisit, missControllerVisit } from '../../api/verifications'
import { listSubmissions } from '../../api/submissions'
import { listLocations } from '../../api/locations'
import type { ApiVerification, ApiLocation } from '../../api/types'
import KpiCard from '../../components/KpiCard'


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

type StatusFilter = 'all' | 'scheduled' | 'completed' | 'missed'

type SessionUpdate = {
  status: 'completed' | 'missed'
  observedTotal?: number
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
  return <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
}

export default function CtrlDashboard({ controllerName, locationIds, ctx, onNavigate }: Props) {
  // FIX: Use state so Date.now() is only called once during initial render, satisfying the purity rule
  const [now] = useState(() => Date.now())

  const [statusFilter,   setStatusFilter]  = useState<StatusFilter>('all')
  const [locationFilter, setLocationFilter] = useState('all')
  const [page,           setPage]          = useState(0)
  const [apiLocations,   setApiLocations]  = useState<ApiLocation[]>([])

  useEffect(() => {
    listLocations().then(setApiLocations).catch(() => {})
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
  const [cObs,        setCObs]        = useState('')
  const [cNotes,      setCNotes]      = useState('')
  const [cWarnReason, setCWarnReason] = useState('')
  const [cSig,        setCSig]        = useState('')
  const [cErrors,     setCErrors]     = useState<Record<string, string>>({})

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
  const [apiSubsMap, setApiSubsMap] = useState<Record<string, { status: string; id: string; totalCash: number }>>({})

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
          const map: Record<string, { status: string; id: string; totalCash: number }> = {}
          flats.forEach(s => {
            map[`${s.location_id}_${s.submission_date}`] = { status: s.status, id: s.id, totalCash: s.total_cash }
          })
          setApiSubsMap(map)
        })
        .catch(() => { /* fall back to mock */ })
    }
  }, [locationIds, locIdsJoined]) 

  // Helper function to get submission status dynamically
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

  // FIX: Removed useEffect to prevent cascading render errors. Resetting state happens inside the click/change handlers now.
  // useEffect(() => { setPage(0); closeExpand() }, [statusFilter, locationFilter])

  function closeExpand() {
    setExpandedId(null); setExpandAction(null)
    setCObs(''); setCNotes(''); setCWarnReason(''); setCSig(''); setCErrors({})
    setMReason(''); setMNotes(''); setMErrors({})
  }

  function openExpand(id: string, action: 'complete' | 'miss' | 'view') {
    if (expandedId === id && expandAction === action) { closeExpand(); return }
    closeExpand()
    setExpandedId(id)
    setExpandAction(action)
  }

  const sourceVerifs = apiVerifs.length > 0 ? apiVerifs : VERIFICATIONS.filter(v => v.type === 'controller' && locationIds.includes(v.locationId))

  // All controller records for my locations, merged with session overrides
  const allRecords = useMemo<VerificationRecord[]>(() =>
    sourceVerifs
      .map(v => {
        const upd = sessionUpdates[v.id]
        if (!upd) return v
        const merged: VerificationRecord = { ...v, status: upd.status }
        if (upd.observedTotal !== undefined) merged.observedTotal = upd.observedTotal
        if (upd.missedReason)               merged.missedReason  = upd.missedReason
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
    const done = allRecords.filter(v => v.status === 'completed')
    if (done.length < 2) return null
    const sorted = [...done].sort((a, b) => a.date.localeCompare(b.date))
    let total = 0
    for (let i = 1; i < sorted.length; i++) {
      total += (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000
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
  async function handleComplete(id: string) {
    const e: Record<string, string> = {}
    
    // 1. Check if the submission is approved
    const rec = allRecords.find(r => r.id === id)
    if (rec && getSubStatus(rec.locationId, rec.date) !== 'approved') {
      e.approval = "The submission must be approved before confirming visit completion. Please open the form using 'View' and approve it first."
    }

    // Fallback to 0 so we don't throw NaN validation errors when the input is hidden
    const obs = Number(cObs) || 0 

    if (dowWarning && !cWarnReason)       e.warn = 'Please select a reason to proceed.'
    if (!cSig)                            e.sig  = 'Please sign before confirming.'
    if (Object.keys(e).length) { setCErrors(e); return }

    try {
      await completeControllerVisit(id, { observed_total: obs, signature_data: cSig, notes: cNotes.trim() || undefined })
    } catch { /* demo mode — fall back to local session update */ }

    setSessionUpdates(prev => ({
      ...prev,
      [id]: { status: 'completed', observedTotal: obs, notes: cNotes.trim(), warningFlag: !!dowWarning, signatureData: cSig },
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

  const todayStr = new Date().toISOString().split('T')[0]

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
          {(['all', 'scheduled', 'completed', 'missed'] as const).map(s => {
            const labels: Record<StatusFilter, string> = {
              all: 'All', scheduled: '📅 Scheduled', completed: '✅ Completed', missed: '❌ Missed',
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
                  <th style={{ textAlign: 'right' }}>Observed Total</th>
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
                  const expCash    = Number((loc as unknown as Record<string, number>)?.expected_cash || (loc as unknown as Record<string, number>)?.expectedCash || IMPREST)
                  const effObsTotal = (v.observedTotal && v.observedTotal > 0) ? v.observedTotal : getSubTotalCash(v.locationId, v.date)
                  const variance   = effObsTotal !== null && effObsTotal !== undefined ? Math.round((effObsTotal - expCash) * 100) / 100 : null
                  const pct        = variance !== null && expCash > 0 ? (variance / expCash) * 100 : null
                  const varCol     = pct !== null
                    ? (Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)')
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
                      }}>

                        {/* Date */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{dateLabel}</div>
                          {isFuture && (
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

                        {/* Status */}
                        <td><StatusBadge status={v.status} /></td>

                        {/* Observed Total */}
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                          {effObsTotal !== null && effObsTotal !== undefined
                            ? formatCurrency(effObsTotal)
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
                          {v.status === 'scheduled' ? (
                            <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 11, padding: '4px 12px' }}
                                onClick={() => openExpand(v.id, 'complete')}
                              >
                                Mark as Completed
                              </button>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 12px', color: 'var(--red)' }}
                                onClick={() => openExpand(v.id, 'miss')}
                              >
                                Mark as Missed
                              </button>
                            </div>
                          ) : v.status === 'completed' ? (
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '4px 12px', color: 'var(--g7)', borderColor: 'var(--g3)' }}
                              onClick={() => openExpand(v.id, 'view')}
                            >
                              ✅ Completed
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Expand: Complete Visit ── */}
                      {isExpanded && expandAction === 'complete' && (
                        <tr>
                          <td colSpan={8} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{
                              background: 'var(--g0)', borderLeft: '4px solid var(--g4)',
                              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 16,
                            }}>
                              <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g8)' }}>
                                ✓ Complete Visit — {loc?.name ?? v.locationId}
                                <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>
                                  {new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                                </span>
                              </div>

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
                                    {dowWarning.count > 1 ? ` (${dowWarning.count}× in past 6 weeks)` : ''}.
                                    Consider varying the day of visit to maintain unpredictable patterns.
                                  </div>
                                  <select
                                    className="f-inp"
                                    value={cWarnReason}
                                    onChange={e => { setCWarnReason(e.target.value); setCErrors(p => ({ ...p, warn: '' })) }}
                                    style={{ fontSize: 12, width: 360 }}
                                  >
                                    <option value="">— Select reason to proceed —</option>
                                    <option value="operational">Operational necessity — only available day</option>
                                    <option value="requested">Requested by location / area management</option>
                                    <option value="followup">Follow-up visit after a discrepancy</option>
                                    <option value="other">Other (documented separately)</option>
                                  </select>
                                  {cErrors.warn && (
                                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{cErrors.warn}</div>
                                  )}
                                </div>
                              )}

                              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'stretch' }}>

                                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                                  {(() => {
                                    const st = getSubStatus(v.locationId, v.date)
                                    if (!st) return (
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
                                            submissionId: getSubId(v.locationId, v.date) ?? '',
                                            visitId: v.id,
                                            fromPanel: 'ctrl-dashboard',
                                            expandVisitId: v.id,
                                            expandAction: 'complete'
                                          })}>
                                          👁 View & Approve
                                        </button>
                                        {st === 'approved' && <span style={{ fontSize: 11, color: 'var(--g7)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>✅ Approved</span>}
                                        {st === 'rejected' && <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>❌ Rejected</span>}
                                        {st === 'pending_approval' && <span style={{ fontSize: 11, color: '#b45309', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 4 }}>⏳ Pending approval</span>}
                                      </>
                                    )
                                  })()}
                                </div>
                                {/* Observed total
                                <div style={{ flex: '0 0 220px' }}>
                                  <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: 'var(--td)', marginBottom: 5 }}>
                                    Observed Total Cash *
                                  </label>
                                  <div style={{ position: 'relative' }}>
                                    <span style={{
                                      position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
                                      fontSize: 13, fontWeight: 600, color: 'var(--ts)', pointerEvents: 'none',
                                    }}>$</span>
                                    <input
                                      type="number"
                                      className="f-inp"
                                      placeholder="0.00"
                                      value={cObs}
                                      min={0}
                                      step={0.01}
                                      onChange={e => { setCObs(e.target.value); setCErrors(p => ({ ...p, obs: '' })) }}
                                      style={{ paddingLeft: 24, width: '100%' }}
                                    />
                                  </div>
                                  {cErrors.obs && (
                                    <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{cErrors.obs}</div>
                                  )}
                                  {liveVariance && (() => {
                                    const c = Math.abs(liveVariance.pct) > 5 ? 'var(--red)'
                                            : Math.abs(liveVariance.pct) > 2 ? 'var(--amb)' : 'var(--g7)'
                                    return (
                                      <div style={{ fontSize: 11, color: c, marginTop: 5, fontWeight: 500 }}>
                                        Variance:&nbsp;
                                        {liveVariance.v >= 0 ? '+' : ''}{formatCurrency(liveVariance.v)}&nbsp;
                                        ({liveVariance.pct >= 0 ? '+' : ''}{liveVariance.pct.toFixed(2)}%)
                                      </div>
                                    )
                                  })()}
                                </div>*/}

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
                                <button
                                  className="btn btn-primary"
                                  style={{ fontSize: 12, padding: '7px 20px' }}
                                  onClick={() => handleComplete(v.id)}
                                >
                                  ✓ Confirm Completion
                                </button>
                                <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={closeExpand}>
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}

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