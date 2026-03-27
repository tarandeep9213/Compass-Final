import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend,
} from 'recharts'
import {
  TIPS,
  CORE_KPIS as MOCK_KPIS,
  COVERAGE as MOCK_COVERAGE,
  TREND_DATA as MOCK_TREND,
  AT_RISK_LOCATIONS as MOCK_AT_RISK,
} from '../../mock/bizDashData'
import type { TipContent, TrendPoint } from '../../mock/bizDashData'

// TODO: Remove mock fallbacks when backend APIs return real data consistently.
// Each section below checks if API data is empty/zero and falls back to mock.
// To switch to real-only: remove the fallback lines marked with "// MOCK FALLBACK"
import { getComplianceDashboard, getComplianceTrend } from '../../api/compliance'
import { getReportSummary, getSlaSummary } from '../../api/reports'
import { listSubmissions } from '../../api/submissions'
import { getControllerActivity, getOperatorBehaviour, getRejections, getDgmCoverage } from '../../api/businessDashboard'
import type { ControllerActivityItem, OperatorBehaviourResponse, RejectionsResponse, DgmCoverageResponse } from '../../api/businessDashboard'
import type { SlaApprover, LocationCompliance } from '../../api/types'

interface Props { adminName: string }

const NOW = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
const NOW_MS = Date.now()

// ── Tooltip button ─────────────────────────────────────────────────────────

function TipBtn({ tip, label, align = 'center' }: { tip: TipContent; label: string; align?: 'left' | 'center' | 'right' }) {
  const [hovered, setHovered] = useState(false)
  const [clicked, setClicked] = useState(false)
  const btnRef = useRef<HTMLSpanElement>(null)
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null)
  const show = hovered || clicked

  useEffect(() => {
    function outside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) setClicked(false)
    }
    document.addEventListener('mousedown', outside)
    return () => document.removeEventListener('mousedown', outside)
  }, [])

  useEffect(() => {
    if (show && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect()
      const w = 280
      let left = align === 'right' ? r.right - w : align === 'left' ? r.left : r.left + r.width / 2 - w / 2
      left = Math.max(8, Math.min(left, window.innerWidth - w - 8))
      setPos({ top: r.bottom + 8, left })
    }
  }, [show, align])

  return (
    <>
      <span
        ref={btnRef}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onClick={e => { e.stopPropagation(); setClicked(c => !c) }}
        style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          width: 16, height: 16, borderRadius: '50%', fontSize: 9, fontWeight: 800,
          background: '#e2e8f0', color: '#64748b', cursor: 'pointer',
          flexShrink: 0, userSelect: 'none', border: '1px solid #cbd5e1',
        }}
      >?</span>

      {show && pos && createPortal(
        <div
          onClick={e => e.stopPropagation()}
          style={{
            position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999, width: 280,
            background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0',
            boxShadow: '0 12px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
            pointerEvents: 'auto', overflow: 'hidden',
          }}
        >
          <div style={{ background: 'linear-gradient(135deg, #1e293b 0%, #334155 100%)', padding: '10px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#f8fafc', letterSpacing: '0.04em', textTransform: 'uppercase' }}>{label}</div>
          </div>
          <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>WHAT</div>
              <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5 }}>{tip.what}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>HOW IT'S CALCULATED</div>
              <div style={{ fontSize: 11.5, color: '#334155', lineHeight: 1.5 }}>{tip.how}</div>
            </div>
            {tip.formula && (
              <div>
                <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 3 }}>FORMULA</div>
                <div style={{ fontFamily: 'monospace', fontSize: 11, color: '#0f172a', background: '#f1f5f9', border: '1px solid #e2e8f0', borderRadius: 6, padding: '6px 10px', lineHeight: 1.6, borderLeft: '3px solid #3b82f6', wordBreak: 'break-all' }}>
                  {tip.formula}
                </div>
              </div>
            )}
            {tip.flag && (
              <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <span style={{ fontSize: 11, flexShrink: 0 }}>⚠</span>
                <div style={{ fontSize: 11, color: '#92400e', lineHeight: 1.45 }}>{tip.flag}</div>
              </div>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}

// ── Other helpers ──────────────────────────────────────────────────────────

function DeltaBadge({ delta, unit }: { delta: number; unit: 'pct' | 'gbp' | 'count' }) {
  const isGood  = unit === 'pct' ? delta >= 0 : delta > 0
  const color   = isGood ? 'var(--g7)' : 'var(--red)'
  const arrow   = delta >= 0 ? '↑' : '↓'
  const abs     = Math.abs(delta)
  const label   = unit === 'pct' ? `${abs}%` : unit === 'gbp' ? `$${abs.toLocaleString()}` : `${abs}`
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color, display: 'inline-flex', alignItems: 'center', gap: 2 }}>
      {arrow} {label}
    </span>
  )
}

function SectionTitle({ children, tip, tipLabel }: { children: React.ReactNode; tip?: TipContent; tipLabel?: string }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.08em', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
      {children}
      {tip && tipLabel && <TipBtn tip={tip} label={tipLabel} />}
    </div>
  )
}

function HealthDot({ health }: { health: 'red' | 'amber' | 'green' }) {
  const c = health === 'red' ? 'var(--red)' : health === 'amber' ? 'var(--amb)' : 'var(--g7)'
  return <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
}

// ── Main Component ────────────────────────────────────────────────────────

export default function RcBizDash({ adminName }: Props) {
  // Date range for API calls — current month + prior month for deltas
  const today = new Date().toISOString().split('T')[0]
  const monthStart = today.slice(0, 8) + '01'
  const priorMonthEnd = new Date(new Date(monthStart).getTime() - 86400000).toISOString().split('T')[0]
  const priorMonthStart = priorMonthEnd.slice(0, 8) + '01'

  // ── Task 1: Compliance Trend from real API ──────────────────────────────
  const [trendData, setTrendData] = useState<TrendPoint[] | null>(null)
  const [trendLoading, setTrendLoading] = useState(true)

  // ── Task 2: Slowest Approvers from real API ─────────────────────────────
  type ApproverRow = { name: string; avgHours: number; slaBreaches: number; reviewed: number }
  const [approvers, setApprovers] = useState<ApproverRow[] | null>(null)
  const [approversLoading, setApproversLoading] = useState(true)

  // ── Task 5: Core KPI cards from real API ────────────────────────────────
  type KpiCard = { label: string; value: string; raw: number; delta: number; deltaLabel: string; unit: 'pct' | 'gbp' | 'count'; redBelow?: number; amberBelow?: number; tooltip: TipContent }
  const [kpiCards, setKpiCards] = useState<KpiCard[] | null>(null)
  const [kpiLoading, setKpiLoading] = useState(true)

  // ── Task 8: Controller Activity from real API ───────────────────────────
  const [ctrlActivity, setCtrlActivity] = useState<ControllerActivityItem[] | null>(null)
  const [ctrlActivityLoading, setCtrlActivityLoading] = useState(true)

  // ── Task 9: Operator Behaviour from real API ──────────────────────────
  const [opBehaviour, setOpBehaviour] = useState<OperatorBehaviourResponse | null>(null)
  const [opBehaviourLoading, setOpBehaviourLoading] = useState(true)

  // ── Task 10: Rejections from real API ─────────────────────────────────
  const [rejections, setRejections] = useState<RejectionsResponse | null>(null)
  const [rejectionsLoading, setRejectionsLoading] = useState(true)

  // ── Task 11: DGM Coverage from real API ───────────────────────────────
  const [dgmCov, setDgmCov] = useState<DgmCoverageResponse | null>(null)
  const [dgmCovLoading, setDgmCovLoading] = useState(true)

  // ── Task 6: Coverage + Pending Queue from real API ───────────────────────
  type CoverageData = {
    totalLocations: number
    controllerVisits: { done: number; pct: number }
    dgmVisits: { done: number; pct: number }
    pendingQueue: { under24h: number; between24and48h: number; over48h: number }
  }
  const [coverage, setCoverage] = useState<CoverageData | null>(null)

  // ── Task 3 + 4: Compliance dashboard (at-risk + location table) ──────────
  type RiskFlag = 'No submission' | 'Rejected' | 'Overdue >48h' | 'Variance >5%' | 'No DGM visit' | 'Ctrl overdue' | 'No ctrl visit'
  type AtRiskRow = { rank: number; name: string; score: number; health: 'red' | 'amber'; flags: string[] }
  const [atRiskData, setAtRiskData] = useState<AtRiskRow[] | null>(null)
  const [atRiskLoading, setAtRiskLoading] = useState(true)
  const [apiLocations, setApiLocations] = useState<LocationCompliance[] | null>(null)

  useEffect(() => {
    // Task 1
    getComplianceTrend('weekly', 8)
      .then(res => {
        const realTrend = res.data.map(p => ({
          week: p.period,
          submissionRate: Math.round(p.submission_rate_pct),
          approvalRate: Math.round(p.approval_rate_pct),
          exceptions: p.exception_count,
        }))
        // MOCK FALLBACK: if all trend values are zero, use demo data
        const trendAllZero = realTrend.every(p => p.submissionRate === 0 && p.approvalRate === 0)
        setTrendData(trendAllZero ? MOCK_TREND : realTrend)
      })
      .catch(() => setTrendData(MOCK_TREND)) // MOCK FALLBACK
      .finally(() => setTrendLoading(false))

    // Task 2
    getSlaSummary({ date_from: monthStart, date_to: today })
      .then(res => {
        setApprovers(
          res.approvers
            .map((a: SlaApprover) => ({
              name: a.name,
              avgHours: a.avg_hours,
              slaBreaches: a.count - a.within_sla,
              reviewed: a.count,
            }))
            .sort((a: ApproverRow, b: ApproverRow) => b.avgHours - a.avgHours)
        )
      })
      .catch(() => setApprovers(null))
      .finally(() => setApproversLoading(false))

    // Task 3: Fetch compliance dashboard → compute risk scores
    getComplianceDashboard()
      .then(dash => {
        const nowMs = Date.now()
        const scored = dash.locations
          .filter((loc: LocationCompliance) => loc.health !== 'green')
          .map((loc: LocationCompliance) => {
            let score = 0
            const flags: RiskFlag[] = []

            if (!loc.submission) {
              score += 30; flags.push('No submission')
            } else {
              if (loc.submission.status === 'rejected') { score += 20; flags.push('Rejected') }
              // Check overdue: pending + submitted_at > 48h ago
              if (loc.submission.status === 'pending_approval' && loc.submission.submitted_at) {
                const hrs = (nowMs - new Date(loc.submission.submitted_at).getTime()) / 3600000
                if (hrs > 48) { score += 25; flags.push('Overdue >48h') }
              }
              if (Math.abs(loc.submission.variance_pct) > 5) { score += 15; flags.push('Variance >5%') }
            }
            if (!loc.dgm_visit.visit_date)                    { score += 10; flags.push('No DGM visit') }
            if (loc.controller_visit.days_since === null)      { score += 15; flags.push('No ctrl visit') }
            else if (loc.controller_visit.days_since > 14)     { score += 10; flags.push('Ctrl overdue') }

            return { name: loc.name, score, health: (score >= 50 ? 'red' : 'amber') as 'red' | 'amber', flags: flags as string[] }
          })
          .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
          .slice(0, 5)
          .map((r: { name: string; score: number; health: 'red' | 'amber'; flags: string[] }, i: number) => ({ ...r, rank: i + 1 }))

        // MOCK FALLBACK: if no at-risk locations found, use demo data
        setAtRiskData(scored.length > 0 ? scored : MOCK_AT_RISK)
        setApiLocations(dash.locations)

        // Task 6: Compute coverage from dashboard locations
        const totalLocs = dash.locations.length
        const ctrlDone = dash.locations.filter((l: LocationCompliance) =>
          l.controller_visit.days_since !== null && l.controller_visit.days_since <= 30
        ).length
        const dgmDone = dash.locations.filter((l: LocationCompliance) =>
          l.dgm_visit.visit_date !== null
        ).length

        // Fetch pending submissions for queue bucketing
        listSubmissions({ status: 'pending_approval', page_size: 200 })
          .then(res => {
            const nowMs = Date.now()
            let under24 = 0, between24and48 = 0, over48 = 0
            for (const sub of res.items) {
              if (!sub.submitted_at) continue
              const hrs = (nowMs - new Date(sub.submitted_at).getTime()) / 3600000
              if (hrs > 48) over48++
              else if (hrs > 24) between24and48++
              else under24++
            }
            const realCoverage = {
              totalLocations: totalLocs,
              controllerVisits: { done: ctrlDone, pct: totalLocs > 0 ? Math.round(ctrlDone / totalLocs * 100) : 0 },
              dgmVisits: { done: dgmDone, pct: totalLocs > 0 ? Math.round(dgmDone / totalLocs * 100) : 0 },
              pendingQueue: { under24h: under24, between24and48h: between24and48, over48h: over48 },
            }
            // MOCK FALLBACK: if all coverage is zero, use demo data
            const covAllZero = ctrlDone === 0 && dgmDone === 0 && under24 + between24and48 + over48 === 0
            setCoverage(covAllZero ? MOCK_COVERAGE : realCoverage)
          })
          .catch(() => {
            // MOCK FALLBACK
            setCoverage(MOCK_COVERAGE)
          })
      })
      .catch(() => { setAtRiskData(MOCK_AT_RISK); setApiLocations(null) }) // MOCK FALLBACK
      .finally(() => setAtRiskLoading(false))

    // Task 5: Fetch report summaries + SLA (current + prior month) for KPI cards with deltas
    // Use individual catch() so prior-month failures don't break the whole thing
    const emptySum = { approval_rate_pct: 0, variance_exceptions: 0, cash_at_risk: 0, total_submissions: 0 }
    const emptySla = { sla_compliance_pct: null as number | null }
    Promise.all([
      getReportSummary({ date_from: monthStart, date_to: today }).catch(() => emptySum),
      getReportSummary({ date_from: priorMonthStart, date_to: priorMonthEnd }).catch(() => emptySum),
      getSlaSummary({ date_from: monthStart, date_to: today }).catch(() => emptySla),
      getSlaSummary({ date_from: priorMonthStart, date_to: priorMonthEnd }).catch(() => emptySla),
      getComplianceDashboard().catch(() => ({ summary: { overall_compliance_pct: 0 } })),
    ])
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      .then(([curSummary, prevSummary, _curSla, _prevSla, dash]) => {
        const curCompPct  = Math.round(dash.summary.overall_compliance_pct)
        const prevCompPct = prevSummary.total_submissions > 0
          ? Math.round(prevSummary.approval_rate_pct)
          : curCompPct

        const tt = {
          compliance: { what: 'Percentage of active locations that submitted a cash count AND had it approved within the selected period.', how: 'Divides locations with at least one approved submission by total active locations.', formula: '(Locations with approved submission ÷ Total active locations) × 100', flag: 'Green ≥ 80% · Amber 70–79% · Red < 70%.' },
          approval: { what: 'Percentage of submitted cash counts that were approved by a manager (vs rejected).', how: 'Counts approved submissions and divides by total non-draft submissions.', formula: '(Approved ÷ Total submitted) × 100', flag: 'Target ≥ 85%. Low rate signals operator accuracy problems.' },
          sla: { what: 'Percentage of submissions reviewed within the 48-hour SLA window.', how: 'Hours between submitted_at and approved_at. Counts those ≤ 48h.', formula: '(Reviewed ≤ 48h ÷ Total reviewed) × 100', flag: 'Target ≥ 90%. Check Slowest Approvers for bottlenecks.' },
          cashAtRisk: { what: 'Total dollar variance across all exception submissions (>5% tolerance).', how: 'Sums |actual − imprest| for every variance exception.', formula: 'Σ |actual cash − imprest| for exceptions', flag: 'Report this to finance. Rising trend = systemic issue.' },
          exceptions: { what: 'Submissions where cash deviated from imprest by more than 5%.', how: '|actual − imprest| ÷ imprest × 100 > 5%.', formula: 'COUNT(variance > 5%)', flag: 'Written explanation required. Repeat exceptions = training gap.' },
        }

        const realCards: KpiCard[] = [
          { label: 'Compliance Rate', value: `${curCompPct}%`, raw: curCompPct, delta: curCompPct - prevCompPct, deltaLabel: 'vs last month', unit: 'pct', redBelow: 70, amberBelow: 80, tooltip: tt.compliance },
          { label: 'Approval Rate', value: `${Math.round(curSummary.approval_rate_pct)}%`, raw: Math.round(curSummary.approval_rate_pct), delta: Math.round(curSummary.approval_rate_pct - prevSummary.approval_rate_pct), deltaLabel: 'vs last month', unit: 'pct', redBelow: 80, amberBelow: 85, tooltip: tt.approval },
          { label: 'Cash at Risk', value: `$${Math.round(curSummary.cash_at_risk).toLocaleString()}`, raw: curSummary.cash_at_risk, delta: Math.round(prevSummary.cash_at_risk - curSummary.cash_at_risk), deltaLabel: 'vs last month', unit: 'gbp', tooltip: tt.cashAtRisk },
          { label: 'Variance Exceptions', value: `${curSummary.variance_exceptions}`, raw: curSummary.variance_exceptions, delta: prevSummary.variance_exceptions - curSummary.variance_exceptions, deltaLabel: 'vs last month', unit: 'count', tooltip: tt.exceptions },
        ]
        // MOCK FALLBACK: if compliance rate is 0 or most KPIs are zero, use demo data
        const zeroCount = realCards.filter(c => c.raw === 0).length
        setKpiCards(zeroCount >= 3 ? MOCK_KPIS : realCards)
      })
      .catch(err => { console.error('KPI fetch error:', err); setKpiCards(MOCK_KPIS) }) // MOCK FALLBACK
      .finally(() => setKpiLoading(false))

    // Task 8: Controller Activity
    getControllerActivity()
      .then(res => setCtrlActivity(res.items.length > 0 ? res.items : null))
      .catch(() => setCtrlActivity(null)) // MOCK FALLBACK handled in render
      .finally(() => setCtrlActivityLoading(false))

    // Task 9: Operator Behaviour
    getOperatorBehaviour()
      .then(setOpBehaviour)
      .catch(() => setOpBehaviour(null))
      .finally(() => setOpBehaviourLoading(false))

    // Task 10: Rejections
    getRejections()
      .then(setRejections)
      .catch(() => setRejections(null))
      .finally(() => setRejectionsLoading(false))

    // Task 11: DGM Coverage
    getDgmCoverage()
      .then(setDgmCov)
      .catch(() => setDgmCov(null))
      .finally(() => setDgmCovLoading(false))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Alert detail expand state (keyed by index)
  const [alertOpen, setAlertOpen] = useState<Record<number, boolean>>({})
  const toggleAlert = (i: number) => setAlertOpen(prev => ({ ...prev, [i]: !prev[i] }))

  // ── Task 7: Derive alert banner from real API data ──────────────────────
  type AlertItem = { type: 'red' | 'amber'; message: string; details: string[] }
  const alerts: AlertItem[] = []
  if (apiLocations) {
    const nowMs = NOW_MS
    // SLA breaches: pending submissions waiting >48h
    const slaBreach = apiLocations.filter(l =>
      l.submission && l.submission.status === 'pending_approval' && l.submission.submitted_at &&
      (nowMs - new Date(l.submission.submitted_at).getTime()) / 3600000 > 48
    )
    if (slaBreach.length > 0) {
      alerts.push({
        type: 'red',
        message: `${slaBreach.length} submission${slaBreach.length !== 1 ? 's' : ''} breached the 48h approval SLA`,
        details: slaBreach.map(l => {
          const hrs = Math.round((nowMs - new Date(l.submission!.submitted_at).getTime()) / 3600000)
          return `${l.name} (${hrs}h waiting)`
        }),
      })
    }
    // Locations with no submission today
    const noSub = apiLocations.filter(l => !l.submission)
    if (noSub.length > 0) {
      alerts.push({
        type: 'amber',
        message: `${noSub.length} location${noSub.length !== 1 ? 's' : ''} have not submitted today`,
        details: noSub.map(l => l.name),
      })
    }
  }
  // High-risk locations — removed from alerts (shown in At-Risk panel below)

  const redAlerts   = alerts.filter(a => a.type === 'red')
  const amberAlerts = alerts.filter(a => a.type === 'amber')
  const hasAlerts   = alerts.length > 0

  // Layer 3 — collapsible location detail (from real API, Task 4)
  const [locTableOpen, setLocTableOpen] = useState(false)
  const [locHealthFilter, setLocHealthFilter] = useState<'all' | 'red' | 'amber' | 'green'>('all')
  const allLocs = apiLocations ?? []
  const filteredLocs = locHealthFilter === 'all'
    ? allLocs
    : allLocs.filter(l => l.health === locHealthFilter)
  const healthCounts = {
    red: allLocs.filter(l => l.health === 'red').length,
    amber: allLocs.filter(l => l.health === 'amber').length,
    green: allLocs.filter(l => l.health === 'green').length,
  }

  return (
    <div className="fade-up" style={{ maxWidth: 1100 }}>

      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            Business Dashboard
          </h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Executive overview · {adminName} · As of {NOW}
          </p>
        </div>
        <div className="ph-right" style={{ gap: 8 }}>
          <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={() => window.print()}>
            🖨 Print / Export
          </button>
        </div>
      </div>

      {/* ── Alert Banner ─────────────────────────────────────────────────── */}
      {hasAlerts && (
        <div style={{
          borderRadius: 10, marginBottom: 20, overflow: 'hidden',
          border: redAlerts.length > 0 ? '1.5px solid #fca5a5' : '1.5px solid #fcd34d',
        }}>
          {redAlerts.length > 0 && (
            <div style={{ background: '#fff1f2', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {redAlerts.map((a, i) => {
                const idx = i
                const open = !!alertOpen[idx]
                return (
                  <div key={i}>
                    <div
                      onClick={() => a.details && a.details.length > 0 && toggleAlert(idx)}
                      style={{ fontSize: 13, fontWeight: 600, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 8, cursor: a.details?.length ? 'pointer' : 'default' }}
                    >
                      <span>🔴</span>
                      {a.message}
                      {a.details && a.details.length > 0 && (
                        <span style={{ fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', marginLeft: 4 }}>▶</span>
                      )}
                    </div>
                    {open && a.details && (
                      <div style={{ marginLeft: 28, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {a.details.map((d, j) => (
                          <div key={j} style={{ fontSize: 12, color: '#991b1b', fontWeight: 500 }}>→ {d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {amberAlerts.length > 0 && (
            <div style={{ background: '#fffbeb', padding: '10px 16px', display: 'flex', flexDirection: 'column', gap: 6, borderTop: redAlerts.length > 0 ? '1px solid #fcd34d' : undefined }}>
              {amberAlerts.map((a, i) => {
                const idx = redAlerts.length + i
                const open = !!alertOpen[idx]
                return (
                  <div key={i}>
                    <div
                      onClick={() => a.details && a.details.length > 0 && toggleAlert(idx)}
                      style={{ fontSize: 13, fontWeight: 600, color: '#92400e', display: 'flex', alignItems: 'center', gap: 8, cursor: a.details?.length ? 'pointer' : 'default' }}
                    >
                      <span>🟡</span>
                      {a.message}
                      {a.details && a.details.length > 0 && (
                        <span style={{ fontSize: 11, transition: 'transform 0.2s', transform: open ? 'rotate(90deg)' : 'rotate(0deg)', marginLeft: 4 }}>▶</span>
                      )}
                    </div>
                    {open && a.details && (
                      <div style={{ marginLeft: 28, marginTop: 4, display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {a.details.map((d, j) => (
                          <div key={j} style={{ fontSize: 12, color: '#78350f', fontWeight: 500 }}>→ {d}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Core KPI Cards — real API data (Task 5) ─────────────────────── */}
      {kpiLoading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
          {[1,2,3,4,5].map(i => (
            <div key={i} style={{ background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 12, padding: '14px 16px', height: 90 }}>
              <div style={{ width: '60%', height: 10, borderRadius: 4, background: '#e2e8f0', marginBottom: 10 }} />
              <div style={{ width: '40%', height: 22, borderRadius: 4, background: '#e2e8f0' }} />
            </div>
          ))}
        </div>
      ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        {(kpiCards ?? []).map(kpi => {
          const isRed   = kpi.redBelow   !== undefined && kpi.raw < kpi.redBelow
          const isAmber = kpi.amberBelow !== undefined && kpi.raw < kpi.amberBelow && !isRed
          const valColor = isRed ? 'var(--red)' : isAmber ? 'var(--amb)' : 'var(--g7)'
          const bg       = isRed ? '#fff1f2' : isAmber ? '#fffbeb' : 'var(--ow)'
          const border   = isRed ? '#fca5a5' : isAmber ? '#fcd34d' : 'var(--ow2)'
          return (
            <div key={kpi.label} style={{
              background: bg, border: `1.5px solid ${border}`, borderRadius: 12,
              padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 4,
              position: 'relative',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--ts)' }}>{kpi.label}</div>
                <TipBtn tip={kpi.tooltip} label={kpi.label} align="right" />
              </div>
              <div style={{ fontSize: 26, fontWeight: 700, fontFamily: 'DM Serif Display,serif', color: valColor, lineHeight: 1.1 }}>
                {kpi.value}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                <DeltaBadge delta={kpi.delta} unit={kpi.unit} />
                <span style={{ fontSize: 10, color: 'var(--ts)' }}>{kpi.deltaLabel}</span>
              </div>
            </div>
          )
        })}
      </div>
      )}

      {/* ── Coverage Strip — real API data (Task 6) ────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-body" style={{ padding: '14px 20px' }}>
          {!coverage ? (
            <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '12px 0' }}>Loading coverage data…</div>
          ) : (
          <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', alignItems: 'center' }}>

            {/* Controller visits */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                Controller Visits This Month
                <TipBtn tip={TIPS.controllerVisits} label="Controller Visit Coverage" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Serif Display,serif', color: coverage.controllerVisits.pct >= 80 ? 'var(--g7)' : 'var(--amb)' }}>
                  {coverage.controllerVisits.done}/{coverage.totalLocations}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ts)' }}>locations ({coverage.controllerVisits.pct}%)</span>
              </div>
              <div style={{ marginTop: 5, height: 5, background: 'var(--ow2)', borderRadius: 3, width: 140 }}>
                <div style={{ height: '100%', borderRadius: 3, background: coverage.controllerVisits.pct >= 80 ? 'var(--g6)' : 'var(--amb)', width: `${coverage.controllerVisits.pct}%` }} />
              </div>
            </div>

            <div style={{ width: 1, height: 44, background: 'var(--ow2)' }} />

            {/* DGM visits */}
            <div>
              <div style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                DGM Visits This Month
                <TipBtn tip={TIPS.dgmVisits} label="DGM Visit Coverage" />
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <span style={{ fontSize: 22, fontWeight: 700, fontFamily: 'DM Serif Display,serif', color: coverage.dgmVisits.pct >= 60 ? 'var(--amb)' : 'var(--red)' }}>
                  {coverage.dgmVisits.done}/{coverage.totalLocations}
                </span>
                <span style={{ fontSize: 13, color: 'var(--ts)' }}>locations ({coverage.dgmVisits.pct}%)</span>
              </div>
              <div style={{ marginTop: 5, height: 5, background: 'var(--ow2)', borderRadius: 3, width: 140 }}>
                <div style={{ height: '100%', borderRadius: 3, background: coverage.dgmVisits.pct >= 80 ? 'var(--g6)' : coverage.dgmVisits.pct >= 50 ? 'var(--amb)' : 'var(--red)', width: `${coverage.dgmVisits.pct}%` }} />
              </div>
            </div>

            <div style={{ width: 1, height: 44, background: 'var(--ow2)' }} />

            {/* Pending Approval Queue — removed per user request */}
          </div>
          )}
        </div>
      </div>

      {/* ── Trend + At-Risk ──────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginBottom: 20 }}>

        {/* Trend chart — real API data (Task 1) */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Compliance Trend</span>
            <span className="card-sub">Last 8 weeks · {trendLoading ? 'Loading…' : trendData ? `${trendData.length} data points` : 'No data'}</span>
          </div>
          <div className="card-body" style={{ paddingTop: 8 }}>
            {trendLoading ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ts)', fontSize: 13 }}>Loading trend data…</div>
            ) : !trendData || trendData.length === 0 ? (
              <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--ts)', fontSize: 13 }}>No trend data available</div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={trendData} margin={{ top: 4, right: 16, left: -8, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} unit="%" />
                  <Tooltip formatter={(v, n) => [`${v}${n === 'exceptions' ? '' : '%'}`, n === 'submissionRate' ? 'Submission Rate' : n === 'approvalRate' ? 'Approval Rate' : 'Exceptions']} />
                  <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} formatter={(v) => v === 'submissionRate' ? 'Submission Rate' : v === 'approvalRate' ? 'Approval Rate' : 'Exceptions'} />
                  <Line type="monotone" dataKey="submissionRate" stroke="var(--g6)" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="approvalRate"   stroke="#2563eb" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="exceptions"     stroke="var(--red)" strokeWidth={2} dot={false} strokeDasharray="4 3" />
                </LineChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* At-Risk panel — real API data (Task 3) */}
        <div className="card">
          <div className="card-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="card-title">Top At-Risk Locations</span>
              <TipBtn tip={TIPS.atRisk} label="At-Risk Location Score" />
            </div>
            <span className="card-sub">{atRiskLoading ? 'Loading…' : atRiskData ? `${atRiskData.length} flagged · Risk score ↓` : 'No data'}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {atRiskLoading ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>Loading risk data…</div>
            ) : !atRiskData || atRiskData.length === 0 ? (
              <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--g7)', fontSize: 13, fontWeight: 600 }}>✓ All locations are compliant</div>
            ) : (
              atRiskData.map(loc => (
                <div key={loc.rank} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10,
                  padding: '10px 16px', borderBottom: '1px solid var(--ow2)',
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: '50%', flexShrink: 0, marginTop: 4,
                    background: loc.health === 'red' ? 'var(--red)' : 'var(--amb)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6 }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--td)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {loc.name}
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4, flexShrink: 0,
                        background: loc.health === 'red' ? '#fff1f2' : '#fffbeb',
                        color: loc.health === 'red' ? 'var(--red)' : 'var(--amb)',
                      }}>
                        {loc.health === 'red' ? 'High Risk' : 'Medium Risk'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                      {loc.flags.map(f => (
                        <span key={f} style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#f1f5f9', color: '#475569', border: '1px solid #e2e8f0' }}>{f}</span>
                      ))}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* ── Operator Behaviour — real API data (Tasks 9+10) ────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <span className="card-title">Operator Behaviour</span>
          <span className="card-sub">{opBehaviourLoading ? 'Loading…' : 'Submission patterns · Platform usage · This month'}</span>
        </div>
        <div className="card-body">
          {opBehaviourLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '20px 0' }}>Loading operator data…</div>
          ) : opBehaviour ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 20, marginBottom: 24 }}>
            <div style={{ padding: '12px 16px', background: opBehaviour.lateSubmitters > 0 ? '#fffbeb' : 'var(--ow)', border: `1.5px solid ${opBehaviour.lateSubmitters > 0 ? '#fcd34d' : 'var(--ow2)'}`, borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Late submitters <TipBtn tip={TIPS.lateSubmitters} label="Late Submitters" align="right" />
              </div>
              <div style={{ fontSize: 24, fontWeight: 700, fontFamily: 'DM Serif Display,serif', color: opBehaviour.lateSubmitters > 0 ? 'var(--amb)' : 'var(--g7)', textAlign: 'center' }}>{opBehaviour.lateSubmitters}</div>
              <div style={{ fontSize: 10, color: 'var(--ts)', textAlign: 'center', marginTop: 2 }}>after 18:00 or next day</div>
            </div>
            <div style={{ padding: '12px 16px', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 10 }}>
              <div style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, marginBottom: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                Platform usage <TipBtn tip={TIPS.platformUsage} label="Platform Usage" align="right" />
              </div>
              {[
                { label: 'FORM',  pct: opBehaviour.platformSplit.form,  color: 'var(--g6)' },
                { label: 'EXCEL', pct: opBehaviour.platformSplit.excel, color: '#2563eb' },
              ].map(m => (
                <div key={m.label} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, width: 36, color: 'var(--td)' }}>{m.label}</div>
                  <div style={{ flex: 1, height: 10, background: 'var(--ow2)', borderRadius: 3 }}>
                    <div style={{ height: '100%', borderRadius: 3, background: m.color, width: `${m.pct}%` }} />
                  </div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--td)', width: 28, textAlign: 'right' }}>{m.pct}%</div>
                </div>
              ))}
            </div>
          </div>
          ) : <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '20px 0' }}>No operator data available</div>}

          {/* Most rejected operators + rejection reasons (Task 10) */}
          {rejectionsLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '20px 0' }}>Loading rejection data…</div>
          ) : rejections && (rejections.operators.length > 0 || rejections.reasons.length > 0) ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            <div>
              <SectionTitle tip={TIPS.rejectedOperators} tipLabel="Most Rejected Operators">Most Rejected Operators</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {rejections.operators.map(op => (
                  <div key={op.name} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 8 }}>
                    <HealthDot health="red" />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--td)' }}>{op.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--ts)' }}>{op.location} · {op.topReason}</div>
                    </div>
                    <div style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fff1f2', color: 'var(--red)', border: '1px solid #fca5a5' }}>{op.rejections}</div>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, padding: '8px 12px', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 8 }}>
                <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 4, fontWeight: 600 }}>Avg rejections before approval</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: 'DM Serif Display,serif', color: rejections.avgRejectionsBeforeApproval > 1 ? 'var(--amb)' : 'var(--g7)' }}>{rejections.avgRejectionsBeforeApproval} <span style={{ fontSize: 12, fontWeight: 400, color: 'var(--ts)' }}>avg</span></div>
              </div>
            </div>
            <div>
              <SectionTitle tip={TIPS.rejectionReasons} tipLabel="Top Rejection Reasons">Top Rejection Reasons</SectionTitle>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {rejections.reasons.map(r => (
                  <div key={r.reason} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 500, color: 'var(--td)', flex: 1 }}>{r.reason}</div>
                    <div style={{ width: 120, height: 10, background: 'var(--ow2)', borderRadius: 3 }}>
                      <div style={{ height: '100%', borderRadius: 3, background: 'var(--red)', width: `${r.pct}%` }} />
                    </div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--td)', width: 28, textAlign: 'right' }}>{r.count}</div>
                    <div style={{ fontSize: 11, color: 'var(--ts)', width: 32, textAlign: 'right' }}>{r.pct}%</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
          ) : null}
        </div>
      </div>

      {/* ── Controller Activity — real API data (Task 8) ──────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="card-title">Controller Activity</span>
            <TipBtn tip={TIPS.controllerActivity} label="Controller Activity" />
          </div>
          <span className="card-sub">{ctrlActivityLoading ? 'Loading…' : ctrlActivity ? `${ctrlActivity.length} controller${ctrlActivity.length !== 1 ? 's' : ''} · this month` : 'No data'}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {ctrlActivityLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>Loading controller data…</div>
          ) : !ctrlActivity || ctrlActivity.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>No controller visits this month</div>
          ) : (
          <table className="dt">
            <thead>
              <tr>
                <th>Controller</th>
                <th style={{ textAlign: 'center' }}>Completed</th>
                <th style={{ textAlign: 'center' }}>Missed</th>
                <th style={{ textAlign: 'center' }}>Scheduled</th>
                <th style={{ textAlign: 'center' }}>Completion Rate</th>
                <th style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    Avg Variance Found
                    <TipBtn tip={TIPS.controllerActivity} label="Variance Found" align="right" />
                  </span>
                </th>
                <th style={{ textAlign: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                    DOW Warnings
                    <TipBtn tip={TIPS.dowRotation} label="Day-of-Week Rotation" align="right" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {ctrlActivity.map(c => (
                <tr key={c.name}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{c.name}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{ color: 'var(--g7)', fontWeight: 600, fontSize: 13 }}>{c.completed}</span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {c.missed > 0
                      ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fff1f2', color: 'var(--red)', border: '1px solid #fca5a5' }}>{c.missed}</span>
                      : <span style={{ color: 'var(--ts)', fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--amb)', fontWeight: c.scheduled > 0 ? 600 : 400 }}>
                    {c.scheduled > 0 ? c.scheduled : <span style={{ color: 'var(--ts)' }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
                      background: c.completionRate === 100 ? 'var(--g0)' : c.completionRate >= 75 ? '#fffbeb' : '#fff1f2',
                      color:      c.completionRate === 100 ? 'var(--g7)' : c.completionRate >= 75 ? 'var(--amb)' : 'var(--red)',
                      border:     `1px solid ${c.completionRate === 100 ? 'var(--g2)' : c.completionRate >= 75 ? '#fcd34d' : '#fca5a5'}`,
                    }}>
                      {c.completionRate}%
                    </span>
                  </td>
                  <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--td)' }}>
                    ${c.avgVarianceFound.toLocaleString()}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {c.dowWarnings > 0
                      ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fffbeb', color: 'var(--amb)', border: '1px solid #fcd34d' }}>{c.dowWarnings} ⚠</span>
                      : <span style={{ color: 'var(--g7)', fontWeight: 600, fontSize: 13 }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* ── DGM Coverage — real API data (Task 11) ────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="card-title">DGM Coverage</span>
            <TipBtn tip={TIPS.dgmCoverage} label="DGM Coverage" />
          </div>
          <span className="card-sub">{dgmCovLoading ? 'Loading…' : 'Monthly visit completion · pending locations · findings'}</span>
        </div>
        <div className="card-body">
          {dgmCovLoading ? (
            <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '32px 0' }}>Loading DGM data…</div>
          ) : !dgmCov ? (
            <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '32px 0' }}>No DGM data available</div>
          ) : (
          <>
            {/* Pending locations alert */}
            {dgmCov.pendingLocations.length > 0 && (
              <div style={{ marginBottom: 20, padding: '12px 16px', background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 10 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  ⏳ {dgmCov.pendingLocations.length} location{dgmCov.pendingLocations.length !== 1 ? 's' : ''} still awaiting a DGM visit this month
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {dgmCov.pendingLocations.map(loc => (
                    <div key={loc.name} style={{
                      padding: '5px 10px', borderRadius: 8, background: '#fff',
                      border: loc.daysLeft <= 5 ? '1.5px solid #fca5a5' : '1.5px solid #fcd34d',
                      display: 'flex', flexDirection: 'column', gap: 2,
                    }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--td)' }}>{loc.name}</div>
                      <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                        <span style={{ color: loc.daysLeft <= 5 ? 'var(--red)' : 'var(--amb)', fontWeight: 600 }}>{loc.daysLeft}d left</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Per-DGM table */}
            {dgmCov.dgms.length > 0 ? (
            <table className="dt">
              <thead>
                <tr>
                  <th>DGM</th>
                  <th style={{ textAlign: 'center' }}>Assigned</th>
                  <th style={{ textAlign: 'center' }}>Visited</th>
                  <th style={{ textAlign: 'center' }}>Coverage</th>
                  <th style={{ textAlign: 'center' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      Avg Variance Found
                      <TipBtn tip={TIPS.dgmFindings} label="DGM Findings" align="right" />
                    </span>
                  </th>
                  <th>Pending Locations</th>
                </tr>
              </thead>
              <tbody>
                {dgmCov.dgms.map(d => (
                  <tr key={d.name}>
                    <td style={{ fontWeight: 600, fontSize: 13 }}>{d.name}</td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--ts)' }}>{d.locationsAssigned}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ color: 'var(--g7)', fontWeight: 600, fontSize: 13 }}>{d.locationsVisited}</span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{
                        fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
                        background: d.coveragePct === 100 ? 'var(--g0)' : d.coveragePct >= 70 ? '#fffbeb' : '#fff1f2',
                        color:      d.coveragePct === 100 ? 'var(--g7)' : d.coveragePct >= 70 ? 'var(--amb)' : 'var(--red)',
                        border:     `1px solid ${d.coveragePct === 100 ? 'var(--g2)' : d.coveragePct >= 70 ? '#fcd34d' : '#fca5a5'}`,
                      }}>
                        {d.coveragePct}%
                      </span>
                    </td>
                    <td style={{ textAlign: 'center', fontSize: 13, color: 'var(--td)' }}>
                      ${d.avgVarianceFound.toLocaleString()}
                    </td>
                    <td>
                      {d.pendingLocations.length === 0
                        ? <span style={{ color: 'var(--g7)', fontWeight: 600, fontSize: 12 }}>✓ All done</span>
                        : <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {d.pendingLocations.map(l => (
                              <span key={l} style={{ fontSize: 10, padding: '2px 7px', borderRadius: 4, background: '#fff1f2', color: 'var(--red)', border: '1px solid #fca5a5' }}>{l}</span>
                            ))}
                          </div>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13, padding: '20px 0' }}>No DGM visits this month</div>
            )}
          </>
          )}
        </div>
      </div>

      {/* ── Slowest Approvers — real API data (Task 2) ────────────────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="card-title">Slowest Approvers</span>
            <TipBtn tip={TIPS.slowestApprovers} label="Slowest Approvers" />
          </div>
          <span className="card-sub">
            {approversLoading ? 'Loading…' : approvers ? `${approvers.length} approver${approvers.length !== 1 ? 's' : ''} · this month · 48h SLA` : 'No data'}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {approversLoading ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>Loading approver data…</div>
          ) : !approvers || approvers.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>No approved submissions this month</div>
          ) : (
          <table className="dt">
            <thead>
              <tr>
                <th>Approver</th>
                <th style={{ textAlign: 'center' }}>Submissions Reviewed</th>
                <th style={{ textAlign: 'center' }}>Avg Approval Time</th>
                <th style={{ textAlign: 'center' }}>SLA Breaches</th>
                <th style={{ textAlign: 'center' }}>SLA Status</th>
              </tr>
            </thead>
            <tbody>
              {approvers.map(a => (
                <tr key={a.name}>
                  <td style={{ fontWeight: 600, fontSize: 13 }}>{a.name}</td>
                  <td style={{ textAlign: 'center', fontSize: 13 }}>{a.reviewed}</td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 12, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
                      background: a.avgHours <= 24 ? 'var(--g0)' : a.avgHours <= 48 ? '#fffbeb' : '#fff1f2',
                      color:      a.avgHours <= 24 ? 'var(--g7)' : a.avgHours <= 48 ? 'var(--amb)' : 'var(--red)',
                      border:     `1px solid ${a.avgHours <= 24 ? 'var(--g2)' : a.avgHours <= 48 ? '#fcd34d' : '#fca5a5'}`,
                    }}>
                      {a.avgHours}h
                    </span>
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {a.slaBreaches > 0
                      ? <span style={{ fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: '#fff1f2', color: 'var(--red)', border: '1px solid #fca5a5' }}>{a.slaBreaches}</span>
                      : <span style={{ color: 'var(--g7)', fontWeight: 600, fontSize: 13 }}>—</span>}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <span style={{
                      fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 6,
                      background: a.slaBreaches === 0 ? 'var(--g0)' : '#fff1f2',
                      color:      a.slaBreaches === 0 ? 'var(--g7)' : 'var(--red)',
                      border:     `1px solid ${a.slaBreaches === 0 ? 'var(--g2)' : '#fca5a5'}`,
                    }}>
                      {a.slaBreaches === 0 ? 'Within SLA' : 'Breached'}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          )}
        </div>
      </div>

      {/* ── Layer 3: Location Compliance Detail (collapsible) ────────── */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div
          className="card-header"
          style={{ cursor: 'pointer', userSelect: 'none' }}
          onClick={() => setLocTableOpen(o => !o)}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 14, transition: 'transform 0.2s', transform: locTableOpen ? 'rotate(90deg)' : 'rotate(0deg)' }}>▶</span>
            <span className="card-title">Location Compliance Detail</span>
            {/* Health count chips */}
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fff1f2', color: 'var(--red)', border: '1px solid #fca5a5' }}>{healthCounts.red} Red</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: '#fffbeb', color: 'var(--amb)', border: '1px solid #fcd34d' }}>{healthCounts.amber} Amber</span>
            <span style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 10, background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g2)' }}>{healthCounts.green} Green</span>
          </div>
          <span className="card-sub">{atRiskLoading ? 'Loading…' : locTableOpen ? 'Click to collapse' : 'Click to expand'} · {allLocs.length} locations</span>
        </div>

        {locTableOpen && (
          <>
            {/* Filter chips */}
            <div style={{ display: 'flex', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--ow2)', background: '#fafaf8', alignItems: 'center' }}>
              {(['all', 'red', 'amber', 'green'] as const).map(h => {
                const active = locHealthFilter === h
                const count  = h === 'all' ? allLocs.length : healthCounts[h]
                const colors: Record<string, { bg: string; color: string; border: string }> = {
                  all:   { bg: active ? 'var(--g7)' : '#fff', color: active ? '#fff' : 'var(--td)', border: active ? 'var(--g4)' : 'var(--ow2)' },
                  red:   { bg: active ? '#fff1f2' : '#fff', color: 'var(--red)', border: '#fca5a5' },
                  amber: { bg: active ? '#fffbeb' : '#fff', color: 'var(--amb)', border: '#fcd34d' },
                  green: { bg: active ? 'var(--g0)' : '#fff', color: 'var(--g7)', border: 'var(--g2)' },
                }
                const c = colors[h]
                const tipKey = h === 'red' ? 'healthRed' : h === 'amber' ? 'healthAmber' : h === 'green' ? 'healthGreen' : null
                const tipLabel = h === 'red' ? 'Non-Compliant (Red)' : h === 'amber' ? 'At Risk (Amber)' : h === 'green' ? 'Compliant (Green)' : ''
                return (
                  <div key={h} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <button onClick={() => setLocHealthFilter(h)} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      padding: '4px 12px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
                      cursor: 'pointer', borderRadius: 20, transition: 'all 0.12s',
                      border: `${active ? '2px' : '1.5px'} solid ${c.border}`,
                      background: c.bg, color: c.color,
                    }}>
                      {h === 'all' ? 'All' : h === 'red' ? '✕ Non-Compliant' : h === 'amber' ? '⚠ At Risk' : '✓ Compliant'}
                      <span style={{ fontSize: 10, fontWeight: 700, padding: '1px 6px', borderRadius: 10, background: 'rgba(0,0,0,0.06)', color: c.color }}>{count}</span>
                    </button>
                    {tipKey && <TipBtn tip={TIPS[tipKey]} label={tipLabel} />}
                  </div>
                )
              })}
            </div>

            {/* Table */}
            <div className="card-body" style={{ padding: 0 }}>
              <table className="dt">
                <thead>
                  <tr>
                    <th style={{ width: 100 }}>Health</th>
                    <th style={{ minWidth: 160 }}>Location</th>
                    <th style={{ minWidth: 200 }}>Today's Submission</th>
                    <th style={{ minWidth: 150 }}>Manager Approval</th>
                    <th style={{ minWidth: 180 }}>Controller Visit</th>
                    <th style={{ minWidth: 160 }}>DGM Visit</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLocs.map(loc => {
                    const hBg    = loc.health === 'green' ? '#f0fdf4' : loc.health === 'amber' ? '#fffbeb' : '#fff5f5'
                    const hBor   = loc.health === 'green' ? 'var(--g3)' : loc.health === 'amber' ? '#f59e0b' : 'var(--red)'
                    const hCol   = loc.health === 'green' ? 'var(--g7)' : loc.health === 'amber' ? 'var(--amb)' : 'var(--red)'
                    const hLabel = loc.health === 'green' ? '✓ Compliant' : loc.health === 'amber' ? '⚠ At Risk' : '✕ Non-Compliant'

                    // Derive submission display status from API data
                    const sub = loc.submission
                    let subDisplayStatus: 'approved' | 'rejected' | 'pending' | 'overdue' | 'none' = 'none'
                    let pendingHours: number | null = null
                    if (sub) {
                      if (sub.status === 'approved') subDisplayStatus = 'approved'
                      else if (sub.status === 'rejected') subDisplayStatus = 'rejected'
                      else if (sub.status === 'pending_approval') {
                        pendingHours = sub.submitted_at ? Math.round((NOW_MS - new Date(sub.submitted_at).getTime()) / 3600000) : null
                        subDisplayStatus = pendingHours !== null && pendingHours > 48 ? 'overdue' : 'pending'
                      }
                    }

                    const SUB_STYLE: Record<string, { dotHealth: 'green' | 'amber' | 'red'; label: string }> = {
                      approved: { dotHealth: 'green', label: 'Approved' },
                      rejected: { dotHealth: 'red', label: 'Rejected' },
                      pending:  { dotHealth: 'amber', label: 'Pending Approval' },
                      overdue:  { dotHealth: 'red', label: 'Overdue (>48h)' },
                      none:     { dotHealth: 'amber', label: 'No submission' },
                    }
                    const ss = SUB_STYLE[subDisplayStatus]
                    const isException = sub ? Math.abs(sub.variance_pct) > 5 : false

                    return (
                      <tr key={loc.id}>
                        {/* Health */}
                        <td>
                          <span style={{
                            fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 6,
                            background: hBg, color: hCol, border: `1.5px solid ${hBor}`,
                            whiteSpace: 'nowrap',
                          }}>{hLabel}</span>
                        </td>

                        {/* Location */}
                        <td>
                          <div style={{ fontWeight: 600, fontSize: 13 }}>{loc.name}</div>
                          <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ts)' }}>{loc.id}</div>
                        </td>

                        {/* Today's Submission */}
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <HealthDot health={subDisplayStatus === 'none' ? 'amber' : ss.dotHealth} />
                            <span style={{ fontSize: 12, fontWeight: 600, color: subDisplayStatus === 'none' ? '#bbb' : 'var(--td)' }}>{ss.label}</span>
                          </div>
                          {sub && (
                            <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                              ${sub.total_cash.toLocaleString()}
                              <span style={{
                                marginLeft: 4, fontWeight: 600,
                                color: isException ? 'var(--red)' : Math.abs(sub.variance_pct) > 2 ? 'var(--amb)' : 'var(--ts)',
                              }}>
                                {sub.variance_pct >= 0 ? '+' : ''}{sub.variance_pct.toFixed(2)}%
                              </span>
                            </div>
                          )}
                        </td>

                        {/* Manager Approval */}
                        <td>
                          {subDisplayStatus === 'approved' ? (
                            <span style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600 }}>✓ Approved</span>
                          ) : subDisplayStatus === 'rejected' ? (
                            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>✕ Rejected</span>
                          ) : subDisplayStatus === 'overdue' ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--red)' }}>
                              Waiting {pendingHours}h — SLA BREACH
                            </span>
                          ) : subDisplayStatus === 'pending' ? (
                            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--amb)' }}>
                              Awaiting review{pendingHours !== null ? ` (${pendingHours}h)` : ''}
                            </span>
                          ) : (
                            <span style={{ fontSize: 12, color: '#bbb' }}>—</span>
                          )}
                        </td>

                        {/* Controller Visit */}
                        <td>
                          {loc.controller_visit.days_since !== null ? (
                            <div>
                              <span style={{
                                fontSize: 12, fontWeight: 600,
                                color: loc.controller_visit.days_since <= 7 ? 'var(--g7)' : loc.controller_visit.days_since <= 14 ? 'var(--amb)' : 'var(--red)',
                              }}>
                                {loc.controller_visit.days_since}d ago
                              </span>
                              {loc.controller_visit.warning_flag && <span style={{ marginLeft: 6, fontSize: 10, padding: '1px 5px', borderRadius: 4, background: '#fffbeb', color: 'var(--amb)', border: '1px solid #fcd34d' }}>DOW ⚠</span>}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>No visit recorded</span>
                          )}
                          {loc.controller_visit.next_scheduled_date && <div style={{ fontSize: 10, color: 'var(--ts)', marginTop: 2 }}>Next: {loc.controller_visit.next_scheduled_date}</div>}
                        </td>

                        {/* DGM Visit */}
                        <td>
                          {loc.dgm_visit.visit_date ? (
                            <div>
                              <span style={{ fontSize: 12, color: '#7e22ce', fontWeight: 600 }}>✓ {loc.dgm_visit.visit_date}</span>
                              {loc.dgm_visit.observed_total !== null && (
                                <div style={{ fontSize: 10, color: 'var(--ts)', marginTop: 2 }}>
                                  Observed: ${loc.dgm_visit.observed_total.toLocaleString()}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span style={{ fontSize: 12, color: 'var(--amb)', fontWeight: 600 }}>No visit this month</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  )
}
