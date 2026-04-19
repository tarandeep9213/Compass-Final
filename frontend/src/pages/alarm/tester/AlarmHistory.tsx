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

export default function AlarmHistory({ locationIds, onNavigate }: Props) {
  const [activeTab, setActiveTab] = useState<'monthly' | 'biannual'>('monthly')
  const [tests, setTests] = useState<AlarmTest[]>([])
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [biannualChecks, setBiannualChecks] = useState<BiannualCheck[]>([])
  const [filterBuilding, setFilterBuilding] = useState('')
  const [filterStatus, setFilterStatus] = useState<string>('All')
  const [filterYear, setFilterYear] = useState(String(new Date().getFullYear()))
  const [filterMonth, setFilterMonth] = useState('')
  const [page, setPage] = useState(0)
  const [biPage, setBiPage] = useState(0)
  const [biFilterStatus, setBiFilterStatus] = useState<string>('All')

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
          <p style={{ color: 'var(--ts)', fontSize: 13, margin: '4px 0 0' }}>View all alarm tests across your assigned buildings</p>
        </div>
        <div className="ph-right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" data-screenshot-trigger="nav-test-form" onClick={() => onNavigate('alarm-test-form')}>🔔 Monthly Alarm Test</button>
          <button className="btn btn-outline" data-screenshot-trigger="nav-biannual-form" onClick={() => onNavigate('biannual-check')}>📋 Biannual Checks</button>
        </div>
      </div>

      {/* ── Tab toggle ── */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 16 }}>
        {(['monthly', 'biannual'] as const).map(tab => (
          <button key={tab}
            data-screenshot-trigger={tab === 'biannual' ? 'tab-biannual' : 'tab-monthly'}
            onClick={() => { setActiveTab(tab); setPage(0); setBiPage(0) }}
            style={{
              padding: '9px 20px', fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              border: '1.5px solid var(--g4)', borderRight: tab === 'monthly' ? 'none' : undefined,
              borderRadius: tab === 'monthly' ? '8px 0 0 8px' : '0 8px 8px 0',
              background: activeTab === tab ? 'var(--g7)' : '#fff',
              color: activeTab === tab ? '#fff' : 'var(--g7)',
            }}>
            {tab === 'monthly' ? '🔔 Monthly Tests' : '📋 Biannual Checks'}
          </button>
        ))}
      </div>

      {activeTab === 'monthly' && <>
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
            onChange={(e) => { setFilterBuilding(e.target.value); setPage(0) }}
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
                onClick={() => { setFilterStatus(s); setPage(0) }}
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
              onChange={(e) => { setFilterYear(e.target.value); setFilterMonth(''); setPage(0) }}
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
              onChange={(e) => { setFilterMonth(e.target.value); setPage(0) }}
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

      {activeTab === 'biannual' && (() => {
        const getApprovalStatus = (c: BiannualCheck) => c.approval_status || 'SUBMITTED'
        const filteredBi = biannualChecks
          .filter(c => !filterBuilding || c.buildingId === filterBuilding)
          .filter(c => biFilterStatus === 'All' || getApprovalStatus(c) === biFilterStatus)
          .sort((a, b) => b.checkDate.localeCompare(a.checkDate))
        const biTotalPages = Math.max(1, Math.ceil(filteredBi.length / PAGE_SIZE))
        const biRows = filteredBi.slice(biPage * PAGE_SIZE, (biPage + 1) * PAGE_SIZE)

        const cellularCount = biannualChecks.filter(c => c.checkType === 'CELLULAR_BACKUP').length
        const cameraCount = biannualChecks.filter(c => c.checkType === 'CAMERA_BACKUP').length
        const biPendingCount = biannualChecks.filter(c => getApprovalStatus(c) === 'SUBMITTED').length
        const biRejectedCount = biannualChecks.filter(c => getApprovalStatus(c) === 'REJECTED').length

        return <>
          {/* KPI row */}
          <div className="kpi-row">
            <KpiCard label="Total Checks" value={biannualChecks.length} accent="var(--g7)"
              tooltip={{ what: 'Total biannual checks recorded.', how: 'Count of all cellular and camera checks.' }} />
            <KpiCard label="Cellular" value={cellularCount} accent="#2563eb"
              tooltip={{ what: 'Cellular backup checks.', how: 'Count of CELLULAR_BACKUP type checks.' }} />
            <KpiCard label="Camera" value={cameraCount} accent="#7c3aed"
              tooltip={{ what: '30-day camera backup checks.', how: 'Count of CAMERA_BACKUP type checks.' }} />
            <KpiCard label="Pending Review" value={biPendingCount} accent="#d97706"
              tooltip={{ what: 'Checks awaiting approval.', how: 'Count of checks with SUBMITTED approval status.' }} />
            <KpiCard label="Rejected" value={biRejectedCount} accent="#dc2626"
              tooltip={{ what: 'Checks that were rejected.', how: 'Count of checks with REJECTED approval status.' }} />
          </div>

          {/* Filter */}
          <div className="card">
            <div className="card-header" style={{ flexWrap: 'wrap', gap: 12 }}>
              <select className="f-sel" style={{ width: 200 }} value={filterBuilding}
                onChange={e => { setFilterBuilding(e.target.value); setBiPage(0) }}>
                <option value="">All Buildings</option>
                {buildings.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
              </select>

              {/* Status pills */}
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                {STATUS_OPTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    style={pillStyle(biFilterStatus === s)}
                    onClick={() => { setBiFilterStatus(s); setBiPage(0) }}
                  >
                    {STATUS_LABELS[s]}
                  </button>
                ))}
              </div>
            </div>

            {biRows.length === 0 ? (
              <EmptyState icon="📋" title="No biannual checks found" subtitle="Adjust your filters or record a new check." />
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table className="dt" style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Building</th>
                      <th>Type</th>
                      <th>Result</th>
                      <th>Status</th>
                      <th>Checked By</th>
                      <th>Next Due</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {biRows.map(c => {
                      const bld = buildings.find(b => b.id === c.buildingId)
                      const approvalSt = getApprovalStatus(c)
                      return (
                        <tr key={c.id}>
                          <td>{new Date(c.checkDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                          <td style={{ fontWeight: 600 }}>{bld?.name ?? c.buildingId}</td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
                              background: c.checkType === 'CELLULAR_BACKUP' ? '#dbeafe' : '#f3e8ff',
                              color: c.checkType === 'CELLULAR_BACKUP' ? '#1e40af' : '#6b21a8',
                            }}>
                              {c.checkType === 'CELLULAR_BACKUP' ? 'Cellular' : 'Camera'}
                            </span>
                          </td>
                          <td>
                            <span style={{
                              fontSize: 11, fontWeight: 600, padding: '2px 10px', borderRadius: 12,
                              background: c.status === 'COMPLIANT' ? '#dcfce7' : c.status === 'NON_COMPLIANT' ? '#fef2f2' : '#fef9c3',
                              color: c.status === 'COMPLIANT' ? '#166534' : c.status === 'NON_COMPLIANT' ? '#991b1b' : '#854d0e',
                            }}>
                              {c.status === 'COMPLIANT' ? 'Compliant' : c.status === 'NON_COMPLIANT' ? 'Non-Compliant' : 'Pending'}
                            </span>
                          </td>
                          <td>
                            <AlarmStatusBadge status={approvalSt} />
                          </td>
                          <td>{c.checkedByName || '—'}</td>
                          <td>{c.nextDueDate ? new Date(c.nextDueDate + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}</td>
                          <td>
                            {approvalSt === 'DRAFT' ? (
                              <button
                                className="btn btn-primary"
                                style={{ fontSize: 12, padding: '4px 12px' }}
                                onClick={() => onNavigate('biannual-check', { buildingId: c.buildingId })}
                              >
                                Continue
                              </button>
                            ) : approvalSt === 'REJECTED' ? (
                              <button
                                className="btn btn-outline"
                                style={{ fontSize: 12, padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}
                                onClick={() => onNavigate('biannual-check', { buildingId: c.buildingId })}
                              >
                                Fix &amp; Resubmit
                              </button>
                            ) : (
                              <button
                                className="btn btn-ghost"
                                style={{ fontSize: 12, padding: '4px 12px' }}
                                onClick={() => onNavigate('biannual-check', { buildingId: c.buildingId })}
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
            )}

            {/* Pagination */}
            {biTotalPages > 1 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid var(--ow2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>
                  {filteredBi.length} check{filteredBi.length !== 1 ? 's' : ''}
                </span>
                <div style={{ display: 'flex', gap: 4 }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}
                    disabled={biPage === 0} onClick={() => setBiPage(p => p - 1)}>← Prev</button>
                  <span style={{ fontSize: 12, padding: '4px 8px', color: 'var(--ts)' }}>
                    {biPage + 1} / {biTotalPages}
                  </span>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }}
                    disabled={biPage >= biTotalPages - 1} onClick={() => setBiPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            )}
          </div>
        </>
      })()}
    </div>
  )
}
