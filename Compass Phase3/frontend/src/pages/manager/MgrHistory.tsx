import { useState, useMemo, useEffect } from 'react'
import { SUBMISSIONS, getLocation, formatCurrency } from '../../mock/data'
import type { Submission } from '../../mock/data'
import { listSubmissions } from '../../api/submissions'
import type { ApiSubmission } from '../../api/types'
import KpiCard from '../../components/KpiCard'

function mapApiSub(s: ApiSubmission): Submission {
  return {
    id:               s.id,
    locationId:       s.location_id,
    operatorName:     s.operator_name,
    date:             s.submission_date,
    status:           s.status,
    source:           s.source,
    totalCash:        s.total_cash,
    expectedCash:     s.expected_cash,
    variance:         s.variance,
    variancePct:      s.variance_pct,
    submittedAt:      s.submitted_at ?? s.created_at,
    varianceException: s.variance_exception,
    varianceNote:     s.variance_note ?? undefined,
    approvedBy:       s.approved_by_name ?? undefined,
    rejectionReason:  s.rejection_reason ?? undefined,
    sections:         { A:0, B:0, C:0, D:0, E:0, F:0, G:0, H:0, I:0 },
  }
}

interface Props {
  managerName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

type StatusFilter = 'all' | 'approved' | 'rejected'
type DateRange    = '7d'  | '30d' | 'all'

const varColor = (pct: number) =>
  Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)'

function timeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h  = Math.floor(ms / 3600000)
  const d  = Math.floor(h / 24)
  if (d >= 1) return `${d}d ago`
  if (h >= 1) return `${h}h ago`
  return 'just now'
}

export default function MgrHistory({ managerName, locationIds, onNavigate }: Props) {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [dateRange,    setDateRange]    = useState<DateRange>('30d')
  const [apiSubs,      setApiSubs]      = useState<Submission[]>([])

  useEffect(() => {
    Promise.all(locationIds.map(id =>
      listSubmissions({ location_id: id, page_size: 100 })
        .then(r => r.items.map(mapApiSub))
        .catch(() => [] as Submission[])
    )).then(arrays => setApiSubs(arrays.flat()))
  }, [locationIds])

  const cutoff = useMemo(() => {
    // eslint-disable-next-line react-hooks/purity
    if (dateRange === '7d')  return Date.now() - 7  * 86400000
    // eslint-disable-next-line react-hooks/purity
    if (dateRange === '30d') return Date.now() - 30 * 86400000
    return 0
  }, [dateRange])

  const sourceSubs = apiSubs.length > 0 ? apiSubs : SUBMISSIONS

  // All actioned (approved/rejected) subs for this manager's locations within date range
  const allActioned = useMemo(() =>
    sourceSubs.filter(s =>
      locationIds.includes(s.locationId) &&
      (s.status === 'approved' || s.status === 'rejected') &&
      new Date(s.submittedAt).getTime() >= cutoff
    ).sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime()),
  [locationIds, cutoff, sourceSubs])

  const rows = statusFilter === 'all'
    ? allActioned
    : allActioned.filter(s => s.status === statusFilter)

  const approvedCount = allActioned.filter(s => s.status === 'approved').length
  const rejectedCount = allActioned.filter(s => s.status === 'rejected').length
  const avgVariance   = allActioned.length > 0
    ? allActioned.reduce((sum, s) => sum + Math.abs(s.variancePct), 0) / allActioned.length
    : 0

  const dateRangeLabel = dateRange === '7d' ? 'last 7 days' : dateRange === '30d' ? 'last 30 days' : 'all time'

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Approval History</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            All actioned submissions across your {locationIds.length} locations
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('mgr-approvals')}>
            ← Pending Approvals
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Total Actioned"
          value={allActioned.length}
          sub={dateRangeLabel}
          tooltip={{
            what: "Total number of submissions you approved or rejected in the selected period.",
            how: "Counts all submissions where you took a decision (approved or rejected) within the date range.",
            formula: "COUNT(approved) + COUNT(rejected)",
          }}
        />
        <KpiCard
          label="Approved"
          value={approvedCount}
          sub={allActioned.length > 0 ? `${Math.round(approvedCount / allActioned.length * 100)}%` : '—'}
          accent="var(--g7)"
          tooltip={{
            what: "Number of submissions you approved in the period.",
            how: "Submissions marked 'Approved' by this manager. The percentage below shows the approval rate.",
            formula: "COUNT(status = approved)",
            flag: "High rejection rates may indicate recurring operator errors.",
          }}
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          sub={allActioned.length > 0 ? `${Math.round(rejectedCount / allActioned.length * 100)}%` : '—'}
          accent={rejectedCount > 0 ? 'var(--red)' : 'var(--td)'}
          tooltip={{
            what: "Number of submissions you rejected in the period.",
            how: "Submissions returned to the operator with a rejection reason. Operators must resubmit after correcting the issue.",
            formula: "COUNT(status = rejected)",
          }}
        />
        <KpiCard
          label="Avg Variance"
          value={allActioned.length > 0 ? `${avgVariance.toFixed(2)}%` : '—'}
          accent={avgVariance > 5 ? 'var(--red)' : avgVariance > 2 ? 'var(--amb)' : 'var(--g7)'}
          tooltip={{
            what: "Average absolute variance percentage across all submissions you actioned.",
            how: "Sums the absolute variance % of every actioned submission and divides by total count.",
            formula: "Σ|variancePct| ÷ COUNT(actioned)",
            flag: "Amber >2%, red >5%. Consistently high values suggest a location-level cash handling issue.",
          }}
        />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        {/* Status filter chips */}
        {([
          { id: 'all'      as StatusFilter, label: `All (${allActioned.length})` },
          { id: 'approved' as StatusFilter, label: `✅ Approved (${approvedCount})` },
          { id: 'rejected' as StatusFilter, label: `❌ Rejected (${rejectedCount})` },
        ]).map(f => (
          <button
            key={f.id}
            onClick={() => setStatusFilter(f.id)}
            style={{
              padding: '6px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
              border: `1px solid ${statusFilter === f.id ? 'var(--g4)' : 'var(--ow2)'}`,
              background: statusFilter === f.id ? 'var(--g7)' : '#fff',
              color: statusFilter === f.id ? '#fff' : 'var(--tm)',
              fontFamily: 'inherit', transition: 'all 0.15s',
            }}
          >
            {f.label}
          </button>
        ))}

        {/* Date range filter */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          {([
            { id: '7d'  as DateRange, label: 'Last 7 days' },
            { id: '30d' as DateRange, label: 'Last 30 days' },
            { id: 'all' as DateRange, label: 'All time' },
          ]).map(r => (
            <button
              key={r.id}
              onClick={() => setDateRange(r.id)}
              style={{
                padding: '6px 14px', borderRadius: 6, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${dateRange === r.id ? 'var(--g4)' : 'var(--ow2)'}`,
                background: dateRange === r.id ? 'var(--g7)' : '#fff',
                color: dateRange === r.id ? '#fff' : 'var(--tm)',
                fontFamily: 'inherit', transition: 'all 0.15s',
              }}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── History table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {statusFilter === 'all'      ? 'All Actioned Submissions'
           : statusFilter === 'approved' ? 'Approved Submissions'
           : 'Rejected Submissions'}
          </span>
          <span className="card-sub">{rows.length} {statusFilter === 'all' ? 'entries' : statusFilter} · {dateRangeLabel}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div style={{ padding: '40px 32px', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              No {statusFilter === 'all' ? 'actioned' : statusFilter} submissions found for {dateRangeLabel}.
            </div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Location</th>
                  <th>Operator</th>
                  <th>For Date</th>
                  <th style={{ textAlign: 'right' }}>Total Cash</th>
                  <th style={{ textAlign: 'right' }}>Variance</th>
                  <th>Status</th>
                  <th>Actioned By</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {rows.map(sub => {
                  const loc = getLocation(sub.locationId)
                  return (
                    <tr
                      key={sub.id}
                      style={{ cursor: 'pointer' }}
                      onClick={() => onNavigate('op-readonly', {
                        locationId: sub.locationId, date: sub.date, submissionId: sub.id,
                      })}
                    >
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? sub.locationId}</div>
                        <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'monospace' }}>{sub.locationId}</div>
                      </td>
                      <td style={{ fontSize: 13 }}>{sub.operatorName}</td>
                      <td style={{ fontSize: 13 }}>
                        {new Date(sub.date + 'T12:00:00').toLocaleDateString('en-GB', {
                          weekday: 'short', day: 'numeric', month: 'short',
                        })}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                        {formatCurrency(sub.totalCash)}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ color: varColor(sub.variancePct), fontWeight: 500, fontSize: 13 }}>
                          {sub.variance >= 0 ? '+' : ''}{formatCurrency(sub.variance)}
                        </span>
                        <div style={{ fontSize: 11, color: 'var(--ts)' }}>
                          ({sub.variancePct >= 0 ? '+' : ''}{sub.variancePct.toFixed(2)}%)
                        </div>
                      </td>
                      <td>
                        {sub.status === 'approved' ? (
                          <span className="badge badge-green"><span className="bdot"></span>Approved</span>
                        ) : (
                          <>
                            <span className="badge badge-red"><span className="bdot"></span>Rejected</span>
                            {sub.rejectionReason && (
                              <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, maxWidth: 180 }}
                                title={sub.rejectionReason}>
                                {sub.rejectionReason.length > 55
                                  ? sub.rejectionReason.slice(0, 55) + '…'
                                  : sub.rejectionReason}
                              </div>
                            )}
                          </>
                        )}
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: 'var(--td)', fontWeight: 500 }}>
                          {sub.approvedBy ?? managerName}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--ts)' }}>{timeAgo(sub.submittedAt)}</div>
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={e => {
                            e.stopPropagation()
                            onNavigate('op-readonly', { locationId: sub.locationId, date: sub.date, submissionId: sub.id })
                          }}
                        >
                          View →
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  )
}
