import { useState, useEffect } from 'react'
import {
  listAlarmBuildings,
  listZones,
  listTests,
  listBiannualChecks,
} from '../../../api/alarm'
import type { AlarmBuilding, AlarmZone, AlarmTest, BiannualCheck } from '../../../mock/alarmData'
import KpiCard from '../../../components/KpiCard'
import TrafficLight from '../../../components/alarm/TrafficLight'
import AlarmStatusBadge from '../../../components/alarm/AlarmStatusBadge'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'

interface Props {
  userName: string
  ctx: Record<string, string>
  onNavigate: (p: string, c?: Record<string, string>) => void
}

const MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const ZONE_TYPE_COLORS: Record<string, { bg: string; color: string }> = {
  ENTRY_EXIT:       { bg: '#dbeafe', color: '#1e40af' },
  INTERIOR_MOTION:  { bg: '#ede9fe', color: '#6d28d9' },
  PANIC_SILENT:     { bg: '#fee2e2', color: '#991b1b' },
  HOLDUP:           { bg: '#fef3c7', color: '#92400e' },
  FIRE_SMOKE:       { bg: '#ffedd5', color: '#9a3412' },
  OTHER:            { bg: '#f3f4f6', color: '#4b5563' },
}

const ZONE_TYPE_LABELS: Record<string, string> = {
  ENTRY_EXIT: 'Entry/Exit',
  INTERIOR_MOTION: 'Interior',
  PANIC_SILENT: 'Panic',
  HOLDUP: 'Holdup',
  FIRE_SMOKE: 'Fire/Smoke',
  OTHER: 'Other',
}

function getLast12Months(): { key: string; label: string; isFuture: boolean }[] {
  const now = new Date()
  const months: { key: string; label: string; isFuture: boolean }[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ key, label: MONTH_ABBR[d.getMonth()], isFuture: d > now })
  }
  return months
}

function daysBetween(a: string, b: string): number {
  return Math.round((new Date(b).getTime() - new Date(a).getTime()) / (1000 * 60 * 60 * 24))
}

function formatDate(d?: string): string {
  if (!d) return '-'
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export default function AlarmDrillDown({ userName: _userName, ctx, onNavigate }: Props) {
  const buildingId = ctx.buildingId ?? ''
  const fromPanel = ctx.fromPanel || 'alarm-overview'

  const [building, setBuilding] = useState<AlarmBuilding | null>(null)
  const [zones, setZones] = useState<AlarmZone[]>([])
  const [tests, setTests] = useState<AlarmTest[]>([])
  const [biannualChecks, setBiannualChecks] = useState<BiannualCheck[]>([])
  const [loading, setLoading] = useState(true)
  const [expandedMonth, setExpandedMonth] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listAlarmBuildings(),
      listZones(buildingId),
      listTests({ buildingId }),
      listBiannualChecks(buildingId),
    ]).then(([buildings, zoneList, testList, checks]) => {
      setBuilding(buildings.find(b => b.id === buildingId) ?? null)
      setZones(zoneList.filter(z => z.isActive))
      setTests(testList.sort((a, b) => b.testDate.localeCompare(a.testDate)))
      setBiannualChecks(checks)
      setLoading(false)
    })
  }, [buildingId])

  if (loading) {
    return <div className="content fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>Loading...</div>
  }

  if (!building) {
    return (
      <div className="content fade-up" style={{ padding: 40, textAlign: 'center' }}>
        <p>Building not found.</p>
        <button className="btn btn-outline" style={{ marginTop: 12 }} onClick={() => onNavigate(fromPanel)}>Back</button>
      </div>
    )
  }

  // Compute KPI data
  const currentYear = new Date().getFullYear()
  const testsThisYear = tests.filter(t => t.testDate.startsWith(String(currentYear)))
  const curMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`
  const curMonthTests = tests.filter(t => t.testMonth === curMonth)
  const curMonthApproved = curMonthTests.find(t => t.status === 'APPROVED')
  const curMonthSubmitted = curMonthTests.find(t => t.status === 'SUBMITTED')
  const curMonthStatusText = curMonthApproved ? 'Approved' : curMonthSubmitted ? 'Pending' : 'Missing'
  const curMonthHighlight: 'green' | 'amber' | 'red' = curMonthApproved ? 'green' : curMonthSubmitted ? 'amber' : 'red'

  const avgCoverage = tests.length > 0
    ? Math.round(tests.reduce((sum, t) => sum + (t.zonesTotal > 0 ? (t.zonesTested / t.zonesTotal) * 100 : 0), 0) / tests.length)
    : 0

  const cellularChecks = biannualChecks.filter(c => c.checkType === 'CELLULAR_BACKUP').sort((a, b) => b.checkDate.localeCompare(a.checkDate))
  const cameraChecks = biannualChecks.filter(c => c.checkType === 'CAMERA_BACKUP').sort((a, b) => b.checkDate.localeCompare(a.checkDate))
  const latestCellular = cellularChecks[0]
  const latestCamera = cameraChecks[0]

  const today = new Date().toISOString().slice(0, 10)
  const cellularOverdue = latestCellular ? latestCellular.nextDueDate < today : true
  const cameraOverdue = latestCamera ? latestCamera.nextDueDate < today : true

  const last12 = getLast12Months()

  // Build test map by month
  const testByMonth: Record<string, AlarmTest | undefined> = {}
  for (const m of last12) {
    const monthTests = tests.filter(t => t.testMonth === m.key)
    testByMonth[m.key] = monthTests.find(t => t.status === 'APPROVED')
      ?? monthTests.find(t => t.status === 'SUBMITTED')
      ?? monthTests.find(t => t.status === 'REJECTED')
      ?? monthTests[0]
  }

  // Status badge for building
  const statusBadgeCls = building.status === 'active'
    ? 'badge badge-green'
    : building.status === 'temporarily_exempt'
    ? 'badge badge-amber'
    : 'badge badge-gray'
  const statusLabel = building.status === 'active' ? 'Active' : building.status === 'temporarily_exempt' ? 'Exempt' : 'Closed'

  return (
    <div className="content fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <button
            className="btn btn-outline"
            style={{ marginBottom: 8, fontSize: 12, padding: '5px 12px' }}
            onClick={() => onNavigate(fromPanel)}
          >
            &larr; Back
          </button>
          <h2>{building.name}</h2>
          <p>Region: {building.region} | Security: {building.securityCompanyName} (ID: {building.securityCustomerId})</p>
        </div>
        <div className="ph-right">
          <span className={statusBadgeCls}><span className="bdot" />{statusLabel}</span>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
        <KpiCard
          label="Tests This Year"
          value={testsThisYear.length}
          tooltip={{ what: 'Number of alarm tests submitted this calendar year.', how: 'Count of all tests for this building in the current year.' }}
        />
        <KpiCard
          label="Current Month"
          value={curMonthStatusText}
          highlight={curMonthHighlight}
          tooltip={{ what: 'Status of this month\'s alarm test.', how: 'Checks if an approved or pending test exists for the current month.' }}
        />
        <KpiCard
          label="Zone Coverage"
          value={`${avgCoverage}%`}
          tooltip={{ what: 'Average zone test coverage across all tests.', how: '(zonesTested / zonesTotal) averaged across all tests.' }}
        />
        <KpiCard
          label="Cellular Backup"
          value={cellularOverdue ? 'Overdue' : 'Compliant'}
          highlight={cellularOverdue ? 'red' : 'green'}
          tooltip={{ what: 'Biannual cellular backup check compliance.', how: 'Compares next due date against today.' }}
        />
        <KpiCard
          label="Camera Backup"
          value={cameraOverdue ? 'Overdue' : 'Compliant'}
          highlight={cameraOverdue ? 'red' : 'green'}
          tooltip={{ what: 'Biannual camera backup check compliance.', how: 'Compares next due date against today.' }}
        />
      </div>

      {/* ── Zone Config Card ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Configured Zones</span>
          <span className="card-sub">{zones.length} zones</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
            {zones.map(zone => {
              const typeColor = ZONE_TYPE_COLORS[zone.zoneType] ?? ZONE_TYPE_COLORS.OTHER
              return (
                <div key={zone.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 8px', borderRadius: 6, border: '1px solid var(--ow2)' }}>
                  <span style={{
                    width: 32, height: 32, borderRadius: 6, background: 'var(--g0)', color: 'var(--g7)',
                    fontSize: 11, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                  }}>
                    {zone.zoneNumber}
                  </span>
                  <span style={{ fontSize: 12, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {zone.zoneName}
                  </span>
                  <span style={{
                    fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 10,
                    background: typeColor.bg, color: typeColor.color, whiteSpace: 'nowrap',
                  }}>
                    {ZONE_TYPE_LABELS[zone.zoneType] ?? zone.zoneType}
                  </span>
                  {zone.areaNumber > 1 && (
                    <span style={{
                      fontSize: 10, fontWeight: 500, padding: '2px 6px', borderRadius: 10,
                      background: 'var(--ow2)', color: 'var(--ts)', whiteSpace: 'nowrap',
                    }}>
                      Area {zone.areaNumber}
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Monthly Test History Card ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Test History (Last 12 Months)</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {last12.map(m => {
              const test = testByMonth[m.key]
              let dotColor: 'green' | 'yellow' | 'red' | 'gray' = 'gray'
              if (m.isFuture) {
                dotColor = 'gray'
              } else if (test?.status === 'APPROVED') {
                dotColor = 'green'
              } else if (test?.status === 'SUBMITTED') {
                dotColor = 'yellow'
              } else {
                dotColor = 'red'
              }
              const isExpanded = expandedMonth === m.key
              return (
                <div key={m.key}>
                  <div
                    onClick={() => setExpandedMonth(isExpanded ? null : m.key)}
                    style={{
                      width: 60, textAlign: 'center', padding: 8, borderRadius: 8,
                      border: `1px solid ${isExpanded ? 'var(--g4)' : 'var(--ow2)'}`,
                      cursor: 'pointer', background: isExpanded ? 'var(--g0)' : undefined,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{m.label}</div>
                    <TrafficLight status={dotColor} size={10} />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Accordion detail */}
          {expandedMonth && (() => {
            const test = testByMonth[expandedMonth]
            if (!test) {
              return (
                <div style={{ marginTop: 12, padding: 12, borderRadius: 8, background: 'var(--ow)', border: '1px solid var(--ow2)', fontSize: 13, color: 'var(--ts)' }}>
                  No test recorded for this month.
                </div>
              )
            }
            return (
              <div style={{ marginTop: 12, padding: 14, borderRadius: 8, background: 'var(--ow)', border: '1px solid var(--ow2)' }}>
                <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'center', marginBottom: 10 }}>
                  <div style={{ fontSize: 13 }}><strong>Test Date:</strong> {formatDate(test.testDate)}</div>
                  <div style={{ fontSize: 13 }}><strong>Tester:</strong> {test.testerName}</div>
                  <AlarmStatusBadge status={test.status} />
                </div>
                <ZoneSummaryBar
                  tested={test.zonesTested}
                  notTested={test.zonesTotal - test.zonesTested - test.zonesIssue}
                  issues={test.zonesIssue}
                  total={test.zonesTotal}
                  showLegend
                />
                <div style={{ marginTop: 10 }}>
                  <span
                    style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer', fontWeight: 600 }}
                    onClick={() => onNavigate('alarm-review', { testId: test.id, fromPanel: 'alarm-drilldown', buildingId })}
                  >
                    View Full Review &rarr;
                  </span>
                </div>
              </div>
            )
          })()}
        </div>
      </div>

      {/* ── Biannual Card ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Biannual Compliance</span>
        </div>
        <div className="card-body">
          {[
            { label: 'Cellular Backup', check: latestCellular, overdue: cellularOverdue },
            { label: 'Camera Backup', check: latestCamera, overdue: cameraOverdue },
          ].map(row => {
            const daysUntil = row.check?.nextDueDate
              ? daysBetween(today, row.check.nextDueDate)
              : null
            return (
              <div key={row.label} style={{
                display: 'flex', alignItems: 'center', gap: 20, padding: '10px 0',
                borderBottom: '1px solid var(--ow2)', flexWrap: 'wrap',
              }}>
                <div style={{ fontSize: 13, fontWeight: 600, minWidth: 130 }}>{row.label}</div>
                <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                  Last: {row.check ? formatDate(row.check.checkDate) : 'Never'}
                </div>
                <span className={row.overdue ? 'badge badge-red' : 'badge badge-green'}>
                  <span className="bdot" />
                  {row.overdue ? 'Overdue' : 'Compliant'}
                </span>
                <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                  Next Due: {row.check ? formatDate(row.check.nextDueDate) : '-'}
                </div>
                {daysUntil !== null && (
                  <span style={{ fontSize: 12, fontWeight: 600, color: daysUntil >= 0 ? 'var(--g7)' : 'var(--red)' }}>
                    {daysUntil >= 0 ? `${daysUntil} days remaining` : `${Math.abs(daysUntil)} days overdue`}
                  </span>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Approval Timeline Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Approval Timeline</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="dt">
            <thead>
              <tr>
                <th>Month</th>
                <th>Test Date</th>
                <th>Tester</th>
                <th>Status</th>
                <th>Reviewer</th>
                <th>Review Date</th>
              </tr>
            </thead>
            <tbody>
              {last12.slice().reverse().map(m => {
                const test = testByMonth[m.key]
                return (
                  <tr key={m.key}>
                    <td style={{ fontWeight: 500 }}>{m.label} {m.key.split('-')[0]}</td>
                    <td>{test ? formatDate(test.testDate) : '-'}</td>
                    <td>{test?.testerName ?? '-'}</td>
                    <td>{test ? <AlarmStatusBadge status={test.status} size="sm" /> : <span style={{ color: 'var(--ts)', fontSize: 12 }}>-</span>}</td>
                    <td>{test?.approvedByName ?? '-'}</td>
                    <td>{test?.approvedAt ? formatDate(test.approvedAt) : '-'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
