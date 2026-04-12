import { useState, useEffect, useCallback } from 'react'
import { api } from '../api/client'
import { setToken } from '../api/client'
import { getReportSummary, getSlaSummary } from '../api/reports'
import { getComplianceDashboard } from '../api/compliance'
import { getDgmCoverage } from '../api/businessDashboard'
import type { ReportSummary, SlaSummary, ComplianceDashboard, LocationCompliance } from '../api/types'
import type { DgmCoverageResponse } from '../api/businessDashboard'

// ── Date helpers ──────────────────────────────────────────────────────────────
function fmtDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function startOfWeek(d: Date): Date {
  const day = d.getDay()
  const diff = d.getDate() - day + (day === 0 ? -6 : 1)
  return new Date(d.getFullYear(), d.getMonth(), diff)
}
function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

type Period = 'today' | 'week' | 'month' | 'custom'

// ── Conviction definitions ───────────────────────────────────────────────────
const CONVICTIONS = [
  {
    key: 'submission',
    label: 'Submission Compliance',
    target: 95,
    unit: '%',
    baseline: 'Untracked (manual)',
    conviction: 'We believe daily cash count submission compliance will go from untracked to >95% within 30 days of go-live, because operators will be prompted daily and every miss is captured automatically.',
  },
  {
    key: 'approval',
    label: 'Approval Turnaround (SLA)',
    target: 100,
    unit: '%',
    baseline: 'Days/weeks (no SLA)',
    conviction: 'We believe approval turnaround will drop from days/weeks to <48 hours, because managers now have SLA tracking with automated breach alerts.',
  },
  {
    key: 'variance',
    label: 'Variance Exceptions',
    target: 5,
    unit: '%',
    baseline: 'Discovered during audits',
    conviction: 'We believe cash variance exceptions will become 100% visible in real-time, compared to being discovered months later during audits, because every submission is automatically checked against tolerance thresholds.',
  },
  {
    key: 'controller',
    label: 'Controller Weekly Coverage',
    target: 100,
    unit: '%',
    baseline: 'Manual tracking',
    conviction: 'We believe controller verification coverage will reach 100% weekly because scheduling is system-enforced, misses are tracked, and day-of-week warnings prevent predictable visit patterns.',
  },
  {
    key: 'dgm',
    label: 'DGM Monthly Coverage',
    target: 100,
    unit: '%',
    baseline: 'Manual spreadsheets',
    conviction: 'We believe DGM monthly visit coverage will reach 100% because the system tracks pending locations in real-time and surfaces gaps before month-end.',
  },
] as const

const CONVICTION_STATEMENTS = [
  'We believe daily cash count submission compliance will go from untracked to >95% within 30 days of go-live, because operators will be prompted daily and every miss is captured automatically.',
  'We believe approval turnaround will drop from days/weeks to <48 hours, because managers now have SLA tracking with automated breach alerts.',
  'We believe cash variance exceptions will become 100% visible in real-time, compared to being discovered months later during audits, because every submission is automatically checked against tolerance thresholds.',
  'We believe the system will provide complete audit trail transparency where previously there was none, enabling Compass to demonstrate compliance to auditors on demand.',
  'We believe controller verification coverage will reach 100% weekly because scheduling is system-enforced, misses are tracked, and day-of-week warnings prevent predictable visit patterns.',
  'We believe DGM monthly visit coverage will reach 100% because the system tracks pending locations in real-time and surfaces gaps before month-end.',
  'We believe cash at risk will be identified and flagged within hours instead of months, because every variance exceeding tolerance is surfaced immediately to controllers and regional management.',
  'We believe the digitised process will eliminate lost or misplaced paper cash counts entirely, because every submission is timestamped, stored, and linked to its location and operator permanently.',
] as const

// ── Login Screen ─────────────────────────────────────────────────────────────
function EsLogin({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const res = await api.post<{ access_token: string }>('/auth/login', { email, password })
      setToken(res.access_token)
      onLogin()
    } catch {
      setError('Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #334155 100%)' }}>
      <form onSubmit={handleSubmit} style={{ background: '#fff', borderRadius: 16, padding: '40px 36px', width: 380, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div style={{ fontSize: 28, fontFamily: 'DM Serif Display,serif', color: '#0f172a', marginBottom: 4 }}>ES Dashboard</div>
          <div style={{ fontSize: 12, color: '#64748b' }}>Engagement Strategist Value Tracker</div>
        </div>
        {error && <div style={{ color: '#dc2626', fontSize: 13, marginBottom: 12, textAlign: 'center' }}>{error}</div>}
        <div style={{ marginBottom: 14 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <div style={{ marginBottom: 20 }}>
          <label style={{ fontSize: 11, fontWeight: 600, color: '#475569', display: 'block', marginBottom: 4 }}>Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)} required
            style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid #d1d5db', fontSize: 14, boxSizing: 'border-box' }} />
        </div>
        <button type="submit" disabled={loading}
          style={{ width: '100%', padding: '12px', borderRadius: 8, border: 'none', background: '#0f172a', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  )
}

// ── KPI Conviction Card ──────────────────────────────────────────────────────
function ConvictionCard({ label, actual, target, unit, baseline, conviction, loading }: {
  label: string; actual: number | null; target: number; unit: string; baseline: string; conviction: string; loading: boolean
}) {
  const isInverse = label === 'Variance Exceptions' // lower is better
  const met = actual !== null
    ? (isInverse ? actual <= target : actual >= target)
    : false
  const color = actual === null ? '#94a3b8' : met ? '#16a34a' : actual !== null && (isInverse ? actual <= target * 1.5 : actual >= target * 0.8) ? '#d97706' : '#dc2626'
  const status = actual === null ? 'No data' : met ? 'On Track' : 'Needs Attention'
  const [showConviction, setShowConviction] = useState(false)

  return (
    <div style={{
      background: '#fff', borderRadius: 12, padding: '20px 18px', border: `2px solid ${color}22`,
      boxShadow: '0 1px 4px rgba(0,0,0,0.06)', position: 'relative', minWidth: 180, flex: '1 1 180px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
        <span
          onClick={() => setShowConviction(!showConviction)}
          style={{
            width: 18, height: 18, borderRadius: '50%', background: '#f1f5f9', border: '1px solid #cbd5e1',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 9, fontWeight: 800, color: '#64748b', cursor: 'pointer',
          }}
        >?</span>
      </div>

      {loading ? (
        <div style={{ fontSize: 22, color: '#cbd5e1', fontFamily: 'DM Serif Display,serif' }}>--</div>
      ) : (
        <>
          <div style={{ fontSize: 32, fontFamily: 'DM Serif Display,serif', color: color, lineHeight: 1 }}>
            {actual !== null ? `${actual.toFixed(1)}${unit}` : '--'}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 8 }}>
            <span style={{
              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 99,
              background: met ? '#dcfce7' : '#fef3c7', color: met ? '#166534' : '#92400e',
            }}>{status}</span>
            <span style={{ fontSize: 10, color: '#94a3b8' }}>Target: {isInverse ? '<' : '>'}{target}{unit}</span>
          </div>
          <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6 }}>
            Baseline: <span style={{ fontStyle: 'italic' }}>{baseline}</span>
          </div>
        </>
      )}

      {showConviction && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 10,
          background: '#0f172a', color: '#e2e8f0', borderRadius: 10, padding: '14px 16px',
          fontSize: 12, lineHeight: 1.6, marginTop: 6, boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: 6, letterSpacing: '0.08em' }}>Conviction Statement</div>
          {conviction}
        </div>
      )}
    </div>
  )
}

// ── Location Health Grid ─────────────────────────────────────────────────────
function LocationHealthMap({ locations, loading }: { locations: LocationCompliance[]; loading: boolean }) {
  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Loading locations...</div>

  const counts = { green: 0, amber: 0, red: 0 }
  locations.forEach(l => counts[l.health]++)

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={{ margin: 0, fontFamily: 'DM Serif Display,serif', fontSize: 18, color: '#0f172a' }}>Location Health Map</h3>
        <div style={{ display: 'flex', gap: 12 }}>
          <span style={{ fontSize: 11, color: '#16a34a', fontWeight: 600 }}>Green: {counts.green}</span>
          <span style={{ fontSize: 11, color: '#d97706', fontWeight: 600 }}>Amber: {counts.amber}</span>
          <span style={{ fontSize: 11, color: '#dc2626', fontWeight: 600 }}>Red: {counts.red}</span>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
        {locations.map(loc => {
          const bg = loc.health === 'green' ? '#dcfce7' : loc.health === 'amber' ? '#fef3c7' : '#fee2e2'
          const border = loc.health === 'green' ? '#86efac' : loc.health === 'amber' ? '#fde68a' : '#fca5a5'
          const text = loc.health === 'green' ? '#166534' : loc.health === 'amber' ? '#92400e' : '#991b1b'
          return (
            <div key={loc.id} style={{
              background: bg, border: `1px solid ${border}`, borderRadius: 8,
              padding: '8px 10px', fontSize: 11, color: text, fontWeight: 600,
              display: 'flex', flexDirection: 'column', gap: 2,
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, lineHeight: 1.3 }}>{loc.name}</div>
              <div style={{ fontSize: 9, fontWeight: 400, opacity: 0.8 }}>
                {loc.submission ? `Var: ${loc.submission.variance_pct.toFixed(1)}%` : 'No submission'}
                {loc.controller_visit?.warning_flag && ' | DOW warn'}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Alerts Section ───────────────────────────────────────────────────────────
function AlertsSection({ locations, summary, sla, loading }: {
  locations: LocationCompliance[]; summary: ReportSummary | null; sla: SlaSummary | null; loading: boolean
}) {
  if (loading) return <div style={{ color: '#94a3b8', padding: 20 }}>Loading alerts...</div>

  const alerts: { severity: 'red' | 'amber'; message: string }[] = []

  // SLA breaches
  if (sla && sla.sla_compliance_pct !== null && sla.sla_compliance_pct < 100) {
    alerts.push({ severity: 'red', message: `SLA compliance at ${sla.sla_compliance_pct.toFixed(0)}% — ${(100 - sla.sla_compliance_pct).toFixed(0)}% of approvals breached the 48-hour window` })
  }

  // Overdue submissions (red locations with no submission)
  const overdue = locations.filter(l => l.submission === null && l.health === 'red')
  if (overdue.length > 0) {
    alerts.push({ severity: 'red', message: `${overdue.length} location${overdue.length > 1 ? 's' : ''} with no submission today: ${overdue.slice(0, 5).map(l => l.name).join(', ')}${overdue.length > 5 ? '...' : ''}` })
  }

  // Variance exceptions
  if (summary && summary.variance_exceptions > 0) {
    alerts.push({ severity: 'amber', message: `${summary.variance_exceptions} variance exception${summary.variance_exceptions > 1 ? 's' : ''} detected (>${5}% threshold) — Cash at risk: \u00a3${summary.cash_at_risk.toLocaleString()}` })
  }

  // Rejected submissions
  if (summary && summary.rejected > 0) {
    alerts.push({ severity: 'amber', message: `${summary.rejected} submission${summary.rejected > 1 ? 's' : ''} rejected in this period` })
  }

  // Pending approvals
  if (summary && summary.pending > 0) {
    alerts.push({ severity: 'amber', message: `${summary.pending} submission${summary.pending > 1 ? 's' : ''} pending approval` })
  }

  // Controller DOW warnings
  const dowWarnings = locations.filter(l => l.controller_visit?.warning_flag)
  if (dowWarnings.length > 0) {
    alerts.push({ severity: 'amber', message: `${dowWarnings.length} location${dowWarnings.length > 1 ? 's' : ''} with day-of-week controller warnings` })
  }

  // Locations needing DGM visits
  const noDgm = locations.filter(l => !l.dgm_visit?.visit_date)
  if (noDgm.length > 5) {
    alerts.push({ severity: 'amber', message: `${noDgm.length} locations still pending DGM visit this month` })
  }

  if (alerts.length === 0) {
    alerts.push({ severity: 'amber', message: 'No active alerts — all systems operating normally' })
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, padding: '20px 18px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>
      <h3 style={{ margin: '0 0 14px', fontFamily: 'DM Serif Display,serif', fontSize: 18, color: '#0f172a' }}>Alerts & Action Items</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {alerts.map((a, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start', padding: '10px 14px', borderRadius: 8,
            background: a.severity === 'red' ? '#fef2f2' : '#fffbeb',
            border: `1px solid ${a.severity === 'red' ? '#fecaca' : '#fde68a'}`,
          }}>
            <span style={{ fontSize: 14, flexShrink: 0, marginTop: 1 }}>{a.severity === 'red' ? '\u26a0\ufe0f' : '\u26a1'}</span>
            <span style={{ fontSize: 12, color: a.severity === 'red' ? '#991b1b' : '#92400e', lineHeight: 1.5 }}>{a.message}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Conviction Statements Banner ──────────────────────────────────────────
function ConvictionBanner() {
  const [expanded, setExpanded] = useState(true)

  return (
    <div style={{
      background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
      borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
    }}>
      <div
        onClick={() => setExpanded(!expanded)}
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '16px 20px', cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 20 }}>&#x1F3AF;</span>
          <div>
            <div style={{ fontSize: 16, fontFamily: 'DM Serif Display,serif', color: '#f8fafc' }}>Conviction Statements</div>
            <div style={{ fontSize: 11, color: '#94a3b8', marginTop: 2 }}>What we believe this system will achieve — our north star</div>
          </div>
        </div>
        <span style={{ color: '#94a3b8', fontSize: 18, transition: 'transform 0.2s', transform: expanded ? 'rotate(180deg)' : 'rotate(0)' }}>
          &#x25B2;
        </span>
      </div>

      {expanded && (
        <div style={{ padding: '0 20px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {CONVICTION_STATEMENTS.map((stmt, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: 'rgba(255,255,255,0.06)', borderRadius: 8, padding: '12px 16px',
              borderLeft: '3px solid #3b82f6',
            }}>
              <span style={{ color: '#3b82f6', fontWeight: 800, fontSize: 13, flexShrink: 0, marginTop: 1 }}>
                {String(i + 1).padStart(2, '0')}
              </span>
              <span style={{ fontSize: 13, color: '#e2e8f0', lineHeight: 1.65, fontStyle: 'italic' }}>
                &ldquo;{stmt}&rdquo;
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main Dashboard ───────────────────────────────────────────────────────────
export default function EsDashboard() {
  const [authed, setAuthed] = useState(false)
  const [period, setPeriod] = useState<Period>('month')
  const [customFrom, setCustomFrom] = useState('')
  const [customTo, setCustomTo] = useState('')
  const [loading, setLoading] = useState(true)
  const [summary, setSummary] = useState<ReportSummary | null>(null)
  const [sla, setSla] = useState<SlaSummary | null>(null)
  const [compliance, setCompliance] = useState<ComplianceDashboard | null>(null)
  const [dgm, setDgm] = useState<DgmCoverageResponse | null>(null)

  const getDateRange = useCallback((): { from: string; to: string } => {
    const today = new Date()
    switch (period) {
      case 'today': return { from: fmtDate(today), to: fmtDate(today) }
      case 'week':  return { from: fmtDate(startOfWeek(today)), to: fmtDate(today) }
      case 'month': return { from: fmtDate(startOfMonth(today)), to: fmtDate(today) }
      case 'custom': return { from: customFrom || fmtDate(startOfMonth(today)), to: customTo || fmtDate(today) }
    }
  }, [period, customFrom, customTo])

  const fetchData = useCallback(async () => {
    setLoading(true)
    const range = getDateRange()
    try {
      const [summaryRes, slaRes, complianceRes, dgmRes] = await Promise.all([
        getReportSummary({ date_from: range.from, date_to: range.to }).catch(() => null),
        getSlaSummary({ date_from: range.from, date_to: range.to }).catch(() => null),
        getComplianceDashboard().catch(() => null),
        getDgmCoverage().catch(() => null),
      ])
      setSummary(summaryRes)
      setSla(slaRes)
      setCompliance(complianceRes)
      setDgm(dgmRes)
    } finally {
      setLoading(false)
    }
  }, [getDateRange])

  useEffect(() => {
    if (authed) fetchData()
  }, [authed, fetchData])

  if (!authed) return <EsLogin onLogin={() => setAuthed(true)} />

  // ── Compute KPI values ────────────────────────────────────────────────────
  const submissionPct = compliance
    ? (compliance.summary.total_locations > 0
      ? (compliance.summary.submitted_today / compliance.summary.total_locations) * 100
      : null)
    : null

  const slaPct = sla?.sla_compliance_pct ?? null

  const variancePct = summary
    ? (summary.total_submissions > 0
      ? (summary.variance_exceptions / summary.total_submissions) * 100
      : null)
    : null

  // Controller coverage: use report data
  const controllerPct = summary
    ? (summary.total_submissions > 0 && summary.controller_verifications > 0
      ? Math.min((summary.controller_verifications / compliance!.summary.total_locations) * 100, 100)
      : 0)
    : null

  const dgmPct = dgm
    ? (dgm.dgms.length > 0
      ? dgm.dgms.reduce((s, d) => s + d.coveragePct, 0) / dgm.dgms.length
      : null)
    : null

  const kpiValues: Record<string, number | null> = {
    submission: submissionPct,
    approval: slaPct,
    variance: variancePct,
    controller: controllerPct,
    dgm: dgmPct,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9' }}>
      {/* ── Header ── */}
      <div style={{
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        padding: '24px 32px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 24, fontFamily: 'DM Serif Display,serif', color: '#f8fafc' }}>ES Value Dashboard</div>
          <div style={{ fontSize: 12, color: '#94a3b8', marginTop: 2 }}>Compass CashRoom Compliance System</div>
        </div>
        <button
          onClick={() => { setToken(null); setAuthed(false) }}
          style={{
            padding: '8px 18px', borderRadius: 8, border: '1px solid #475569',
            background: 'transparent', color: '#94a3b8', fontSize: 12, cursor: 'pointer',
          }}
        >Sign Out</button>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 20px', display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* ── Date Filter ── */}
        <div style={{
          display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap',
          background: '#fff', borderRadius: 10, padding: '12px 16px', boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
        }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: '#475569', marginRight: 8 }}>Period:</span>
          {(['today', 'week', 'month', 'custom'] as Period[]).map(p => (
            <button key={p} onClick={() => setPeriod(p)}
              style={{
                padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                background: period === p ? '#0f172a' : '#f1f5f9', color: period === p ? '#fff' : '#475569',
              }}
            >{p === 'today' ? 'Today' : p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : 'Custom'}</button>
          ))}
          {period === 'custom' && (
            <>
              <input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
              <span style={{ color: '#94a3b8' }}>to</span>
              <input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)}
                style={{ padding: '5px 8px', borderRadius: 6, border: '1px solid #d1d5db', fontSize: 12 }} />
            </>
          )}
          <button onClick={fetchData}
            style={{
              padding: '6px 14px', borderRadius: 6, border: 'none', fontSize: 12, fontWeight: 600,
              background: '#3b82f6', color: '#fff', cursor: 'pointer', marginLeft: 'auto',
            }}
          >Refresh</button>
        </div>

        {/* ── Conviction Statements Banner ── */}
        <ConvictionBanner />

        {/* ── Conviction KPI Cards ── */}
        <div>
          <h3 style={{ margin: '0 0 12px', fontFamily: 'DM Serif Display,serif', fontSize: 18, color: '#0f172a' }}>Conviction Tracker</h3>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {CONVICTIONS.map(c => (
              <ConvictionCard
                key={c.key}
                label={c.label}
                actual={kpiValues[c.key]}
                target={c.target}
                unit={c.unit}
                baseline={c.baseline}
                conviction={c.conviction}
                loading={loading}
              />
            ))}
          </div>
        </div>

        {/* ── Location Health Map ── */}
        <LocationHealthMap
          locations={compliance?.locations ?? []}
          loading={loading}
        />

        {/* ── Alerts & Action Items ── */}
        <AlertsSection
          locations={compliance?.locations ?? []}
          summary={summary}
          sla={sla}
          loading={loading}
        />

        {/* ── Footer ── */}
        <div style={{ textAlign: 'center', fontSize: 10, color: '#94a3b8', padding: '12px 0' }}>
          CashRoom Compliance System &mdash; Engagement Strategist Dashboard
        </div>
      </div>
    </div>
  )
}
