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

type StatusFilter = 'ALL' | 'SUBMITTED' | 'APPROVED' | 'REJECTED'

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: 'ALL',       label: 'All' },
  { key: 'SUBMITTED', label: 'Pending Review' },
  { key: 'APPROVED',  label: 'Approved' },
  { key: 'REJECTED',  label: 'Rejected' },
]

function formatDate(iso: string): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
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

function StatusBadge({ status }: { status: AlarmTest['status'] }) {
  if (status === 'SUBMITTED') return <span className="badge badge-amber"><span className="bdot" />Pending</span>
  if (status === 'APPROVED')  return <span className="badge badge-green"><span className="bdot" />Approved</span>
  if (status === 'REJECTED')  return <span className="badge badge-red"><span className="bdot" />Rejected</span>
  return <span className="badge badge-gray">{status}</span>
}

export default function AlarmApproval({ adminName: _adminName, onNavigate }: Props) {
  const [allTests, setAllTests]     = useState<AlarmTest[]>([])
  const [buildings, setBuildings]   = useState<AlarmBuilding[]>([])
  const [loading, setLoading]       = useState(true)

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL')
  const [regionFilter, setRegionFilter] = useState('')
  const [sortNewest, setSortNewest]     = useState(false)
  const [page, setPage]                 = useState(1)

  // ── Load all tests in one shot ────────────────────────────────────────────
  useEffect(() => {
    setLoading(true)
    Promise.all([
      listTests({}),
      listAlarmBuildings(),
    ])
      .then(([tests, blds]) => {
        setAllTests(tests.filter(t => t.status !== 'DRAFT'))
        setBuildings(blds)
      })
      .catch(() => toast.error('Failed to load approval data'))
      .finally(() => setLoading(false))
  }, [])

  // ── Lookups ───────────────────────────────────────────────────────────────
  const buildingMap = useMemo(() => {
    const map: Record<string, AlarmBuilding> = {}
    for (const b of buildings) map[b.id] = b
    return map
  }, [buildings])

  const regions = useMemo(() => {
    const set = new Set(buildings.map((b) => b.region))
    return Array.from(set).sort()
  }, [buildings])

  // ── KPI counts ────────────────────────────────────────────────────────────
  const pendingCount  = allTests.filter((t) => t.status === 'SUBMITTED').length
  const approvedCount = allTests.filter((t) => t.status === 'APPROVED').length
  const rejectedCount = allTests.filter((t) => t.status === 'REJECTED').length

  const avgReviewTime = useMemo(() => {
    const approved = allTests.filter((t) => t.status === 'APPROVED' && t.submittedAt && t.approvedAt)
    if (approved.length === 0) return '—'
    const total = approved.reduce((sum, t) => {
      return sum + (new Date(t.approvedAt!).getTime() - new Date(t.submittedAt!).getTime()) / (1000 * 60 * 60 * 24)
    }, 0)
    return `${(total / approved.length).toFixed(1)} days`
  }, [allTests])

  const staleCount = allTests.filter((t) => t.status === 'SUBMITTED' && daysSince(t.submittedAt) > 3).length

  // ── Filtered + sorted list ────────────────────────────────────────────────
  const filteredTests = useMemo(() => {
    let list = [...allTests]
    if (statusFilter !== 'ALL') list = list.filter((t) => t.status === statusFilter)
    if (regionFilter) list = list.filter((t) => buildingMap[t.buildingId]?.region === regionFilter)
    list.sort((a, b) => {
      const da = a.submittedAt ?? a.testDate
      const db = b.submittedAt ?? b.testDate
      return sortNewest ? db.localeCompare(da) : da.localeCompare(db)
    })
    return list
  }, [allTests, statusFilter, regionFilter, sortNewest, buildingMap])

  const totalPages = Math.ceil(filteredTests.length / PAGE_SIZE)
  const pagedTests = filteredTests.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Loading ───────────────────────────────────────────────────────────────
  if (loading) {
    return <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--ts)' }}>Loading approvals...</div>
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
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-escalation')}>Escalations</button>
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
          label="Approved"
          value={approvedCount}
          accent="var(--g5)"
          tooltip={{ what: 'Total tests approved', how: 'Count of all tests in APPROVED status' }}
        />
        <KpiCard
          label="Rejected"
          value={rejectedCount}
          highlight={rejectedCount > 0 ? 'red' : false}
          accent="var(--red)"
          tooltip={{ what: 'Total tests rejected', how: 'Count of all tests in REJECTED status' }}
        />
        <KpiCard
          label="Avg Review Time"
          value={avgReviewTime}
          accent="var(--g7)"
          tooltip={{ what: 'Average days to review', how: 'Mean days between submission and approval' }}
        />
      </div>

      {/* ── Stale alert ── */}
      {staleCount > 0 && (
        <div className="alert-warn">
          <span>&#9888;</span>
          <span>{staleCount} test{staleCount !== 1 ? 's have' : ' has'} been waiting for review for more than 3 days</span>
        </div>
      )}

      {/* ── Main card ── */}
      <div className="card">

        {/* Row 1: Status filter tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--ow2)', padding: '0 16px' }}>
          {STATUS_TABS.map((tab) => {
            const count = tab.key === 'ALL' ? allTests.length
              : tab.key === 'SUBMITTED' ? pendingCount
              : tab.key === 'APPROVED'  ? approvedCount
              : rejectedCount
            const active = statusFilter === tab.key
            return (
              <button
                key={tab.key}
                onClick={() => { setStatusFilter(tab.key); setPage(1) }}
                style={{
                  padding: '10px 16px',
                  fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  border: 'none',
                  outline: 'none',
                  borderBottom: active ? '2px solid var(--g7)' : '2px solid transparent',
                  marginBottom: -1,
                  background: 'transparent',
                  color: active ? 'var(--g7)' : 'var(--ts)',
                }}
              >
                {tab.label}
                <span style={{
                  marginLeft: 6,
                  fontSize: 11,
                  fontWeight: 500,
                  background: active ? 'var(--g7)' : 'var(--ow2)',
                  color: active ? '#fff' : 'var(--ts)',
                  borderRadius: 10,
                  padding: '1px 7px',
                }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>

        {/* Row 2: Region filter + sort */}
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--ow2)' }}>
          <select
            className="f-sel"
            style={{ width: 160, fontSize: 12 }}
            value={regionFilter}
            onChange={(e) => { setRegionFilter(e.target.value); setPage(1) }}
          >
            <option value="">All Regions</option>
            {regions.map((r) => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', marginLeft: 'auto' }}>
            {[{ label: 'Oldest', val: false }, { label: 'Newest', val: true }].map(({ label, val }, i) => (
              <button
                key={label}
                onClick={() => { setSortNewest(val); setPage(1) }}
                style={{
                  borderRadius: i === 0 ? '16px 0 0 16px' : '0 16px 16px 0',
                  border: '1.5px solid var(--ow2)',
                  borderLeft: i === 1 ? 'none' : undefined,
                  background: sortNewest === val ? 'var(--g0)' : 'transparent',
                  color: sortNewest === val ? 'var(--g7)' : 'var(--ts)',
                  fontWeight: sortNewest === val ? 600 : 400,
                  fontSize: 11,
                  padding: '5px 12px',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  outline: 'none',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Table */}
        <div style={{ padding: 0 }}>
          {filteredTests.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--ts)' }}>
              <div style={{ fontSize: 36, marginBottom: 8 }}>&#10003;</div>
              <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>
                {statusFilter === 'SUBMITTED' ? 'No tests pending review' : 'No tests found'}
              </div>
              <div style={{ fontSize: 12 }}>{statusFilter === 'SUBMITTED' ? 'All caught up!' : 'Try a different filter.'}</div>
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
                    {statusFilter === 'ALL' && <th>Status</th>}
                    <th>{statusFilter === 'REJECTED' ? 'Rejection Reason' : statusFilter === 'APPROVED' ? 'Approved' : 'Waiting'}</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedTests.map((t) => {
                    const b = buildingMap[t.buildingId]
                    const waiting = daysSince(t.submittedAt)
                    const isStale = t.status === 'SUBMITTED' && waiting > 3
                    const incomplete = t.zonesTested < t.zonesTotal

                    return (
                      <tr key={t.id}>
                        <td style={{ fontWeight: 500 }}>{b?.name ?? t.buildingId}</td>
                        <td>{b?.region ?? '—'}</td>
                        <td>{formatDate(t.testDate)}</td>
                        <td>{t.testerName}</td>
                        <td style={{ background: incomplete && t.status === 'SUBMITTED' ? '#fef2f2' : undefined }}>
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
                        {statusFilter === 'ALL' && (
                          <td><StatusBadge status={t.status} /></td>
                        )}
                        <td>
                          {t.status === 'REJECTED' ? (
                            <span style={{ fontSize: 12, color: 'var(--red)', display: 'block', maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.rejectionReason}>
                              {t.rejectionReason ?? '—'}
                            </span>
                          ) : t.status === 'APPROVED' ? (
                            <span style={{ fontSize: 12, color: 'var(--g7)' }}>{t.approvedAt ? formatDate(t.approvedAt) : '—'}</span>
                          ) : (
                            <span style={{ fontSize: 12, color: isStale ? 'var(--red)' : 'var(--ts)', fontWeight: isStale ? 700 : 400 }}>
                              {waiting}d ago
                            </span>
                          )}
                        </td>
                        <td>
                          <button
                            className={t.status === 'SUBMITTED' ? 'btn btn-primary' : 'btn btn-outline'}
                            style={{ padding: '5px 14px', fontSize: 12 }}
                            onClick={() => onNavigate('alarm-review', { testId: t.id, fromPanel: 'alarm-approval' })}
                          >
                            {t.status === 'SUBMITTED' ? 'Review' : 'View'}
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'center', gap: 4, padding: '14px 0', borderTop: '1px solid var(--ow2)' }}>
                  {pageNums(filteredTests.length, page).map((p, i) =>
                    p === '...' ? (
                      <span key={`e${i}`} style={{ padding: '6px 4px', fontSize: 12, color: 'var(--ts)' }}>...</span>
                    ) : (
                      <button
                        key={p}
                        onClick={() => setPage(p as number)}
                        style={{
                          padding: '5px 11px', fontSize: 12, borderRadius: 6,
                          border: '1px solid var(--ow2)',
                          background: p === page ? 'var(--g7)' : 'transparent',
                          color: p === page ? '#fff' : 'var(--tm)',
                          fontWeight: p === page ? 600 : 400,
                          cursor: 'pointer', fontFamily: 'inherit',
                        }}
                      >
                        {p}
                      </button>
                    )
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
