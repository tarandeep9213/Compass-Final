import { useState, useEffect, useMemo } from 'react'
import { listTests, listAlarmBuildings } from '../../../api/alarm'
import type { AlarmTest, AlarmBuilding } from '../../../mock/alarmData'
import KpiCard from '../../../components/KpiCard'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import { toast } from '../../../components/ui/Toast'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

function currentMonth(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function daysSince(iso?: string): number {
  if (!iso) return 0
  return Math.floor((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60 * 24))
}

function pageNums(total: number, current: number): (number | '...')[] {
  const last = Math.ceil(total / PAGE_SIZE)
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1)
  const pages: (number | '...')[] = [1]
  if (current > 3) pages.push('...')
  for (let i = Math.max(2, current - 1); i <= Math.min(last - 1, current + 1); i++) pages.push(i)
  if (current < last - 2) pages.push('...')
  pages.push(last)
  return pages
}

export default function AlarmApproval({ adminName: _adminName, onNavigate }: Props) {
  const [pendingTests, setPendingTests] = useState<AlarmTest[]>([])
  const [approvedTests, setApprovedTests] = useState<AlarmTest[]>([])
  const [rejectedTests, setRejectedTests] = useState<AlarmTest[]>([])
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [regionFilter, setRegionFilter] = useState('')
  const [sortNewest, setSortNewest] = useState(false)
  const [page, setPage] = useState(1)

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    const month = currentMonth()
    Promise.all([
      listTests({ status: 'SUBMITTED' }),
      listTests({ status: 'APPROVED' }),
      listTests({ status: 'REJECTED' }),
      listAlarmBuildings(),
    ])
      .then(([submitted, approved, rejected, blds]) => {
        setPendingTests(submitted)
        setApprovedTests(approved.filter((t) => t.testMonth === month))
        setRejectedTests(rejected.filter((t) => t.testMonth === month))
        setBuildings(blds)
      })
      .catch(() => toast.error('Failed to load approval data'))
      .finally(() => setLoading(false))
  }, [])

  // ── Building lookup ───────────────────────────────────────────────────────
  const buildingMap = useMemo(() => {
    const map: Record<string, AlarmBuilding> = {}
    for (const b of buildings) map[b.id] = b
    return map
  }, [buildings])

  // ── Regions ───────────────────────────────────────────────────────────────
  const regions = useMemo(() => {
    const set = new Set(buildings.map((b) => b.region))
    return Array.from(set).sort()
  }, [buildings])

  // ── Filtered + sorted tests ───────────────────────────────────────────────
  const filteredTests = useMemo(() => {
    let list = [...pendingTests]
    if (regionFilter) {
      list = list.filter((t) => {
        const b = buildingMap[t.buildingId]
        return b && b.region === regionFilter
      })
    }
    list.sort((a, b) => {
      const da = a.submittedAt ?? a.testDate
      const db = b.submittedAt ?? b.testDate
      return sortNewest ? db.localeCompare(da) : da.localeCompare(db)
    })
    return list
  }, [pendingTests, regionFilter, sortNewest, buildingMap])

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.ceil(filteredTests.length / PAGE_SIZE)
  const pagedTests = filteredTests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── KPI calculations ──────────────────────────────────────────────────────
  const pendingCount = pendingTests.length
  const approvedCount = approvedTests.length
  const rejectedCount = rejectedTests.length

  // Avg review time: days between submittedAt and approvedAt for approved tests
  const avgReviewTime = useMemo(() => {
    const withTimes = approvedTests.filter((t) => t.submittedAt && t.approvedAt)
    if (withTimes.length === 0) return '—'
    const total = withTimes.reduce((sum, t) => {
      const diff = new Date(t.approvedAt!).getTime() - new Date(t.submittedAt!).getTime()
      return sum + diff / (1000 * 60 * 60 * 24)
    }, 0)
    return `${(total / withTimes.length).toFixed(1)} days`
  }, [approvedTests])

  // ── Escalation alert ──────────────────────────────────────────────────────
  const staleCount = pendingTests.filter((t) => daysSince(t.submittedAt) > 3).length

  // ── Loading state ─────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--ts)' }}>
        Loading approvals...
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Alarm Test Approvals</h2>
          <p>Review and approve submitted alarm tests</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-escalation')}>
            Escalations
          </button>
        </div>
      </div>

      {/* ── KPI row ── */}
      <div className="kpi-row">
        <KpiCard
          label="Pending Review"
          value={pendingCount}
          highlight={pendingCount > 0 ? 'amber' : false}
          accent="var(--amb)"
          tooltip={{ what: 'Tests awaiting your review', how: 'Count of tests in SUBMITTED status' }}
        />
        <KpiCard
          label="Approved This Month"
          value={approvedCount}
          accent="var(--g5)"
          tooltip={{ what: 'Tests approved this month', how: 'Count of APPROVED tests for current month' }}
        />
        <KpiCard
          label="Rejected This Month"
          value={rejectedCount}
          accent="var(--red)"
          tooltip={{ what: 'Tests rejected this month', how: 'Count of REJECTED tests for current month' }}
        />
        <KpiCard
          label="Avg Review Time"
          value={avgReviewTime}
          accent="var(--g7)"
          tooltip={{ what: 'Average days to review', how: 'Mean time between submission and approval for approved tests this month' }}
        />
      </div>

      {/* ── Stale alert banner ── */}
      {staleCount > 0 && (
        <div className="alert-warn">
          <span>&#9888;</span>
          <span>{staleCount} test{staleCount !== 1 ? 's have' : ' has'} been waiting for review for more than 3 days</span>
        </div>
      )}

      {/* ── Queue card ── */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="card-title">Pending Tests</span>
            <select
              className="f-sel"
              style={{ width: 180 }}
              value={regionFilter}
              onChange={(e) => { setRegionFilter(e.target.value); setPage(1) }}
            >
              <option value="">All Regions</option>
              {regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            <button
              className="btn"
              style={{
                borderRadius: '16px 0 0 16px',
                border: '1.5px solid var(--ow2)',
                background: !sortNewest ? 'var(--g0)' : 'transparent',
                color: !sortNewest ? 'var(--g7)' : 'var(--ts)',
                fontWeight: !sortNewest ? 600 : 400,
                fontSize: 11,
                padding: '5px 14px',
              }}
              onClick={() => { setSortNewest(false); setPage(1) }}
            >
              Oldest First
            </button>
            <button
              className="btn"
              style={{
                borderRadius: '0 16px 16px 0',
                border: '1.5px solid var(--ow2)',
                borderLeft: 'none',
                background: sortNewest ? 'var(--g0)' : 'transparent',
                color: sortNewest ? 'var(--g7)' : 'var(--ts)',
                fontWeight: sortNewest ? 600 : 400,
                fontSize: 11,
                padding: '5px 14px',
              }}
              onClick={() => { setSortNewest(true); setPage(1) }}
            >
              Newest First
            </button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {filteredTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ts)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>&#10003;</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>No tests pending review</div>
              <div style={{ fontSize: 12 }}>All caught up!</div>
            </div>
          ) : (
            <>
              <table className="dt">
                <thead>
                  <tr>
                    <th>Building</th>
                    <th>Region</th>
                    <th>Test Date</th>
                    <th>Tester</th>
                    <th>Zones</th>
                    <th>Waiting Since</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTests.map((t) => {
                    const b = buildingMap[t.buildingId]
                    const bName = b?.name ?? t.buildingId
                    const bRegion = b?.region ?? '—'
                    const waiting = daysSince(t.submittedAt)
                    const isStale = waiting > 3
                    const incomplete = t.zonesTested < t.zonesTotal

                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{bName}</td>
                        <td>{bRegion}</td>
                        <td>{formatDate(t.testDate)}</td>
                        <td>{t.testerName}</td>
                        <td style={{ background: incomplete ? '#fef2f2' : undefined }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <ZoneSummaryBar
                              width={80}
                              tested={t.zonesTested}
                              notTested={t.zonesTotal - t.zonesTested - t.zonesIssue}
                              issues={t.zonesIssue}
                              total={t.zonesTotal}
                            />
                            <span style={{ fontSize: 11, color: 'var(--ts)', whiteSpace: 'nowrap' }}>
                              {t.zonesTested}/{t.zonesTotal}
                            </span>
                          </div>
                        </td>
                        <td
                          style={{
                            color: isStale ? 'var(--red)' : undefined,
                            fontWeight: isStale ? 700 : undefined,
                          }}
                        >
                          {waiting}d
                        </td>
                        <td>
                          <button
                            className="btn btn-primary"
                            style={{ padding: '5px 14px', fontSize: 12 }}
                            onClick={() =>
                              onNavigate('alarm-review', {
                                testId: t.id,
                                fromPanel: 'alarm-approval',
                              })
                            }
                          >
                            Review
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'center',
                    gap: 4,
                    padding: '14px 0',
                    borderTop: '1px solid var(--ow2)',
                  }}
                >
                  {pageNums(filteredTests.length, page).map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} style={{ padding: '6px 4px', fontSize: 12, color: 'var(--ts)' }}>
                        ...
                      </span>
                    ) : (
                      <button
                        key={p}
                        className="btn"
                        style={{
                          padding: '5px 11px',
                          fontSize: 12,
                          borderRadius: 6,
                          border: '1px solid var(--ow2)',
                          background: p === page ? 'var(--g7)' : 'transparent',
                          color: p === page ? '#fff' : 'var(--tm)',
                          fontWeight: p === page ? 600 : 400,
                          cursor: 'pointer',
                        }}
                        onClick={() => setPage(p as number)}
                      >
                        {p}
                      </button>
                    ),
                  )}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
