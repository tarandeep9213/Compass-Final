import { useState, useMemo, useEffect } from 'react'
import { VERIFICATIONS, getLocation, LOCATIONS, formatCurrency, IMPREST } from '../../mock/data'
import type { VerificationRecord } from '../../mock/data'
import { listDgmVerifications } from '../../api/verifications'
import type { ApiVerification } from '../../api/types'
import KpiCard from '../../components/KpiCard'

function mapApiVerif(v: ApiVerification): VerificationRecord {
  return {
    id:            v.id,
    locationId:    v.location_id,
    verifierName:  v.verifier_name,
    type:          'dgm',
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

const MONTH_FULL = ['January','February','March','April','May','June','July','August','September','October','November','December']
const PAGE_SIZE  = 10

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)         return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

const SEL: React.CSSProperties = {
  padding: '7px 28px 7px 10px', fontSize: 12, fontWeight: 600, fontFamily: 'inherit',
  border: '1.5px solid var(--ow2)', borderRadius: 8, background: '#fff', color: 'var(--td)',
  outline: 'none', appearance: 'none', WebkitAppearance: 'none', cursor: 'pointer', minWidth: 130,
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%230d3320' stroke-width='1.6' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
  backgroundRepeat: 'no-repeat', backgroundPosition: 'right 9px center',
}

function StatusBadge({ status }: { status: string }) {
  if (status === 'scheduled') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>📅 Scheduled</span>
  )
  if (status === 'missed') return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--red-bg)', color: 'var(--red)', border: '1px solid #fca5a5' }}>❌ Missed</span>
  )
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 10px', borderRadius: 12, fontSize: 11, fontWeight: 700, background: 'var(--g0)', color: 'var(--g7)', border: '1px solid var(--g1)' }}>✅ Completed</span>
  )
}

interface Props {
  dgmName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function DGMHistory({ dgmName, locationIds, onNavigate }: Props) {
  const [filterLoc,      setFilterLoc]      = useState('all')
  const [filterYear,     setFilterYear]     = useState('all')
  const [filterMonth,    setFilterMonth]    = useState('all')
  const [filterStatus,   setFilterStatus]   = useState('all')
  const [filterVariance, setFilterVariance] = useState('all')
  const [page,           setPage]           = useState(0)
  const [apiVerifs,      setApiVerifs]      = useState<VerificationRecord[]>([])

  useEffect(() => {
    Promise.all(locationIds.map(id =>
      listDgmVerifications({ location_id: id, page_size: 100 })
        .then(r => r.items.map(mapApiVerif))
        .catch(() => [] as VerificationRecord[])
    )).then(arrays => setApiVerifs(arrays.flat()))
  }, [locationIds])

  // Derive effective filterMonth: reset to 'all' if filterYear changed and filterMonth is from a different year
  const effectiveFilterMonth = (filterYear !== 'all' && filterMonth !== 'all' && !filterMonth.startsWith(filterYear))
    ? 'all'
    : filterMonth

  const anyFilterActive = filterLoc !== 'all' || filterYear !== 'all' || effectiveFilterMonth !== 'all' || filterStatus !== 'all' || filterVariance !== 'all'

  function clearFilters() {
    setFilterLoc('all'); setFilterYear('all'); setFilterMonth('all')
    setFilterStatus('all'); setFilterVariance('all')
  }

  const mockVisits = useMemo(() =>
    VERIFICATIONS.filter(v => v.type === 'dgm' && locationIds.includes(v.locationId))
      .sort((a, b) => b.date.localeCompare(a.date)),
  [locationIds])

  const allVisits = useMemo(() => {
    // 1. Read session overrides from Dashboard
    let sessionUpdates: Record<string, { status: string; notes?: string; observedTotal?: number }> = {}
    try {
      const saved = sessionStorage.getItem('dgm_session_updates')
      if (saved) sessionUpdates = JSON.parse(saved)
    } catch { 
      // ignore parse errors
    }

    const base = apiVerifs.length > 0 ? apiVerifs : mockVisits

    return base
      .map(v => {
        const upd = sessionUpdates[v.id]
        if (!upd) return v
        // 2. Merge status and data from session storage so table shows "Completed"
        return { 
          ...v, 
          status: upd.status,
          notes: upd.notes ?? v.notes,
          observedTotal: upd.observedTotal !== undefined ? upd.observedTotal : v.observedTotal
        }
      })
      // 3. Filter out cancelled visits so they don't show in history
      .filter(v => v.status !== 'cancelled')
      .sort((a, b) => b.date.localeCompare(a.date))
  }, [apiVerifs, mockVisits])

  const historyYears = useMemo(() => {
    const seen = new Set<string>()
    allVisits.forEach(v => { seen.add((v.monthYear ?? v.date).slice(0, 4)) })
    return [...seen].sort((a, b) => b.localeCompare(a))
  }, [allVisits])

  const historyMonths = useMemo(() => {
    const seen = new Set<string>()
    allVisits.forEach(v => {
      const my = v.monthYear ?? v.date.slice(0, 7)
      if (filterYear === 'all' || my.startsWith(filterYear)) seen.add(my)
    })
    return [...seen].sort((a, b) => b.localeCompare(a))
  }, [allVisits, filterYear])

  const filtered = useMemo(() =>
    allVisits.filter(v => {
      const my = v.monthYear ?? v.date.slice(0, 7)
      const yr = my.slice(0, 4)
      if (filterLoc      !== 'all' && v.locationId !== filterLoc)  return false
      if (filterYear     !== 'all' && yr            !== filterYear)  return false
      if (effectiveFilterMonth !== 'all' && my !== effectiveFilterMonth) return false
      if (filterStatus   !== 'all' && (v.status ?? 'completed') !== filterStatus) return false
      if (filterVariance !== 'all') {
        if (v.observedTotal === undefined) return filterVariance === 'none'
        const pct = Math.abs((v.observedTotal - IMPREST) / IMPREST) * 100
        if (filterVariance === 'ok'   && pct  > 2)  return false
        if (filterVariance === 'warn' && (pct <= 2 || pct > 5)) return false
        if (filterVariance === 'over' && pct  <= 5) return false
        if (filterVariance === 'none' && v.observedTotal !== undefined) return false
      }
      return true
    }),
  [allVisits, filterLoc, filterYear, effectiveFilterMonth, filterStatus, filterVariance])

  const totalPages  = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageClamped = Math.min(page, totalPages - 1)
  const pageRows    = filtered.slice(pageClamped * PAGE_SIZE, (pageClamped + 1) * PAGE_SIZE)
  const fromEntry   = filtered.length === 0 ? 0 : pageClamped * PAGE_SIZE + 1
  const toEntry     = Math.min((pageClamped + 1) * PAGE_SIZE, filtered.length)

  const myLocations = LOCATIONS.filter(l => locationIds.includes(l.id))

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Visit History</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            All DGM visits across {locationIds.length} locations · {dgmName}
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-primary" onClick={() => onNavigate('dgm-log')}>+ Schedule Visit</button>
        </div>
      </div>

      {/* ── KPIs ── */}
      <div className="kpi-row" style={{ marginBottom: 22, position: 'relative', zIndex: 10, overflow: 'visible' }}>
        <KpiCard
          label="Total Visits"
          value={allVisits.length}
          sub="all time"
          tooltipAlign="left"
          tooltip={{
            what: "Total number of DGM physical verification visits across all assigned locations, all time.",
            how: "Counts all visit records regardless of status (completed, scheduled, missed).",
            formula: "COUNT(all visits)",
          }}
        />
        <KpiCard
          label="Completed"
          value={allVisits.filter(v => v.status === 'completed').length}
          sub="visits logged"
          accent="var(--g7)"
          tooltip={{
            what: "Number of DGM visits that were fully carried out and logged.",
            how: "Visits with status 'Completed' where an observed cash total was recorded. These satisfy the monthly visit requirement for each location.",
            formula: "COUNT(visits where status = completed)",
          }}
        />
        <KpiCard
          label="Scheduled"
          value={allVisits.filter(v => v.status === 'scheduled').length}
          sub="upcoming"
          accent="#1d4ed8"
          tooltip={{
            what: "Number of upcoming DGM visits that are booked but not yet carried out.",
            how: "Visits with status 'Scheduled' with a future date. These are planned visits awaiting execution.",
            formula: "COUNT(visits where status = scheduled)",
          }}
        />
        <KpiCard
          label="Missed"
          value={allVisits.filter(v => v.status === 'missed').length}
          sub="need follow-up"
          accent={allVisits.some(v => v.status === 'missed') ? 'var(--red)' : 'var(--g7)'}
          highlight={allVisits.some(v => v.status === 'missed') ? 'red' : false}
          tooltipAlign="right"
          tooltip={{
            what: "Number of DGM visits that were scheduled but not completed.",
            how: "A visit is marked 'Missed' when it passes its scheduled date without being logged as completed. Each missed visit creates a compliance gap.",
            formula: "COUNT(visits where status = missed)",
            flag: "Any missed visits require follow-up — the location did not receive its required monthly DGM check.",
          }}
        />
      </div>

      {/* ── Table card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Visit Log</span>
          <span className="card-sub">
            {filtered.length} of {allVisits.length} records
            {filtered.length > PAGE_SIZE ? ` · page ${page + 1} of ${totalPages}` : ''}
          </span>
        </div>

        {/* Filters */}
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', padding: '12px 20px', borderBottom: '1px solid var(--ow2)', background: 'var(--ow)' }}>
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--td)', marginRight: 4 }}>Filter:</span>

          <select value={filterLoc} onChange={e => setFilterLoc(e.target.value)} style={SEL}>
            <option value="all">All Locations</option>
            {myLocations.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>

          <select value={filterYear} onChange={e => setFilterYear(e.target.value)} style={SEL}>
            <option value="all">All Years</option>
            {historyYears.map(y => <option key={y} value={y}>{y}</option>)}
          </select>

          <select value={effectiveFilterMonth} onChange={e => setFilterMonth(e.target.value)} style={SEL}>
            <option value="all">{filterYear === 'all' ? 'All Months' : `All of ${filterYear}`}</option>
            {historyMonths.map(my => {
              const [y, m] = my.split('-')
              return <option key={my} value={my}>{MONTH_FULL[parseInt(m) - 1]}{filterYear === 'all' ? ` ${y}` : ''}</option>
            })}
          </select>

          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={SEL}>
            <option value="all">All Statuses</option>
            <option value="completed">✅ Completed</option>
            <option value="scheduled">📅 Scheduled</option>
            <option value="missed">❌ Missed</option>
          </select>

          <select value={filterVariance} onChange={e => setFilterVariance(e.target.value)} style={SEL}>
            <option value="all">All Variance</option>
            <option value="ok">✅ In tolerance (≤2%)</option>
            <option value="warn">⚠ Warning (2–5%)</option>
            <option value="over">🔴 Over threshold (&gt;5%)</option>
            <option value="none">— No observed total</option>
          </select>

          {anyFilterActive && (
            <button className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 12px' }} onClick={clearFilters}>✕ Clear all</button>
          )}
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 ? (
            <div style={{ padding: '40px 32px', textAlign: 'center' }}>
              <div style={{ fontSize: 32, marginBottom: 10 }}>🔍</div>
              <div style={{ fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
                {allVisits.length === 0 ? 'No visits logged yet' : 'No records match filters'}
              </div>
            </div>
          ) : (
            <>
              <table className="dt">
                <thead>
                  <tr>
                    <th>Month</th>
                    <th>Location</th>
                    <th>Visit Date</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Observed Total</th>
                    <th style={{ textAlign: 'right' }}>vs Imprest</th>
                    <th>Notes</th>
                  </tr>
                </thead>
                <tbody>
                  {pageRows.map(v => {
                    const loc      = getLocation(v.locationId)
                    const variance = v.observedTotal !== undefined ? v.observedTotal - IMPREST : null
                    const pct      = variance !== null ? (variance / IMPREST) * 100 : null
                    const varCol   = pct !== null ? (Math.abs(pct) > 5 ? 'var(--red)' : Math.abs(pct) > 2 ? 'var(--amb)' : 'var(--g7)') : 'var(--wg)'
                    const dateLabel = new Date(v.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
                    const my       = v.monthYear ?? v.date.slice(0, 7)
                    const [vy, vm] = my.split('-')
                    return (
                      <tr key={v.id}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--td)' }}>{MONTH_FULL[parseInt(vm) - 1]} {vy}</div>
                        </td>
                        <td>
                          <div style={{ fontWeight: 500, fontSize: 13 }}>{loc?.name ?? v.locationId}</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ts)' }}>{v.locationId}</div>
                        </td>
                        <td style={{ fontSize: 13, color: 'var(--td)' }}>{dateLabel}</td>
                        <td><StatusBadge status={v.status} /></td>
                        <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 15 }}>
                          {v.observedTotal !== undefined
                            ? formatCurrency(v.observedTotal)
                            : <span style={{ color: 'var(--wg)', fontFamily: 'inherit', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {variance !== null && pct !== null ? (
                            <>
                              <span style={{ color: varCol, fontWeight: 500, fontSize: 13 }}>{variance >= 0 ? '+' : ''}{formatCurrency(variance)}</span>
                              <div style={{ fontSize: 11, color: 'var(--ts)' }}>({pct >= 0 ? '+' : ''}{pct.toFixed(2)}%)</div>
                            </>
                          ) : <span style={{ color: 'var(--wg)', fontSize: 12 }}>—</span>}
                        </td>
                        <td style={{ fontSize: 12, color: 'var(--ts)', maxWidth: 200 }}>
                          {v.notes ? (v.notes.length > 55 ? v.notes.slice(0, 55) + '…' : v.notes) : <span style={{ color: 'var(--wg)' }}>—</span>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
                  <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromEntry}–{toEntry} of {filtered.length}</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    {pageNums(page, totalPages).map((n, i) => n === 'gap'
                      ? <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>…</span>
                      : <button key={n} onClick={() => setPage(n)} style={{ width: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: page === n ? 700 : 400, border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`, background: page === n ? 'var(--g7)' : '#fff', color: page === n ? '#fff' : 'var(--tm)' }}>{n + 1}</button>
                    )}
                    <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
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
