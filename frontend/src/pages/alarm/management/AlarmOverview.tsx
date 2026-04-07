import { useState, useEffect, useMemo } from 'react'
import { getAlarmOverview } from '../../../api/alarm'
import KpiCard from '../../../components/KpiCard'
import TrafficLight from '../../../components/alarm/TrafficLight'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'

import type { AlarmOverviewData, BuildingComplianceRow } from '../../../api/alarm'
import type { BiannualStatusRow } from '../../../api/alarm'
import { getBiannualStatus } from '../../../api/alarm'
import { listZones, getComplianceRules, listAlarmBuildings, listAlarmUsers } from '../../../api/alarm'
import type { ComplianceRules, AlarmBuilding, AlarmUser } from '../../../mock/alarmData'

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

type SortKey = 'status' | 'buildingName' | 'region' | 'lastTestDate' | 'zonesTotal' | 'cellularStatus' | 'cameraStatus'
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
  escalationTier: 0 | 1 | 2 | 3
  testerNames: string[]
  approverNameFull: string
}

export default function AlarmOverview({ adminName: _adminName, onNavigate }: Props) {
  const [month, setMonth] = useState(curMonthValue())
  const [region, setRegion] = useState('')
  const [data, setData] = useState<AlarmOverviewData | null>(null)
  const [biannualData, setBiannualData] = useState<BiannualStatusRow[]>([])
  const [zoneMap, setZoneMap] = useState<Record<string, { total: number; tested: number }>>({})
  const [rules, setRules] = useState<ComplianceRules | null>(null)
  const [alarmBuildings, setAlarmBuildings] = useState<AlarmBuilding[]>([])
  const [alarmUsers, setAlarmUsers] = useState<AlarmUser[]>([])
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
      getComplianceRules(),
      listAlarmBuildings(),
      listAlarmUsers(),
    ])
      .then(([overview, biannual, compRules, blds, usrs]) => {
        setData(overview)
        setBiannualData(biannual)
        setRules(compRules)
        setAlarmBuildings(blds)
        setAlarmUsers(usrs)

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
    // Compute days since deadline for escalation tier
    const deadlineDay = rules?.monthlyDeadlineDay ?? 15
    const [mYear, mMonth] = month.split('-').map(Number)
    const deadline = new Date(mYear, mMonth - 1, deadlineDay)
    const now = new Date()
    const daysOverdue = Math.max(0, Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)))
    const tier3After = rules?.escalation.tier3.daysAfter ?? 14
    const tier2After = rules?.escalation.tier2.daysAfter ?? 7
    const tier1Before = rules?.escalation.tier1.daysBefore ?? 5

    return data.buildings.map(b => {
      const bi = biannualData.find(r => r.buildingId === b.buildingId)
      const zones = zoneMap[b.buildingId] ?? { total: 0, tested: 0 }
      const bld = alarmBuildings.find(x => x.id === b.buildingId)

      // Determine escalation tier for overdue buildings
      let escalationTier: 0 | 1 | 2 | 3 = 0
      if (b.status === 'overdue') {
        if (daysOverdue >= tier3After) escalationTier = 3
        else if (daysOverdue >= tier2After) escalationTier = 2
        else if (now >= new Date(mYear, mMonth - 1, deadlineDay - tier1Before)) escalationTier = 1
      }

      // Resolve tester and approver names
      const testerNames = (bld?.assignedTesters ?? []).map(tid => alarmUsers.find(u => u.id === tid)?.name ?? tid)
      const approverNameFull = bld?.assignedApprover ? (alarmUsers.find(u => u.id === bld.assignedApprover)?.name ?? bld.assignedApprover) : ''

      return {
        ...b,
        zonesTotal: zones.total,
        zonesTested: zones.tested,
        cellularStatus: bi?.cellularStatus === 'COMPLIANT' ? 'green' as const : bi?.cellularStatus === 'NON_COMPLIANT' || bi?.cellularStatus === 'PENDING' ? 'red' as const : 'gray' as const,
        cameraStatus: bi?.cameraStatus === 'COMPLIANT' ? 'green' as const : bi?.cameraStatus === 'NON_COMPLIANT' || bi?.cameraStatus === 'PENDING' ? 'red' as const : 'gray' as const,
        escalationTier,
        testerNames,
        approverNameFull,
      }
    })
  }, [data, biannualData, zoneMap, rules, month, alarmBuildings, alarmUsers])

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

  // ── Export helpers ─────────────────────────────────────────────────────
  function downloadCsv(filename: string, headers: string[], rows: string[][]) {
    const csvContent = [headers.join(','), ...rows.map(r => r.map(c => `"${(c ?? '').replace(/"/g, '""')}"`).join(','))].join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  function exportBuildingReport(format: 'csv' | 'pdf') {
    const headers = ['Building', 'Region', 'Status', 'Testers', 'Approver', 'Last Test Date', 'Zones Total', 'Cellular', 'Camera']
    const rows = filteredBuildings.map(b => [
      b.buildingName,
      b.region,
      b.status,
      b.testerNames.join('; '),
      b.approverNameFull,
      b.lastTestDate ?? '',
      String(b.zonesTotal),
      b.cellularStatus,
      b.cameraStatus,
    ])
    if (format === 'csv') {
      downloadCsv(`building-compliance-${month}.csv`, headers, rows)
    } else {
      // Generate printable HTML for PDF
      const html = `<html><head><title>Building Compliance Report - ${formatMonthYear(month)}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left}th{background:#f0f0f0;font-weight:600}.compliant{color:#16a34a}.overdue{color:#dc2626}.pending{color:#d97706}.exempt{color:#888}</style></head>
        <body><h1>Building Compliance Report — ${formatMonthYear(month)}${region ? ' — ' + region : ''}</h1>
        <p>Generated: ${new Date().toLocaleDateString()} | Buildings: ${rows.length}</p>
        <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${i === 2 ? ` class="${c}"` : ''}>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
      const w = window.open('', '_blank')
      if (w) { w.document.write(html); w.document.close(); w.print() }
    }
  }

  function exportRegionReport(format: 'csv' | 'pdf') {
    // Aggregate by region
    const regionMap = new Map<string, { total: number; compliant: number; pending: number; overdue: number; exempt: number }>()
    for (const b of enrichedBuildings) {
      const entry = regionMap.get(b.region) ?? { total: 0, compliant: 0, pending: 0, overdue: 0, exempt: 0 }
      entry.total++
      if (b.status === 'compliant') entry.compliant++
      else if (b.status === 'pending') entry.pending++
      else if (b.status === 'overdue') entry.overdue++
      else if (b.status === 'exempt') entry.exempt++
      regionMap.set(b.region, entry)
    }
    const headers = ['Region', 'Total Buildings', 'Compliant', 'Pending', 'Overdue', 'Exempt', 'Compliance Rate']
    const rows = Array.from(regionMap.entries()).sort((a, b) => a[0].localeCompare(b[0])).map(([r, s]) => {
      const active = s.total - s.exempt
      const rate = active > 0 ? Math.round((s.compliant / active) * 100) : 0
      return [r, String(s.total), String(s.compliant), String(s.pending), String(s.overdue), String(s.exempt), `${rate}%`]
    })
    if (format === 'csv') {
      downloadCsv(`region-compliance-${month}.csv`, headers, rows)
    } else {
      const html = `<html><head><title>Region Compliance Report - ${formatMonthYear(month)}</title>
        <style>body{font-family:Arial,sans-serif;padding:20px}h1{font-size:18px}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;font-size:12px;text-align:left}th{background:#f0f0f0;font-weight:600}</style></head>
        <body><h1>Region Compliance Report — ${formatMonthYear(month)}</h1>
        <p>Generated: ${new Date().toLocaleDateString()} | Regions: ${rows.length}</p>
        <table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`
      const w = window.open('', '_blank')
      if (w) { w.document.write(html); w.document.close(); w.print() }
    }
  }

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

      {/* ── Export Buttons ─────────────────────────────────────────────── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Export Compliance Reports</span>
        </div>
        <div className="card-body" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 220, padding: 12, border: '1px solid var(--ow2)', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Per Building Report</div>
            <p style={{ fontSize: 11, color: 'var(--ts)', margin: '0 0 10px' }}>
              Detailed compliance status for each building{region ? ` in ${region}` : ''} — {formatMonthYear(month)}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => exportBuildingReport('csv')}>
                Export CSV
              </button>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => exportBuildingReport('pdf')}>
                Export PDF
              </button>
            </div>
          </div>
          <div style={{ flex: 1, minWidth: 220, padding: 12, border: '1px solid var(--ow2)', borderRadius: 8 }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>Per Region Report</div>
            <p style={{ fontSize: 11, color: 'var(--ts)', margin: '0 0 10px' }}>
              Aggregated compliance summary by region — {formatMonthYear(month)}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => exportRegionReport('csv')}>
                Export CSV
              </button>
              <button className="btn btn-outline" style={{ fontSize: 11, padding: '4px 12px' }} onClick={() => exportRegionReport('pdf')}>
                Export PDF
              </button>
            </div>
          </div>
        </div>
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
              <Tooltip
                formatter={(value: unknown, _name: unknown, props: unknown) => {
                  const p = (props as { payload?: { compliant: number; total: number } })?.payload
                  return [`${value}% (${p?.compliant ?? 0} of ${p?.total ?? 0} buildings)`, 'Compliance Rate']
                }}
              />
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
                <th>Testers</th>
                <th>Approver</th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('lastTestDate')}>
                  Last Test{sortIndicator('lastTestDate')}
                </th>
                <th style={{ cursor: 'pointer' }} onClick={() => handleSort('zonesTotal')}>
                  Zones{sortIndicator('zonesTotal')}
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
                  <td colSpan={10} style={{ textAlign: 'center', color: 'var(--ts)', padding: 24 }}>
                    No buildings match the current filters.
                  </td>
                </tr>
              )}
              {pagedBuildings.map(b => (
                <tr key={b.buildingId}>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <TrafficLight status={statusToTraffic(b.status)} />
                      {b.escalationTier > 0 && (
                        <span
                          title={
                            b.escalationTier === 1
                              ? `Tier 1 — Reminder: ${rules?.escalation.tier1.daysBefore ?? 5} days before deadline → Tester notified`
                              : b.escalationTier === 2
                              ? `Tier 2 — Overdue: ${rules?.escalation.tier2.daysAfter ?? 7}+ days past deadline → Tester & Approver notified`
                              : `Tier 3 — Critical: ${rules?.escalation.tier3.daysAfter ?? 14}+ days past deadline → Tester, Approver & Regional notified`
                          }
                          style={{
                            fontSize: 9,
                            fontWeight: 700,
                            padding: '1px 5px',
                            borderRadius: 4,
                            background: b.escalationTier === 3 ? '#dc2626' : b.escalationTier === 2 ? '#ea580c' : '#d97706',
                            color: '#fff',
                            cursor: 'help',
                          }}
                        >
                          T{b.escalationTier}
                        </span>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 600 }}>{b.buildingName}</td>
                  <td>{b.region}</td>
                  <td style={{ fontSize: 12 }}>
                    {b.testerNames.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                        {b.testerNames.map((name, i) => (
                          <span key={i} style={{ whiteSpace: 'nowrap' }}>{name}</span>
                        ))}
                      </div>
                    ) : (
                      <span style={{ color: 'var(--ts)' }}>{'\u2014'}</span>
                    )}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {b.approverNameFull || <span style={{ color: 'var(--ts)' }}>{'\u2014'}</span>}
                  </td>
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

        {/* Escalation Legend */}
        {enrichedBuildings.some(b => b.escalationTier > 0) && (
          <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ow2)', display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'var(--tm)' }}>Auto-Escalation Tiers:</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#d97706', color: '#fff' }}>T1</span>
              <span style={{ fontSize: 11, color: 'var(--ts)' }}>Reminder — {rules?.escalation.tier1.daysBefore ?? 5} days before deadline (Tester)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#ea580c', color: '#fff' }}>T2</span>
              <span style={{ fontSize: 11, color: 'var(--ts)' }}>Overdue — {rules?.escalation.tier2.daysAfter ?? 7}+ days past deadline (Tester + Approver)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <span style={{ fontSize: 9, fontWeight: 700, padding: '1px 5px', borderRadius: 4, background: '#dc2626', color: '#fff' }}>T3</span>
              <span style={{ fontSize: 11, color: 'var(--ts)' }}>Critical — {rules?.escalation.tier3.daysAfter ?? 14}+ days past deadline (Tester + Approver + Regional)</span>
            </div>
          </div>
        )}

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
