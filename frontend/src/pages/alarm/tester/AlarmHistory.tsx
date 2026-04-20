import { useState, useEffect, useMemo } from 'react'
import { listTests, listAlarmBuildings } from '../../../api/alarm'
import type { AlarmTest, AlarmBuilding } from '../../../mock/alarmData'
import KpiCard from '../../../components/KpiCard'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import AlarmStatusBadge from '../../../components/alarm/AlarmStatusBadge'
import EmptyState from '../../../components/ui/EmptyState'

interface Props {
  userName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

const STATUS_OPTIONS = ['All', 'DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] as const
const STATUS_LABELS: Record<string, string> = {
  All: 'All',
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
}

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3) return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

export default function AlarmHistory({ locationIds, onNavigate }: Props) {
  const [tests, setTests] = useState<AlarmTest[]>([])
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterMonth, setFilterMonth] = useState('')
  const [page, setPage] = useState(0)

  // ── Load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    listTests({}).then((all) => setTests(all))
    listAlarmBuildings().then((all) => setBuildings(all))
  }, [])

  // ── Building lookup map ───────────────────────────────────────────────────
  const buildingMap = useMemo(() => {
    const m: Record<string, AlarmBuilding> = {}
    for (const b of buildings) m[b.id] = b
    return m
  }, [buildings])

  // ── Filter by locationIds first (fall back to all in demo mode) ───────────
  const locationBuildings = useMemo(() => {
    if (locationIds.length === 0) return buildings
    const filtered = buildings.filter((b) => locationIds.includes(b.locationId))
    return filtered.length > 0 ? filtered : buildings
  }, [buildings, locationIds])

  const locationBuildingIds = useMemo(
    () => new Set(locationBuildings.map((b) => b.id)),
    [locationBuildings],
  )

  // ── Filtered tests ────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let result = tests.filter((t) => locationBuildingIds.has(t.buildingId))
    if (filterBuilding) result = result.filter((t) => t.buildingId === filterBuilding)
    if (filterStatus !== 'All') result = result.filter((t) => t.status === filterStatus)
    if (filterMonth) result = result.filter((t) => t.testMonth === filterMonth)
    // Sort by date descending
    result.sort((a, b) => b.testDate.localeCompare(a.testDate))
    return result
  }, [tests, locationBuildingIds, filterBuilding, filterStatus, filterMonth])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [filterBuilding, filterStatus, filterMonth])

  // ── KPI counts ────────────────────────────────────────────────────────────
  const currentYear = new Date().getFullYear().toString()
  const yearTests = tests.filter(
    (t) => locationBuildingIds.has(t.buildingId) && t.testDate.startsWith(currentYear),
  )
  const totalThisYear = yearTests.length
  const approvedCount = yearTests.filter((t) => t.status === 'APPROVED').length
  const pendingCount = yearTests.filter((t) => t.status === 'SUBMITTED').length
  const rejectedCount = yearTests.filter((t) => t.status === 'REJECTED').length

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const from = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const to = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  // ── Pill button style helper ──────────────────────────────────────────────
  const pillStyle = (active: boolean): React.CSSProperties => ({
    padding: '5px 14px',
    borderRadius: 20,
    border: `1.5px solid ${active ? 'var(--g7)' : 'var(--ow2)'}`,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    background: active ? 'var(--g7)' : 'transparent',
    color: active ? '#fff' : 'var(--tm)',
    fontFamily: 'inherit',
    transition: 'all 0.15s',
  })

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Alarm Test History</h2>
        </div>
        <div className="ph-right">
          <button className="btn btn-primary" onClick={() => onNavigate('alarm-test-form')}>
            New Test
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="kpi-row">
        <KpiCard
          label="Tests This Year"
          value={totalThisYear}
          accent="var(--g7)"
          tooltip={{ what: 'Total alarm tests recorded this calendar year.', how: 'Count of all tests with a date in the current year.' }}
        />
        <KpiCard
          label="Approved"
          value={approvedCount}
          accent="#3a9458"
          highlight="green"
          tooltip={{ what: 'Tests approved by the reviewer.', how: 'Count of tests with APPROVED status this year.' }}
        />
        <KpiCard
          label="Pending Review"
          value={pendingCount}
          accent="#d97706"
          tooltip={{ what: 'Tests submitted and awaiting approval.', how: 'Count of tests with SUBMITTED status this year.' }}
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          accent="#dc2626"
          tooltip={{ what: 'Tests that were rejected by the reviewer.', how: 'Count of tests with REJECTED status this year.' }}
        />
      </div>

      {/* ── Filter bar ── */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          {/* Building dropdown */}
          <select
            className="f-sel"
            style={{ width: 200 }}
            value={filterBuilding}
            onChange={(e) => setFilterBuilding(e.target.value)}
          >
            <option value="">All Buildings</option>
            {locationBuildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          {/* Status pills */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s}
                type="button"
                style={pillStyle(filterStatus === s)}
                onClick={() => setFilterStatus(s)}
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>

          {/* Month filter */}
          <input
            type="month"
            className="f-inp"
            style={{ width: 160 }}
            value={filterMonth}
            onChange={(e) => setFilterMonth(e.target.value)}
          />
        </div>
      </div>

      {/* ── Tests table ── */}
      {filtered.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <EmptyState icon="🔔" title="No tests found" subtitle="Adjust your filters or create a new test." />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="dt">
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Test Date</th>
                  <th>Month</th>
                  <th>Tester</th>
                  <th>Zones</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((test) => {
                  const bld = buildingMap[test.buildingId]
                  const isDraft = test.status === 'DRAFT'
                  const notTested = test.zonesTotal - test.zonesTested - test.zonesIssue
                  return (
                    <tr
                      key={test.id}
                      style={{ cursor: isDraft ? 'pointer' : undefined }}
                      onClick={isDraft ? () => onNavigate('alarm-test-form', { testId: test.id, buildingId: test.buildingId }) : undefined}
                    >
                      <td style={{ fontWeight: 500 }}>{bld?.name ?? test.buildingId}</td>
                      <td>{test.testDate}</td>
                      <td>{test.testMonth}</td>
                      <td>{test.testerName}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <ZoneSummaryBar
                            tested={test.zonesTested}
                            notTested={notTested > 0 ? notTested : 0}
                            issues={test.zonesIssue}
                            total={test.zonesTotal}
                            width={70}
                          />
                          <span style={{ fontSize: 12, color: 'var(--ts)', whiteSpace: 'nowrap' }}>
                            {test.zonesTested}/{test.zonesTotal}
                          </span>
                        </div>
                      </td>
                      <td>
                        <AlarmStatusBadge status={test.status} />
                      </td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 12, padding: '4px 12px' }}
                          onClick={(e) => {
                            e.stopPropagation()
                            onNavigate('alarm-review', { testId: test.id, fromPanel: 'alarm-history' })
                          }}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Pagination ── */}
          <div
            className="card-body"
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderTop: '1px solid var(--ow2)',
              padding: '10px 16px',
            }}
          >
            <span style={{ fontSize: 12, color: 'var(--ts)' }}>
              Showing {from}–{to} of {filtered.length} tests
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '4px 12px' }}
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              {pageNums(page, totalPages).map((n, i) =>
                n === 'gap' ? (
                  <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setPage(n)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: page === n ? 700 : 400,
                      border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`,
                      background: page === n ? 'var(--g7)' : '#fff',
                      color: page === n ? '#fff' : 'var(--tm)',
                    }}
                  >
                    {n + 1}
                  </button>
                ),
              )}
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '4px 12px' }}
                disabled={page >= totalPages - 1}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
