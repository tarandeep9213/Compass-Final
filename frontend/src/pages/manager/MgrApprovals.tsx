import { useState, useMemo, useEffect, Fragment } from 'react'
import { SUBMISSIONS, getLocation, formatCurrency, IMPREST } from '../../mock/data'
import type { Submission, SubmissionReview } from '../../mock/data'
import { listSubmissions } from '../../api/submissions'
import { listLocations } from '../../api/locations'
import type { ApiSubmission, ApiLocation } from '../../api/types'
import KpiCard from '../../components/KpiCard'

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const

function mapApiSub(s: ApiSubmission): Submission {
  return {
    id: s.id,
    locationId: s.location_id,
    operatorName: s.operator_name,
    date: s.submission_date,
    status: s.status,
    source: s.source,
    totalCash: s.total_cash,
    expectedCash: s.expected_cash,
    variance: s.variance,
    variancePct: s.variance_pct,
    submittedAt: s.submitted_at ?? s.created_at,
    approvedBy: s.approved_by ?? undefined,
    approvedByName: s.approved_by_name ?? undefined,
    rejectionReason: s.rejection_reason ?? undefined,
    sections: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 },
    varianceException: s.variance_exception,
    varianceNote: s.variance_note ?? undefined,
  }
}

interface Props {
  managerName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

type StatusFilter = 'all' | 'pending_approval' | 'approved' | 'rejected'
type DateRange    = '7d'  | '30d' | 'all'

const PAGE_SIZE = 10

/** Returns page indices (0-based) or 'gap' for ellipsis — max 7 buttons shown */
function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)         return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3600000)
  const m  = Math.floor((ms % 3600000) / 60000)
  if (h >= 48) return `${Math.floor(h / 24)}d ago`
  if (h >  0)  return `${h}h ${m}m ago`
  return `${m}m ago`
}

const varColor = (pct: number) =>
  Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)'

export default function MgrApprovals({ managerName, locationIds, onNavigate }: Props) {
  const [statusFilter,   setStatusFilter]   = useState<StatusFilter>('all')
  const [dateRange,      setDateRange]      = useState<DateRange>('7d')
  const [locationFilter, setLocationFilter] = useState<string>('all')
  const [page, setPage] = useState(0)
  const [apiLocations, setApiLocations] = useState<ApiLocation[]>([])

  useEffect(() => {
    listLocations().then(setApiLocations).catch(() => {})
  }, [])
  // Load persisted submission reviews from localStorage
  const [reviews] = useState<Record<string, SubmissionReview>>(() => {
    try {
      const raw = localStorage.getItem('compass_submission_reviews')
      return raw ? JSON.parse(raw) : {}
    } catch { return {} }
  })

  // API-fetched submissions — overlay over mock data
  const [apiSubs, setApiSubs] = useState<Submission[]>([])
  useEffect(() => {
    const key = locationIds.join(',')
    if (!key) return
    Promise.all(locationIds.map(id => listSubmissions({ location_id: id, page_size: 100 }).then(r => r.items.map(mapApiSub))))
      .then(arrays => setApiSubs(arrays.flat()))
      .catch(() => { /* fall back to mock */ })
  }, [locationIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reset to page 0 when filters change
  useEffect(() => { setPage(0) },
    [statusFilter, dateRange, locationFilter])

  // Cutoff timestamp for history (doesn't affect pending — those always show)
  const cutoff = useMemo(() => {
    if (dateRange === '7d')  return Date.now() - 7  * 86400000
    if (dateRange === '30d') return Date.now() - 30 * 86400000
    return 0
  }, [dateRange])

  const sourceSubs = useMemo(() => {
    const base = apiSubs.length > 0 ? apiSubs : SUBMISSIONS
    return base.map(s => {
      const loc = getLocation(s.locationId)
      const expCash = Number(s.expectedCash || (loc as unknown as Record<string, number>)?.expected_cash || (loc as unknown as Record<string, number>)?.expectedCash || IMPREST)
      const variance = s.totalCash - expCash
      const variancePct = expCash > 0 ? (variance / expCash) * 100 : 0
      return { ...s, expectedCash: expCash, variance, variancePct }
    })
  }, [apiSubs])

  const allMgrSubs = useMemo(() =>
    sourceSubs.filter(s =>
      locationIds.includes(s.locationId) &&
      (locationFilter === 'all' || s.locationId === locationFilter)
    ),
  [sourceSubs, locationIds, locationFilter])

  // Effective status: pending_approval from recent resubmit takes precedence over stale reviews
  const effectiveStatus = (s: Submission): 'draft' | 'pending_approval' | 'approved' | 'rejected' => {
    if (s.status === 'pending_approval') return 'pending_approval'
    return (reviews[s.id]?.outcome ?? s.status) as 'draft' | 'pending_approval' | 'approved' | 'rejected'
  }

  // Pending always shown (regardless of date range — they need action)
  // Approved/rejected filtered by date range
  const rows = useMemo(() => {
    return allMgrSubs
      .filter(s => {
        const eff = effectiveStatus(s)
        // Never show drafts to controller — they are operator's private work
        if (eff === 'draft') return false
        if (statusFilter !== 'all' && eff !== statusFilter) return false
        // Pending: always show regardless of date range
        if (eff === 'pending_approval') return true
        // History: apply date range
        return new Date(s.submittedAt).getTime() >= cutoff
      })
      .sort((a, b) => {
        const aEff = effectiveStatus(a)
        const bEff = effectiveStatus(b)
        // Pending rows float to top, oldest-first (most urgent)
        if (aEff === 'pending_approval' && bEff !== 'pending_approval') return -1
        if (bEff === 'pending_approval' && aEff !== 'pending_approval') return 1
        if (aEff === 'pending_approval') return new Date(a.submittedAt).getTime() - new Date(b.submittedAt).getTime()
        // History: newest-first
        return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allMgrSubs, statusFilter, cutoff, reviews])

  // ── KPI calculations ────────────────────────────────────────────────────
  const pendingRows   = allMgrSubs.filter(s => effectiveStatus(s) === 'pending_approval')
  const overdueCount  = pendingRows.filter(s => Date.now() - new Date(s.submittedAt).getTime() > 48 * 3600000).length
  const inRange       = allMgrSubs.filter(s => new Date(s.submittedAt).getTime() >= cutoff)
  const approvedCount = inRange.filter(s => effectiveStatus(s) === 'approved').length
  const rejectedCount = inRange.filter(s => effectiveStatus(s) === 'rejected').length
  const actionedInRange = inRange.filter(s => effectiveStatus(s) !== 'pending_approval')
  const avgVariance   = actionedInRange.length > 0
    ? actionedInRange.reduce((sum, s) => {
        const loc = apiLocations.find(l => l.id === s.locationId)
        const expCash = s.expectedCash || loc?.expected_cash || 0
        const calcVarPct = expCash > 0 ? ((s.totalCash - expCash) / expCash) * 100 : 0
        return sum + Math.abs(calcVarPct)
      }, 0) / actionedInRange.length
    : null

  // ── Filter counts (for chips) ────────────────────────────────────────────
  const chipCounts = {
    all:      allMgrSubs.filter(s => {
                const eff = effectiveStatus(s)
                if (eff === 'pending_approval') return true
                return new Date(s.submittedAt).getTime() >= cutoff
              }).length,
    pending_approval: pendingRows.length,
    approved: approvedCount,
    rejected: rejectedCount,
  }

  const dateRangeLabel = dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'all time'

  // ── Pagination ──────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromEntry  = rows.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toEntry    = Math.min((page + 1) * PAGE_SIZE, rows.length)

  function goToPage(p: number) {
    setPage(p)
  }

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Daily Review Dashboard</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            {locationFilter === 'all'
              ? `${locationIds.length} ${locationIds.length === 1 ? 'location' : 'locations'} · ${locationIds.length === 1 ? (apiLocations.find(l => l.id === locationIds[0])?.name ?? locationIds[0]) : managerName}`
              : `${apiLocations.find(l => l.id === locationFilter)?.name ?? locationFilter} · ${managerName}`}
          </p>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Awaiting Approval"
          value={pendingRows.length}
          sub={overdueCount > 0 ? `${overdueCount} overdue (>48h)` : undefined}
          accent={overdueCount > 0 ? 'var(--red)' : pendingRows.length > 0 ? 'var(--amb)' : 'var(--g7)'}
          highlight={overdueCount > 0 ? 'red' : pendingRows.length > 0 ? 'amber' : false}
          tooltipAlign="left"
          tooltip={{
            what: "Submissions currently pending your review and approval decision.",
            how: "Counts all submissions with status 'Pending Approval' assigned to locations you manage. Overdue means >48h since submission.",
            formula: "COUNT(status = pending_approval)",
            flag: "Red when any submission is overdue (>48h SLA). Amber when pending but within SLA.",
          }}
        />
        <KpiCard
          label="Approved"
          value={approvedCount}
          sub={dateRangeLabel}
          accent="var(--g7)"
          tooltip={{
            what: "Submissions you approved in the selected period.",
            how: "Counts submissions with status 'Approved' within the date range shown below the value.",
            formula: "COUNT(status = approved in period)",
          }}
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          sub={dateRangeLabel}
          accent={rejectedCount > 0 ? 'var(--red)' : 'var(--td)'}
          tooltip={{
            what: "Submissions you rejected in the selected period.",
            how: "Submissions returned to the operator with a rejection reason. Operator must correct and resubmit.",
            formula: "COUNT(status = rejected in period)",
          }}
        />
        <KpiCard
          label="Avg Variance"
          value={avgVariance !== null ? `${avgVariance.toFixed(2)}%` : '—'}
          sub={dateRangeLabel}
          accent={avgVariance !== null ? varColor(avgVariance) : 'var(--ts)'}
          highlight={avgVariance !== null && avgVariance > 5 ? 'red' : avgVariance !== null && avgVariance > 2 ? 'amber' : false}
          tooltip={{
            what: "Average absolute variance percentage across submissions in the selected period.",
            how: "Sums the absolute variance % of every submission in the period and divides by count.",
            formula: "Σ|variancePct| ÷ COUNT(submissions in period)",
            flag: "Amber >2%, red >5%. Consistently high values suggest a systemic cash handling issue.",
          }}
        />
      </div>

      {/* ── Filter bar ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>

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
            const loc = apiLocations.find(l => l.id === id) || getLocation(id)
            const cc = (loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'
            return (
              <option key={id} value={id}>
                {loc?.name ?? id} (CC: {cc})
              </option>
            )
          })}
        </select>

        {/* Divider */}
        <div style={{ width: 1, height: 28, background: 'var(--ow2)' }} />

        {/* Status filter chips */}
        {([
          { id: 'all'              as StatusFilter, label: `All (${chipCounts.all})` },
          { id: 'pending_approval' as StatusFilter, label: `⏳ Pending (${chipCounts.pending_approval})` },
          { id: 'approved'         as StatusFilter, label: `✅ Approved (${chipCounts.approved})` },
          { id: 'rejected'         as StatusFilter, label: `❌ Rejected (${chipCounts.rejected})` },
        ]).map(f => (
          <button key={f.id} onClick={() => setStatusFilter(f.id)} style={{
            padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500,
            cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
            border: `1px solid ${statusFilter === f.id ? 'var(--g4)' : 'var(--ow2)'}`,
            background: statusFilter === f.id ? 'var(--g7)' : '#fff',
            color: statusFilter === f.id ? '#fff' : 'var(--tm)',
          }}>
            {f.label}
          </button>
        ))}

        {/* Date range (right-aligned) */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([
            { id: '7d'  as DateRange, label: 'Last 7 days' },
            { id: '30d' as DateRange, label: 'Last 30 days' },
            { id: 'all' as DateRange, label: 'All time' },
          ]).map(r => (
            <button key={r.id} onClick={() => setDateRange(r.id)} style={{
              padding: '6px 14px', borderRadius: 6, fontSize: 12,
              cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              border: `1px solid ${dateRange === r.id ? 'var(--g4)' : 'var(--ow2)'}`,
              background: dateRange === r.id ? 'var(--g7)' : '#fff',
              color: dateRange === r.id ? '#fff' : 'var(--tm)',
            }}>
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Submissions table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {statusFilter === 'all'      ? 'All Submissions'
           : statusFilter === 'pending_approval'  ? 'Awaiting Approval'
           : statusFilter === 'approved' ? 'Approved Submissions'
           : 'Rejected Submissions'}
          </span>
          <span className="card-sub">
            {rows.length} {statusFilter === 'all' ? 'entries' : statusFilter}
            {rows.length > PAGE_SIZE && ` · page ${page + 1} of ${totalPages}`}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>

          {rows.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>
                {statusFilter === 'pending_approval' ? '✅' : '📭'}
              </div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>
                {statusFilter === 'pending_approval' ? 'All caught up!' : 'Nothing to show'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--ts)' }}>
                {statusFilter === 'pending_approval'
                  ? 'No submissions are waiting for your approval.'
                  : `No ${statusFilter === 'all' ? '' : statusFilter + ' '}submissions found for ${dateRangeLabel}.`}
              </div>
            </div>
          ) : (
            <table className="dt" style={{ tableLayout: 'fixed', width: '100%' }}>
              <colgroup>
                <col style={{ width: '16%' }} />
                <col style={{ width: '15%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '14%' }} />
                <col style={{ width: '13%' }} />
                <col style={{ width: '16%' }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Operator</th>
                  <th>Submitted</th>
                  <th>For Date</th>
                  <th style={{ textAlign: 'right' }}>Total Cash</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th>Status / Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(sub => {
                  const loc     = apiLocations.find(l => l.id === sub.locationId)
                  const eff     = effectiveStatus(sub)
                  const isOver  = eff === 'pending_approval' && Date.now() - new Date(sub.submittedAt).getTime() > 48 * 3600000
                  const review  = eff === 'pending_approval' ? null : (reviews[sub.id] ?? null)

                  const expCash = sub.expectedCash || loc?.expected_cash || 0
                  const calcVariance = sub.totalCash - expCash
                  const calcVariancePct = expCash > 0 ? (calcVariance / expCash) * 100 : 0

                  function goReview() {
                    onNavigate('op-readonly', {
                      locationId: sub.locationId, date: sub.date,
                      submissionId: sub.id, fromPanel: 'mgr-approvals',
                      reviewedBy: managerName,
                    })
                  }

                  return (
                    <Fragment key={sub.id}>
                      <tr style={{ background: isOver ? 'var(--red-bg)' : undefined }}>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? sub.locationId}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'monospace' }}>CC: {(loc as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (loc as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'}</div>
                        </td>
                        <td style={{ fontSize: 13 }}>{sub.operatorName}</td>
                        <td>
                          <div style={{ fontSize: 13 }}>{timeAgo(sub.submittedAt)}</div>
                          {isOver && <div style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>⚠️ Overdue</div>}
                        </td>
                        <td style={{ fontSize: 13 }}>
                          {new Date(sub.date + 'T12:00:00').toLocaleDateString('en-GB', {
                            weekday: 'short', day: 'numeric', month: 'short',
                          })}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                          {formatCurrency(sub.totalCash)}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <span style={{ color: varColor(calcVariancePct), fontWeight: 500, fontSize: 13 }}>
                            {calcVariance >= 0 ? '+' : ''}{formatCurrency(calcVariance)}
                          </span>
                          <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                            ({calcVariancePct >= 0 ? '+' : ''}{calcVariancePct.toFixed(2)}%)
                          </div>
                        </td>
                        <td>
                          {review ? (
                            // Has a completed review — show badge + action button
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                {review.outcome === 'approved'
                                  ? <span className="badge badge-green"><span className="bdot" />Approved</span>
                                  : <span className="badge badge-red"><span className="bdot" />Rejected</span>}
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                                  onClick={goReview}>
                                  View →
                                </button>
                              </div>
                              {review.outcome === 'rejected' && (() => {
                                const rejSecs = SECTIONS.filter(k => review.sections[k]?.decision === 'reject')
                                return rejSecs.length > 0 ? (
                                  <div style={{ fontSize: 11, color: 'var(--red)', maxWidth: 220 }}>
                                    {/* {rejSecs.map(k => (
                                       <span key={k} title={review.sections[k]?.note}
                                        style={{ marginRight: 6, cursor: review.sections[k]?.note ? 'help' : 'default' }}>
                                        §{k}{review.sections[k]?.note ? '*' : ''}
                                      </span>
                                    ))}
                                     <span style={{ color: 'var(--ts)', fontStyle: 'italic' }}>(hover for notes)</span> */}
                                  </div>
                                ) : null
                              })()}
                            </div>
                          ) : eff === 'pending_approval' ? (
                            // No review yet — show Complete Review button
                            <button className="btn btn-primary" style={{ fontSize: 12, padding: '5px 16px' }}
                              onClick={goReview}>
                              📋 Complete Review
                            </button>
                          ) : eff === 'approved' ? (
                            // Approved in data (no local review)
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <span className="badge badge-green"><span className="bdot" />Approved</span>
                              <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={goReview}>View →</button>
                            </div>
                          ) : (
                            // Rejected in data (no local review)
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <span className="badge badge-red"><span className="bdot" />Rejected</span>
                                <button className="btn btn-ghost" style={{ fontSize: 11, padding: '4px 10px' }}
                                  onClick={goReview}>View →</button>
                              </div>
                              {sub.rejectionReason && (
                                <div style={{ fontSize: 11, color: 'var(--red)', maxWidth: 200 }}
                                  title={sub.rejectionReason}>
                                  {sub.rejectionReason.slice(0, 60)}{sub.rejectionReason.length > 60 ? '…' : ''}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
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
                Showing {fromEntry}–{toEntry} of {rows.length} entries
              </span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button
                  className="btn btn-ghost"
                  style={{ fontSize: 12, padding: '4px 12px' }}
                  disabled={page === 0}
                  onClick={() => goToPage(page - 1)}
                >← Prev</button>
                {pageNums(page, totalPages).map((n, i) =>
                  n === 'gap' ? (
                    <span key={`gap-${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>…</span>
                  ) : (
                    <button
                      key={n}
                      onClick={() => goToPage(n)}
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
                  onClick={() => goToPage(page + 1)}
                >Next →</button>
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
