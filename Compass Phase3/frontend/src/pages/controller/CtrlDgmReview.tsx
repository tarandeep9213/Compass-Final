import { useState, useMemo, useEffect, Fragment } from 'react'
import { VERIFICATIONS, VERIFICATION_REVIEWS, getLocation, todayStr } from '../../mock/data'
import type { VerificationRecord, VerificationReview } from '../../mock/data'
import { listDgmVerifications } from '../../api/verifications'
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

const SECTIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const
const PAGE_SIZE = 10

type TimeFilter = 'today' | 'week' | 'month' | 'all'

interface Props {
  controllerName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function CtrlDgmReview({ locationIds }: Props) {
  const today = todayStr()

  const [locationFilter, setLocationFilter] = useState('all')
  const [timeFilter,     setTimeFilter]     = useState<TimeFilter>('month')
  const [page,           setPage]           = useState(0)
  const [expandedId,     setExpandedId]     = useState<string | null>(null)

  const [apiVerifs, setApiVerifs] = useState<VerificationRecord[]>([])
  useEffect(() => {
    listDgmVerifications()
      .then(r => setApiVerifs(r.items.map(mapApiVerification).filter(v => locationIds.includes(v.locationId))))
      .catch(() => { /* fall back to mock */ })
  }, [locationIds.join(',')]) // eslint-disable-line react-hooks/exhaustive-deps

  // Reviews — read from persistent store (read-only; DGM updates these when completing visits)
  const [verifReviews] = useState<Record<string, VerificationReview>>(
    () => ({ ...VERIFICATION_REVIEWS })
  )

  const pastVisits = useMemo(() => {
    // 1. Read DGM session updates to get the latest statuses (Completed/Missed)
    let dgmUpdates: Record<string, { status: string; notes?: string; observedTotal?: number }> = {}
    try {
      const saved = sessionStorage.getItem('dgm_session_updates')
      if (saved) dgmUpdates = JSON.parse(saved)
    } catch { /* ignore */ }

    // 2. Enforce Controller locations
    const baseSource = apiVerifs.length > 0
      ? apiVerifs
      : VERIFICATIONS.filter(v => v.type === 'dgm' && locationIds.includes(v.locationId))

    return baseSource
      .map(v => {
        const upd = dgmUpdates[v.id]
        if (!upd) return v
        return { 
          ...v, 
          status: upd.status,
          notes: upd.notes ?? v.notes,
          observedTotal: upd.observedTotal !== undefined ? upd.observedTotal : v.observedTotal
        }
      })
      // 3. Requirement: Only show records for current to previous dates (date <= today)
      // 4. Exclude cancelled visits, but allow scheduled/completed/missed to be reviewed
      .filter(v => v.date <= today && v.status !== 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [apiVerifs, locationIds, today])

  // Time range boundaries
  const weekStart = useMemo(() => {
    const d = new Date(today + 'T12:00:00')
    d.setDate(d.getDate() - 6)
    return d.toISOString().split('T')[0]
  }, [today])

  const monthStart = today.slice(0, 7) + '-01'

  // Filtered rows
  const rows = useMemo(() => {
    let r = pastVisits
    if (locationFilter !== 'all') r = r.filter(v => v.locationId === locationFilter)
    if (timeFilter === 'today')   r = r.filter(v => v.date === today)
    if (timeFilter === 'week')    r = r.filter(v => v.date >= weekStart)
    if (timeFilter === 'month')   r = r.filter(v => v.date >= monthStart)
    return r
  }, [pastVisits, locationFilter, timeFilter, today, weekStart, monthStart])

  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { setPage(0); setExpandedId(null) }, [locationFilter, timeFilter])

  // KPIs (dynamically updated based on active time and location filters)
  const totalCompleted  = rows.filter(v => v.status === 'completed').length
  const totalMissed     = rows.filter(v => v.status === 'missed').length
  const totalScheduled  = rows.filter(v => v.status === 'scheduled').length
  const reviewedCount   = rows.filter(v => verifReviews[v.id]).length
  const rejectedCount   = rows.filter(v => verifReviews[v.id]?.outcome === 'rejected').length

  // Pagination
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageRows   = rows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromEntry  = rows.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toEntry    = Math.min((page + 1) * PAGE_SIZE, rows.length)

  function toggleExpand(id: string) {
    setExpandedId(prev => prev === id ? null : id)
  }

  const timeLabels: Record<TimeFilter, string> = {
    today: 'Today', week: 'Last 7 Days', month: 'This Month', all: 'All Time',
  }

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Review DGM Visits</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            DGM visit history across your {locationIds.length} location{locationIds.length !== 1 ? 's' : ''}
          </p>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-row" style={{ marginBottom: 20, position: 'relative', zIndex: 10, overflow: 'visible' }}>
        <KpiCard
          label="Completed Visits"
          value={totalCompleted}
          sub="all time"
          tooltipAlign="left"
          tooltip={{
            what: "Total DGM visits completed across your assigned locations.",
            how: "Counts all DGM verifications with status 'Completed' dated on or before today.",
            formula: "COUNT(dgm visits where status = completed AND date ≤ today)",
          }}
        />
        <KpiCard
          label="Scheduled"
          value={totalScheduled}
          sub="up to today"
          highlight={totalScheduled > 0 ? "amber" : "gray"}
          tooltip={{
            what: "DGM visits that are scheduled for today or earlier but not yet marked completed/missed.",
            how: "Counts all DGM verifications with status 'Scheduled' dated on or before today.",
            formula: "COUNT(dgm visits where status = scheduled AND date ≤ today)",
          }}
        />
        <KpiCard
          label="Missed Visits"
          value={totalMissed}
          sub="all time"
          accent={totalMissed > 0 ? 'var(--red)' : 'var(--g7)'}
          highlight={totalMissed > 0 ? 'amber' : false}
          tooltip={{
            what: "DGM visits that were scheduled but not completed.",
            how: "Counts all DGM verifications with status 'Missed' dated on or before today.",
            formula: "COUNT(dgm visits where status = missed AND date ≤ today)",
            flag: "Amber when any missed visits exist.",
          }}
        />
        <KpiCard
          label="Section Reviews"
          value={reviewedCount}
          sub={`of ${totalCompleted} completed`}
          tooltip={{
            what: "Completed visits that have a section-level review recorded by the DGM.",
            how: "Counts completed visits that have an entry in the section review store.",
            formula: "COUNT(completed visits with a saved section review)",
          }}
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          sub="section reviews"
          accent={rejectedCount > 0 ? 'var(--red)' : 'var(--g7)'}
          highlight={rejectedCount > 0 ? 'red' : false}
          tooltipAlign="right" // FIX: Align right to prevent clipping at the screen edge
          tooltip={{
            what: "Visits where one or more sections were rejected during the DGM section review.",
            how: "Counts visits where the review outcome is 'rejected'.",
            formula: "COUNT(visits where review.outcome = rejected)",
            flag: "Red when any rejected visits exist — review the section breakdown.",
          }}
        />
      </div>

      {/* ── Filters ── */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>

        {/* Time filter chips */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {(['today', 'week', 'month', 'all'] as const).map(t => {
            const active = timeFilter === t
            return (
              <button
                key={t}
                onClick={() => setTimeFilter(t)}
                style={{
                  padding: '6px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600,
                  cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.12s',
                  border: active ? '2px solid var(--g4)' : '1px solid var(--ow2)',
                  background: active ? 'var(--g7)' : '#fff',
                  color: active ? '#fff' : 'var(--tm)',
                }}
              >
                {timeLabels[t]}
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
            return <option key={id} value={id} style={{ background: '#fff', color: 'var(--td)' }}>{loc?.name ?? id}</option>
          })}
        </select>
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">DGM Visit History</span>
          <span className="card-sub">
            {rows.length} record{rows.length !== 1 ? 's' : ''}
            {timeFilter   !== 'all' ? ` · ${timeLabels[timeFilter]}` : ''}
            {locationFilter !== 'all' ? ` · ${getLocation(locationFilter)?.name ?? locationFilter}` : ''}
            {rows.length > PAGE_SIZE ? ` · page ${page + 1} of ${totalPages}` : ''}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>📋</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No visits found</div>
              <div style={{ fontSize: 13, color: 'var(--ts)' }}>
                No DGM past visits match the selected filters.
              </div>
            </div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Location</th>
                  <th>DGM Name</th>
                  <th>Status</th>
                  <th>Review Outcome</th>
                  <th>Notes / Reason</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(v => {
                  const loc       = getLocation(v.locationId)
                  const review    = verifReviews[v.id]
                  const isExpanded = expandedId === v.id
                  const dateLabel = new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })

                  return (
                    <Fragment key={v.id}>
                      <tr style={{
                        background: isExpanded ? (review?.outcome === 'rejected' ? '#fff5f5' : 'var(--g0)') : undefined,
                        borderLeft: isExpanded ? `3px solid ${review?.outcome === 'rejected' ? 'var(--red)' : 'var(--g4)'}` : undefined,
                      }}>

                        {/* Date */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{dateLabel}</div>
                        </td>

                        {/* Location */}
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? v.locationId}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'monospace' }}>{v.locationId}</div>
                        </td>

                        {/* DGM Name */}
                        <td style={{ fontSize: 13 }}>{v.verifierName || <span style={{ color: 'var(--wg)' }}>—</span>}</td>

                        {/* Status */}
                        <td>
                          {v.status === 'completed' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)' }}>✅ Completed</span>
                          ) : v.status === 'scheduled' ? (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>📅 Scheduled</span>
                          ) : (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #fca5a5' }}>❌ Missed</span>
                          )}
                        </td>

                        {/* Review Outcome */}
                        <td>
                          {review ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span className={`badge ${review.outcome === 'approved' ? 'badge-green' : 'badge-red'}`}>
                                <span className="bdot" />{review.outcome}
                              </span>
                              {review.outcome === 'rejected' && (() => {
                                const rejSecs = SECTIONS.filter(k => review.sections[k]?.decision === 'reject')
                                return rejSecs.length > 0 ? (
                                  <div style={{ fontSize: 11, color: 'var(--red)' }}>
                                    {rejSecs.map(k => (
                                      <span
                                        key={k}
                                        title={review.sections[k]?.note || `Section ${k} rejected`}
                                        style={{ marginRight: 3, cursor: 'help', textDecoration: 'underline dotted' }}
                                      >§{k}*</span>
                                    ))}
                                  </div>
                                ) : null
                              })()}
                            </div>
                          ) : v.status === 'completed' ? (
                            <span style={{ fontSize: 11, color: 'var(--amb)', fontStyle: 'italic' }}>Pending review</span>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                          )}
                        </td>

                        {/* Notes / Reason */}
                        <td style={{ fontSize: 12, maxWidth: 220 }}>
                          {v.missedReason ? (
                            <span style={{ color: 'var(--red)', fontSize: 11 }}>
                              {v.missedReason.length > 50 ? v.missedReason.slice(0, 50) + '…' : v.missedReason}
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
                          {review ? (
                            <button
                              className={`btn btn-ghost${isExpanded ? ' active' : ''}`}
                              style={{ fontSize: 11, padding: '3px 10px' }}
                              onClick={() => toggleExpand(v.id)}
                            >
                              {isExpanded ? 'Close ↑' : 'View →'}
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                          )}
                        </td>
                      </tr>

                      {/* ── Inline: Section Review Breakdown ── */}
                      {isExpanded && review && (
                        <tr>
                          <td colSpan={7} style={{ padding: 0, borderBottom: '1px solid var(--ow2)' }}>
                            <div style={{
                              background: review.outcome === 'approved' ? 'var(--g0)' : '#fff5f5',
                              borderLeft: `4px solid ${review.outcome === 'approved' ? 'var(--g4)' : 'var(--red)'}`,
                              padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 14,
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <div style={{ fontWeight: 700, fontSize: 13, color: review.outcome === 'approved' ? 'var(--g8)' : 'var(--red)' }}>
                                  Section Review — {loc?.name ?? v.locationId}
                                  <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--ts)', marginLeft: 10 }}>{dateLabel}</span>
                                </div>
                                <span className={`badge ${review.outcome === 'approved' ? 'badge-green' : 'badge-red'}`}>
                                  <span className="bdot" />{review.outcome}
                                </span>
                              </div>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12, border: '1px solid var(--ow2)' }}>
                                <thead>
                                  <tr style={{ background: 'var(--g1)' }}>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--g8)', width: 70 }}>Section</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'var(--g8)', width: 100 }}>Decision</th>
                                    <th style={{ padding: '6px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--g8)' }}>Note</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {SECTIONS.map(k => {
                                    const sec = review.sections[k]
                                    return (
                                      <tr key={k} style={{
                                        borderTop: '1px solid var(--ow2)',
                                        background: sec?.decision === 'reject' ? '#fff5f5' : sec?.decision === 'accept' ? '#f0fdf4' : undefined,
                                      }}>
                                        <td style={{ padding: '7px 12px', fontWeight: 700, fontSize: 13 }}>§{k}</td>
                                        <td style={{ padding: '7px 12px', textAlign: 'center' }}>
                                          {sec?.decision === 'accept' ? (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--g7)', background: 'var(--g0)', border: '1px solid var(--g2)', padding: '2px 10px', borderRadius: 12 }}>Accept</span>
                                          ) : sec?.decision === 'reject' ? (
                                            <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--red)', background: '#fff5f5', border: '1px solid #fca5a5', padding: '2px 10px', borderRadius: 12 }}>Reject</span>
                                          ) : (
                                            <span style={{ fontSize: 11, color: 'var(--wg)' }}>—</span>
                                          )}
                                        </td>
                                        <td style={{ padding: '7px 12px', fontSize: 12, color: sec?.decision === 'reject' ? 'var(--red)' : 'var(--ts)' }}>
                                          {sec?.note || <span style={{ color: 'var(--wg)' }}>—</span>}
                                        </td>
                                      </tr>
                                    )
                                  })}
                                </tbody>
                              </table>
                              <span style={{ fontSize: 11, color: 'var(--ts)' }}>
                                Reviewed by <strong>{review.reviewedBy}</strong> on{' '}
                                {new Date(review.reviewedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                              </span>
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

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
              <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromEntry}–{toEntry} of {rows.length} records</span>
              <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                {Array.from({ length: totalPages }, (_, i) => i).map(n => (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      width: 30, height: 30, borderRadius: 6, fontSize: 12,
                      cursor: 'pointer', fontFamily: 'inherit',
                      fontWeight: page === n ? 700 : 400,
                      border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`,
                      background: page === n ? 'var(--g7)' : '#fff',
                      color: page === n ? '#fff' : 'var(--tm)',
                    }}
                  >{n + 1}</button>
                ))}
                <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
              </div>
            </div>
          )}

        </div>
      </div>

    </div>
  )
}
