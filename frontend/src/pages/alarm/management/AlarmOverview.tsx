import { useState, useEffect, useMemo } from 'react'
import { getAlarmOverview } from '../../../api/alarm'
import KpiCard from '../../../components/KpiCard'
import TrafficLight from '../../../components/alarm/TrafficLight'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import AlarmStatusBadge from '../../../components/alarm/AlarmStatusBadge'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

import type { AlarmOverviewData, BuildingComplianceRow } from '../../../api/alarm'
import type { BiannualStatusRow } from '../../../api/alarm'
import { getBiannualStatus } from '../../../api/alarm'
import { listZones } from '../../../api/alarm'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

const MONTH_LABELS: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function curMonthValue(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatMonthYear(month: string): string {
  const [y, m] = month.split('-')
  const names = ['January','February','March','April','May','June','July','August','September','October','November','December']
  return `${names[parseInt(m, 10) - 1]} ${y}`
}

type SortKey = 'status' | 'buildingName' | 'region' | 'lastTestDate' | 'zonesTotal' | 'lastTestStatus' | 'cellularStatus' | 'cameraStatus'
type SortDir = 'asc' | 'desc'
type KpiFilter = 'all' | 'compliant' | 'pending' | 'overdue' | 'exempt'

const STATUS_ORDER: Record<string, number> = { overdue: 0, pending: 1, compliant: 2, exempt: 3 }

function pageNums(current: number, total: number): number[] {
  const pages: number[] = []
  for (let i = 1; i <= total; i++) {
    if (i === 1 || i === total || (i >= current - 1 && i <= current + 1)) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== -1) {
      pages.push(-1) // ellipsis marker
    }
  }
  return pages
}

// Extended building row with zone/biannual info
interface EnrichedBuilding extends BuildingComplianceRow {
  zonesTotal: number
  zonesTested: number
  cellularStatus: 'green' | 'red' | 'gray'
  cameraStatus: 'green' | 'red' | 'gray'
}

export default function AlarmOverview({ adminName: _adminName, onNavigate }: Props) {
  const [month, setMonth] = useState(curMonthValue())
  const [region, setRegion] = useState('')
  const [data, setData] = useState<AlarmOverviewData | null>(null)
  const [biannualData, setBiannualData] = useState<BiannualStatusRow[]>([])
  const [zoneMap, setZoneMap] = useState<Record<string, { total: number; tested: number }>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('status')
  const [sortDir, setSortDir] = useState<SortDir>('asc')
  const [page, setPage] = useState(1)
  const [kpiFilter, setKpiFilter] = useState<KpiFilter>('all')

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAlarmOverview(region || undefined, month),
      getBiannualStatus(),
    ])
      .then(([overview, biannual]) => {
        setData(overview)
        setBiannualData(biannual)

        // Load zone counts for each building
        const buildingIds = overview.buildings.map(b => b.buildingId)
        Promise.all(buildingIds.map(id => listZones(id).then(zones => ({ id, total: zones.length, tested: zones.length })).catch(() => ({ id, total: 0, tested: 0 }))))
          .then(results => {
            const map: Record<string, { total: number; tested: number }> = {}
            for (const r of results) {
              map[r.id] = { total: r.total, tested: r.tested }
            }
            setZoneMap(map)
          })
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [region, month])

  // Reset page when filters change
  useEffect(() => { setPage(1) }, [search, kpiFilter, sortKey, sortDir, month, region])

  // ── Derived data ──────────────────────────────────────────────────────────
  const regions = useMemo(() => {
    if (!data) return []
    const set = new Set(data.buildings.map(b => b.region))
    return Array.from(set).sort()
  }, [data])

  const enrichedBuildings: EnrichedBuilding[] = useMemo(() => {
    if (!data) return []
    return data.buildings.map(b => {
      const bi = biannualData.find(r => r.buildingId === b.buildingId)
      const zones = zoneMap[b.buildingId] ?? { total: 0, tested: 0 }
      return {
        ...b,
        zonesTotal: zones.total,
        zonesTested: zones.tested,
        cellularStatus: bi?.cellularStatus === 'COMPLIANT' ? 'green' as const : bi?.cellularStatus === 'NON_COMPLIANT' || bi?.cellularStatus === 'PENDING' ? 'red' as const : 'gray' as const,
        cameraStatus: bi?.cameraStatus === 'COMPLIANT' ? 'green' as const : bi?.cameraStatus === 'NON_COMPLIANT' || bi?.cameraStatus === 'PENDING' ? 'red' as const : 'gray' as const,
      }
    })
  }, [data, biannualData, zoneMap])

  const filteredBuildings = useMemo(() => {
    let rows = [...enrichedBuildings]

    // KPI filter
    if (kpiFilter !== 'all') {
      rows = rows.filter(b => b.status === kpiFilter)
    }

    // Search filter
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(b =>
        b.buildingName.toLowerCase().includes(q) ||
        b.region.toLowerCase().includes(q),
      )
    }

    // Sort
    rows.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case 'status':
          cmp = (STATUS_ORDER[a.status] ?? 9) - (STATUS_ORDER[b.status] ?? 9)
          break
        case 'buildingName':
          cmp = a.buildingName.localeCompare(b.buildingName)
          break
        case 'region':
          cmp = a.region.localeCompare(b.region)
          break
        case 'lastTestDate':
          cmp = (a.lastTestDate ?? '').localeCompare(b.lastTestDate ?? '')
          break
        case 'zonesTotal':
          cmp = a.zonesTotal - b.zonesTotal
          break
        case 'lastTestStatus':
          cmp = (a.lastTestStatus ?? '').localeCompare(b.lastTestStatus ?? '')
          break
        case 'cellularStatus':
          cmp = a.cellularStatus.localeCompare(b.cellularStatus)
          break
        case 'cameraStatus':
          cmp = a.cameraStatus.localeCompare(b.cameraStatus)
          break
      }
      return sortDir === 'asc' ? cmp : -cmp
    })

    return rows
  }, [enrichedBuildings, kpiFilter, search, sortKey, sortDir])

  const totalPages = Math.max(1, Math.ceil(filteredBuildings.length / PAGE_SIZE))
  const pagedBuildings = filteredBuildings.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Chart data ────────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    if (!data) return []
    return data.monthlyHistory.map(h => {
      const [, m] = h.month.split('-')
      const rate = h.total > 0 ? Math.round((h.compliant / h.total) * 100) : 0
      return {
        month: MONTH_LABELS[m] ?? m,
        rate,
        compliant: h.compliant,
        total: h.total,
      }
    })
  }, [data])

  // ── Biannual summary ─────────────────────────────────────────────────────
  const biannualSummary = useMemo(() => {
    const cellular = { compliant: 0, total: 0 }
    const camera = { compliant: 0, total: 0 }
    for (const row of biannualData) {
      // Filter by region if set
      if (region && row.region !== region) continue
      cellular.total++
      camera.total++
      if (row.cellularStatus === 'COMPLIANT') cellular.compliant++
      if (row.cameraStatus === 'COMPLIANT') camera.compliant++
    }
    return { cellular, camera }
  }, [biannualData, region])

  // ── Sort handler ──────────────────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortKey(key)
      setSortDir('asc')
    }
  }

  function sortIndicator(key: SortKey) {
    if (sortKey !== key) return ''
    return sortDir === 'asc' ? ' \u25B2' : ' \u25BC'
  }

  function toggleKpiFilter(filter: KpiFilter) {
    setKpiFilter(prev => prev === filter ? 'all' : filter)
  }

  // ── Status mapping for TrafficLight ───────────────────────────────────────
  function statusToTraffic(s: BuildingComplianceRow['status']): 'green' | 'yellow' | 'red' | 'gray' {
    if (s === 'compliant') return 'green'
    if (s === 'pending') return 'yellow'
    if (s === 'overdue') return 'red'
    return 'gray'
  }

  // ── Compliance rate highlight ─────────────────────────────────────────────
  const compRate = data?.summary.complianceRate ?? 0
  const compHighlight: 'green' | 'amber' | 'red' = compRate >= 80 ? 'green' : compRate >= 60 ? 'amber' : 'red'
  const compAccent = compRate >= 80 ? 'var(--g5)' : compRate >= 60 ? 'var(--amb)' : 'var(--red)'

  if (loading && !data) {
    return (
      <div className="fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>
        Loading alarm compliance data...
      </div>
    )
  }

  const summary = data?.summary ?? { totalBuildings: 0, compliant: 0, pendingReview: 0, overdue: 0, exempt: 0, complianceRate: 0 }

  return (
    <div className="fade-up">
      {/* ── Page Header ──────────────────────────────────────────────────── */}
      <div className="ph">
        <div>
          <h2>Alarm Compliance Dashboard</h2>
          <p>{formatMonthYear(month)}</p>
        </div>
        <div className="ph-right">
          <input
            type="month"
            className="f-inp"
            style={{ width: 170 }}
            value={month}
            onChange={e => setMonth(e.target.value)}
          />
          <select
            className="f-sel"
            style={{ width: 180 }}
            value={region}
            onChange={e => setRegion(e.target.value)}
          >
            <option value="">All Regions</option>
            {regions.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── KPI Row ──────────────────────────────────────────────────────── */}
      <div className="kpi-row">
        <KpiCard
          label="Compliance Rate"
          value={`${summary.complianceRate}%`}
          tooltip={{ what: '% of active buildings with approved test this month', how: 'Approved / Active buildings \u00d7 100' }}
          highlight={compHighlight}
          accent={compAccent}
          onClick={() => toggleKpiFilter('all')}
          selected={kpiFilter === 'all'}
        />
        <KpiCard
          label="Compliant"
          value={summary.compliant}
          tooltip={{ what: 'Buildings with an approved alarm test this month', how: 'Count of buildings where latest test status is APPROVED' }}
          highlight="green"
          accent="var(--g5)"
          onClick={() => toggleKpiFilter('compliant')}
          selected={kpiFilter === 'compliant'}
        />
        <KpiCard
          label="Pending Review"
          value={summary.pendingReview}
          tooltip={{ what: 'Buildings with a submitted test awaiting approval', how: 'Count of buildings where latest test status is SUBMITTED' }}
          accent="var(--amb)"
          onClick={() => toggleKpiFilter('pending')}
          selected={kpiFilter === 'pending'}
        />
        <KpiCard
          label="Overdue"
          value={summary.overdue}
          tooltip={{ what: 'Active buildings with no approved test this month', how: 'Active buildings minus Compliant minus Pending' }}
          highlight={summary.overdue > 0 ? 'red' : false}
          accent="var(--red)"
          onClick={() => toggleKpiFilter('overdue')}
          selected={kpiFilter === 'overdue'}
        />
        <KpiCard
          label="Exempt"
          value={summary.exempt}
          tooltip={{ what: 'Buildings temporarily exempt from testing', how: 'Count of buildings with status temporarily_exempt or closed' }}
          accent="var(--ts)"
          onClick={() => toggleKpiFilter('exempt')}
          selected={kpiFilter === 'exempt'}
        />
      </div>

      {/* ── Trend Chart ──────────────────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Monthly Compliance Trend</span>
          <span
            style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer' }}
            onClick={() => onNavigate('alarm-trends')}
          >
            View Full Trends &rarr;
          </span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip />
              <ReferenceLine y={80} stroke="#d97706" strokeDasharray="5 5" label={{ value: '80% target', position: 'right', fontSize: 10 }} />
              <Area type="monotone" dataKey="rate" stroke="#3a9458" fill="#d6f0dc" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Biannual Summary Row ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
        {/* Cellular Backup */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Cellular Backup</span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 22, fontFamily: 'DM Serif Display, serif', color: 'var(--td)', marginBottom: 8 }}>
              {biannualSummary.cellular.compliant} / {biannualSummary.cellular.total}
              <span style={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif', color: 'var(--ts)', marginLeft: 8 }}>compliant</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--ow2)', marginBottom: 10 }}>
              <div
                style={{
                  height: '100%',
                  width: biannualSummary.cellular.total > 0
                    ? `${Math.round((biannualSummary.cellular.compliant / biannualSummary.cellular.total) * 100)}%`
                    : '0%',
                  background: 'var(--g5)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span
              style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer' }}
              onClick={() => onNavigate('biannual-status')}
            >
              View Details &rarr;
            </span>
          </div>
        </div>

        {/* Camera Backup */}
        <div className="card">
          <div className="card-header">
            <span className="card-title">Camera Backup</span>
          </div>
          <div className="card-body">
            <div style={{ fontSize: 22, fontFamily: 'DM Serif Display, serif', color: 'var(--td)', marginBottom: 8 }}>
              {biannualSummary.camera.compliant} / {biannualSummary.camera.total}
              <span style={{ fontSize: 12, fontFamily: 'DM Sans, sans-serif', color: 'var(--ts)', marginLeft: 8 }}>compliant</span>
            </div>
            <div style={{ height: 8, borderRadius: 4, overflow: 'hidden', background: 'var(--ow2)', marginBottom: 10 }}>
              <div
                style={{
                  height: '100%',
                  width: biannualSummary.camera.total > 0
                    ? `${Math.round((biannualSummary.camera.compliant / biannualSummary.camera.total) * 100)}%`
                    : '0%',
                  background: 'var(--g5)',
                  borderRadius: 4,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <span
              style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer' }}
              onClick={() => onNavigate('biannual-status')}
            >
              View Details &rarr;
            </span>
          </div>
        </div>
      </div>

      {/* ── Building Compliance Table ────────────────────────────────────── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Building Compliance Status</span>
          <input
            className="f-inp"
            placeholder="Search buildings..."
            style={{ maxWidth: 260 }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="dt">
            <thead>
              <tr>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('status')}>
                  Status{sortIndicator('status')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('buildingName')}>
                  Building{sortIndicator('buildingName')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('region')}>
                  Region{sortIndicator('region')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastTestDate')}>
                  Last Test{sortIndicator('lastTestDate')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('zonesTotal')}>
                  Zones{sortIndicator('zonesTotal')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastTestStatus')}>
                  Monthly{sortIndicator('lastTestStatus')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('cellularStatus')}>
                  Cellular{sortIndicator('cellularStatus')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('cameraStatus')}>
                  Camera{sortIndicator('cameraStatus')}
                </th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedBuildings.length === 0 && (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--ts)', padding: 24 }}>
                    No buildings match the current filters.
                  </td>
                </tr>
              )}
              {pagedBuildings.map(b => (
                <tr key={b.buildingId}>
                  <td>
                    <TrafficLight status={statusToTraffic(b.status)} />
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.buildingName}</td>
                  <td>{b.region}</td>
                  <td style={{ fontSize: 12, color: 'var(--ts)' }}>
                    {b.lastTestDate ?? '\u2014'}
                  </td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <ZoneSummaryBar
                        tested={b.zonesTested}
                        notTested={Math.max(0, b.zonesTotal - b.zonesTested)}
                        issues={0}
                        total={b.zonesTotal}
                        width={70}
                      />
                      <span style={{ fontSize: 11, color: 'var(--ts)', whiteSpace: 'nowrap' }}>
                        {b.zonesTested}/{b.zonesTotal}
                      </span>
                    </div>
                  </td>
                  <td>
                    {b.lastTestStatus
                      ? <AlarmStatusBadge status={b.lastTestStatus} />
                      : <span style={{ fontSize: 11, color: 'var(--ts)' }}>{'\u2014'}</span>
                    }
                  </td>
                  <td>
                    <TrafficLight status={b.cellularStatus === 'green' ? 'green' : b.cellularStatus === 'red' ? 'red' : 'gray'} size={10} />
                  </td>
                  <td>
                    <TrafficLight status={b.cameraStatus === 'green' ? 'green' : b.cameraStatus === 'red' ? 'red' : 'gray'} size={10} />
                  </td>
                  <td>
                    <span
                      style={{ color: 'var(--g7)', cursor: 'pointer', fontSize: 12 }}
                      onClick={() => onNavigate('alarm-drilldown', { buildingId: b.buildingId })}
                    >
                      Details
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 4, padding: '12px 16px', borderTop: '1px solid var(--ow2)' }}>
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: 11 }}
              disabled={page === 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
            >
              Prev
            </button>
            {pageNums(page, totalPages).map((p, i) =>
              p === -1 ? (
                <span key={`ellipsis-${i}`} style={{ padding: '4px 6px', fontSize: 11, color: 'var(--ts)' }}>&hellip;</span>
              ) : (
                <button
                  key={p}
                  className="btn"
                  style={{
                    padding: '4px 10px',
                    fontSize: 11,
                    background: p === page ? 'var(--g7)' : 'transparent',
                    color: p === page ? '#fff' : 'var(--tm)',
                    border: p === page ? 'none' : '1px solid var(--ow2)',
                    minWidth: 30,
                  }}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ),
            )}
            <button
              className="btn btn-outline"
              style={{ padding: '4px 10px', fontSize: 11 }}
              disabled={page === totalPages}
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
