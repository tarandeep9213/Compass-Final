import { useState, useMemo, useEffect } from 'react'
import { VERIFICATIONS, LOCATIONS, getLocation, formatCurrency, IMPREST } from '../../mock/data'
import type { VerificationRecord } from '../../mock/data'
import { listControllerVerifications } from '../../api/verifications'
import type { ApiVerification } from '../../api/types'
import KpiCard from '../../components/KpiCard'

function mapApiVerif(v: ApiVerification): VerificationRecord {
  return {
    id:            v.id,
    locationId:    v.location_id,
    verifierName:  v.verifier_name,
    type:          v.verification_type.toLowerCase() as 'controller' | 'dgm',
    date:          v.verification_date,
    scheduledTime: v.scheduled_time ?? undefined,
    notes:         v.notes,
    dayOfWeek:     v.day_of_week,
    warningFlag:   v.warning_flag,
    status:        v.status,
    observedTotal: v.observed_total ?? undefined,
    monthYear:     v.month_year ?? undefined,
  }
}

interface Props {
  controllerName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const PAGE_SIZE  = 10

const varColor = (pct: number) =>
  Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)'

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)         return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

export default function CtrlHistory({ controllerName, locationIds, onNavigate }: Props) {
  const [locationFilter, setLocationFilter] = useState('all')
  const [page,           setPage]           = useState(0)
  const [apiVerifs,      setApiVerifs]      = useState<VerificationRecord[]>([])

  useEffect(() => {
    Promise.all(locationIds.map(id =>
      listControllerVerifications({ location_id: id, status: 'completed', page_size: 100 })
        .then(r => r.items.map(mapApiVerif))
        .catch(() => [] as VerificationRecord[])
    )).then(arrays => setApiVerifs(arrays.flat()))
  }, [locationIds])

  // All controller verifications for this controller's locations, newest-first
  const mockRecords = useMemo(() =>
    VERIFICATIONS
      .filter(v => v.type === 'controller' && v.status === 'completed' && locationIds.includes(v.locationId))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [locationIds])

  const allRecords = useMemo(() =>
    (apiVerifs.length > 0 ? apiVerifs : mockRecords)
      .sort((a, b) => b.date.localeCompare(a.date)),
  [apiVerifs, mockRecords])

  const rows = locationFilter === 'all'
    ? allRecords
    : allRecords.filter(v => v.locationId === locationFilter)

  // ── Pagination ────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(rows.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages - 1)
  const pageRows    = rows.slice(pageClamped * PAGE_SIZE, (pageClamped + 1) * PAGE_SIZE)
  const fromEntry   = rows.length === 0 ? 0 : pageClamped * PAGE_SIZE + 1
  const toEntry     = Math.min((pageClamped + 1) * PAGE_SIZE, rows.length)

  // ── KPIs ──────────────────────────────────────────────────────────────
  const thisMonthKey   = new Date().toISOString().slice(0, 7)
  const thisMonthCount = allRecords.filter(v => v.date.startsWith(thisMonthKey)).length
  const warningCount   = allRecords.filter(v => v.warningFlag).length

  // Average gap (days) between consecutive visits across all locations
  const avgGap = useMemo(() => {
    if (allRecords.length < 2) return null
    const sorted = [...allRecords].sort((a, b) => a.date.localeCompare(b.date))
    let total = 0
    for (let i = 1; i < sorted.length; i++) {
      total += (new Date(sorted[i].date).getTime() - new Date(sorted[i - 1].date).getTime()) / 86400000
    }
    return Math.round(total / (sorted.length - 1))
  }, [allRecords])

  // Locations coverage: how many of my locations have been visited this month
  const visitedThisMonth = new Set(
    allRecords.filter(v => v.date.startsWith(thisMonthKey)).map(v => v.locationId)
  ).size

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Verification History</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Physical verifications across your {locationIds.length} locations · {controllerName}
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-primary" onClick={() => onNavigate('ctrl-schedule')}>
            + Schedule Visit
          </button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-row" style={{ marginBottom: 20 }}>
        <KpiCard
          label="Total Verified"
          value={allRecords.length}
          sub="all time"
          tooltip={{
            what: "Total number of controller verification visits completed across all assigned locations, all time.",
            how: "Counts all completed verification records regardless of which location or when.",
            formula: "COUNT(all completed verifications)",
          }}
        />
        <KpiCard
          label="This Month"
          value={thisMonthCount}
          sub={`${visitedThisMonth}/${locationIds.length} locations visited`}
          tooltip={{
            what: "Number of verifications completed in the current calendar month, and how many unique locations were visited.",
            how: "Filters verifications by the current month and year. The sub-count shows distinct location coverage.",
            formula: "COUNT(verifications in current month) / COUNT(DISTINCT locations visited)",
          }}
        />
        <KpiCard
          label="Pattern Warnings"
          value={warningCount}
          sub="day-of-week flags"
          accent={warningCount > 0 ? 'var(--amb)' : 'var(--g7)'}
          highlight={warningCount > 0 ? 'amber' : false}
          tooltip={{
            what: "Visits flagged because the controller visited the same location on the same day of the week as a previous visit within the lookback window.",
            how: "The DOW (day-of-week) rule compares each scheduled visit's weekday against visits to the same location in the prior 2 weeks. A flag is raised if the weekday matches.",
            formula: "flag IF same location AND same weekday AND prior visit within 14 days",
            flag: "Amber warning — the system allows the visit but flags it to avoid predictable visit patterns.",
          }}
        />
        <KpiCard
          label="Avg Visit Gap"
          value={avgGap !== null ? `${avgGap}d` : '—'}
          sub="between visits"
          tooltip={{
            what: "Average number of days between consecutive verification visits to the same location.",
            how: "For each location, calculates the gaps between consecutive completed visits, then averages across all locations.",
            formula: "AVG(days between consecutive visits per location)",
          }}
        />
      </div>

      {/* ── Location filter ── */}
      <div style={{ marginBottom: 16 }}>
        <select
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          style={{
            padding: '7px 32px 7px 12px',
            fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
            minWidth: 210, cursor: 'pointer',
            border: `2px solid ${locationFilter !== 'all' ? 'var(--g4)' : 'var(--g3)'}`,
            borderRadius: 8,
            background: locationFilter !== 'all' ? 'var(--g7)' : 'var(--g0)',
            color: locationFilter !== 'all' ? '#fff' : 'var(--g8)',
            outline: 'none', appearance: 'none', WebkitAppearance: 'none',
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='${locationFilter !== 'all' ? '%23ffffff' : '%230d3320'}' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat', backgroundPosition: 'right 10px center',
            boxShadow: locationFilter !== 'all' ? '0 2px 8px rgba(52,160,110,0.25)' : '0 1px 3px rgba(0,0,0,0.08)',
            transition: 'all 0.15s',
          }}
        >
          <option value="all">📍 All Locations ({locationIds.length})</option>
          {locationIds.map(id => {
            const loc = LOCATIONS.find(l => l.id === id)
            return <option key={id} value={id}>{loc?.name ?? id}</option>
          })}
        </select>
      </div>

      {/* ── History table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Verification Log</span>
          <span className="card-sub">
            {rows.length} record{rows.length !== 1 ? 's' : ''}
            {locationFilter !== 'all' ? ` · ${getLocation(locationFilter)?.name ?? locationFilter}` : ''}
            {rows.length > PAGE_SIZE && ` · page ${page + 1} of ${totalPages}`}
          </span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {rows.length === 0 ? (
            <div style={{ padding: '48px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 36, marginBottom: 10 }}>🔍</div>
              <div style={{ fontWeight: 600, marginBottom: 6 }}>No records found</div>
              <div style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 16 }}>
                No verifications logged for this location yet.
              </div>
              <button className="btn btn-primary" onClick={() => onNavigate('ctrl-schedule')}>
                + Schedule Visit
              </button>
            </div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Location</th>
                  <th style={{ textAlign: 'right' }}>Observed Total</th>
                  <th style={{ textAlign: 'right' }}>vs Imprest</th>
                  <th>Flag</th>
                  <th>Notes</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(v => {
                  const loc      = getLocation(v.locationId)
                  const variance = v.observedTotal !== undefined ? v.observedTotal - IMPREST : null
                  const pct      = variance !== null ? (variance / IMPREST) * 100 : null
                  const col      = pct !== null ? varColor(pct) : 'var(--wg)'
                  const dateLabel = new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short', year: 'numeric',
                  })
                  return (
                    <tr key={v.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{dateLabel}</div>
                      </td>
                      <td>
                        <span style={{
                          fontSize: 11, fontWeight: 700,
                          padding: '2px 9px', borderRadius: 12,
                          background: 'var(--g0)', color: 'var(--g7)',
                          border: '1px solid var(--g1)',
                        }}>
                          {DOW_LABELS[v.dayOfWeek]}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? v.locationId}</div>
                        <div style={{ fontSize: 11, color: 'var(--ts)', fontFamily: 'monospace' }}>{v.locationId}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                        {v.observedTotal !== undefined
                          ? formatCurrency(v.observedTotal)
                          : <span style={{ color: 'var(--wg)', fontFamily: 'inherit', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {variance !== null && pct !== null ? (
                          <>
                            <span style={{ color: col, fontWeight: 500, fontSize: 13 }}>
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
                      <td>
                        {v.warningFlag ? (
                          <span className="badge badge-amber">
                            <span className="bdot"></span>DOW flag
                          </span>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--wg)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ts)', maxWidth: 220 }}>
                        {v.notes
                          ? (v.notes.length > 65 ? v.notes.slice(0, 65) + '…' : v.notes)
                          : <span style={{ color: 'var(--wg)' }}>—</span>
                        }
                      </td>
                    </tr>
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
                      onClick={() => setPage(n)}
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
