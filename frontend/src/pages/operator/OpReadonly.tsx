import { useState, useEffect } from 'react'
import { getLocation, formatCurrency, todayStr } from '../../mock/data'
import type { Submission } from '../../mock/data'
import { getSubmission, approveSubmission, rejectSubmission } from '../../api/submissions'
import { api } from '../../api/client'
import KpiCard from '../../components/KpiCard'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

// Yellow cell style (formula / calculated)
const YC: React.CSSProperties = {
  background: '#fffde7',
  color: '#78590a',
  fontWeight: 600,
  textAlign: 'right',
  fontSize: 13,
}

// Display cell (read-only input replacement)
function ValCell({ val }: { val: number }) {
  return <td style={YC}>{val !== 0 ? formatCurrency(val) : <span style={{ color: '#c4a84a' }}>—</span>}</td>
}

// Dash cell — shown when denomination detail is not available
function DashCell() {
  return <td style={{ textAlign: 'right', color: 'var(--ts)', fontSize: 12 }}>—</td>
}

// Amount cell — yellow when value present, dash otherwise
function AmtCell({ val }: { val: number | null }) {
  if (val == null) return <td style={YC}><span style={{ color: '#c4a84a' }}>—</span></td>
  return <td style={YC}>{val !== 0 ? formatCurrency(val) : <span style={{ color: '#c4a84a' }}>—</span>}</td>
}

const SEC_A_DENOM = [
  { label: 'Ones',     key: 'ones',     face: 1 },
  { label: 'Twos',     key: 'twos',     face: 2 },
  { label: 'Fives',    key: 'fives',    face: 5 },
  { label: 'Tens',     key: 'tens',     face: 10 },
  { label: 'Twenties', key: 'twenties', face: 20 },
  { label: 'Fifties',  key: 'fifties',  face: 50 },
  { label: 'Hundreds', key: 'hundreds', face: 100 },
  { label: 'Other',    key: 'other',    face: 1 },
]
const SEC_B_DENOM = [
  { label: 'Dollars',  key: 'dollar',   face: 1.00 },
  { label: 'Halves',   key: 'halves',   face: 0.50 },
  { label: 'Quarters', key: 'quarters', face: 0.25 },
  { label: 'Dimes',    key: 'dimes',    face: 0.10 },
  { label: 'Nickels',  key: 'nickels',  face: 0.05 },
  { label: 'Pennies',  key: 'pennies',  face: 0.01 },
]

function SecHead({ id, title, total, red = false }: { id: string; title: string; total: number; red?: boolean }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px',
      background: red ? '#fee2e2' : 'var(--g1)',
      borderBottom: `1px solid ${red ? '#fca5a5' : 'var(--ow2)'}`,
    }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: red ? 'var(--red)' : 'var(--g8)' }}>{id}. {title}</span>
      <span style={{ ...YC, background: 'transparent', fontSize: 13, color: red ? 'var(--red)' : '#78590a' }}>
        {total > 0 ? formatCurrency(total) : <span style={{ color: 'var(--ts)' }}>—</span>}
      </span>
    </div>
  )
}

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const

const SEC_C_LABELS = ['Dollars', 'Halves', 'Quarters', 'Dimes', 'Nickels', 'Pennies']
const SEC_C_FACE   = [1.00, 0.50, 0.25, 0.10, 0.05, 0.01]
const SEC_C_KEYS   = ['cDollar', 'cHalves', 'cQuarters', 'cDimes', 'cNickels', 'cPennies']

const SEC_D_LABELS = ['Dollars', 'Quarters', 'Dimes', 'Nickels']
const SEC_D_FACE   = [1.00, 0.25, 0.10, 0.05]
const SEC_D_KEYS   = ['dDollar', 'dQuarters', 'dDimes', 'dNickels']

export default function OpReadonly({ ctx, onNavigate }: Props) {
  // When a controller comes via "Mark as Completed" flow, force a fresh re-review
  // regardless of prior approval — treated as an independent review (don't pre-populate)
  //const forceReview = ctx.fromPanel === 'ctrl-dashboard' && ctx.expandAction === 'complete'

  const [apiSub, setApiSub] = useState<Submission | null>(null)
  const [apiLoading, setApiLoading] = useState(true)
  const [realTolerance, setRealTolerance] = useState<number | null>(null)

  useEffect(() => {
    interface ConfigResponse {
      global_config?: { default_tolerance_pct?: number };
      location_overrides?: Array<{ location_id: string; tolerance_pct: number }>;
    }
    api.get<ConfigResponse>('/config').then(conf => {
      const override = conf.location_overrides?.find(o => o.location_id === ctx.locationId)
      if (override && override.tolerance_pct !== undefined) {
        setRealTolerance(override.tolerance_pct)
      } else if (conf.global_config && conf.global_config.default_tolerance_pct !== undefined) {
        setRealTolerance(conf.global_config.default_tolerance_pct)
      }
    }).catch(() => {})
  }, [ctx.locationId])

  // Load denomination detail — first from sessionStorage (set by OpForm/OpExcel before navigate),
  // then overwritten by API response if available.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [denomDetail, setDenomDetail] = useState<Record<string, any>>(() => {
    if (!ctx.submissionId) return {}
    try {
      const stored = sessionStorage.getItem(`denom_${ctx.submissionId}`)
      return stored ? JSON.parse(stored) : {}
    } catch { return {} }
  })

  useEffect(() => {
    if (!ctx.submissionId) { setApiLoading(false); return }
    setApiLoading(true)
    getSubmission(ctx.submissionId)
      .then(s => {
        const forceUTC = (d?: string | null) => (d && !d.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(d) ? d + 'Z' : d);
        setApiSub({
          id: s.id, locationId: s.location_id, operatorName: s.operator_name,
          date: s.submission_date, status: s.status, source: s.source,
          totalCash: s.total_cash, expectedCash: s.expected_cash,
          variance: s.variance, variancePct: s.variance_pct,
          submittedAt: forceUTC(s.submitted_at ?? s.created_at) as string,
          approvedBy: s.approved_by ?? undefined, approvedByName: s.approved_by_name ?? undefined,
          rejectionReason: s.rejection_reason ?? undefined,
          varianceNote: s.variance_note ?? undefined,
          varianceException: !!s.variance_note,
          sections: {
            A: typeof s.sections['A'] === 'number' ? s.sections['A'] : (s.sections['A'] as { total?: number })?.total ?? 0,
            B: typeof s.sections['B'] === 'number' ? s.sections['B'] : (s.sections['B'] as { total?: number })?.total ?? 0,
            C: typeof s.sections['C'] === 'number' ? s.sections['C'] : (s.sections['C'] as { total?: number })?.total ?? 0,
            D: typeof s.sections['D'] === 'number' ? s.sections['D'] : (s.sections['D'] as { total?: number })?.total ?? 0,
            E: typeof s.sections['E'] === 'number' ? s.sections['E'] : (s.sections['E'] as { total?: number })?.total ?? 0,
            F: typeof s.sections['F'] === 'number' ? s.sections['F'] : (s.sections['F'] as { total?: number })?.total ?? 0,
            G: typeof s.sections['G'] === 'number' ? s.sections['G'] : (s.sections['G'] as { total?: number })?.total ?? 0,
            H: typeof s.sections['H'] === 'number' ? s.sections['H'] : (s.sections['H'] as { total?: number })?.total ?? 0,
            I: typeof s.sections['I'] === 'number' ? s.sections['I'] : (s.sections['I'] as { total?: number })?.total ?? 0,
            holdover: typeof s.sections['holdover'] === 'number' ? s.sections['holdover'] : 0,
            coinTransit: typeof s.sections['coin_transit'] === 'number' ? s.sections['coin_transit'] : 0,
          } as unknown as Submission['sections'],
        })
        // Extract denomination detail from API response and merge with stored
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const detail: Record<string, any> = {}
        for (const [sec, data] of Object.entries(s.sections)) {
          if (typeof data === 'object' && data !== null) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const d: any = {}
            for (const [k, v] of Object.entries(data as unknown as Record<string, unknown>)) {
              if (k !== 'total') d[k] = v
            }
            if (Object.keys(d).length > 0) detail[sec] = d
          }
        }
        if (Object.keys(detail).length > 0) setDenomDetail(prev => ({ ...prev, ...detail }))
      })
      .catch(() => { /* keep sessionStorage data */ })
      .finally(() => setApiLoading(false))
  }, [ctx.submissionId])

  const sub = apiSub
  const location = getLocation(ctx.locationId)

  const [localAction, setLocalAction] = useState<'approved' | 'rejected' | null>(null)
  
  const [verifyChecked, setVerifyChecked] = useState(false)
  const [dgmVerified, setDgmVerified] = useState(() => sessionStorage.getItem(`dgm_verified_${ctx.visitId}`) === 'true')

  const [secDecisions, setSecDecisions] = useState<Record<string, 'accept' | 'reject' | null>>(
    () => Object.fromEntries(SECTIONS.map(k => [k, null]))
  )
  const [secNotes, setSecNotes] = useState<Record<string, string>>(
    () => Object.fromEntries(SECTIONS.map(k => [k, '']))
  )

  const isManagerView = ctx.fromPanel === 'mgr-approvals' || ctx.fromPanel === 'ctrl-dashboard' || ctx.fromPanel === 'dgm-dash'

  if (apiLoading) {
    return (
      <div className="fade-up">
        <div className="ph"><div><h2>Loading Submission…</h2></div></div>
      </div>
    )
  }

  if (!sub) {
    return (
      <div className="fade-up">
        <div className="ph"><div><h2>Submission Not Found</h2></div></div>
        <div className="alert-warn">
          <span>⚠️</span>
          <div>No submission found. The operator has yet to complete the details. {' '}
            <button className="btn btn-ghost" onClick={() => onNavigate(ctx.fromPanel === 'ctrl-dashboard' ? 'ctrl-dashboard' : ctx.fromPanel === 'dgm-dash' ? 'dgm-dash' : isManagerView ? 'mgr-approvals' : 'op-start')}>
              ← Go back
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Trust API status when submission is already actioned — localStorage review may be stale
  const effStatus = localAction ?? sub.status

  // Show review form when pending approval OR when controller is doing a forced re-review
  //const showSecReview = isManagerView && (effStatus === 'pending_approval' || forceReview)
  const showSecReview = (ctx.fromPanel === 'mgr-approvals' || ctx.fromPanel === 'ctrl-dashboard') && effStatus === 'pending_approval'
  const allDecided = SECTIONS.every(k => secDecisions[k] !== null)
  const allNoted   = SECTIONS.every(k => secDecisions[k] !== 'reject' || secNotes[k].trim() !== '')
  const canSubmit  = allDecided && allNoted

  async function handleSubmitReview() {
    if (!canSubmit || !sub) return
    const outcome: 'approved' | 'rejected' = SECTIONS.some(k => secDecisions[k] === 'reject') ? 'rejected' : 'approved'
    const sections: Record<string, { decision: 'accept' | 'reject'; note: string }> = {}
    SECTIONS.forEach(k => {
      sections[k] = { decision: secDecisions[k] as 'accept' | 'reject', note: secNotes[k] }
    })

    // Call the API to persist the approval/rejection
    try {
      if (outcome === 'approved') {
        await approveSubmission(sub.id)
      } else {
        const rejectNote = Object.values(sections).find(s => s.decision === 'reject')?.note ?? 'Rejected by controller.'
        await rejectSubmission(sub.id, { reason: rejectNote })
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit review.'
      window.alert(msg)
      return
    }

    {/*if (ctx.fromPanel === 'ctrl-dashboard') {
      // Re-open the completion panel so the controller can click Confirm Completion
      const vid = ctx.visitId || ctx.verificationId
      onNavigate('ctrl-dashboard', vid ? { expandVisitId: vid, expandAction: 'complete' } : {})
      return
    }*/}
    if (ctx.fromPanel === 'ctrl-dashboard') {
        onNavigate('ctrl-dashboard')
        return
      }
    if (ctx.fromPanel === 'dgm-dash') {
      const vid = ctx.visitId || ctx.verificationId
      onNavigate('dgm-dash', vid ? { expandVisitId: vid, expandAction: 'complete' } : {})
      return
    }
    setLocalAction(outcome)
  }

  function renderSecFooter(secKey: string) {
    if (!showSecReview) return null
    const dec  = secDecisions[secKey]
    const note = secNotes[secKey]
    return (
      <div style={{
        padding: '10px 12px', borderTop: '1px solid var(--ow2)',
        background: dec === 'accept' ? '#f0fdf4' : dec === 'reject' ? '#fef2f2' : 'var(--g0)',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, flex: 1 }}>Review — Section {secKey}:</span>
          <button
            onClick={() => setSecDecisions(prev => ({ ...prev, [secKey]: 'accept' }))}
            style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: dec === 'accept' ? 'var(--g7)' : 'white',
              color: dec === 'accept' ? 'white' : 'var(--g7)',
              border: '1.5px solid var(--g7)',
            }}
          >✓ Accept</button>
          <button
            onClick={() => setSecDecisions(prev => ({ ...prev, [secKey]: 'reject' }))}
            style={{
              padding: '4px 14px', borderRadius: 6, fontSize: 12, fontWeight: 600, cursor: 'pointer',
              background: dec === 'reject' ? 'var(--red)' : 'white',
              color: dec === 'reject' ? 'white' : 'var(--red)',
              border: '1.5px solid var(--red)',
            }}
          >✗ Reject</button>
        </div>
        {dec === 'reject' && (
          <textarea
            className="f-inp" rows={2}
            placeholder="Required: note your reason for rejecting this section…"
            value={note}
            onChange={e => setSecNotes(prev => ({ ...prev, [secKey]: e.target.value }))}
            style={{ width: '100%', resize: 'vertical', fontSize: 12, marginTop: 8 }}
          />
        )}
      </div>
    )
  }

  const dateLabel      = new Date(sub.date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const safeSubmittedAt = sub.submittedAt.endsWith('Z') ? sub.submittedAt : sub.submittedAt + 'Z'
  const submittedLabel = new Date(safeSubmittedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const isToday        = sub.date === todayStr()
  const pastRejected   = !isToday && effStatus === 'rejected'

  const statusConfig: Record<string, { badge: string; icon: string; message: string }> = {
    pending_approval: { badge: 'badge-amber', icon: '⏳', message: 'Awaiting controller approval.' },
    approved:         { badge: 'badge-green', icon: '✅', message: localAction === 'approved' ? 'Review submitted — approved.' : `Approved by ${sub.approvedByName ?? sub.approvedBy ?? 'controller'}.` },
    rejected:         { badge: 'badge-red',   icon: '❌', message: localAction === 'rejected' ? 'Review submitted — rejected.' : (sub.rejectionReason ?? 'Rejected — please resubmit after correction.') },
    draft:            { badge: 'badge-gray',  icon: '📝', message: 'Draft — not yet submitted for approval.' },
  }
  const sc = statusConfig[effStatus] ?? statusConfig['pending_approval']

  const s = sub.sections
  // Read intermediate values from sections JSON (stored by backend at submission time)
  const sectionsRaw = s as unknown as Record<string, unknown>
  const holdoverAmt = Number(sectionsRaw.holdover ?? 0)
  const coinTransitAmt = Number(sectionsRaw.coinTransit ?? sectionsRaw.coin_transit ?? 0)
  // "Total Cash" = A+B+C+D+E+F+G minus holdover (intermediate subtotal before H, I, J, K)
  const calcTotalCash = s.A + s.B + s.C + s.D + s.E + s.F + s.G - holdoverAmt
  // All totals come from API — single source of truth
  const calcTotalFund = sub.totalCash
  const calcExpectedCash = sub.expectedCash || 0
  const calcVariance = sub.variance
  const calcVariancePct = sub.variancePct
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const locAny = location as any
  const tolerance = realTolerance ?? locAny?.tolerance_pct_override ?? locAny?.effective_tolerance_pct ?? locAny?.tolerance_pct ?? location?.tolerancePct ?? 0.5
  const exceedsTolerance = Math.abs(calcVariancePct) > tolerance
  const varColor = Math.abs(calcVariancePct) > 5 ? 'var(--red)' : Math.abs(calcVariancePct) > 2 ? 'var(--amb)' : 'var(--g7)'

  return (
    <div className="fade-up">

      {/* Page header */}
      <div className="ph">
        <div>
          <h2>Submission — {location?.name}</h2>
          <p>{dateLabel}</p>
        </div>
        <div className="ph-right">
          {isManagerView ? (
            <button className="btn btn-outline" onClick={() => {
              if (ctx.fromPanel === 'ctrl-dashboard') {
                // Re-open the same visit panel so controller lands back in context
                const backCtx: Record<string, string> = {}
                if (ctx.expandVisitId) backCtx.expandVisitId = ctx.expandVisitId
                if (ctx.expandAction)  backCtx.expandAction  = ctx.expandAction
                onNavigate('ctrl-dashboard', backCtx)
              } else if (ctx.fromPanel === 'dgm-dash') {
                onNavigate('dgm-dash')
              } else {
                onNavigate('mgr-approvals')
              }
            }}>← Dashboard</button>
          ) : (
            <>
              <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>← Dashboard</button>
              {sub.status === 'rejected' && (
                <button className="btn btn-primary" onClick={() => onNavigate('op-method', { locationId: ctx.locationId, date: ctx.date, submissionId: sub.id })}>
                  Resubmit →
                </button>
              )}
              {sub.status === 'pending_approval' && !isManagerView && (
                <button className="btn btn-primary" onClick={() => onNavigate('op-method', { locationId: ctx.locationId, date: ctx.date, submissionId: sub.id })}>
                  Update →
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Status banner */}
      <div style={{
        display: 'flex', gap: 14, alignItems: 'flex-start',
        padding: '14px 18px', borderRadius: 10, marginBottom: 18,
        background: effStatus === 'approved' ? 'var(--g0)' : effStatus === 'rejected' ? 'var(--red-bg)' : 'var(--amb-bg)',
        border: `1px solid ${effStatus === 'approved' ? 'var(--g1)' : effStatus === 'rejected' ? '#fca5a5' : '#fcd34d'}`,
      }}>
        <span style={{ fontSize: 24 }}>{sc.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>
            {effStatus === 'pending_approval' ? 'Pending Approval' : (effStatus === 'approved' && dgmVerified ? 'Approved & Verified' : effStatus.charAt(0).toUpperCase() + effStatus.slice(1))}
            {/*{forceReview && effStatus === 'approved' && (
              <span style={{
                fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                background: '#fef3c7', color: '#92400e', border: '1px solid #fcd34d',
              }}>Previously Approved — Re-review Required</span>
            )}*/}
          </div>
          <div style={{ fontSize: 13, color: effStatus === 'rejected' ? 'var(--red)' : 'var(--tm)' }}>
            {/*{forceReview && effStatus === 'approved'
              ? 'This submission was previously approved. Please review each section again to confirm completion.'
              : sc.message}*/}
              {sc.message}
          </div>
        </div>
      </div>

      {/* Controller review panel */}
      {showSecReview && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            {/*<span className="card-title">{forceReview ? 'Re-review Required' : 'Complete Review'}</span>*/}
            <span className="card-title">Complete Review</span>
            <span className="card-sub">Submitted by {sub.operatorName} · {submittedLabel}</span>
          </div>
          <div className="card-body">
            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--ts)', marginRight: 4 }}>
                Accept or Reject each section (A–I) below, then:
              </span>
              <button className="btn btn-primary" style={{ padding: '8px 24px', opacity: canSubmit ? 1 : 0.45 }}
                disabled={!canSubmit} onClick={handleSubmitReview}>
                Submit Review
              </button>
            </div>
            {allDecided && (() => {
              const rejected = SECTIONS.filter(k => secDecisions[k] === 'reject')
              return rejected.length > 0 ? (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>❌</span>
                  <span>Section(s) <strong>{rejected.join(', ')}</strong> rejected — submission will be <strong>rejected</strong>.</span>
                </div>
              ) : (
                <div style={{ marginTop: 10, fontSize: 12, color: 'var(--g7)', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span>✓</span>
                  <span>All sections accepted — submission will be <strong>approved</strong>.</span>
                </div>
              )
            })()}
            {!allDecided && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--amb)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>⚠️</span>
                <span>
                  Please <strong>Accept</strong> or <strong>Reject</strong> each section (A–I) before submitting.
                  {' '}{SECTIONS.filter(k => secDecisions[k] === null).length} section(s) remaining.
                </span>
              </div>
            )}
            {allDecided && !allNoted && (
              <div style={{ marginTop: 10, fontSize: 12, color: 'var(--red)', display: 'flex', alignItems: 'center', gap: 6 }}>
                <span>❌</span>
                <span>A note is required for each section you rejected.</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Post-action confirmation */}
      {isManagerView && localAction && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-body" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 28 }}>{localAction === 'approved' ? '✅' : '❌'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 2 }}>
                Review submitted — submission {localAction === 'approved' ? 'approved' : 'rejected'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ts)' }}>
                {localAction === 'approved'
                  ? 'All sections accepted. The operator will be notified.'
                  : 'One or more sections rejected. The operator will receive your review comments via email.'}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* KPIs */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Total Fund"
          value={formatCurrency(calcTotalFund)}
          highlight={Math.abs(calcVariancePct) > 5 ? 'red' : false}
          tooltip={{
            what: "The total cash counted across all sections (A–I) of this submission.",
            how: "Summed from all section totals entered during the cash count — bills, coins, rolled coin, changer funds, etc.",
            formula: "Σ(Section A + B + C + D + E + F + G + H ± I)",
            flag: "Turns red if variance vs imprest exceeds 5%.",
          }}
        />
        <KpiCard
          label="Imprest Balance"
          value={formatCurrency(calcExpectedCash)}
          accent="var(--ts)"
          tooltip={{
            what: "The fixed cash fund amount that this location is expected to hold at all times.",
            how: "Set by the administrator for each location. This is the benchmark used to calculate the daily variance. The default system-wide value is £9,575.",
            formula: "Fixed per location — configured in Admin > Locations",
          }}
        />
        <KpiCard
          label="Variance"
          value={`${calcVariance >= 0 ? '+' : ''}${formatCurrency(calcVariance)}`}
          sub={`${calcVariancePct >= 0 ? '+' : ''}${calcVariancePct.toFixed(2)}%`}
          accent={varColor}
          highlight={Math.abs(calcVariancePct) > 5 ? 'red' : Math.abs(calcVariancePct) > 2 ? 'amber' : false}
          tooltip={{
            what: "The difference between the actual cash counted and the expected imprest balance.",
            how: "Positive variance means more cash than expected (overage); negative means less (shortage). The percentage is used to determine if a written explanation is required.",
            formula: "Variance = Total Fund − Imprest Balance\nVariance % = Variance ÷ Imprest × 100",
            flag: ">5% requires written explanation. >2% shown in amber as a soft warning.",
          }}
        />
        <KpiCard
          label="Submitted"
          value={submittedLabel}
          //sub={`Ref: ${sub.id}`}
          tooltip={{
            what: "The date and time this cash count submission was recorded.",
            how: "Automatically stamped when the operator submitted the form. Used to track SLA compliance — managers must approve within 48 hours.",
            formula: "Timestamp set at form submission. SLA breach = (now − submitted_at) > 48h",
          }}
        />
      </div>

      {/* Controller review result (from API status) */}
      {!showSecReview && (effStatus === 'approved' || effStatus === 'rejected') && sub.approvedByName && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <span className="card-title">Controller Review</span>
            <span className={`badge ${effStatus === 'approved' ? 'badge-green' : 'badge-red'}`}>
              <span className="bdot" />{effStatus === 'approved' ? 'Approved' : 'Rejected'}
            </span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 13, color: 'var(--td)' }}>
              <strong>Reviewed by:</strong> {sub.approvedByName}
            </div>
            {sub.rejectionReason && (
              <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>
                <strong>Reason:</strong> {sub.rejectionReason}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Past-date rejected banner */}
      {pastRejected && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '12px 16px', borderRadius: 10, marginBottom: 16,
          background: 'var(--red-bg)', border: '1px solid #fca5a5',
        }}>
          <span style={{ fontSize: 20 }}>🔒</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
              Resubmission not available — past date
            </div>
            <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.55 }}>
              This submission was rejected but cannot be corrected because the date ({sub.date}) has passed.
              Only today's rejected submissions can be resubmitted.
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-filled form header ── */}
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{ padding: '10px 16px', background: 'var(--g8)', color: '#fff', textAlign: 'center' }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>Canteen Vending Services</div>
          <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 16, marginTop: 2 }}>Daily Cashroom Count Worksheet</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            ['Location',    location?.name ?? '—'],
            ['Date',        dateLabel],
            ['Counted By',  sub.operatorName],
            ['Verified By', sub.approvedByName ?? sub.approvedBy ?? '—'],
          ].map(([label, value], i) => (
            <div key={label} style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--ow2)',
              borderRight: i < 3 ? '1px solid var(--ow2)' : undefined,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--td)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ══ ROW 1 — A · B · C ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        {/* Section A */}
        <div className="card" style={{ border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
          <SecHead id="A" title="Currency" total={s.A} red={pastRejected} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Denomination</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {SEC_A_DENOM.map(r => {
                const qty = denomDetail['A']?.[r.key] ?? null
                return (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {qty != null
                      ? <td style={{ textAlign: 'right', fontSize: 12 }}>{qty > 0 ? qty : '—'}</td>
                      : <DashCell />}
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>A. Total</td>
                <ValCell val={s.A} />
              </tr>
            </tbody>
          </table>
          {renderSecFooter('A')}
        </div>

        {/* Section B */}
        <div className="card" style={{ border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
          <SecHead id="B" title="Rolled Coin" total={s.B} red={pastRejected} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Denomination</th>
                <th style={{ textAlign: 'right' }}>Qty</th>
              </tr>
            </thead>
            <tbody>
              {SEC_B_DENOM.map(r => {
                const qty = denomDetail['B']?.[r.key] ?? null
                return (
                  <tr key={r.label}>
                    <td>{r.label}</td>
                    {qty != null
                      ? <td style={{ textAlign: 'right', fontSize: 12 }}>{qty > 0 ? qty : '—'}</td>
                      : <DashCell />}
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>B. Total</td>
                <ValCell val={s.B} />
              </tr>
            </tbody>
          </table>
          {renderSecFooter('B')}
        </div>

        {/* Section C */}
        <div className="card" style={{ border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
          <SecHead id="C" title="Coins in Counting Machines (Sorter/Counter)" total={s.C} red={pastRejected} />
          <div style={{ overflowX: 'auto' }}>
            <table className="dt" style={{ fontSize: 12, minWidth: 380 }}>
              <thead>
                <tr>
                  <th>Denom</th>
                  <th style={{ textAlign: 'right' }}>No. 1</th>
                  <th style={{ textAlign: 'right' }}>No. 2</th>
                  <th style={{ textAlign: 'right', color: 'var(--ts)', fontSize: 11 }}>Face $</th>
                  <th style={{ textAlign: 'right', background: '#fffde7' }}>Tot Count</th>
                  <th style={{ textAlign: 'right', background: '#fffde7' }}>Total $</th>
                </tr>
              </thead>
              <tbody>
                {SEC_C_LABELS.map((lbl, i) => {
                  const m = denomDetail['C']?.machines?.[SEC_C_KEYS[i]]
                  const m1 = m?.m1 ? parseFloat(m.m1) : 0
                  const m2 = m?.m2 ? parseFloat(m.m2) : 0
                  const totalCount = m1 + m2
                  const totalAmt = totalCount * SEC_C_FACE[i]
                  return (
                    <tr key={lbl}>
                      <td>{lbl}</td>
                      {m1 > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{m1}</td> : <DashCell />}
                      {m2 > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{m2}</td> : <DashCell />}
                      <td style={{ textAlign: 'right', color: 'var(--ts)', fontSize: 11 }}>{formatCurrency(SEC_C_FACE[i])}</td>
                      {totalCount > 0 ? <td style={YC}>{totalCount}</td> : <DashCell />}
                      {totalAmt > 0 ? <td style={YC}>{formatCurrency(totalAmt)}</td> : <DashCell />}
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--g0)' }}>
                  <td colSpan={5} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>C. Total</td>
                  <ValCell val={s.C} />
                </tr>
              </tbody>
            </table>
          </div>
          {renderSecFooter('C')}
        </div>
      </div>

      {/* ══ ROW 2 — D · E ══ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        {/* Section D */}
        <div className="card" style={{ border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
          <SecHead id="D" title="Bagged Coin (Full for Bank)" total={s.D} red={pastRejected} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>No.</th>
                <th style={{ textAlign: 'right', background: '#fffde7' }}>Totals</th>
              </tr>
            </thead>
            <tbody>
              {SEC_D_LABELS.map((lbl, i) => {
                const qty = denomDetail['D']?.bags?.[SEC_D_KEYS[i]]
                const total = qty ? qty * SEC_D_FACE[i] : 0
                return (
                  <tr key={lbl}>
                    <td>{lbl}</td>
                    {qty > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{qty}</td> : <DashCell />}
                    {total > 0 ? <td style={YC}>{formatCurrency(total)}</td> : <DashCell />}
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--g0)' }}>
                <td colSpan={2} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>D. Total</td>
                <ValCell val={s.D} />
              </tr>
            </tbody>
          </table>
          {renderSecFooter('D')}
        </div>

        {/* Section E */}
        <div className="card" style={{ border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
          <SecHead id="E" title="Unissued Changer Funds in Cashroom or Vault" total={s.E} red={pastRejected} />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--ow2)' }}>
            {['Set 1', 'Set 2'].map((setLabel, si) => (
              <div key={setLabel} style={{ borderRight: si === 0 ? '1px solid var(--ow2)' : undefined }}>
                <div style={{ padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', borderBottom: '1px solid var(--ow2)' }}>
                  {setLabel}
                </div>
                <table className="dt" style={{ fontSize: 12 }}>
                  <thead>
                    <tr>
                      <th style={{ textAlign: 'right' }}>No.</th>
                      <th style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</th>
                      <th style={{ textAlign: 'right' }}>Amt</th>
                      <th style={{ textAlign: 'right', background: '#fffde7' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Array.from({ length: 5 }).map((_, i) => {
                      const row = denomDetail['E']?.[si === 0 ? 'set1' : 'set2']?.[i] || denomDetail['E']?.[si === 0 ? 'left' : 'right']?.[i]
                      const qty = row?.qty ? parseFloat(row.qty) : 0
                      const amt = row?.amount ? parseFloat(row.amount) : 0
                      const total = qty * amt
                      return (
                        <tr key={i}>
                          {qty > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{qty}</td> : <DashCell />}
                          <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</td>
                          {amt > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{formatCurrency(amt)}</td> : <DashCell />}
                          {total > 0 ? <td style={YC}>{formatCurrency(total)}</td> : <DashCell />}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            ))}
          </div>
          <table className="dt" style={{ fontSize: 12 }}>
            <tbody>
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>E. Total</td>
                <ValCell val={s.E} />
              </tr>
            </tbody>
          </table>
          {renderSecFooter('E')}
        </div>
      </div>

      {/* ══ Sections F · G · H · I (full width) ══ */}

      {/* Section F */}
      <div className="card" style={{ marginBottom: 12, border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
        <SecHead id="F" title="Returned but Uncounted Manual Change" total={s.F} red={pastRejected} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', width: 90 }}>Qty</th>
              <th style={{ width: 60 }}></th>
              <th style={{ textAlign: 'right', width: 110 }}>Amount ($)</th>
              <th style={{ textAlign: 'right', background: '#fffde7', width: 120 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 4 }).map((_, i) => {
              const row = denomDetail['F']?.rows?.[i] || (Array.isArray(denomDetail['F']) ? denomDetail['F'][i] : null)
              const qty = row?.qty ? parseFloat(row.qty) : 0
              const amt = row?.amount ? parseFloat(row.amount) : 0
              const total = qty * amt
              return (
                <tr key={i}>
                  {qty > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{qty}</td> : <DashCell />}
                  <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</td>
                  {amt > 0 ? <td style={{ textAlign: 'right', fontSize: 12 }}>{formatCurrency(amt)}</td> : <DashCell />}
                  {total > 0 ? <td style={YC}>{formatCurrency(total)}</td> : <DashCell />}
                </tr>
              )
            })}
            <tr style={{ background: 'var(--g0)' }}>
              <td colSpan={3} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>F. Total</td>
              <ValCell val={s.F} />
            </tr>
          </tbody>
        </table>
        {renderSecFooter('F')}
      </div>

      {/* Section G */}
      <div className="card" style={{ marginBottom: 12, border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
        <SecHead id="G" title="Mutilated Currency, Foreign, and/or Bent Coin" total={s.G} red={pastRejected} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            {[['Currency', 'currency'], ['Coin', 'coin']].map(([lbl, key]) => {
              const val = denomDetail['G']?.[key] ?? null
              return (
                <tr key={lbl}>
                  <td>{lbl}</td>
                  <AmtCell val={val} />
                </tr>
              )
            })}
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>G. Total</td>
              <ValCell val={s.G} />
            </tr>
          </tbody>
        </table>
        {renderSecFooter('G')}
      </div>

      {/* Section H */}
      <div className="card" style={{ marginBottom: 12, border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
        <SecHead id="H" title="Changer Funds Outstanding (Per Form #1841 / #403-1)" total={s.H} red={pastRejected} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Entry</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Changer Funds Outstanding</td>
              <AmtCell val={denomDetail['H']?.value ?? null} />
            </tr>
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>H. Total</td>
              <ValCell val={s.H} />
            </tr>
          </tbody>
        </table>
        {renderSecFooter('H')}
      </div>

      {/* Section I */}
      <div className="card" style={{ marginBottom: 12, border: pastRejected ? '1.5px solid #fca5a5' : undefined }}>
        <SecHead id="I" title="Net Unreimbursed Bill Changer Fund Shortage / (Overage)" total={Math.abs(s.I)} red={pastRejected} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Entry</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            {[
              ['Shortage / (Overage) as of Yesterday', 'yesterday'],
              ["Today's Shortage / (Overage)", 'today'],
            ].map(([lbl, key]) => {
              const val = denomDetail['I']?.[key] ?? null
              return (
                <tr key={lbl}>
                  <td>{lbl}</td>
                  <AmtCell val={val} />
                </tr>
              )
            })}
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>I. Total</td>
              <td style={{ ...YC, color: s.I < 0 ? 'var(--red)' : '#78590a' }}>{formatCurrency(s.I)}</td>
            </tr>
          </tbody>
        </table>
        {renderSecFooter('I')}
      </div>

      {/* ══ Summary ══ */}
      <div className="card" style={{ border: `2px solid ${Math.abs(calcVariancePct) > 5 ? 'var(--red)' : 'var(--g4)'}` }}>
        <div className="card-header" style={{ background: Math.abs(calcVariancePct) > 5 ? 'var(--red-bg)' : 'var(--g0)' }}>
          <span className="card-title">Summary</span>
          <span className="card-sub">Cashroom Count Totals</span>
        </div>
        <div className="card-body">
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {([
                ['A', 'Currency',                                      s.A],
                ['B', 'Rolled Coin',                                   s.B],
                ['C', 'Coins in Counting Machines',                    s.C],
                ['D', 'Bagged Coin (Full for Bank)',                   s.D],
                ['E', 'Unissued Changer Funds',                        s.E],
                ['F', 'Uncounted / Returned Changers',                 s.F],
                ['G', 'Mutilated Currency, Foreign, and/or Bent Coin', s.G],
              ] as [string, string, number][]).map(([sec, lbl, tot]) => (
                <tr key={sec} style={{ borderBottom: '1px solid var(--ow2)' }}>
                  <td style={{ padding: '7px 0', width: 24, color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>{sec}</td>
                  <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>{lbl}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                    {formatCurrency(tot)}
                  </td>
                </tr>
              ))}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--ts)', fontStyle: 'italic' }}>
                  Deduct Holdover (if any)
                </td>
                <td style={{ textAlign: 'right', padding: '7px 0', color: 'var(--td)', fontSize: 14 }}>
                  {formatCurrency((s as unknown as Record<string, number>).holdover || 0)}
                </td>
              </tr>
              <tr style={{ background: '#fffde7', borderBottom: '2px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: '#78590a' }}>Total Cash</td>
                <td style={{ ...YC, padding: '8px 0', fontSize: 15, fontFamily: 'DM Serif Display,serif' }}>
                  {formatCurrency(calcTotalCash)}
                </td>
              </tr>
              {(['H', 'I'] as const).map(k => (
                <tr key={k} style={{ borderBottom: '1px solid var(--ow2)' }}>
                  <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>{k}</td>
                  <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>
                    {k === 'H' ? 'Changer Funds Outstanding' : 'Net Unreimbursed Bill Changer Shortage / (Overage)'}
                  </td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                    {formatCurrency(s[k])}
                  </td>
                </tr>
              ))}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>J</td>
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>Coin Purchase in Transit to / from Bank</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                  {formatCurrency(coinTransitAmt)}
                </td>
              </tr>
              <tr style={{ background: '#fffde7', borderBottom: '2px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: '#78590a' }}>Total Cashier's Fund – TODAY</td>
                <td style={{ ...YC, padding: '8px 0', fontSize: 15, fontFamily: 'DM Serif Display,serif' }}>
                  {formatCurrency(calcTotalFund)}
                </td>
              </tr>
            </tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--ts)' }}>Cashier's Fund Imprest Balance (this location)</span>
            <span style={{ color: 'var(--ts)', fontFamily: 'DM Serif Display,serif' }}>{formatCurrency(calcExpectedCash)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--ts)', fontSize: 12 }}>Tolerance Threshold</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: exceedsTolerance ? 'var(--red)' : 'var(--g7)' }}>
              ±{tolerance.toFixed(1)}%&nbsp;
              <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(±{formatCurrency(calcExpectedCash * tolerance / 100)})</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--ow2)', marginTop: 6 }}>
            <strong style={{ color: varColor }}>Variance – Short or (Over)</strong>
            <strong style={{ fontFamily: 'DM Serif Display,serif', fontSize: 18, color: varColor }}>
              {calcVariance >= 0 ? '+' : ''}{formatCurrency(calcVariance)}&nbsp;
              ({calcVariancePct >= 0 ? '+' : ''}{calcVariancePct.toFixed(2)}%)
            </strong>
          </div>

          {sub.varianceException && sub.varianceNote && (
            <div style={{ marginTop: 12, padding: '12px 16px', borderRadius: 8, background: 'var(--amb-bg)', border: '1px solid #fcd34d', fontSize: 13 }}>
              <strong>Variance Note:</strong> {sub.varianceNote}
            </div>
          )}
        </div>
      </div>

      {/* Approval details */}
      {effStatus === 'approved' && sub.approvedBy && !localAction && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Approval Details</span>
            <span className="badge badge-green"><span className="bdot" />{dgmVerified ? 'Approved & Verified' : 'Approved'}</span>
          </div>
          <div className="card-body" style={{ fontSize: 13, color: 'var(--ts)', lineHeight: 1.5 }}>
            Approved by <strong style={{ color: 'var(--td)' }}>{sub.approvedByName ?? sub.approvedBy ?? 'Unknown'}</strong>
            {dgmVerified && <div>Verified by <strong style={{ color: 'var(--td)' }}>DGM</strong></div>}
          </div>
        </div>
      )}

      {/* DGM Verification Section */}
      {ctx.fromPanel === 'dgm-dash' && effStatus === 'approved' && ctx.expandAction === 'complete' && (
        <div className="card" style={{ marginTop: 18, border: dgmVerified ? '1px solid var(--g4)' : '1px solid var(--ow2)' }}>
          <div className="card-header" style={{ background: dgmVerified ? 'var(--g0)' : undefined }}>
            <span className="card-title">DGM Verification</span>
            {dgmVerified && <span className="badge badge-green"><span className="bdot" />Verified</span>}
          </div>
          <div className="card-body">
            {dgmVerified ? (
              <div style={{ fontSize: 13, color: 'var(--g7)', fontWeight: 600 }}>
                ✅ You have successfully verified this submission.
                <div style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" onClick={() => onNavigate('dgm-dash', { expandVisitId: ctx.visitId, expandAction: 'complete' })}>
                    Return to Dashboard
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13, color: 'var(--td)', marginBottom: 16 }}>
                  <input 
                    type="checkbox" 
                    checked={verifyChecked} 
                    onChange={e => setVerifyChecked(e.target.checked)}
                    style={{ width: 16, height: 16, cursor: 'pointer' }}
                  />
                  <strong>I confirm that I have verified this submission.</strong>
                </label>
                <button 
                  className="btn btn-primary" 
                  disabled={!verifyChecked}
                  style={{ opacity: verifyChecked ? 1 : 0.5 }}
                  onClick={() => {
                    sessionStorage.setItem(`dgm_verified_${ctx.visitId}`, 'true')
                    setDgmVerified(true)
                    onNavigate('dgm-dash', { expandVisitId: ctx.visitId, expandAction: 'complete' })
                  }}
                >
                  Mark as Verified
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  )
}
