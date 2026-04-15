import { useMemo, useState, useEffect } from 'react'
import { LOCATIONS, SUBMISSIONS, VERIFICATIONS, formatCurrency, IMPREST, todayStr } from '../../mock/data'
import { getComplianceDashboard, getComplianceTrend } from '../../api/compliance'
import type { ComplianceDashboard, ComplianceTrend } from '../../api/types'
import KpiCard from '../../components/KpiCard'
import { SkeletonKpiRow } from '../../components/ui/Skeleton'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'

interface Props { adminName: string }

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December']

function curMonthYear() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
}
function daysSince(dateStr: string) {
  return Math.floor((Date.now() - new Date(dateStr+'T12:00:00').getTime()) / 86400000)
}
function Dot({ c }: { c: 'green'|'amber'|'red'|'gray' }) {
  const bg = c==='green'?'var(--g7)':c==='amber'?'var(--amb)':c==='red'?'var(--red)':'#bbb'
  return <span style={{display:'inline-block',width:8,height:8,borderRadius:'50%',background:bg,flexShrink:0,marginTop:2}}/>
}

type CompStatus = 'green'|'amber'|'red'
type SortKey   = 'status'|'name'
type RangeKey  = 'today'|'week'|'month'|'custom'
type ActiveKpi = 'all'|'compliance'|'submitted'|'overdue'|'variance'|'controller'|'dgm'


function getRangeDates(range: RangeKey, customFrom: string, customTo: string): { start: string; end: string } {
  const today = todayStr()
  if (range === 'today') return { start: today, end: today }
  if (range === 'week') {
    const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() - 6)
    return { start: d.toISOString().split('T')[0], end: today }
  }
  if (range === 'month') {
    const d = new Date(today + 'T00:00:00'); d.setDate(1)
    return { start: d.toISOString().split('T')[0], end: today }
  }
  return { start: customFrom || today, end: customTo || today }
}

export default function AdmCompliance({ adminName }: Props) {
  const today  = todayStr()
  const curMY  = curMonthYear()
  const [cy,cm] = curMY.split('-')
  const [sortKey,       setSortKey]       = useState<SortKey>('status')
  const [loading,       setLoading]       = useState(true)
  const [dashboard,     setDashboard]     = useState<ComplianceDashboard | null>(null)
  const [range,         setRange]         = useState<RangeKey>('month')
  const [customFrom,    setCustomFrom]    = useState('')
  const [customTo,      setCustomTo]      = useState(today)
  const [activeKpi,     setActiveKpi]     = useState<ActiveKpi>('all')
  const [locFilter,     setLocFilter]     = useState('all')
  const [trendData,     setTrendData]     = useState<ComplianceTrend | null>(null)
  const [trendGran,     setTrendGran]     = useState<'daily'|'weekly'|'monthly'>('weekly')
  const [trendPeriods,  setTrendPeriods]  = useState(12)

  function toggleKpi(k: ActiveKpi) { setActiveKpi(prev => prev === k ? 'all' : k) }

  const { start, end } = useMemo(
    () => getRangeDates(range, customFrom, customTo),
    [range, customFrom, customTo]
  )

  const rangeLabel = useMemo(() => {
    if (range === 'today') return 'Today'
    if (range === 'week')  return 'Last 7 Days'
    if (range === 'month') return `${MONTH_NAMES[parseInt(cm)-1]} ${cy}`
    if (start && end) {
      const fmt = (s: string) => new Date(s+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})
      return `${fmt(start)} – ${fmt(end)}`
    }
    return 'Custom'
  }, [range, start, end, cm, cy])

  useEffect(() => {
    getComplianceDashboard().then(setDashboard).catch(() => {}).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setTrendData(null)
    getComplianceTrend(trendGran, trendPeriods).then(setTrendData).catch(() => {})
  }, [trendGran, trendPeriods])

  const btnBase: React.CSSProperties = {
    padding:'6px 16px', borderRadius:8, fontSize:12, fontWeight:700,
    cursor:'pointer', fontFamily:'inherit', transition:'all 0.12s',
  }

  const rows = useMemo(() => LOCATIONS.map(loc => {
    // ── Submissions in selected range ────────────────────────────────
    const subs      = SUBMISSIONS.filter(s => s.locationId === loc.id && s.date >= start && s.date <= end)
    const latestSub = [...subs].sort((a,b) => b.date.localeCompare(a.date))[0] ?? null
    const pending   = subs.filter(s => s.status === 'pending_approval')
    const overdue   = pending.filter(s => (Date.now()-new Date(s.submittedAt).getTime())/3600000 > 48)
    const rangeDays = Math.max(1, Math.round((new Date(end+'T00:00:00').getTime() - new Date(start+'T00:00:00').getTime()) / 86400000) + 1)
    const rate30    = Math.min(100, Math.round((subs.length / rangeDays) * 100))

    // ── Controller visits in range ───────────────────────────────────
    const ctrlAll    = VERIFICATIONS.filter(v=>v.type==='controller'&&v.locationId===loc.id)
    const ctrlRange  = ctrlAll.filter(v=>v.date>=start&&v.date<=end)
    const lastCtrl   = ctrlAll.filter(v=>v.status==='completed').sort((a,b)=>b.date.localeCompare(a.date))[0]??null
    const nextCtrl   = ctrlAll.filter(v=>v.status==='scheduled'&&v.date>=today).sort((a,b)=>a.date.localeCompare(b.date))[0]??null
    const missedCtrl = ctrlRange.filter(v=>v.status==='missed').length
    const dSinceCtrl = lastCtrl ? daysSince(lastCtrl.date) : null

    // ── DGM visits in range ──────────────────────────────────────────
    const dgmVisit = VERIFICATIONS
      .filter(v=>v.type==='dgm'&&v.locationId===loc.id&&v.date>=start&&v.date<=end)
      .sort((a,b)=>b.date.localeCompare(a.date))[0] ?? null

    // ── Per-track colours ────────────────────────────────────────────
    const subC:  'green'|'amber'|'red'|'gray' = !latestSub?'gray':latestSub.status==='approved'?'green':latestSub.status==='rejected'?'red':overdue.length>0?'red':'amber'
    const ctrlC: 'green'|'amber'|'red'|'gray' = missedCtrl>0?'red':ctrlRange.filter(v=>v.status==='completed').length>0?'green':dSinceCtrl===null?'gray':dSinceCtrl>14?'amber':'green'
    const dgmC:  'green'|'amber'|'red'|'gray' = dgmVisit?'green':'amber'

    // ── Overall compliance ───────────────────────────────────────────
    const compStatus: CompStatus =
      (subC==='red'||ctrlC==='red')                                                           ? 'red'   :
      (subC==='amber'||subC==='gray'||ctrlC==='amber'||ctrlC==='gray'||dgmC==='amber')        ? 'amber' :
      'green'

    return { loc, todaySub: latestSub, overdue, rate30,
             lastCtrl, nextCtrl, missedCtrl, dSinceCtrl, dgmVisit,
             subC, ctrlC, dgmC, compStatus }
  }), [start, end, today])

  // ── Map API dashboard locations to the same row shape ───────────────────────
  const apiRows = useMemo(() => {
    if (!dashboard) return null
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now()
    return dashboard.locations.map(lc => {
      const subC:  'green'|'amber'|'red'|'gray' = !lc.submission ? 'gray' : lc.submission.status === 'approved' ? 'green' : lc.submission.status === 'rejected' ? 'red' : 'amber'
      const ctrlC: 'green'|'amber'|'red'|'gray' = lc.controller_visit.warning_flag ? 'amber' : lc.controller_visit.days_since === null ? 'gray' : lc.controller_visit.days_since > 14 ? 'amber' : 'green'
      const dgmC:  'green'|'amber'|'red'|'gray' = lc.dgm_visit.visit_date ? 'green' : 'amber'
      return {
        loc:        { id: lc.id, name: lc.name, city: '', expectedCash: 0, tolerancePct: 0, active: true },
        todaySub:   lc.submission ? { totalCash: lc.submission.total_cash, variance: lc.submission.variance, variancePct: lc.submission.variance_pct, status: lc.submission.status } : null,
        overdue:    lc.submission?.status === 'pending_approval' && lc.submission.submitted_at && (now - new Date(lc.submission.submitted_at).getTime()) / 3600000 > 48 ? [1] : [],
        rate30:     lc.submission_rate_30d,
        lastCtrl:   lc.controller_visit.last_date ? { date: lc.controller_visit.last_date, observedTotal: undefined as number | undefined, warningFlag: lc.controller_visit.warning_flag } : null,
        nextCtrl:   lc.controller_visit.next_scheduled_date ? { date: lc.controller_visit.next_scheduled_date, scheduledTime: undefined as string | undefined } : null,
        missedCtrl: 0,
        dSinceCtrl: lc.controller_visit.days_since,
        dgmVisit:   lc.dgm_visit.visit_date ? { date: lc.dgm_visit.visit_date, observedTotal: lc.dgm_visit.observed_total ?? undefined } : null,
        subC, ctrlC, dgmC,
        compStatus: lc.health as CompStatus,
      }
    })
  }, [dashboard])

  // ── Sort ────────────────────────────────────────────────────────────────────
  const sortedRows = useMemo(() => {
    const source = apiRows ?? rows
    if (sortKey === 'name') return [...source].sort((a,b)=>a.loc.name.localeCompare(b.loc.name))
    const ord: Record<CompStatus,number> = { red:0, amber:1, green:2 }
    return [...source].sort((a,b)=>ord[a.compStatus]-ord[b.compStatus])
  }, [apiRows, rows, sortKey])

  // ── Filter table rows based on active KPI + location filter ────────────────
  const filteredRows = useMemo(() => {
    const byLoc = (r: typeof sortedRows[0]) => locFilter === 'all' || r.loc.id === locFilter
    switch (activeKpi) {
      case 'compliance':  return sortedRows.filter(r => byLoc(r) && r.compStatus === 'green')
      case 'submitted':   return sortedRows.filter(r => byLoc(r) && r.todaySub)
      case 'overdue':     return sortedRows.filter(r => byLoc(r) && r.overdue.length > 0)
      case 'variance':    return sortedRows.filter(r => byLoc(r) && r.todaySub && Math.abs(r.todaySub.variancePct) > 5)
      case 'controller':  return sortedRows.filter(r => byLoc(r) && (r.missedCtrl > 0 || (r.dSinceCtrl !== null && r.dSinceCtrl > 14)))
      case 'dgm':         return sortedRows.filter(r => byLoc(r) && !r.dgmVisit)
      default:            return sortedRows.filter(r => byLoc(r))
    }
  }, [sortedRows, activeKpi, locFilter])

  const tableTitle = useMemo(() => {
    switch (activeKpi) {
      case 'compliance':  return 'Fully Compliant Locations'
      case 'submitted':   return 'Locations with Submissions in Period'
      case 'overdue':     return 'Locations with Overdue Submissions (>48h)'
      case 'variance':    return 'Locations with Variance Exceptions (>5%)'
      case 'controller':  return 'Locations with Controller Visit Issues'
      case 'dgm':         return 'Locations with No DGM Visit in Period'
      default:            return 'Location Status — All Tracks'
    }
  }, [activeKpi])

  // ── At-risk scoring ─────────────────────────────────────────────────────────
  // Score each location by combining submission, variance, and visit signals.
  // Higher score = more at risk. Only non-green locations are ranked.
  type RiskFlag = 'No submission' | 'Rejected' | 'Overdue >48h' | 'Variance >5%' | 'No DGM visit' | 'Ctrl overdue' | 'No ctrl visit'
  type AtRiskRow = { id: string; name: string; score: number; flags: RiskFlag[] }

  const atRiskRows = useMemo((): AtRiskRow[] => {
    const source = apiRows ?? rows
    return source
      .filter(r => r.compStatus !== 'green')
      .map(r => {
        let score = 0
        const flags: RiskFlag[] = []
        if (!r.todaySub) {
          score += 30; flags.push('No submission')
        } else {
          if (r.todaySub.status === 'rejected')       { score += 20; flags.push('Rejected') }
          if (r.overdue.length > 0)                   { score += 25; flags.push('Overdue >48h') }
          if (Math.abs(r.todaySub.variancePct) > 5)   { score += 15; flags.push('Variance >5%') }
        }
        if (!r.dgmVisit)                              { score += 10; flags.push('No DGM visit') }
        if (r.dSinceCtrl === null)                    { score += 15; flags.push('No ctrl visit') }
        else if (r.dSinceCtrl > 14)                   { score += 10; flags.push('Ctrl overdue') }
        return { id: r.loc.id, name: r.loc.name, score, flags }
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5)
  }, [apiRows, rows])

  // ── KPIs: use real API dashboard.summary when available ─────────────────────
  const totalLocations     = dashboard ? dashboard.summary.total_locations     : LOCATIONS.length
  const fullyCompliant     = apiRows   ? apiRows.filter(r=>r.compStatus==='green').length : rows.filter(r=>r.compStatus==='green').length
  const compPct            = dashboard ? Math.round(dashboard.summary.overall_compliance_pct) : Math.round(fullyCompliant/Math.max(totalLocations,1)*100)
  const submittedInRange   = dashboard ? dashboard.summary.submitted_today           : rows.filter(r=>r.todaySub).length
  const overdueTotal       = dashboard ? dashboard.summary.overdue_count             : rows.reduce((n,r)=>n+r.overdue.length,0)
  const varianceExceptions = dashboard ? dashboard.summary.variance_exceptions_today : rows.filter(r=>r.todaySub&&Math.abs(r.todaySub.variancePct)>5).length
  const ctrlIssues         = dashboard ? dashboard.summary.controller_issues         : rows.filter(r=>r.missedCtrl>0||(r.dSinceCtrl!==null&&r.dSinceCtrl>14)).length
  const dgmCovered         = apiRows   ? apiRows.filter(r=>r.dgmVisit).length       : rows.filter(r=>r.dgmVisit).length

  return (
    <div className="fade-up">

      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="ph" style={{marginBottom:18}}>
        <div>
          <h2>Compliance Dashboard</h2>
          <p style={{color:'var(--ts)',fontSize:13}}>Three-track view per location · {adminName}</p>
        </div>
        <div className="ph-right">
          <span style={{fontSize:12,color:'var(--ts)'}}>{totalLocations} locations · {rangeLabel}</span>
        </div>
      </div>

      {/* ── Date filter ────────────────────────────────────────────── */}
      <div style={{display:'flex',gap:8,alignItems:'center',flexWrap:'wrap',marginBottom:20}}>
        <span style={{fontSize:12,fontWeight:600,color:'var(--td)'}}>Period:</span>
        {(['today','week','month','custom'] as RangeKey[]).map(r => (
          <button key={r} onClick={() => setRange(r)} style={{
            ...btnBase,
            border: range===r ? '2px solid var(--g4)' : '1.5px solid var(--ow2)',
            background: range===r ? 'var(--g7)' : '#fff',
            color: range===r ? '#fff' : 'var(--td)',
          }}>
            {r==='today'?'Today':r==='week'?'This Week':r==='month'?'This Month':'Custom'}
          </button>
        ))}
        {range==='custom' && (
          <>
            <input type="date" className="f-inp" value={customFrom} max={customTo||today}
              onChange={e=>setCustomFrom(e.target.value)} style={{fontSize:12,width:140}}/>
            <span style={{fontSize:12,color:'var(--ts)'}}>→</span>
            <input type="date" className="f-inp" value={customTo} max={today}
              onChange={e=>setCustomTo(e.target.value)} style={{fontSize:12,width:140}}/>
          </>
        )}
        {range!=='custom' && start && end && start!==end && (
          <span style={{fontSize:11,color:'var(--ts)',marginLeft:4}}>
            {new Date(start+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})} –{' '}
            {new Date(end+'T00:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short',year:'numeric'})}
          </span>
        )}
        <div style={{width:1, height:24, background:'#e2e8f0', flexShrink:0, margin:'0 4px'}}/>
        <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0,
          background:'#f8fafc', border:'1.5px solid #cbd5e1', borderRadius:10, padding:'5px 12px 5px 10px' }}>
          <span style={{fontSize:11,fontWeight:700,color:'#475569',whiteSpace:'nowrap',letterSpacing:'0.03em'}}>LOCATION</span>
          <select value={locFilter} onChange={e => setLocFilter(e.target.value)}
            style={{ fontSize:13, fontWeight:600, fontFamily:'inherit',
              color: locFilter !== 'all' ? 'var(--g7)' : '#1e293b',
              background:'transparent', border:'none', outline:'none', cursor:'pointer', minWidth:160, maxWidth:220 }}>
            <option value="all">All Locations</option>
            {sortedRows.slice().sort((a,b)=>a.loc.name.localeCompare(b.loc.name)).map(r => (
              <option key={r.loc.id} value={r.loc.id}>{r.loc.name}</option>
            ))}
          </select>
          {locFilter !== 'all' && (
            <button onClick={() => setLocFilter('all')}
              style={{ background:'none', border:'none', cursor:'pointer', padding:0, fontSize:14, color:'#94a3b8', lineHeight:1, flexShrink:0 }}
              title="Clear location filter">✕</button>
          )}
        </div>
      </div>

      {/* ── KPIs ───────────────────────────────────────────────────── */}
      {loading ? <SkeletonKpiRow count={6} /> : null}
      <div className="kpi-row" style={{marginBottom:20, display: loading ? 'none' : undefined}}>
        <KpiCard
          label="Overall Compliance"
          onClick={() => toggleKpi('compliance')}
          selected={activeKpi === 'compliance'}
          value={<>{compPct}<span style={{fontSize:15,fontWeight:400,color:compPct===100?'var(--g7)':compPct<50?'var(--red)':'var(--amb)'}}>%</span></>}
          sub={`${fullyCompliant} of ${totalLocations} fully green`}
          accent={compPct===100?'var(--g7)':compPct<50?'var(--red)':'var(--amb)'}
          tooltip={{
            what: 'Percentage of locations that are fully compliant across all three tracks in the selected period.',
            how: 'A location is green only when its submission, controller visit, and DGM visit tracks are all green. Amber or red on any track disqualifies it.',
            formula: '(Green locations ÷ Total locations) × 100',
            flag: 'Turns red if <50% compliant; amber if <100%.',
          }}
        />
        <KpiCard
          label="Submitted"
          value={<>{submittedInRange}<span style={{fontSize:15,fontWeight:400,color:'var(--ts)'}}> / {totalLocations}</span></>}
          sub="locations in period"
          onClick={() => toggleKpi('submitted')}
          selected={activeKpi === 'submitted'}
          tooltip={{
            what: 'Number of locations that have at least one cash count submission within the selected date range.',
            how: 'Each location is counted once regardless of how many submissions it made. The latest submission in the range is used to determine that location\'s status.',
            formula: 'COUNT(locations where submissions ≥ 1 in [start, end])',
          }}
        />
        <KpiCard
          label="Overdue (>48h)"
          value={overdueTotal}
          sub="need urgent action"
          accent={overdueTotal>0?'var(--red)':'var(--g7)'}
          highlight={overdueTotal>0?'red':false}
          onClick={() => toggleKpi('overdue')}
          selected={activeKpi === 'overdue'}
          tooltip={{
            what: 'Pending submissions that have breached the 48-hour manager approval SLA.',
            how: 'Counts submissions in the period with status "Pending Approval" where the elapsed time since submission exceeds the SLA limit.',
            formula: 'COUNT(status = pending AND (now − submitted_at) > 48h)',
            flag: 'Any value above 0 turns this card red — immediate action required.',
          }}
        />
        <KpiCard
          label="Variance Exceptions"
          value={varianceExceptions}
          sub=">5% tolerance"
          accent={varianceExceptions>0?'var(--amb)':'var(--g7)'}
          highlight={varianceExceptions>0?'amber':false}
          onClick={() => toggleKpi('variance')}
          selected={activeKpi === 'variance'}
          tooltip={{
            what: 'Submissions where the cash count deviates from the imprest balance by more than the 5% tolerance threshold.',
            how: 'For each submission, the absolute variance percentage is compared against the 5% system threshold. Breaches require a written explanation from the operator.',
            formula: '|actual − imprest| ÷ imprest × 100 > 5%',
            flag: 'Flagged amber when any exceptions exist in the period.',
          }}
        />
        <KpiCard
          label="Controller Visit Status"
          value={ctrlIssues}
          sub="locations with issues"
          accent={ctrlIssues>0?'var(--amb)':'var(--g7)'}
          highlight={ctrlIssues>0?'amber':false}
          onClick={() => toggleKpi('controller')}
          selected={activeKpi === 'controller'}
          tooltip={{
            what: 'Locations where the controller visit cadence has a problem — either a missed visit or an overdue gap.',
            how: 'A location is flagged if: (a) any scheduled visit in the period was marked "missed", OR (b) the last completed visit was more than 14 days ago.',
            formula: 'missed_visits > 0  OR  days_since_last_visit > 14',
            flag: 'Flagged amber when any location meets either condition.',
          }}
        />
        <KpiCard
          label="DGM Visit Status"
          value={<>{dgmCovered}<span style={{fontSize:15,fontWeight:400,color:'var(--ts)'}}> / {totalLocations}</span></>}
          sub="locations visited"
          accent={dgmCovered<totalLocations?'var(--amb)':'var(--g7)'}
          highlight={dgmCovered<totalLocations?'amber':false}
          onClick={() => toggleKpi('dgm')}
          selected={activeKpi === 'dgm'}
          tooltip={{
            what: 'Number of locations that received at least one DGM physical verification visit in the selected period.',
            how: 'A location is counted as covered if a DGM visit with status "completed" falls within the selected date range. Target cadence is one visit per location per calendar month.',
            formula: 'COUNT(locations with ≥1 DGM visit in [start, end])',
            flag: 'Flagged amber when any location has no DGM visit in the period.',
          }}
        />
      </div>

      {/* ── At-Risk Location Ranking ────────────────────────────────── */}
      {atRiskRows.length > 0 && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <div>
              <span className="card-title">Top At-Risk Locations</span>
              <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--ts)' }}>
                Ranked by combined risk score · today's snapshot
              </span>
            </div>
            <span style={{ fontSize: 11, color: 'var(--ts)' }}>
              {atRiskRows.length} location{atRiskRows.length !== 1 ? 's' : ''} flagged
            </span>
          </div>
          <div className="card-body" style={{ padding: '8px 0 4px' }}>
            {atRiskRows.map((r, i) => {
              const flagColors: Record<RiskFlag, { bg: string; color: string }> = {
                'No submission':  { bg: '#fff1f2', color: 'var(--red)' },
                'Rejected':       { bg: '#fff1f2', color: 'var(--red)' },
                'Overdue >48h':   { bg: '#fff1f2', color: 'var(--red)' },
                'Variance >5%':   { bg: '#fffbeb', color: 'var(--amb)' },
                'No DGM visit':   { bg: '#fffbeb', color: 'var(--amb)' },
                'Ctrl overdue':   { bg: '#fffbeb', color: 'var(--amb)' },
                'No ctrl visit':  { bg: '#fff1f2', color: 'var(--red)' },
              }
              const scoreColor = r.score >= 40 ? 'var(--red)' : r.score >= 20 ? 'var(--amb)' : '#64748b'
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '10px 20px',
                  borderBottom: i < atRiskRows.length - 1 ? '1px solid #f1f5f9' : 'none',
                }}>
                  {/* Rank */}
                  <div style={{
                    width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                    background: i === 0 ? '#fee2e2' : i === 1 ? '#ffedd5' : '#f1f5f9',
                    color: i === 0 ? 'var(--red)' : i === 1 ? 'var(--amb)' : '#64748b',
                    fontSize: 11, fontWeight: 800,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {i + 1}
                  </div>
                  {/* Name */}
                  <div style={{ minWidth: 160, flex: 1 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--td)' }}>{r.name}</div>
                    <div style={{ fontSize: 10, color: 'var(--ts)', fontFamily: 'monospace' }}>{r.id}</div>
                  </div>
                  {/* Flags */}
                  <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', flex: 2 }}>
                    {r.flags.map(f => (
                      <span key={f} style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 5,
                        background: flagColors[f].bg, color: flagColors[f].color,
                        letterSpacing: '0.02em',
                      }}>
                        {f}
                      </span>
                    ))}
                  </div>
                  {/* Risk score */}
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: scoreColor, lineHeight: 1 }}>
                      {r.score}
                    </div>
                    <div style={{ fontSize: 9, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      risk score
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* ── Location table ──────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <span className="card-title">{tableTitle}</span>
            {activeKpi !== 'all' && (
              <button onClick={() => setActiveKpi('all')} style={{
                fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:5,
                background:'#f1f5f9', border:'1px solid #cbd5e1', color:'#64748b',
                cursor:'pointer', fontFamily:'inherit',
              }}>✕ Clear filter</button>
            )}
          </div>
          <div style={{display:'flex',gap:8,alignItems:'center'}}>
            <span style={{fontSize:11,color:'var(--ts)'}}>Sort:</span>
            {(['status','name'] as SortKey[]).map(k=>(
              <button key={k} onClick={()=>setSortKey(k)} style={{
                padding:'3px 10px',fontSize:11,fontWeight:600,fontFamily:'inherit',cursor:'pointer',borderRadius:6,
                border:`1px solid ${sortKey===k?'var(--g4)':'var(--ow2)'}`,
                background:sortKey===k?'var(--g7)':'#fff',
                color:sortKey===k?'#fff':'var(--td)',
              }}>{k==='status'?'Most Critical':'A–Z'}</button>
            ))}
            <span style={{fontSize:11,color:'var(--ts)',marginLeft:4}}>
              {filteredRows.length}{activeKpi !== 'all' ? ` of ${totalLocations}` : ''} location{filteredRows.length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>
        <div className="card-body" style={{padding:0}}>
          <table className="dt">
            <thead>
              <tr>
                <th style={{width:120}}>Health</th>
                <th style={{minWidth:150}}>Location</th>
                <th style={{minWidth:210}}>📋 Today's Submission</th>
                <th style={{minWidth:80,textAlign:'center'}}>30d Rate</th>
                <th style={{minWidth:200}}>🔍 Controller Visit</th>
                <th style={{minWidth:200}}>📅 DGM Visit</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map(({loc,todaySub,overdue,rate30,
                                lastCtrl,nextCtrl,missedCtrl,dSinceCtrl,dgmVisit,
                                subC,ctrlC,dgmC,compStatus})=>{
                const sBg  = compStatus==='green'?'#f0fdf4':compStatus==='amber'?'#fffbeb':'#fff5f5'
                const sBor = compStatus==='green'?'var(--g3)':compStatus==='amber'?'#f59e0b':'var(--red)'
                const sCol = compStatus==='green'?'var(--g7)':compStatus==='amber'?'var(--amb)':'var(--red)'
                const sLbl = compStatus==='green'?'✓ Compliant':compStatus==='amber'?'⚠ At Risk':'✕ Non-Compliant'
                return (
                  <tr key={loc.id}>
                    {/* Health badge */}
                    <td>
                      <span style={{fontSize:10,fontWeight:700,padding:'3px 8px',borderRadius:6,
                        letterSpacing:'0.03em',background:sBg,color:sCol,
                        border:`1px solid ${sBor}`,whiteSpace:'nowrap',display:'inline-block'}}>
                        {sLbl}
                      </span>
                    </td>

                    {/* Location */}
                    <td>
                      <div style={{fontWeight:600,fontSize:13}}>{loc.name}</div>
                      <div style={{fontSize:11,fontFamily:'monospace',color:'var(--ts)'}}>{loc.id}</div>
                    </td>

                    {/* Today's submission */}
                    <td>
                      <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:3}}>
                        <Dot c={subC}/>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--td)'}}>
                          {!todaySub?'No submission today'
                            :todaySub.status==='approved'?'Approved'
                            :todaySub.status==='rejected'?'Rejected'
                            :overdue.length>0?'Pending — overdue'
                            :'Pending approval'}
                        </span>
                      </div>
                      {todaySub&&<div style={{fontSize:11,color:'var(--ts)',paddingLeft:14}}>
                        {formatCurrency(todaySub.totalCash)} · <span style={{
                          color:Math.abs(todaySub.variancePct)>5?'var(--red)':Math.abs(todaySub.variancePct)>2?'var(--amb)':'var(--g7)',
                          fontWeight:500}}>
                          {todaySub.variance>=0?'+':''}{formatCurrency(todaySub.variance)} ({todaySub.variancePct>=0?'+':''}{todaySub.variancePct.toFixed(2)}%)
                        </span>
                      </div>}
                    </td>

                    {/* 30-day submission rate */}
                    <td style={{textAlign:'center'}}>
                      <div style={{fontSize:14,fontWeight:700,
                        color:rate30>=90?'var(--g7)':rate30>=70?'var(--amb)':'var(--red)'}}>
                        {rate30}%
                      </div>
                      <div style={{fontSize:10,color:'var(--ts)'}}>30-day</div>
                    </td>

                    {/* Controller visit */}
                    <td>
                      <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:3}}>
                        <Dot c={ctrlC}/>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--td)'}}>
                          {lastCtrl
                            ?`Last: ${dSinceCtrl===0?'today':dSinceCtrl===1?'1d ago':`${dSinceCtrl}d ago`}`
                            :'No visits yet'}
                        </span>
                      </div>
                      {lastCtrl&&lastCtrl.observedTotal!==undefined&&<div style={{fontSize:11,color:'var(--ts)',paddingLeft:14}}>
                        {formatCurrency(lastCtrl.observedTotal)} · <span style={{
                          color:lastCtrl.warningFlag?'var(--amb)':'var(--g7)',fontWeight:500}}>
                          {lastCtrl.warningFlag?'⚠ DOW flag':'No flags'}
                        </span>
                      </div>}
                      {lastCtrl&&lastCtrl.observedTotal===undefined&&lastCtrl.warningFlag&&<div style={{fontSize:11,color:'var(--ts)',paddingLeft:14}}>
                        <span style={{color:'var(--amb)',fontWeight:500}}>⚠ DOW flag</span>
                      </div>}
                      <div style={{fontSize:11,color:'var(--ts)',paddingLeft:14,marginTop:2}}>
                        {nextCtrl
                          ?`Next: ${new Date(nextCtrl.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}${nextCtrl.scheduledTime?' · '+nextCtrl.scheduledTime:''}`
                          :missedCtrl>0
                            ?<span style={{color:'var(--red)',fontWeight:600}}>⚠ {missedCtrl} missed</span>
                            :'No upcoming visit'}
                      </div>
                    </td>

                    {/* DGM this month */}
                    <td>
                      <div style={{display:'flex',alignItems:'flex-start',gap:6,marginBottom:3}}>
                        <Dot c={dgmC}/>
                        <span style={{fontSize:12,fontWeight:600,color:'var(--td)'}}>
                          {dgmVisit
                            ?`Visited · ${new Date(dgmVisit.date+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'})}`
                            :'Not yet visited'}
                        </span>
                      </div>
                      {dgmVisit?.observedTotal!==undefined&&<div style={{fontSize:11,color:'var(--ts)',paddingLeft:14}}>
                        {(()=>{
                          const v=dgmVisit.observedTotal!-IMPREST
                          const p=(v/IMPREST)*100
                          return <span style={{color:Math.abs(p)>5?'var(--red)':Math.abs(p)>2?'var(--amb)':'var(--g7)',fontWeight:500}}>
                            {formatCurrency(dgmVisit.observedTotal!)} · {v>=0?'+':''}{formatCurrency(v)}
                          </span>
                        })()}
                      </div>}
                      {!dgmVisit&&<div style={{fontSize:11,color:'var(--amb)',paddingLeft:14}}>
                        No visit in period
                      </div>}
                    </td>
                  </tr>
                )
              })}
              {filteredRows.length === 0 && (
                <tr>
                  <td colSpan={6} style={{textAlign:'center',padding:'32px 0',color:'var(--ts)',fontSize:13}}>
                    No locations match this filter for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Compliance Trend Chart ──────────────────────────────────── */}
      <div className="card" style={{ marginTop: 24 }}>
        <div className="card-header">
          <div>
            <span className="card-title">Compliance Trend</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--ts)' }}>
              Submission rate & approval rate over time
            </span>
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {/* Granularity toggle */}
            <div style={{ display: 'flex', borderRadius: 7, overflow: 'hidden', border: '1px solid var(--ow2)' }}>
              {(['daily', 'weekly', 'monthly'] as const).map(g => (
                <button key={g} onClick={() => {
                  setTrendGran(g)
                  setTrendPeriods(g === 'daily' ? 7 : g === 'weekly' ? 12 : 6)
                }} style={{
                  padding: '4px 12px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit',
                  border: 'none', outline: 'none', textTransform: 'capitalize',
                  background: trendGran === g ? 'var(--g7)' : '#fff',
                  color: trendGran === g ? '#fff' : 'var(--ts)',
                  fontWeight: trendGran === g ? 700 : 400,
                }}>
                  {g}
                </button>
              ))}
            </div>
            {/* Period selector */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(trendGran === 'daily' ? [7, 14, 30] : trendGran === 'weekly' ? [8, 12, 24] : [6, 12]).map(n => (
                <button key={n} onClick={() => setTrendPeriods(n)} style={{
                  padding: '4px 10px', fontSize: 11, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 6,
                  border: `1px solid ${trendPeriods === n ? 'var(--g4)' : 'var(--ow2)'}`,
                  background: trendPeriods === n ? 'var(--g0)' : '#fff',
                  color: trendPeriods === n ? 'var(--g7)' : 'var(--ts)',
                  fontWeight: trendPeriods === n ? 700 : 400,
                }}>
                  {n} {trendGran === 'daily' ? 'd' : trendGran === 'weekly' ? 'wk' : 'mo'}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="card-body" style={{ padding: '20px 12px 12px' }}>
          {!trendData || trendData.data.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ts)', fontSize: 13 }}>
              No trend data available for the selected period.
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={320}>
              <LineChart data={trendData.data} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#888' }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 100]}
                  tickFormatter={v => `${v}%`}
                  tick={{ fontSize: 11, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                  width={44}
                />
                <Tooltip
                  formatter={(value, name) => [
                    `${Number(value).toFixed(1)}%`,
                    name === 'submission_rate_pct' ? 'Submission Rate'
                      : name === 'approval_rate_pct' ? 'Approval Rate'
                      : 'DGM Coverage',
                  ]}
                  contentStyle={{ fontSize: 12, borderRadius: 8, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                />
                <Legend
                  formatter={(value) =>
                    value === 'submission_rate_pct' ? 'Submission Rate'
                    : value === 'approval_rate_pct' ? 'Approval Rate'
                    : 'DGM Coverage'
                  }
                  iconType="circle"
                  iconSize={8}
                  wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
                />
                <Line
                  type="monotone"
                  dataKey="submission_rate_pct"
                  stroke="var(--g7)"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: 'var(--g7)', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="approval_rate_pct"
                  stroke="#2563eb"
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: '#2563eb', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
                <Line
                  type="monotone"
                  dataKey="dgm_coverage_pct"
                  stroke="#d97706"
                  strokeWidth={2.5}
                  strokeDasharray="5 3"
                  dot={{ r: 4, fill: '#d97706', strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6 }}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
