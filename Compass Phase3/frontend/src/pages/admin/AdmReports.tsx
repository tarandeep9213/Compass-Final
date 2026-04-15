import { useState, useMemo, useEffect } from 'react'
import { formatCurrency, todayStr } from '../../mock/data'
import { getReportSummary, getSlaSummary } from '../../api/reports'
import { fetchBlob } from '../../api/client'
import { listSubmissions } from '../../api/submissions'
import { listControllerVerifications, listDgmVerifications } from '../../api/verifications'
import { listLocations } from '../../api/locations'
import { listUsers } from '../../api/admin'
import type { ReportSummary, ApiLocation, SlaSummary } from '../../api/types'
import KpiCard from '../../components/KpiCard'

// Normalised row shapes used by all tables in this component
type SubRow = {
  id: string
  locationId: string; locationName: string; date: string
  operatorName: string; status: string
  totalCash: number; variance: number; variancePct: number
  varianceException: boolean
  approvedBy: string | null; approvedByName: string | null
  varianceNote: string | null; rejectionReason: string | null
}
type VerifRow = {
  locationId: string; locationName: string; date: string
  verifierName: string; type: 'controller' | 'dgm'; status: string
}

interface Props { adminName: string }

const ACT_PAGE_SIZE = 10
const EXC_PAGE_SIZE = 10
const DTL_PAGE_SIZE = 20

function pageNums(cur: number, total: number): (number|'gap')[] {
  if (total<=7) return Array.from({length:total},(_,i)=>i)
  if (cur<=3)         return [0,1,2,3,'gap',total-1]
  if (cur>=total-4)   return [0,'gap',total-4,total-3,total-2,total-1]
  return [0,'gap',cur-1,cur,cur+1,'gap',total-1]
}

function rangeLabel(range: string) {
  const today = new Date()
  if (range==='today') {
    return { start: todayStr(), end: todayStr() }
  }
  if (range==='week') {
    const start = new Date(today); start.setDate(today.getDate()-6)
    return { start: start.toISOString().split('T')[0], end: todayStr() }
  }
  if (range==='month') {
    const start = new Date(today); start.setDate(1)
    return { start: start.toISOString().split('T')[0], end: todayStr() }
  }
  return null
}

export default function AdmReports({ adminName }: Props) {
  const [range,      setRange]      = useState<'today'|'week'|'month'|'custom'>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo,   setCustomTo]   = useState(todayStr())
  const [downloaded, setDownloaded] = useState(false)
  const [actPage,    setActPage]    = useState(0)
  const [actRole,    setActRole]    = useState('all')
  const [excPage,    setExcPage]    = useState(0)
  const [dtlPage,    setDtlPage]    = useState(0)
  const [dtlLocFilter, setDtlLocFilter] = useState('all')

  const [apiSummary,   setApiSummary]   = useState<ReportSummary | null>(null)
  const [apiSubRows,   setApiSubRows]   = useState<SubRow[] | null>(null)
  const [apiVerifRows, setApiVerifRows] = useState<VerifRow[] | null>(null)
  const [apiLocations, setApiLocations] = useState<ApiLocation[]>([])
  const [rcByLoc, setRcByLoc] = useState<Record<string, string>>({})
  const [slaData, setSlaData] = useState<SlaSummary | null>(null)

  const { start, end } = useMemo(() => {
    if (range==='custom') return { start: customFrom, end: customTo }
    return rangeLabel(range) ?? { start:'', end:'' }
  }, [range, customFrom, customTo])

  useEffect(() => {
    listLocations().then(setApiLocations).catch(() => {})
    listUsers({ role: 'REGIONAL_CONTROLLER', page_size: 200 }).then(r => {
      const map: Record<string, string> = {}
      r.items.forEach(u => { u.location_ids.forEach(lid => { map[lid] = u.name }) })
      setRcByLoc(map)
    }).catch(() => {})
  }, [])

  // Fetch real data whenever date range changes
  useEffect(() => {
    if (!start || !end) {
      Promise.resolve().then(() => { setApiSummary(null); setApiSubRows(null); setApiVerifRows(null); setSlaData(null) })
      return
    }
    getReportSummary({ date_from: start, date_to: end })
      .then(setApiSummary).catch(() => setApiSummary(null))

    getSlaSummary({ date_from: start, date_to: end })
      .then(setSlaData).catch(() => setSlaData(null))

    listSubmissions({ date_from: start, date_to: end, page_size: 100 })
      .then(r => setApiSubRows(r.items.map(s => ({
        id: s.id,
        locationId: s.location_id, locationName: s.location_name, date: s.submission_date,
        operatorName: s.operator_name, status: s.status,
        totalCash: s.total_cash, variance: s.variance, variancePct: s.variance_pct,
        varianceException: s.variance_exception,
        approvedBy: s.approved_by, approvedByName: s.approved_by_name,
        varianceNote: s.variance_note, rejectionReason: s.rejection_reason,
      }))))
      .catch(() => setApiSubRows(null))

    Promise.all([
      listControllerVerifications({ date_from: start, date_to: end, page_size: 100 }),
      listDgmVerifications({ date_from: start, date_to: end, page_size: 100 }),
    ]).then(([ctrl, dgm]) => setApiVerifRows([
      ...ctrl.items.map(v => ({ locationId: v.location_id, locationName: v.location_name, date: v.verification_date, verifierName: v.verifier_name, type: 'controller' as const, status: v.status })),
      ...dgm.items.map(v => ({ locationId: v.location_id, locationName: v.location_name, date: v.verification_date, verifierName: v.verifier_name, type: 'dgm' as const, status: v.status })),
    ])).catch(() => setApiVerifRows(null))
  }, [start, end]) // eslint-disable-line react-hooks/exhaustive-deps

  // Use API data when available, fall back to empty (mock SUBMISSIONS has stale 2024 dates)
  const filteredSubs = useMemo((): SubRow[] => {
    if (apiSubRows !== null) return apiSubRows
    return []
  }, [apiSubRows])

  const approvedCount  = apiSummary ? apiSummary.approved           : filteredSubs.filter(s=>s.status==='approved').length
  const rejectedCount  = apiSummary ? apiSummary.rejected           : filteredSubs.filter(s=>s.status==='rejected').length
  const totalSubCount  = apiSummary ? apiSummary.total_submissions  : filteredSubs.length
  const approvalRate   = apiSummary ? Math.round(apiSummary.approval_rate_pct) : (totalSubCount ? Math.round((approvedCount/totalSubCount)*100) : 0)
  const exceptions     = filteredSubs.filter(s => s.varianceException)
  const exceptionCount = apiSummary ? apiSummary.variance_exceptions : exceptions.length
  const avgVariance    = apiSummary ? apiSummary.avg_variance_pct
    : (filteredSubs.length ? filteredSubs.reduce((n,s)=>n+Math.abs(s.variancePct),0)/filteredSubs.length : 0)

  const ctrlCount = apiSummary ? apiSummary.controller_verifications : 0
  const dgmCount  = apiSummary ? apiSummary.dgm_visits              : 0

  // All verifications in the date range (from API, falls back to empty)
  const filteredVerifs = useMemo((): VerifRow[] => {
    if (apiVerifRows !== null) return apiVerifRows
    return []
  }, [apiVerifRows])

  // Unified per-actor summary — covers operators, managers, controllers, DGMs
  type ActorRow = {
    name: string; role: string
    actions: number            // submissions (op/mgr) or verifications (ctrl/dgm)
    positive: number           // approved (op/mgr) or completed (ctrl/dgm)
    negative: number           // rejected (op/mgr) or missed (ctrl/dgm)
    pending: number            // pending (op) or scheduled (ctrl/dgm) — 0 for mgr
    rate: number               // approval rate (op/mgr) or completion rate (ctrl/dgm)
    variance: number | null    // avg variancePct — operators/managers only
    excepts: number | null     // >5% count — operators only
    locs: number
  }
  const actorSummary = useMemo((): ActorRow[] => {
    const rows: ActorRow[] = []

    // ── Operators ───────────────────────────────────────────────────────────
    const opNames = [...new Set(filteredSubs.map(s => s.operatorName))]
    opNames.forEach(name => {
      const subs     = filteredSubs.filter(s => s.operatorName === name)
      const approved = subs.filter(s => s.status === 'approved').length
      const rejected = subs.filter(s => s.status === 'rejected').length
      const pending  = subs.filter(s => s.status === 'pending_approval').length
      const variance = subs.length ? subs.reduce((n,s) => n + s.variancePct, 0) / subs.length : 0
      const excepts  = subs.filter(s => Math.abs(s.variancePct) > 5).length
      const rate     = subs.length ? Math.round((approved / subs.length) * 100) : 0
      const locs     = new Set(subs.map(s => s.locationId)).size
      rows.push({ name, role:'Operator', actions:subs.length, positive:approved, negative:rejected, pending, rate, variance, excepts, locs })
    })

    // ── Managers ────────────────────────────────────────────────────────────
    // approvedBy is set on reviewed (approved) submissions; rejected subs may not carry it
    const mgNames = [...new Set(filteredSubs.filter(s => s.approvedBy).map(s => s.approvedBy as string))]
    mgNames.forEach(name => {
      const reviewed = filteredSubs.filter(s => s.approvedBy === name)
      const approved = reviewed.filter(s => s.status === 'approved').length
      const rejected = reviewed.filter(s => s.status === 'rejected').length
      const rate     = reviewed.length ? Math.round((approved / reviewed.length) * 100) : 0
      const variance = reviewed.length ? reviewed.reduce((n,s) => n + s.variancePct, 0) / reviewed.length : 0
      const locs     = new Set(reviewed.map(s => s.locationId)).size
      rows.push({ name, role:'Manager', actions:reviewed.length, positive:approved, negative:rejected, pending:0, rate, variance, excepts:null, locs })
    })

    // ── Controllers ─────────────────────────────────────────────────────────
    const ctrlNames = [...new Set(filteredVerifs.filter(v => v.type==='controller').map(v => v.verifierName))]
    ctrlNames.forEach(name => {
      const verifs    = filteredVerifs.filter(v => v.type==='controller' && v.verifierName===name)
      const completed = verifs.filter(v => v.status==='completed').length
      const missed    = verifs.filter(v => v.status==='missed').length
      const scheduled = verifs.filter(v => v.status==='scheduled').length
      const rate      = verifs.length ? Math.round((completed / verifs.length) * 100) : 0
      const locs      = new Set(verifs.map(v => v.locationId)).size
      rows.push({ name, role:'Controller', actions:verifs.length, positive:completed, negative:missed, pending:scheduled, rate, variance:null, excepts:null, locs })
    })

    // ── DGMs ────────────────────────────────────────────────────────────────
    const dgmNames = [...new Set(filteredVerifs.filter(v => v.type==='dgm').map(v => v.verifierName))]
    dgmNames.forEach(name => {
      const verifs    = filteredVerifs.filter(v => v.type==='dgm' && v.verifierName===name)
      const completed = verifs.filter(v => v.status==='completed').length
      const missed    = verifs.filter(v => v.status==='missed').length
      const scheduled = verifs.filter(v => v.status==='scheduled').length
      const rate      = verifs.length ? Math.round((completed / verifs.length) * 100) : 0
      const locs      = new Set(verifs.map(v => v.locationId)).size
      rows.push({ name, role:'DGM', actions:verifs.length, positive:completed, negative:missed, pending:scheduled, rate, variance:null, excepts:null, locs })
    })

    return rows.sort((a, b) => b.actions - a.actions)
  }, [filteredSubs, filteredVerifs])

  const actFiltered   = actRole === 'all' ? actorSummary : actorSummary.filter(r => r.role === actRole)
  const actTotalPages = Math.max(1, Math.ceil(actFiltered.length / ACT_PAGE_SIZE))
  const actPageClamped = Math.min(actPage, actTotalPages - 1)
  const actPageRows   = actFiltered.slice(actPageClamped * ACT_PAGE_SIZE, (actPageClamped + 1) * ACT_PAGE_SIZE)

  // Role counts for filter chips
  const roleCounts = ['Operator','Manager','Controller','DGM'].reduce<Record<string,number>>((acc, r) => {
    acc[r] = actorSummary.filter(a => a.role === r).length
    return acc
  }, {})

  const excTotalPages = Math.max(1, Math.ceil(exceptions.length / EXC_PAGE_SIZE))
  const excPageClamped = Math.min(excPage, excTotalPages - 1)
  const excPageRows   = exceptions.slice(excPageClamped * EXC_PAGE_SIZE, (excPageClamped + 1) * EXC_PAGE_SIZE)

  // ── Date-level detail rows ────────────────────────────────────────────────

  type DtlRow = {
    date: string
    locId: string
    locName: string
    operator: string
    subStatus: string
    approvedBy: string
    controller: string
    dgm: string
    rc: string
  }

  const dtlAllRows = useMemo((): DtlRow[] => {
    // Collect all active (date, locationId) pairs from submissions and verifications
    const pairs = new Set<string>()
    filteredSubs.forEach(s => pairs.add(`${s.date}|${s.locationId}`))
    filteredVerifs.forEach(v => pairs.add(`${v.date}|${v.locationId}`))

    return [...pairs]
      .map(key => {
        const [date, locId] = key.split('|')
        const sub  = filteredSubs.find(s => s.locationId === locId && s.date === date)
        const ctrl = filteredVerifs.find(v => v.locationId === locId && v.date === date && v.type === 'controller' && v.status === 'completed')
        const dgm  = filteredVerifs.find(v => v.locationId === locId && v.date === date && v.type === 'dgm'        && v.status === 'completed')
        const locName = sub?.locationName ?? ctrl?.locationName ?? dgm?.locationName
          ?? apiLocations.find(l => l.id === locId)?.name ?? locId
        const rc = rcByLoc[locId] ?? '—'
        return {
          date,
          locId,
          locName,
          operator:   sub?.operatorName ?? '—',
          subStatus:  sub?.status ?? '—',
          approvedBy: sub?.approvedByName ?? sub?.approvedBy ?? '—',
          controller: ctrl?.verifierName ?? '—',
          dgm:        dgm?.verifierName  ?? '—',
          rc,
        }
      })
      .sort((a, b) => b.date.localeCompare(a.date) || a.locName.localeCompare(b.locName))
  }, [filteredSubs, filteredVerifs, rcByLoc, apiLocations])

  const dtlFiltered   = dtlLocFilter !== 'all'
    ? dtlAllRows.filter(r => r.locId === dtlLocFilter)
    : dtlAllRows
  const dtlTotalPages = Math.max(1, Math.ceil(dtlFiltered.length / DTL_PAGE_SIZE))
  const dtlPageClamped = Math.min(dtlPage, dtlTotalPages - 1)
  const dtlPageRows   = dtlFiltered.slice(dtlPageClamped * DTL_PAGE_SIZE, (dtlPageClamped + 1) * DTL_PAGE_SIZE)

  async function handleDownload() {
    if (!start || !end) return
    const q = new URLSearchParams({ date_from: start, date_to: end })
    try {
      const blob = await fetchBlob(`/reports/export?${q}`)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `cashroom-report-${start}-to-${end}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 3000)
    } catch {
      // backend unavailable — fall back to mock data
      const rows: string[][] = []
      rows.push(['Date','Location','Operator','Status','Total Cash','Variance','Variance %','Exception'])
      filteredSubs.forEach(s => {
        rows.push([
          s.date, s.locationName || s.locationId, s.operatorName,
          s.status, s.totalCash.toFixed(2), s.variance.toFixed(2),
          s.variancePct.toFixed(2), Math.abs(s.variancePct) > 5 ? 'Yes' : 'No',
        ])
      })
      const csv  = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `cashroom-report-${start}-to-${end}.csv`
      a.click()
      URL.revokeObjectURL(url)
      setDownloaded(true)
      setTimeout(() => setDownloaded(false), 3000)
    }
  }

  const btnBase: React.CSSProperties = {
    padding:'8px 18px',borderRadius:8,fontSize:13,fontWeight:700,cursor:'pointer',fontFamily:'inherit',transition:'all 0.12s',
  }

  return (
    <div className="fade-up">
      <div className="ph" style={{marginBottom:18}}>
        <div>
          <h2>Reports</h2>
          <p style={{color:'var(--ts)',fontSize:13}}>Compliance and variance summary · {adminName}</p>
        </div>
        <div className="ph-right">
          {downloaded && <span style={{fontSize:12,color:'var(--g7)',fontWeight:600}}>✓ CSV downloaded</span>}
          <button className="btn btn-outline" style={{fontSize:13}} onClick={handleDownload}>⬇ Export CSV</button>
        </div>
      </div>

      {/* Filters: period + location */}
      <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:22,flexWrap:'nowrap',minWidth:0}}>
        {/* Period buttons */}
        <span style={{fontSize:12,fontWeight:600,color:'var(--td)',whiteSpace:'nowrap'}}>Period:</span>
        {(['today','week','month','custom'] as const).map(r=>(
          <button key={r} onClick={()=>setRange(r)} style={{
            ...btnBase, padding:'7px 14px', whiteSpace:'nowrap',
            border:range===r?'2px solid var(--g4)':'1.5px solid var(--ow2)',
            background:range===r?'var(--g7)':'#fff',
            color:range===r?'#fff':'var(--td)',
          }}>
            {r==='today'?'Today':r==='week'?'This Week':r==='month'?'This Month':'Custom'}
          </button>
        ))}
        {range==='custom' && (
          <>
            <input type="date" className="f-inp" value={customFrom} max={customTo||todayStr()} onChange={e=>setCustomFrom(e.target.value)} style={{fontSize:13,width:138}}/>
            <span style={{fontSize:13,color:'var(--ts)'}}>→</span>
            <input type="date" className="f-inp" value={customTo} max={todayStr()} onChange={e=>setCustomTo(e.target.value)} style={{fontSize:13,width:138}}/>
          </>
        )}
        {start&&end&&range!=='custom'&&<span style={{fontSize:11,color:'var(--ts)',whiteSpace:'nowrap'}}>
          {new Date(start+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})} – {new Date(end+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
        </span>}

        {/* Location filter — separated by a divider */}
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
            value={dtlLocFilter}
            onChange={e => { setDtlLocFilter(e.target.value); setDtlPage(0) }}
            style={{
              fontSize:13, fontWeight:600, fontFamily:'inherit',
              color: dtlLocFilter !== 'all' ? 'var(--g7)' : '#1e293b',
              background:'transparent', border:'none', outline:'none',
              cursor:'pointer', minWidth:160, maxWidth:220,
            }}
          >
            <option value="all">All Locations</option>
            {apiLocations.slice().sort((a,b)=>a.name.localeCompare(b.name)).map(l => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
          {dtlLocFilter !== 'all' && (
            <button
              onClick={() => { setDtlLocFilter('all'); setDtlPage(0) }}
              style={{
                background:'none', border:'none', cursor:'pointer', padding:0,
                fontSize:14, color:'#94a3b8', lineHeight:1, flexShrink:0,
              }}
              title="Clear location filter"
            >✕</button>
          )}
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row" style={{marginBottom:22}}>
        <KpiCard
          label="Total Submissions"
          value={totalSubCount}
          sub="in period"
          tooltip={{
            what: "Total number of cash count submissions (non-draft) recorded in the selected date range.",
            how: "Counts all submissions with status other than Draft that fall within the period's start and end dates.",
            formula: "COUNT(submissions where date ∈ [start, end] AND status ≠ draft)",
          }}
        />
        <KpiCard
          label="Approval Rate"
          value={`${approvalRate}%`}
          sub={`${approvedCount} approved · ${rejectedCount} rejected`}
          accent={approvalRate>=80?'var(--g7)':approvalRate>=60?'var(--amb)':'var(--red)'}
          tooltip={{
            what: "Percentage of submissions that were approved by a manager within the selected period.",
            how: "Divides approved submissions by total submissions and multiplies by 100. Excludes drafts.",
            formula: "(Approved ÷ Total submissions) × 100",
            flag: "Green ≥80%, Amber 60–79%, Red <60%.",
          }}
        />
        <KpiCard
          label="Variance Exceptions"
          value={exceptionCount}
          sub=">5% tolerance"
          accent={exceptionCount>0?'var(--red)':'var(--g7)'}
          highlight={exceptionCount>0?'red':false}
          tooltip={{
            what: "Submissions where the cash count deviates from imprest by more than 5%.",
            how: "Each submission's variance % is calculated as |actual − imprest| ÷ imprest × 100. Any result above 5% is an exception.",
            formula: "|actual − imprest| ÷ imprest × 100 > 5%",
            flag: "Turns red when any exception exists — operator must provide written explanation.",
          }}
        />
        <KpiCard
          label="Avg |Variance|"
          value={`${avgVariance.toFixed(2)}%`}
          sub="across all submissions"
          accent={avgVariance>2?'var(--amb)':'var(--g7)'}
          tooltip={{
            what: "Average absolute variance percentage across all submissions in the period.",
            how: "Sums the absolute variance % of every submission and divides by total count. Uses absolute value so overages and shortages don't cancel each other out.",
            formula: "Σ|variancePct| ÷ COUNT(submissions)",
            flag: "Amber when >2%; no hard threshold but high values indicate systemic cash handling issues.",
          }}
        />
        <KpiCard
          label="Ctrl / DGM Visits"
          value={<>{ctrlCount}<span style={{fontSize:14,fontWeight:400,color:'var(--ts)'}}> / {dgmCount}</span></>}
          sub="controller / DGM"
          tooltip={{
            what: "Number of completed controller verifications and DGM physical visits in the period.",
            how: "Counts verifications with status 'completed' filtered by type (controller vs DGM) within the date range. Displayed as controller count / DGM count.",
            formula: "COUNT(controller visits completed) / COUNT(DGM visits completed)",
          }}
        />
      </div>

      {/* Approval SLA Analytics */}
      {slaData && (
        <div className="card" data-testid="sla-card" style={{marginBottom:22}}>
          <div className="card-header">
            <span className="card-title">Approval SLA Analytics</span>
            <span className="card-sub">{slaData.total_reviewed} reviewed · 48h SLA</span>
          </div>
          <div className="card-body">
            {/* Top KPIs */}
            <div style={{display:'flex',gap:24,marginBottom:20,flexWrap:'wrap'}}>
              <div style={{minWidth:140,padding:'12px 18px',borderRadius:10,background:'var(--ow)',border:'1.5px solid var(--ow2)',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:700,fontFamily:'DM Serif Display,serif',color:'var(--td)'}}>
                  {slaData.avg_hours !== null ? `${slaData.avg_hours}h` : '—'}
                </div>
                <div style={{fontSize:11,color:'var(--ts)',marginTop:2}}>Avg Approval Time</div>
              </div>
              <div style={{minWidth:140,padding:'12px 18px',borderRadius:10,textAlign:'center',
                background: slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 80 ? 'var(--g0)' : slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 60 ? '#fffbeb' : '#fff1f2',
                border: `1.5px solid ${slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 80 ? 'var(--g2)' : slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 60 ? '#fcd34d' : '#fca5a5'}`,
              }}>
                <div style={{fontSize:22,fontWeight:700,fontFamily:'DM Serif Display,serif',
                  color: slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 80 ? 'var(--g7)' : slaData.sla_compliance_pct !== null && slaData.sla_compliance_pct >= 60 ? 'var(--amb)' : 'var(--red)',
                }}>
                  {slaData.sla_compliance_pct !== null ? `${slaData.sla_compliance_pct}%` : '—'}
                </div>
                <div style={{fontSize:11,color:'var(--ts)',marginTop:2}}>Within SLA (≤48h)</div>
              </div>
              <div style={{minWidth:140,padding:'12px 18px',borderRadius:10,background:'var(--ow)',border:'1.5px solid var(--ow2)',textAlign:'center'}}>
                <div style={{fontSize:22,fontWeight:700,fontFamily:'DM Serif Display,serif',color:'var(--td)'}}>
                  {slaData.total_reviewed}
                </div>
                <div style={{fontSize:11,color:'var(--ts)',marginTop:2}}>Submissions Reviewed</div>
              </div>
            </div>

            {/* Distribution bars */}
            <div style={{marginBottom:20}}>
              <div style={{fontSize:12,fontWeight:600,color:'var(--td)',marginBottom:10}}>Time-to-Approval Distribution</div>
              <div style={{display:'flex',flexDirection:'column',gap:8}}>
                {slaData.buckets.map(b => (
                  <div key={b.label} style={{display:'flex',alignItems:'center',gap:10}}>
                    <div style={{width:64,fontSize:11,fontWeight:600,color:'var(--ts)',textAlign:'right',flexShrink:0}}>{b.label}</div>
                    <div style={{flex:1,height:20,background:'var(--ow2)',borderRadius:4,overflow:'hidden',maxWidth:320}}>
                      <div style={{
                        height:'100%',borderRadius:4,
                        width:`${b.pct}%`,minWidth:b.count>0?4:0,
                        background: b.label === '>48h' ? 'var(--red)' : b.label === '24–48h' ? 'var(--amb)' : 'var(--g6)',
                        transition:'width 0.4s',
                      }}/>
                    </div>
                    <div style={{fontSize:12,fontWeight:600,color:'var(--td)',width:36,flexShrink:0}}>{b.count}</div>
                    <div style={{fontSize:11,color:'var(--ts)',width:38,flexShrink:0}}>{b.pct}%</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Per-approver table */}
            {slaData.approvers.length > 0 && (
              <div>
                <div style={{fontSize:12,fontWeight:600,color:'var(--td)',marginBottom:8}}>Approver Breakdown</div>
                <table className="dt">
                  <thead>
                    <tr>
                      <th>Approver</th>
                      <th style={{textAlign:'center'}}>Reviewed</th>
                      <th style={{textAlign:'center'}}>Avg Hours</th>
                      <th style={{textAlign:'center'}}>Within SLA</th>
                      <th style={{textAlign:'center'}}>SLA %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {slaData.approvers.map(a => (
                      <tr key={a.name}>
                        <td style={{fontWeight:600,fontSize:13}}>{a.name}</td>
                        <td style={{textAlign:'center',fontSize:13}}>{a.count}</td>
                        <td style={{textAlign:'center'}}>
                          <span style={{
                            fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:6,
                            background: a.avg_hours <= 24 ? 'var(--g0)' : a.avg_hours <= 48 ? '#fffbeb' : '#fff1f2',
                            color: a.avg_hours <= 24 ? 'var(--g7)' : a.avg_hours <= 48 ? 'var(--amb)' : 'var(--red)',
                            border: `1px solid ${a.avg_hours <= 24 ? 'var(--g2)' : a.avg_hours <= 48 ? '#fcd34d' : '#fca5a5'}`,
                          }}>{a.avg_hours}h</span>
                        </td>
                        <td style={{textAlign:'center',fontSize:13,color:'var(--g7)',fontWeight:600}}>{a.within_sla}</td>
                        <td style={{textAlign:'center'}}>
                          <span style={{
                            fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:6,
                            background: a.sla_pct >= 80 ? 'var(--g0)' : a.sla_pct >= 60 ? '#fffbeb' : '#fff1f2',
                            color: a.sla_pct >= 80 ? 'var(--g7)' : a.sla_pct >= 60 ? 'var(--amb)' : 'var(--red)',
                            border: `1px solid ${a.sla_pct >= 80 ? 'var(--g2)' : a.sla_pct >= 60 ? '#fcd34d' : '#fca5a5'}`,
                          }}>{a.sla_pct}%</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Date-Level Detail table */}
      <div className="card" style={{marginBottom:22}}>
        <div className="card-header">
          <span className="card-title">Date-Level Detail</span>
          <span style={{fontSize:11,color:'var(--ts)'}}>
            {dtlFiltered.length} row{dtlFiltered.length !== 1 ? 's' : ''}
            {dtlLocFilter !== 'all' && <> · {apiLocations.find(l=>l.id===dtlLocFilter)?.name}</>}
          </span>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="dt">
            <thead>
              <tr>
                <th style={{whiteSpace:'nowrap'}}>Date</th>
                <th style={{minWidth:140}}>Location</th>
                <th style={{minWidth:130}}>Operator</th>
                <th style={{minWidth:100,textAlign:'center'}}>Sub Status</th>
                <th style={{minWidth:130}}>Approved By</th>
                <th style={{minWidth:130}}>Controller</th>
                <th style={{minWidth:130}}>DGM</th>
                <th style={{minWidth:150}}>Regional Controller</th>
              </tr>
            </thead>
            <tbody>
              {dtlPageRows.map((r, i) => {
                const STATUS_STYLE: Record<string, {bg:string,color:string,border:string}> = {
                  approved:         {bg:'var(--g0)',   color:'var(--g7)', border:'var(--g2)'},
                  rejected:         {bg:'#fff1f2',     color:'var(--red)',border:'#fca5a5'},
                  pending_approval: {bg:'#fffbeb',     color:'var(--amb)',border:'#fcd34d'},
                  draft:            {bg:'#f8fafc',     color:'#64748b',  border:'#e2e8f0'},
                }
                const ss = STATUS_STYLE[r.subStatus] ?? {bg:'#f8fafc',color:'#94a3b8',border:'#e2e8f0'}
                const statusLabel: Record<string,string> = {
                  approved:'Approved', rejected:'Rejected',
                  pending_approval:'Pending', draft:'Draft',
                }
                return (
                  <tr key={i}>
                    <td style={{whiteSpace:'nowrap',fontSize:12,color:'var(--td)',fontWeight:500}}>
                      {new Date(r.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
                    </td>
                    <td>
                      <div style={{fontWeight:500,fontSize:13}}>{r.locName}</div>
                      <div style={{fontSize:10,fontFamily:'monospace',color:'var(--ts)'}}>{r.locId}</div>
                    </td>
                    <td style={{fontSize:12}}>
                      {r.operator !== '—' ? <span style={{fontWeight:500}}>{r.operator}</span> : <span style={{color:'#bbb'}}>—</span>}
                    </td>
                    <td style={{textAlign:'center'}}>
                      {r.subStatus !== '—'
                        ? <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,whiteSpace:'nowrap',
                            background:ss.bg,color:ss.color,border:`1px solid ${ss.border}`}}>
                            {statusLabel[r.subStatus] ?? r.subStatus}
                          </span>
                        : <span style={{color:'#bbb',fontSize:12}}>No submission</span>}
                    </td>
                    <td style={{fontSize:12}}>
                      {r.approvedBy !== '—' ? <span style={{fontWeight:500}}>{r.approvedBy}</span> : <span style={{color:'#bbb'}}>—</span>}
                    </td>
                    <td style={{fontSize:12}}>
                      {r.controller !== '—' ? <span style={{color:'var(--g7)',fontWeight:500}}>✓ {r.controller}</span> : <span style={{color:'#bbb'}}>—</span>}
                    </td>
                    <td style={{fontSize:12}}>
                      {r.dgm !== '—' ? <span style={{color:'#7e22ce',fontWeight:500}}>✓ {r.dgm}</span> : <span style={{color:'#bbb'}}>—</span>}
                    </td>
                    <td style={{fontSize:12}}>
                      {r.rc !== '—' ? <span style={{fontWeight:500,color:'#0369a1'}}>{r.rc}</span> : <span style={{color:'#bbb'}}>—</span>}
                    </td>
                  </tr>
                )
              })}
              {dtlFiltered.length === 0 && (
                <tr>
                  <td colSpan={8} style={{textAlign:'center',padding:'32px 0',color:'var(--ts)',fontSize:13}}>
                    No activity found for this period{dtlLocFilter !== 'all' ? ` at ${apiLocations.find(l=>l.id===dtlLocFilter)?.name}` : ''}.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
            <span style={{fontSize:12,color:'var(--ts)'}}>
              {dtlFiltered.length === 0
                ? 'No rows'
                : `Showing ${dtlPage*DTL_PAGE_SIZE+1}–${Math.min((dtlPage+1)*DTL_PAGE_SIZE, dtlFiltered.length)} of ${dtlFiltered.length} row${dtlFiltered.length !== 1 ? 's' : ''}`}
            </span>
            <div style={{display:'flex',gap:4,alignItems:'center'}}>
              <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={dtlPage===0} onClick={()=>setDtlPage(p=>p-1)}>← Prev</button>
              {pageNums(dtlPage, dtlTotalPages).map((n,i) => n==='gap'
                ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                : <button key={n} onClick={()=>setDtlPage(n as number)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:dtlPage===n?700:400,border:`1px solid ${dtlPage===n?'var(--g4)':'var(--ow2)'}`,background:dtlPage===n?'var(--g7)':'#fff',color:dtlPage===n?'#fff':'var(--td)'}}>{(n as number)+1}</button>
              )}
              <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={dtlPage>=dtlTotalPages-1} onClick={()=>setDtlPage(p=>p+1)}>Next →</button>
            </div>
          </div>
        </div>
      </div>

      {/* Per-actor summary */}
      {actorSummary.length > 0 && (
        <div className="card" style={{marginBottom:22}}>
          <div className="card-header">
            <span className="card-title">Per-Actor Summary</span>
            <span className="card-sub">
              {actorSummary.length} actor{actorSummary.length!==1?'s':''} · sorted by activity ·
              <span style={{marginLeft:6,fontSize:10,color:'var(--ts)'}}>
                Operators &amp; Managers: submissions · Controllers &amp; DGMs: verifications
              </span>
            </span>
          </div>
          {/* Role filter chips */}
          <div style={{display:'flex',gap:8,alignItems:'center',padding:'10px 16px',borderBottom:'1px solid var(--ow2)',background:'#fafaf8',flexWrap:'wrap'}}>
            <span style={{fontSize:11,fontWeight:600,color:'var(--td)',marginRight:2}}>Show:</span>
            {(['all','Operator','Manager','Controller','DGM'] as const).map(r => {
              const count = r === 'all' ? actorSummary.length : (roleCounts[r] ?? 0)
              const active = actRole === r
              const CHIP_COLORS: Record<string,{bg:string,color:string,border:string}> = {
                Operator:   {bg:'#e0f2fe',color:'#0369a1',border:'#bae6fd'},
                Manager:    {bg:'#fef9c3',color:'#854d0e',border:'#fde047'},
                Controller: {bg:'#f0fdf4',color:'#166534',border:'#bbf7d0'},
                DGM:        {bg:'#fdf4ff',color:'#7e22ce',border:'#e9d5ff'},
              }
              const cc = CHIP_COLORS[r]
              return (
                <button key={r} onClick={() => setActRole(r)} style={{
                  display:'flex', alignItems:'center', gap:5,
                  padding:'4px 12px', fontSize:12, fontWeight:600, fontFamily:'inherit',
                  cursor:'pointer', borderRadius:20, transition:'all 0.12s',
                  border: active ? `2px solid ${r==='all'?'var(--g4)':cc.border}` : `1.5px solid ${r==='all'?'var(--ow2)':cc.border}`,
                  background: active ? (r==='all'?'var(--g7)':cc.bg) : '#fff',
                  color: active ? (r==='all'?'#fff':cc.color) : (r==='all'?'var(--td)':cc.color),
                  opacity: count===0 ? 0.4 : 1,
                }}>
                  {r === 'all' ? 'All Roles' : r}
                  <span style={{
                    fontSize:10, fontWeight:700, padding:'1px 6px', borderRadius:10,
                    background: active ? (r==='all'?'rgba(255,255,255,0.25)':'rgba(0,0,0,0.1)') : (r==='all'?'var(--ow2)':cc.border),
                    color: active ? (r==='all'?'#fff':cc.color) : (r==='all'?'var(--td)':cc.color),
                  }}>{count}</span>
                </button>
              )
            })}
          </div>

          <div className="card-body" style={{padding:0}}>
            <table className="dt">
              <thead>
                <tr>
                  <th>Name</th>
                  <th style={{textAlign:'center'}}>Role</th>
                  <th style={{textAlign:'center'}}>Actions</th>
                  <th style={{textAlign:'center'}}>✓ Approved / Completed</th>
                  <th style={{textAlign:'center'}}>✗ Rejected / Missed</th>
                  <th style={{textAlign:'center'}}>⏳ Pending / Scheduled</th>
                  <th style={{textAlign:'center'}}>Rate</th>
                  <th style={{textAlign:'center'}}>Avg Variance</th>
                  <th style={{textAlign:'center'}}>Exceptions</th>
                  <th style={{textAlign:'center'}}>Locations</th>
                </tr>
              </thead>
              <tbody>
                {actPageRows.map(({name,role,actions,positive,negative,pending,rate,variance,excepts,locs})=>{
                  const ROLE_STYLE: Record<string,{bg:string,color:string,border:string}> = {
                    Operator:   {bg:'#e0f2fe',color:'#0369a1',border:'#bae6fd'},
                    Manager:    {bg:'#fef9c3',color:'#854d0e',border:'#fde047'},
                    Controller: {bg:'#f0fdf4',color:'#166534',border:'#bbf7d0'},
                    DGM:        {bg:'#fdf4ff',color:'#7e22ce',border:'#e9d5ff'},
                  }
                  const rs = ROLE_STYLE[role] ?? {bg:'#f5f5f5',color:'#555',border:'#ddd'}
                  return (
                    <tr key={`${role}-${name}`}>
                      <td style={{fontWeight:600,fontSize:13}}>{name}</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,background:rs.bg,color:rs.color,border:`1px solid ${rs.border}`}}>{role}</span>
                      </td>
                      <td style={{textAlign:'center',fontSize:13,fontWeight:500}}>{actions}</td>
                      <td style={{textAlign:'center'}}>
                        <span style={{color:'var(--g7)',fontWeight:600,fontSize:13}}>{positive}</span>
                      </td>
                      <td style={{textAlign:'center'}}>
                        <span style={{color:negative>0?'var(--red)':'var(--ts)',fontWeight:negative>0?600:400,fontSize:13}}>{negative}</span>
                      </td>
                      <td style={{textAlign:'center'}}>
                        {role==='Manager'
                          ? <span style={{color:'var(--ts)',fontSize:12}}>—</span>
                          : <span style={{color:pending>0?'var(--amb)':'var(--ts)',fontWeight:pending>0?600:400,fontSize:13}}>{pending}</span>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        <span style={{
                          fontSize:12,fontWeight:700,padding:'2px 8px',borderRadius:6,
                          background:rate>=80?'var(--g0)':rate>=60?'#fffbeb':'#fff1f2',
                          color:rate>=80?'var(--g7)':rate>=60?'var(--amb)':'var(--red)',
                          border:`1px solid ${rate>=80?'var(--g2)':rate>=60?'#fcd34d':'#fca5a5'}`,
                        }}>{rate}%</span>
                      </td>
                      <td style={{textAlign:'center'}}>
                        {variance!==null
                          ? <span style={{fontSize:13,color:Math.abs(variance)>2?'var(--amb)':'var(--ts)'}}>{variance>=0?'+':''}{variance.toFixed(2)}%</span>
                          : <span style={{color:'#bbb',fontSize:12}}>—</span>}
                      </td>
                      <td style={{textAlign:'center'}}>
                        {excepts!==null
                          ? excepts>0
                            ? <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,background:'#fff1f2',color:'var(--red)',border:'1px solid #fca5a5'}}>{excepts}</span>
                            : <span style={{color:'var(--g7)',fontWeight:600}}>—</span>
                          : <span style={{color:'#bbb',fontSize:12}}>—</span>}
                      </td>
                      <td style={{textAlign:'center',fontSize:13,color:'var(--ts)'}}>{locs}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {actTotalPages > 1 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
                <span style={{fontSize:12,color:'var(--ts)'}}>
                  Showing {actPage*ACT_PAGE_SIZE+1}–{Math.min((actPage+1)*ACT_PAGE_SIZE,actFiltered.length)} of {actFiltered.length} actor{actFiltered.length!==1?'s':''}{actRole!=='all'?` (${actRole}s)`:''}
                </span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={actPage===0} onClick={()=>setActPage(p=>p-1)}>← Prev</button>
                  {pageNums(actPage,actTotalPages).map((n,i)=>n==='gap'
                    ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                    : <button key={n} onClick={()=>setActPage(n as number)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:actPage===n?700:400,border:`1px solid ${actPage===n?'var(--g4)':'var(--ow2)'}`,background:actPage===n?'var(--g7)':'#fff',color:actPage===n?'#fff':'var(--td)'}}>{(n as number)+1}</button>
                  )}
                  <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={actPage>=actTotalPages-1} onClick={()=>setActPage(p=>p+1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Variance exceptions detail */}
      {exceptions.length > 0 && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Variance Exceptions (&gt;5%)</span>
            <span className="card-sub">{exceptions.length} records</span>
          </div>
          <div className="card-body" style={{padding:0}}>
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th><th>Location</th><th>Operator</th>
                  <th style={{textAlign:'right'}}>Total Cash</th>
                  <th style={{textAlign:'right'}}>Variance</th>
                  <th>Status</th><th>Note</th>
                </tr>
              </thead>
              <tbody>
                {excPageRows.map(s=>{
                  return(
                    <tr key={s.id}>
                      <td style={{fontSize:12,whiteSpace:'nowrap'}}>{new Date(s.date+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}</td>
                      <td>
                        <div style={{fontWeight:500,fontSize:12}}>{s.locationName||s.locationId}</div>
                        <div style={{fontSize:10,fontFamily:'monospace',color:'var(--ts)'}}>{s.locationId}</div>
                      </td>
                      <td style={{fontSize:12}}>{s.operatorName}</td>
                      <td style={{textAlign:'right',fontFamily:'DM Serif Display,serif',fontSize:14}}>{formatCurrency(s.totalCash)}</td>
                      <td style={{textAlign:'right'}}>
                        <span style={{color:'var(--red)',fontWeight:700,fontSize:13}}>{s.variance>=0?'+':''}{formatCurrency(s.variance)}</span>
                        <div style={{fontSize:11,color:'var(--red)'}}>{s.variancePct>=0?'+':''}{s.variancePct.toFixed(2)}%</div>
                      </td>
                      <td>
                        <span style={{fontSize:11,fontWeight:700,padding:'2px 8px',borderRadius:6,
                          background:s.status==='approved'?'var(--g0)':s.status==='rejected'?'#fff1f2':'#fffbeb',
                          color:s.status==='approved'?'var(--g7)':s.status==='rejected'?'var(--red)':'var(--amb)',
                          border:`1px solid ${s.status==='approved'?'var(--g2)':s.status==='rejected'?'#fca5a5':'#fcd34d'}`
                        }}>{s.status.toUpperCase()}</span>
                      </td>
                      <td style={{fontSize:11,color:'var(--ts)',maxWidth:200}}>
                        {s.rejectionReason?<span style={{color:'var(--red)'}}>{s.rejectionReason.slice(0,60)}{s.rejectionReason.length>60?'…':''}</span>:<span style={{color:'#bbb'}}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {excTotalPages > 1 && (
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'12px 20px',borderTop:'1px solid var(--ow2)',background:'var(--ow)'}}>
                <span style={{fontSize:12,color:'var(--ts)'}}>
                  Showing {excPage*EXC_PAGE_SIZE+1}–{Math.min((excPage+1)*EXC_PAGE_SIZE,exceptions.length)} of {exceptions.length} exceptions
                </span>
                <div style={{display:'flex',gap:4,alignItems:'center'}}>
                  <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={excPage===0} onClick={()=>setExcPage(p=>p-1)}>← Prev</button>
                  {pageNums(excPage,excTotalPages).map((n,i)=>n==='gap'
                    ? <span key={`g${i}`} style={{fontSize:12,color:'var(--ts)',padding:'0 4px'}}>…</span>
                    : <button key={n} onClick={()=>setExcPage(n as number)} style={{width:30,height:30,borderRadius:6,fontSize:12,cursor:'pointer',fontFamily:'inherit',fontWeight:excPage===n?700:400,border:`1px solid ${excPage===n?'var(--g4)':'var(--ow2)'}`,background:excPage===n?'var(--g7)':'#fff',color:excPage===n?'#fff':'var(--td)'}}>{(n as number)+1}</button>
                  )}
                  <button className="btn btn-ghost" style={{fontSize:12,padding:'4px 12px'}} disabled={excPage>=excTotalPages-1} onClick={()=>setExcPage(p=>p+1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
