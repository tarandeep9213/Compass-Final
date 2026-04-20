import { useState, useEffect, useMemo } from 'react'
import { getBiannualStatus } from '../../../api/alarm'
import type { BiannualStatusRow } from '../../../api/alarm'
import KpiCard from '../../../components/KpiCard'

interface Props {
  adminName: string
  onNavigate: (p: string, c?: Record<string, string>) => void
}

const PAGE_SIZE = 12

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d?: string): string {
  if (!d) return 'Never'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function pageNums(current: number, total: number): number[] {
  const pages: number[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1)
    }
  }
  return pages
}

type StatusLabel = 'Compliant' | 'Overdue' | 'Upcoming' | 'Never'

function resolveStatus(apiStatus: BiannualStatusRow['cellularStatus'], nextDue?: string): StatusLabel {
  if (apiStatus === 'NO_CHECK') return 'Never'
  if (apiStatus === 'NON_COMPLIANT') return 'Overdue'
  if (!nextDue) return 'Never'
  const today = new Date().toISOString().slice(0, 10)
  const days = daysBetween(today, nextDue)
  if (days < 0) return 'Overdue'
  if (days <= 30) return 'Upcoming'
  return 'Compliant'
}

const STATUS_STYLE: Record<StatusLabel, React.CSSProperties> = {
  Compliant: { background: '#eef8f1', color: '#1a4d30' },
  Overdue:   { background: '#fef2f2', color: '#991b1b' },
  Upcoming:  { background: '#fffbeb', color: '#92400e' },
  Never:     { background: '#f5f5f4', color: '#57534e' },
}

interface EnrichedRow extends BiannualStatusRow {
  cellularLabel: StatusLabel
  cameraLabel: StatusLabel
  sortPriority: number
}

export default function BiannualStatus({ adminName: _adminName, onNavigate }: Props) {
  const [rows, setRows] = useState<BiannualStatusRow[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [page, setPage] = useState(1)

  useEffect(() => {
    setLoading(true)
    getBiannualStatus().then(data => {
      setRows(data)
      setLoading(false)
    })
  }, [])

  const regions = useMemo(() => {
    const set = new Set(rows.map(r => r.region))
    return Array.from(set).sort()
  }, [rows])

  const enriched: EnrichedRow[] = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10)
    return rows
      .filter(r => !region || r.region === region)
      .map(r => {
        const cellularLabel = resolveStatus(r.cellularStatus, r.cellularNextDue)
        const cameraLabel = resolveStatus(r.cameraStatus, r.cameraNextDue)
        const isOverdue = cellularLabel === 'Overdue' || cameraLabel === 'Overdue'
        // Sort priority: overdue first, then by nearest due date
        const cellDays = r.cellularNextDue ? daysBetween(today, r.cellularNextDue) : 9999
        const camDays = r.cameraNextDue ? daysBetween(today, r.cameraNextDue) : 9999
        const nearestDue = Math.min(cellDays, camDays)
        const sortPriority = isOverdue ? -10000 + nearestDue : nearestDue
        return { ...r, cellularLabel, cameraLabel, sortPriority }
      })
      .sort((a, b) => a.sortPriority - b.sortPriority)
  }, [rows, region])

  // KPI counts
  const cellCompliant = enriched.filter(r => r.cellularLabel === 'Compliant' || r.cellularLabel === 'Upcoming').length
  const cellOverdue = enriched.filter(r => r.cellularLabel === 'Overdue' || r.cellularLabel === 'Never').length
  const camCompliant = enriched.filter(r => r.cameraLabel === 'Compliant' || r.cameraLabel === 'Upcoming').length
  const camOverdue = enriched.filter(r => r.cameraLabel === 'Overdue' || r.cameraLabel === 'Never').length

  const totalPages = Math.max(1, Math.ceil(enriched.length / PAGE_SIZE))
  const paged = enriched.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  function handleExport() {
    const header = 'Building,Region,Cellular Status,Cellular Next Due,Camera Status,Camera Next Due\n'
    const csv = header + enriched.map(r =>
      `"${r.buildingName}","${r.region}","${r.cellularLabel}","${r.cellularNextDue ?? ''}","${r.cameraLabel}","${r.cameraNextDue ?? ''}"`
    ).join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'biannual-status.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="content fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>Loading...</div>
  }

  return (
    <div className="content fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Biannual Compliance Status</h2>
        </div>
        <div className="ph-right">
          <select className="f-inp" style={{ width: 140, fontSize: 12, padding: '6px 10px' }} value={region} onChange={e => { setRegion(e.target.value); setPage(1) }}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <button className="btn btn-outline" onClick={handleExport}>Export</button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard
          label="Cellular: Compliant"
          value={cellCompliant}
          highlight="green"
          tooltip={{ what: 'Buildings with compliant cellular backup checks.', how: 'Count where cellular status is Compliant or Upcoming.' }}
        />
        <KpiCard
          label="Cellular: Overdue"
          value={cellOverdue}
          highlight="red"
          tooltip={{ what: 'Buildings with overdue or missing cellular backup checks.', how: 'Count where cellular status is Overdue or Never checked.' }}
        />
        <KpiCard
          label="Camera: Compliant"
          value={camCompliant}
          highlight="green"
          tooltip={{ what: 'Buildings with compliant camera backup checks.', how: 'Count where camera status is Compliant or Upcoming.' }}
        />
        <KpiCard
          label="Camera: Overdue"
          value={camOverdue}
          highlight="red"
          tooltip={{ what: 'Buildings with overdue or missing camera backup checks.', how: 'Count where camera status is Overdue or Never checked.' }}
        />
      </div>

      {/* ── Table ── */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          <table className="dt">
            <thead>
              <tr>
                <th>Building</th>
                <th>Region</th>
                <th>Cellular Last Check</th>
                <th>Cellular Next Due</th>
                <th>Cellular Status</th>
                <th>Camera Last Check</th>
                <th>Camera Next Due</th>
                <th>Camera Status</th>
              </tr>
            </thead>
            <tbody>
              {paged.map(row => {
                const isOverdue = row.cellularLabel === 'Overdue' || row.cameraLabel === 'Overdue'
                return (
                  <tr key={row.buildingId} style={isOverdue ? { borderLeft: '3px solid var(--red)' } : undefined}>
                    <td>
                      <span
                        style={{ fontWeight: 500, color: 'var(--g7)', cursor: 'pointer' }}
                        onClick={() => onNavigate('alarm-drilldown', { buildingId: row.buildingId, fromPanel: 'biannual-status' })}
                      >
                        {row.buildingName}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{row.region}</td>
                    <td style={{ fontSize: 12 }}>
                      {row.cellularStatus !== 'NO_CHECK'
                        ? formatDate(row.cellularNextDue ? new Date(new Date(row.cellularNextDue).getTime() - 180 * 86400000).toISOString().slice(0, 10) : undefined)
                        : 'Never'}
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(row.cellularNextDue)}</td>
                    <td>
                      <span style={{
                        ...STATUS_STYLE[row.cellularLabel],
                        padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      }}>
                        {row.cellularLabel}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>
                      {row.cameraStatus !== 'NO_CHECK'
                        ? formatDate(row.cameraNextDue ? new Date(new Date(row.cameraNextDue).getTime() - 180 * 86400000).toISOString().slice(0, 10) : undefined)
                        : 'Never'}
                    </td>
                    <td style={{ fontSize: 12 }}>{formatDate(row.cameraNextDue)}</td>
                    <td>
                      <span style={{
                        ...STATUS_STYLE[row.cameraLabel],
                        padding: '3px 9px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      }}>
                        {row.cameraLabel}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Pagination ── */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginTop: 14 }}>
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</button>
          {pageNums(page, totalPages).map((p, i) =>
            p === -1 ? (
              <span key={`e${i}`} style={{ padding: '4px 6px', fontSize: 12, color: 'var(--ts)' }}>&hellip;</span>
            ) : (
              <button
                key={p}
                className={p === page ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ fontSize: 11, padding: '4px 10px', minWidth: 32 }}
                onClick={() => setPage(p)}
              >
                {p}
              </button>
            ),
          )}
          <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 10px' }} disabled={page === totalPages} onClick={() => setPage(page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
