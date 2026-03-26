import { useState, useMemo, useEffect } from 'react'
import {
  SUBMISSIONS, DRAFTS, formatCurrency, IMPREST, todayStr, EXPLAINED_MISSED,
} from '../../mock/data'
import type { Submission } from '../../mock/data'
import { listSubmissions } from '../../api/submissions'
import { listLocations } from '../../api/locations'
import type { ApiSubmission, ApiLocation } from '../../api/types'
import KpiCard from '../../components/KpiCard'

function mapApiSub(s: ApiSubmission): Submission {
  const forceUTC = (d?: string | null) => (d && !d.endsWith('Z') && !/[+-]\d{2}:\d{2}$/.test(d) ? d + 'Z' : d);
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
    submittedAt: forceUTC(s.submitted_at ?? s.created_at) as string,
    approvedBy: s.approved_by ?? undefined,
    approvedByName: s.approved_by_name ?? undefined,
    rejectionReason: s.rejection_reason ?? undefined,
    sections: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 },
    varianceException: s.variance_exception,
    varianceNote: s.variance_note ?? undefined,
  }
}

interface Props {
  locationIds: string[]
  userName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

type FilterType = 'all' | 'pending_approval' | 'rejected' | 'missing' | 'approved'

// Generate the last N days as YYYY-MM-DD strings (using safe local time to avoid timezone shifts)
function lastNDays(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date()
    d.setDate(d.getDate() - i)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  })
}

function friendlyDate(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00')
  const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
  const yYear = yesterday.getFullYear()
  const yMonth = String(yesterday.getMonth() + 1).padStart(2, '0')
  const yDay = String(yesterday.getDate()).padStart(2, '0')
  const yesterdayStr = `${yYear}-${yMonth}-${yDay}`
  
  if (dateStr === todayStr()) return 'Today'
  if (dateStr === yesterdayStr) return 'Yesterday'
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function greeting(name: string): string {
  const h = new Date().getHours()
  const first = name.split(' ')[0]
  if (h < 12) return `Good morning, ${first}`
  if (h < 17) return `Good afternoon, ${first}`
  return `Good evening, ${first}`
}

export default function OpStart({ locationIds, userName, onNavigate }: Props) {
  const locationId = locationIds[0] ?? ''
  const [location, setLocation] = useState<ApiLocation | null>(null)
  const [filter, setFilter] = useState<FilterType>('all')
  const [jumpDate, setJumpDate] = useState('')
  const [page, setPage] = useState(0)
  const [fetchError, setFetchError] = useState('')
  const PAGE_SIZE = 10

  // Fetch location details from API to get cost_center and other live data
  useEffect(() => {
    if (!locationId) return
    listLocations().then(locs => {
      const found = locs.find(l => l.id === locationId) ?? null
      setLocation(found)
    }).catch(() => { /* keep null */ })
  }, [locationId])

  // API-fetched submissions — overlay over mock data when available
  const [apiSubs, setApiSubs] = useState<Submission[]>([])
  useEffect(() => {
    if (!locationId) return
    // Lowered page_size to 100 to pass backend validation limits
    listSubmissions({ location_id: locationId, page_size: 100 })
      .then(r => { setApiSubs(r.items.map(mapApiSub)); setFetchError(''); })
      .catch(() => { setFetchError('Could not reach the server. Make sure the backend is running on port 8000.'); })
  }, [locationId])

  // Reset to page 0 whenever filter changes
  useEffect(() => { setPage(0) }, [filter])

  const sourceSubs = useMemo(() => {
    if (apiSubs.length === 0) return SUBMISSIONS
    // Include any mock-only entries (e.g. submitted via fallback when API was unreachable)
    const apiIds = new Set(apiSubs.map(s => s.id))
    const mockOnly = SUBMISSIONS.filter(s => !apiIds.has(s.id))
    return mockOnly.length > 0 ? [...apiSubs, ...mockOnly] : apiSubs
  }, [apiSubs])

  // ── Today ──────────────────────────────────────────────────────────────
  const todaySub = sourceSubs.find(s => s.locationId === locationId && s.date === todayStr())
  const todayDraft = DRAFTS.find(d => d.locationId === locationId && d.date === todayStr())
  const todaySubmitted = !!todaySub

  // ── Build history rows (last 90 days, including today) ──
  const last30 = lastNDays(90)

  interface HistoryRow {
    date: string
    type: 'pending_approval' | 'approved' | 'rejected' | 'missing'
    sub?: Submission
    explained?: boolean
  }

  const historyRows: HistoryRow[] = useMemo(() => {
    const locationSubs = sourceSubs.filter(s => s.locationId === locationId && s.status !== 'draft')
    // Only show history from the date of the first real submission onwards
    const firstSubDate = locationSubs.length > 0
      ? locationSubs.reduce((min, s) => s.date < min ? s.date : min, locationSubs[0].date)
      : null

    return last30
      .filter(date => firstSubDate !== null && date >= firstSubDate)
      .map(date => {
        const sub = sourceSubs.find(s => s.locationId === locationId && s.date === date)
        const explained = EXPLAINED_MISSED.has(`${locationId}|${date}`)
        if (sub) {
          // Past-date drafts = not submitted. The day has passed so it cannot be resumed.
          // Treat the same as a missing day — operator must explain the absence.
          if (sub.status === 'draft') return { date, type: 'missing' as const, explained }
          return { date, type: sub.status as 'pending_approval' | 'approved' | 'rejected', sub }
        }
        return { date, type: 'missing' as const, explained }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationId, sourceSubs])

  // ── Filter counts ───────────────────────────────────────────────────────
  const counts = useMemo(() => ({
    all:              historyRows.length,
    pending_approval: historyRows.filter(r => r.type === 'pending_approval').length,
    approved:         historyRows.filter(r => r.type === 'approved').length,
    rejected:         historyRows.filter(r => r.type === 'rejected').length,
    missing:          historyRows.filter(r => r.type === 'missing').length,
  }), [historyRows])

  const filtered = filter === 'all' ? historyRows : historyRows.filter(r => r.type === filter)
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paginated = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  // ── Handlers ────────────────────────────────────────────────────────────
  function handleRowClick(row: HistoryRow) {
    if (row.type === 'missing') {
      onNavigate('op-missed', { locationId, date: row.date, viewOnly: row.explained ? 'true' : 'false', from: 'op-start' })
    } else if (row.sub) {
      onNavigate('op-readonly', { locationId, date: row.date, submissionId: row.sub.id, from: 'op-start' })
    }
  }

  function handleJumpDate() {
    if (!jumpDate) return
    const existing = sourceSubs.find(s => s.locationId === locationId && s.date === jumpDate)
    if (existing) {
      onNavigate('op-readonly', { locationId, date: jumpDate, submissionId: existing.id, from: 'op-start' })
    } else if (jumpDate < todayStr()) {
      onNavigate('op-missed', { locationId, date: jumpDate, from: 'op-start' })
    } else {
      onNavigate('op-method', { locationId, date: jumpDate, from: 'op-start' })
    }
  }

  // ── Variance helpers ────────────────────────────────────────────────────
  const varColor = (pct: number) =>
    Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)'

  const statusConfig = {
    pending_approval: { badge: 'badge-amber', label: 'Pending Approval', icon: '⏳' },
    approved:         { badge: 'badge-green', label: 'Accepted',         icon: '✅' },
    rejected:         { badge: 'badge-red',   label: 'Rejected',         icon: '❌' },
    missing:          { badge: 'badge-gray',  label: 'Missed',           icon: '⚠️' },
  }

  const FILTER_OPTS: { id: FilterType; label: string; countKey: FilterType }[] = [
    { id: 'all',              label: 'All',       countKey: 'all' },
    { id: 'pending_approval', label: 'Pending',   countKey: 'pending_approval' },
    { id: 'rejected',         label: 'Rejected',  countKey: 'rejected' },
    { id: 'missing',          label: 'Missed',    countKey: 'missing' },
    { id: 'approved',         label: 'Accepted',  countKey: 'approved' },
  ]

  const todayDateLabel = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  const draftCount = DRAFTS.length

  return (
    <div className="fade-up">

      {/* ── Greeting header ── */}
      <div className="ph" style={{ marginBottom: 12 }}>
        <div>
          <h2>{greeting(userName)}</h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: 'var(--g0)', border: '1px solid var(--g1)',
              borderRadius: 20, padding: '4px 14px', fontSize: 12, fontWeight: 500, color: 'var(--g8)',
            }}>
              📍 {location?.name ?? locationId}
              <span style={{ color: 'var(--g5)', fontFamily: 'monospace', fontSize: 11 }}>
                (CC: {(location as unknown as { costCenter?: string; cost_center?: string })?.costCenter || (location as unknown as { costCenter?: string; cost_center?: string })?.cost_center || 'N/A'})
              </span>
            </span>
            <span style={{ fontSize: 12, color: 'var(--ts)' }}>{todayDateLabel}</span>
          </div>
        </div>
        <div className="ph-right">
          {draftCount > 0 && (
            <button
              className="btn btn-outline"
              style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: 6 }}
              onClick={() => onNavigate('op-drafts')}
            >
              📝 My Drafts
              <span style={{
                background: 'var(--amb)', color: '#fff',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{draftCount}</span>
            </button>
          )}
        </div>
      </div>

      {fetchError && (
        <div style={{
          background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '10px 14px', fontSize: 13, color: 'var(--red)', marginBottom: 16,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>⚠️</span> {fetchError} (Running locally)
        </div>
      )}

      {/* ── Today's Status card ── */}
      <div style={{ marginBottom: 20 }}>
        {todaySubmitted && todaySub ? (
          <div style={{
            borderRadius: 12, padding: '20px 24px',
            background: todaySub.status === 'approved' ? 'var(--g0)'
              : todaySub.status === 'rejected' ? 'var(--red-bg)'
              : 'var(--amb-bg)',
            border: `1px solid ${todaySub.status === 'approved' ? 'var(--g2)'
              : todaySub.status === 'rejected' ? '#fca5a5'
              : '#fcd34d'}`,
          }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ts)', marginBottom: 6 }}>
                  Today's Submission
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 22 }}>
                    {todaySub.status === 'approved' ? '✅' : todaySub.status === 'rejected' ? '❌' : '⏳'}
                  </span>
                  <span style={{ fontFamily: 'DM Serif Display,serif', fontSize: 26, color: 'var(--td)' }}>
                    {formatCurrency(todaySub.totalCash)}
                  </span>
                  <span className={`badge ${statusConfig[todaySub.status as keyof typeof statusConfig]?.badge ?? 'badge-gray'}`}>
                    {statusConfig[todaySub.status as keyof typeof statusConfig]?.label ?? todaySub.status}
                  </span>
                </div>
                <div style={{ fontSize: 13, color: 'var(--ts)' }}>
                  {(() => {
                    const expCash = todaySub.expectedCash || location?.expected_cash || IMPREST;
                    const dynamicVar = Math.round((todaySub.totalCash - expCash) * 100) / 100;
                    const dynamicVarPct = expCash > 0 ? (dynamicVar / expCash) * 100 : 0;
                    return (
                      <>
                        Variance:&nbsp;
                        <strong style={{ color: varColor(dynamicVarPct) }}>
                          {dynamicVar >= 0 ? '+' : ''}{formatCurrency(dynamicVar)}
                          &nbsp;({dynamicVarPct >= 0 ? '+' : ''}{dynamicVarPct.toFixed(2)}%)
                        </strong>
                        &nbsp;·&nbsp;Imprest: {formatCurrency(expCash)}
                      </>
                    );
                  })()}
                </div>
                {todaySub.rejectionReason && (
                  <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 6, fontStyle: 'italic' }}>
                    Reason: {todaySub.rejectionReason}
                  </div>
                )}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                <button className="btn btn-outline"
                  onClick={() => onNavigate('op-readonly', { locationId, date: todayStr(), submissionId: todaySub.id, from: 'op-start' })}>
                  View →
                </button>
                {/* Update button intentionally omitted for 'pending_approval' to enforce View-only access */}
                {todaySub.status === 'rejected' && (
                  <button className="btn btn-primary"
                    onClick={() => onNavigate('op-method', { locationId, date: todayStr(), submissionId: todaySub.id })}>
                    Resubmit →
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : todayDraft ? (
          /* Draft in progress */
          <div style={{ borderRadius: 12, padding: '20px 24px', background: 'var(--amb-bg)', border: '1px solid #fcd34d' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 22 }}>📝</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ts)', marginBottom: 4 }}>Draft In Progress</div>
                <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 20, marginBottom: 4 }}>
                  {formatCurrency(todayDraft.totalSoFar)} counted so far
                </div>
                <div style={{ fontSize: 12, color: 'var(--ts)' }}>Not yet submitted for approval</div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                <button className="btn btn-primary"
                  onClick={() => onNavigate('op-form', { locationId, date: todayStr(), draftId: todayDraft.id, method: 'form', from: 'op-start' })}>
                  Resume Draft →
                </button>
                <button className="btn btn-outline"
                  onClick={() => onNavigate('op-method', { locationId, date: todayStr(), from: 'op-start' })}>
                  Start fresh
                </button>
              </div>
            </div>
          </div>
        ) : (
          /* Not submitted yet */
          <div style={{ borderRadius: 12, padding: '20px 24px', background: '#fff', border: '2px dashed var(--ow2)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 28 }}>📋</span>
              <div>
                <div style={{ fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--ts)', marginBottom: 4 }}>Today's Submission</div>
                <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Not yet submitted</div>
                <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                  Submit your cash count for today to keep your location compliant.
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <button className="btn btn-primary" style={{ padding: '10px 22px', fontSize: 14 }}
                  onClick={() => onNavigate('op-method', { locationId, date: todayStr(), from: 'op-start' })}>
                  Submit Now →
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Compliance KPI strip ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        <KpiCard
          label="Accepted"
          value={counts.approved}
          sub="last 90 days"
          highlight="green"
          accent="var(--g7)"
          selected={filter === 'approved'}
          onClick={() => setFilter('approved')}
          style={{ background: '#f0fdf4', border: '1px solid var(--g2)', padding: '12px 16px', borderRadius: 10 }}
          tooltip={{
            what: 'Approved cash count submissions.',
            how: 'Total count of submissions marked verified by a Manager or Controller.',
            formula: "COUNT(status = 'approved')",
          }}
        />
        <KpiCard
          label="Pending"
          value={counts.pending_approval}
          sub="last 90 days"
          highlight="amber"
          accent="#b45309"
          selected={filter === 'pending_approval'}
          onClick={() => setFilter('pending_approval')}
          style={{ background: '#fffbeb', border: '1px solid #fcd34d', padding: '12px 16px', borderRadius: 10 }}
          tooltip={{
            what: 'Submissions currently awaiting review.',
            how: 'Total count of completed forms pending a controller approval.',
            formula: "COUNT(status = 'pending_approval')",
            flag: 'Approval is required to clear exceptions.'
          }}
        />
        <KpiCard
          label="Rejected"
          value={counts.rejected}
          sub="last 90 days"
          highlight="red"
          accent="var(--red)"
          selected={filter === 'rejected'}
          onClick={() => setFilter('rejected')}
          style={{ background: '#fff5f5', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: 10 }}
          tooltip={{
            what: 'Submissions returned for operator correction.',
            how: 'Total count of submissions flagged as rejected due to discrepancies.',
            formula: "COUNT(status = 'rejected')",
          }}
        />
        <KpiCard
          label="Missed"
          value={counts.missing}
          sub="last 90 days"
          highlight="gray"
          accent="#374151"
          selected={filter === 'missing'}
          onClick={() => setFilter('missing')}
          style={{ background: '#f9fafb', border: '1px solid #d1d5db', padding: '12px 16px', borderRadius: 10 }}
          tooltip={{
            what: 'Days without a recorded daily submission.',
            how: 'Total scheduled operational days missing a completed cash count.',
            formula: "COUNT(past_days) - COUNT(submissions)",
          }}
        />
      </div>

      {/* ── Summary chips (filter triggers) ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        {FILTER_OPTS.map(f => {
          const cnt = counts[f.countKey]
          const isActive = filter === f.id
          const chipColors: Record<FilterType, string> = {
            all:              isActive ? 'var(--g7)' : '#fff',
            pending_approval: isActive ? '#92400e' : '#fff',
            rejected:         isActive ? '#991b1b' : '#fff',
            missing:          isActive ? '#374151' : '#fff',
            approved:         isActive ? '#065f46' : '#fff',
          }
          const chipBg: Record<FilterType, string> = {
            all:              isActive ? 'var(--g7)' : '#fff',
            pending_approval: isActive ? '#fef3c7' : '#fff',
            rejected:         isActive ? '#fee2e2' : '#fff',
            missing:          isActive ? '#f3f4f6' : '#fff',
            approved:         isActive ? '#d1fae5' : '#fff',
          }
          return (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '7px 16px', borderRadius: 20, fontSize: 13, fontWeight: 500, cursor: 'pointer',
                border: `1px solid ${isActive
                  ? f.id === 'all' ? 'var(--g6)' : f.id === 'pending_approval' ? '#fcd34d'
                  : f.id === 'rejected' ? '#fca5a5' : f.id === 'missing' ? '#d1d5db' : '#6ee7b7'
                  : 'var(--ow2)'}`,
                background: f.id === 'all' && isActive ? 'var(--g7)' : chipBg[f.id],
                color: f.id === 'all' && isActive ? '#fff' : isActive ? chipColors[f.id] : 'var(--tm)',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
              <span style={{
                background: f.id === 'all' && isActive ? 'rgba(255,255,255,0.25)' : 'var(--ow2)',
                color: f.id === 'all' && isActive ? '#fff' : 'var(--ts)',
                borderRadius: 10, padding: '1px 8px', fontSize: 11, fontWeight: 700,
                minWidth: 22, textAlign: 'center',
              }}>{cnt}</span>
            </button>
          )
        })}

        {/* Jump to date */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
          <input
            type="date" className="f-inp"
            style={{ padding: '6px 10px', fontSize: 13, width: 150 }}
            max={todayStr()}
            value={jumpDate}
            onChange={e => setJumpDate(e.target.value)}
            title="Jump to a specific date"
          />
          <button className="btn btn-outline" style={{ fontSize: 12 }} onClick={handleJumpDate} disabled={!jumpDate}>
            Go →
          </button>
        </div>
      </div>

      {/* ── Submission history table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            {filter === 'all'              ? 'Submission History — Last 90 Days'
           : filter === 'pending_approval' ? 'Pending Approvals'
           : filter === 'rejected'         ? 'Rejected Submissions'
           : filter === 'missing'          ? 'Missed Submissions'
           :                                 'Accepted Submissions'}
          </span>
          <span className="card-sub">
            {filtered.length} {filter === 'all' ? 'entries' : 'records'} · click row for details
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '32px', textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              {filter === 'missing'          ? 'No missed submissions in the last 90 days — great work!'
             : filter === 'pending_approval' ? 'No submissions currently pending approval.'
             : filter === 'rejected'         ? 'No rejected submissions in the last 90 days.'
             : filter === 'approved'         ? 'No accepted submissions yet.'
             : 'No submissions yet. Use the button above to submit your first cash count.'}
            </div>
          ) : (
            <>
              <table className="dt">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th style={{ textAlign: 'right' }}>Total Cash</th>
                    <th style={{ textAlign: 'right' }}>Variance</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated.map(row => {
                    const cfg = statusConfig[row.type]
                    return (
                      <tr
                        key={row.date}
                        onClick={() => handleRowClick(row)}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ fontWeight: 500 }}>{friendlyDate(row.date)}</div>
                          <div style={{ fontSize: 11, color: 'var(--ts)' }}>{row.date}</div>
                          {row.sub?.submittedAt && (
                            <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                              Submitted {new Date(row.sub.submittedAt.endsWith('Z') ? row.sub.submittedAt : row.sub.submittedAt + 'Z').toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontFamily: row.sub ? 'DM Serif Display,serif' : undefined, fontSize: row.sub ? 15 : 13 }}>
                          {row.sub ? formatCurrency(row.sub.totalCash) : <span style={{ color: 'var(--wg)' }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.sub ? (() => {
                            const expCash = row.sub.expectedCash || location?.expected_cash || IMPREST;
                            const dynamicVar = Math.round((row.sub.totalCash - expCash) * 100) / 100;
                            const dynamicVarPct = expCash > 0 ? (dynamicVar / expCash) * 100 : 0;
                            return (
                              <span style={{ color: varColor(dynamicVarPct), fontWeight: 500, fontSize: 13 }}>
                                {dynamicVar >= 0 ? '+' : ''}{formatCurrency(dynamicVar)}
                                <div style={{ fontSize: 11, color: varColor(dynamicVarPct) }}>
                                  ({dynamicVarPct >= 0 ? '+' : ''}{dynamicVarPct.toFixed(2)}%)
                                </div>
                              </span>
                            );
                          })() : (
                            <span style={{ color: 'var(--wg)' }}>—</span>
                          )}
                        </td>
                        <td>
                          {row.type === 'missing' && row.explained ? (
                            <div>
                              <span className="badge badge-green"><span className="bdot"></span>Absence Explained</span>
                            </div>
                          ) : (
                            <div>
                              <span className={`badge ${cfg.badge}`}><span className="bdot"></span>{cfg.label}</span>
                              {row.sub?.rejectionReason && (
                                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, maxWidth: 200 }}>
                                  {row.sub.rejectionReason}
                                </div>
                              )}
                            </div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {row.type === 'missing' && !row.explained ? (
                            <button
                              className="btn btn-outline"
                              style={{ fontSize: 11, padding: '4px 10px', color: 'var(--red)', borderColor: '#fca5a5' }}
                              onClick={e => { e.stopPropagation(); onNavigate('op-missed', { locationId, date: row.date, viewOnly: 'false' }) }}
                            >
                              Explain Absence
                            </button>
                          ) : row.type === 'missing' && row.explained ? (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={e => { e.stopPropagation(); onNavigate('op-missed', { locationId, date: row.date, viewOnly: 'true' }) }}
                            >
                              View Details
                            </button>
                          ) : row.type === 'rejected' ? (
                            <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 11, padding: '4px 10px' }}
                                onClick={e => { e.stopPropagation(); onNavigate('op-readonly', { locationId, date: row.date, submissionId: row.sub!.id, from: 'op-start' }) }}
                              >
                                View Details
                              </button>
                              <button
                                className="btn btn-outline"
                                style={{ fontSize: 11, padding: '4px 10px', color: 'var(--red)', borderColor: '#fca5a5' }}
                                onClick={e => { e.stopPropagation(); onNavigate('op-form', { locationId, date: row.date, submissionId: row.sub!.id, from: 'op-start' }) }}
                              >
                                Update
                              </button>
                            </div>
                          ) : (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '4px 10px' }}
                              onClick={e => { e.stopPropagation(); handleRowClick(row) }}
                            >
                              View Details
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* Pagination controls */}
              {totalPages > 1 && (
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '12px 16px', borderTop: '1px solid var(--ow2)',
                  background: 'var(--ow)', fontSize: 13,
                }}>
                  <span style={{ color: 'var(--ts)' }}>
                    Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length} entries
                  </span>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    <button
                      className="btn btn-outline"
                      style={{ padding: '4px 14px', fontSize: 12 }}
                      disabled={page === 0}
                      onClick={() => setPage(p => Math.max(0, p - 1))}
                    >
                      ← Previous
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => (
                      <button
                        key={i}
                        onClick={() => setPage(i)}
                        style={{
                          width: 30, height: 30, borderRadius: 6, fontSize: 12,
                          border: `1px solid ${i === page ? 'var(--g4)' : 'var(--ow2)'}`,
                          background: i === page ? 'var(--g7)' : '#fff',
                          color: i === page ? '#fff' : 'var(--tm)',
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {i + 1}
                      </button>
                    ))}
                    <button
                      className="btn btn-outline"
                      style={{ padding: '4px 14px', fontSize: 12 }}
                      disabled={page >= totalPages - 1}
                      onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                    >
                      Next →
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

    </div>
  )
}
