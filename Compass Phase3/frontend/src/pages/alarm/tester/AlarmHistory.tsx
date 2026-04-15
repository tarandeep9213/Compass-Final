import { useState, useEffect, useMemo } from 'react'
import { listTests, listAlarmBuildings, listBiannualChecks } from '../../../api/alarm'
import type { AlarmTest, AlarmBuilding, BiannualCheck } from '../../../mock/alarmData'
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

type ViewMode = 'monthly' | 'biannual'

export default function AlarmHistory({ userName, locationIds, onNavigate }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>('monthly')
  const [tests, setTests] = useState<AlarmTest[]>([])
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [biannualChecks, setBiannualChecks] = useState<BiannualCheck[]>([])
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterMonth, setFilterMonth] = useState('')
  const [biFilterBuilding, setBiFilterBuilding] = useState('')
  const [biFilterType, setBiFilterType] = useState<string>('All')
  const [biPage, setBiPage] = useState(0)
  const [page, setPage] = useState(0)
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  // ── Load data on mount ────────────────────────────────────────────────────
  useEffect(() => {
    listTests({}).then((all) => setTests(all))
    listAlarmBuildings().then((all) => setBuildings(all))
    listBiannualChecks().then((all) => setBiannualChecks(all))
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
    if (filterYear && filterMonth) result = result.filter((t) => t.testMonth === `${filterYear}-${filterMonth}`)
    else if (filterYear) result = result.filter((t) => t.testMonth.startsWith(filterYear))
    // Sort by date descending
    result.sort((a, b) => b.testDate.localeCompare(a.testDate))
    return result
  }, [tests, locationBuildingIds, filterBuilding, filterStatus, filterYear, filterMonth])

  // Reset page when filters change
  useEffect(() => { setPage(0) }, [filterBuilding, filterStatus, filterYear, filterMonth])

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

  // ── Biannual filtered data ──────────────────────────────────────────────
  const filteredBiannual = useMemo(() => {
    let result = biannualChecks.filter((c) => locationBuildingIds.has(c.buildingId))
    if (biFilterBuilding) result = result.filter((c) => c.buildingId === biFilterBuilding)
    if (biFilterType !== 'All') result = result.filter((c) => c.checkType === biFilterType)
    result.sort((a, b) => b.checkDate.localeCompare(a.checkDate))
    return result
  }, [biannualChecks, locationBuildingIds, biFilterBuilding, biFilterType])

  // Reset biannual page on filter change
  useEffect(() => { setBiPage(0) }, [biFilterBuilding, biFilterType])

  const biTotalPages = Math.max(1, Math.ceil(filteredBiannual.length / PAGE_SIZE))
  const biPageRows = filteredBiannual.slice(biPage * PAGE_SIZE, (biPage + 1) * PAGE_SIZE)
  const biFrom = filteredBiannual.length === 0 ? 0 : biPage * PAGE_SIZE + 1
  const biTo = Math.min((biPage + 1) * PAGE_SIZE, filteredBiannual.length)

  // Biannual KPIs
  const biCompliant = biannualChecks.filter((c) => locationBuildingIds.has(c.buildingId) && c.status === 'COMPLIANT').length
  const biNonCompliant = biannualChecks.filter((c) => locationBuildingIds.has(c.buildingId) && c.status === 'NON_COMPLIANT').length
  const biTotal = biannualChecks.filter((c) => locationBuildingIds.has(c.buildingId)).length

  function formatBiDate(dateStr: string): string {
    if (!dateStr) return '—'
    const d = new Date(dateStr + 'T00:00:00')
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ── Rejected test notifications ──────────────────────────────────────────
  const rejectedTests = useMemo(() => {
    return tests.filter((t) => t.status === 'REJECTED' && t.testerName === userName && locationBuildingIds.has(t.buildingId))
  }, [tests, userName, locationBuildingIds])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Alarm Test History</h2>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-test-form')}>
            Monthly Alarm Test
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('biannual-check')}>
            Biannual Alarm Test
          </button>
        </div>
      </div>

      {/* ── Rejection notifications ── */}
      {rejectedTests.filter(t => !dismissedIds.has(t.id)).map(t => {
        const bld = buildingMap[t.buildingId]
        return (
          <div key={t.id} style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderLeft: '4px solid var(--red)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 3 }}>
                Test Rejected — {bld?.name ?? t.buildingId} ({t.testMonth})
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                <strong>Reason:</strong> {t.rejectionReason ?? 'No reason provided'}
              </div>
              <button
                className="btn btn-outline"
                style={{ marginTop: 8, fontSize: 11, padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={() => {
                  setDismissedIds(prev => new Set([...prev, t.id]))
                  onNavigate('alarm-test-form', { testId: t.id, buildingId: t.buildingId })
                }}
              >
                Fix &amp; Resubmit
              </button>
            </div>
            <button
              onClick={() => setDismissedIds(prev => new Set([...prev, t.id]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fca5a5', flexShrink: 0, lineHeight: 1 }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )
      })}

      {/* ── View toggle ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16, background: '#f3f4f6', borderRadius: 10, padding: 3, width: 'fit-content' }}>
        <button
          type="button"
          onClick={() => setViewMode('monthly')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: viewMode === 'monthly' ? '#fff' : 'transparent',
            color: viewMode === 'monthly' ? 'var(--g8)' : 'var(--ts)',
            boxShadow: viewMode === 'monthly' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Monthly Tests
        </button>
        <button
          type="button"
          onClick={() => setViewMode('biannual')}
          style={{
            padding: '8px 24px',
            borderRadius: 8,
            border: 'none',
            fontSize: 13,
            fontWeight: 600,
            cursor: 'pointer',
            fontFamily: 'inherit',
            background: viewMode === 'biannual' ? '#fff' : 'transparent',
            color: viewMode === 'biannual' ? 'var(--g8)' : 'var(--ts)',
            boxShadow: viewMode === 'biannual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            transition: 'all 0.15s',
          }}
        >
          Biannual Checks
        </button>
      </div>

      {viewMode === 'monthly' && <>
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

          {/* Year + Month filters grouped */}
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <select
              className="f-sel"
              style={{ width: 100 }}
              value={filterYear}
              onChange={(e) => { setFilterYear(e.target.value); setFilterMonth('') }}
            >
              <option value="">All Years</option>
              {[2026, 2025, 2024, 2023].map((y) => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <select
              className="f-sel"
              style={{ width: 130 }}
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              disabled={!filterYear}
            >
              <option value="">All Months</option>
              {[
                ['01','January'],['02','February'],['03','March'],['04','April'],
                ['05','May'],['06','June'],['07','July'],['08','August'],
                ['09','September'],['10','October'],['11','November'],['12','December'],
              ].map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
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
                        {isDraft ? (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigate('alarm-test-form', { testId: test.id, buildingId: test.buildingId })
                            }}
                          >
                            Continue
                          </button>
                        ) : test.status === 'REJECTED' ? (
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: 12, padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              onNavigate('alarm-test-form', { testId: test.id, buildingId: test.buildingId })
                            }}
                          >
                            Fix &amp; Resubmit
                          </button>
                        ) : (
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
                        )}
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
      </>}

      {viewMode === 'biannual' && <>
      {/* ── Biannual KPI row ── */}
      <div className="kpi-row">
        <KpiCard
          label="Total Checks"
          value={biTotal}
          accent="var(--g7)"
          tooltip={{ what: 'Total biannual checks recorded.', how: 'Count of all cellular and camera backup checks.' }}
        />
        <KpiCard
          label="Compliant"
          value={biCompliant}
          accent="#3a9458"
          highlight="green"
          tooltip={{ what: 'Checks that passed.', how: 'Count of checks with COMPLIANT status.' }}
        />
        <KpiCard
          label="Non-Compliant"
          value={biNonCompliant}
          accent="#dc2626"
          tooltip={{ what: 'Checks that failed.', how: 'Count of checks with NON_COMPLIANT status.' }}
        />
      </div>

      {/* ── Biannual filter bar ── */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
          <select
            className="f-sel"
            style={{ width: 200 }}
            value={biFilterBuilding}
            onChange={(e) => setBiFilterBuilding(e.target.value)}
          >
            <option value="">All Buildings</option>
            {locationBuildings.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>

          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            {(['All', 'CELLULAR_BACKUP', 'CAMERA_BACKUP'] as const).map((t) => (
              <button
                key={t}
                type="button"
                style={pillStyle(biFilterType === t)}
                onClick={() => setBiFilterType(t)}
              >
                {t === 'All' ? 'All' : t === 'CELLULAR_BACKUP' ? 'Cellular' : 'Camera'}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Biannual table ── */}
      {filteredBiannual.length === 0 ? (
        <div className="card">
          <div className="card-body">
            <EmptyState icon="🔔" title="No biannual checks found" subtitle="Adjust your filters or record a new check." />
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="card-body" style={{ padding: 0 }}>
            <table className="dt">
              <thead>
                <tr>
                  <th>Check Type</th>
                  <th>Building</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Checked By</th>
                  <th>Next Due</th>
                  <th>Notes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {biPageRows.map((check) => {
                  const bld = buildingMap[check.buildingId]
                  return (
                    <tr key={check.id}>
                      <td>
                        {check.checkType === 'CELLULAR_BACKUP' ? (
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#dbeafe', color: '#1e40af' }}>Cellular</span>
                        ) : (
                          <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#ede9fe', color: '#5b21b6' }}>Camera</span>
                        )}
                      </td>
                      <td style={{ fontWeight: 500 }}>{bld?.name ?? check.buildingId}</td>
                      <td>{formatBiDate(check.checkDate)}</td>
                      <td>
                        {check.status === 'COMPLIANT' ? (
                          <span className="badge badge-green"><span className="bdot" /> Compliant</span>
                        ) : check.status === 'NON_COMPLIANT' ? (
                          <span className="badge badge-red"><span className="bdot" /> Non-Compliant</span>
                        ) : (
                          <span className="badge badge-amber"><span className="bdot" /> Pending</span>
                        )}
                      </td>
                      <td>{check.checkedByName}</td>
                      <td>{formatBiDate(check.nextDueDate)}</td>
                      <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{check.notes ?? '—'}</td>
                      <td>
                        {check.status === 'PENDING' ? (
                          <button
                            className="btn btn-primary"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => onNavigate('biannual-check', { buildingId: check.buildingId })}
                          >
                            Continue
                          </button>
                        ) : check.status === 'NON_COMPLIANT' ? (
                          <button
                            className="btn btn-outline"
                            style={{ fontSize: 12, padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}
                            onClick={() => onNavigate('biannual-check', { buildingId: check.buildingId })}
                          >
                            Fix &amp; Resubmit
                          </button>
                        ) : (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 12, padding: '4px 12px' }}
                            onClick={() => onNavigate('biannual-check', { buildingId: check.buildingId })}
                          >
                            View
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* ── Biannual Pagination ── */}
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
              Showing {biFrom}–{biTo} of {filteredBiannual.length} checks
            </span>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '4px 12px' }}
                disabled={biPage === 0}
                onClick={() => setBiPage((p) => p - 1)}
              >
                ← Prev
              </button>
              {pageNums(biPage, biTotalPages).map((n, i) =>
                n === 'gap' ? (
                  <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>
                    …
                  </span>
                ) : (
                  <button
                    key={n}
                    onClick={() => setBiPage(n)}
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 6,
                      fontSize: 12,
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontWeight: biPage === n ? 700 : 400,
                      border: `1px solid ${biPage === n ? 'var(--g4)' : 'var(--ow2)'}`,
                      background: biPage === n ? 'var(--g7)' : '#fff',
                      color: biPage === n ? '#fff' : 'var(--tm)',
                    }}
                  >
                    {n + 1}
                  </button>
                ),
              )}
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12, padding: '4px 12px' }}
                disabled={biPage >= biTotalPages - 1}
                onClick={() => setBiPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          </div>
        </div>
      )}
      </>}
    </div>
  )
}
