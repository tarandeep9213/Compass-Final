import { useState, useEffect, useMemo } from 'react'
import { getAlarmTrends, listAlarmBuildings, listTests } from '../../../api/alarm'
import type { AlarmTrendData } from '../../../api/alarm'
import type { AlarmBuilding, AlarmTest } from '../../../mock/alarmData'
import KpiCard from '../../../components/KpiCard'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Cell,
} from 'recharts'

interface Props {
  adminName: string
  onNavigate: (p: string, c?: Record<string, string>) => void
}

const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr',
  '05': 'May', '06': 'Jun', '07': 'Jul', '08': 'Aug',
  '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
}

function monthLabel(m: string): string {
  const parts = m.split('-')
  return MONTH_ABBR[parts[1]] ?? parts[1]
}

type RangePill = 6 | 12 | 24

export default function AlarmTrends({ adminName: _adminName, onNavigate }: Props) {
  const [trendData, setTrendData] = useState<AlarmTrendData | null>(null)
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [allTests, setAllTests] = useState<AlarmTest[]>([])
  const [loading, setLoading] = useState(true)
  const [region, setRegion] = useState('')
  const [range, setRange] = useState<RangePill>(12)

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getAlarmTrends(range),
      listAlarmBuildings(),
      listTests({}),
    ]).then(([trends, blds, tests]) => {
      setTrendData(trends)
      setBuildings(blds)
      setAllTests(tests)
      setLoading(false)
    })
  }, [range])

  // Region filter
  const regions = useMemo(() => {
    const set = new Set(buildings.map(b => b.region))
    return Array.from(set).sort()
  }, [buildings])

  const filteredTrend = useMemo(() => {
    if (!trendData) return []
    return trendData.months
  }, [trendData])

  // Compute KPIs
  const currentRate = filteredTrend.length > 0 ? filteredTrend[filteredTrend.length - 1].complianceRate : 0
  const prevRate = filteredTrend.length > 1 ? filteredTrend[filteredTrend.length - 2].complianceRate : currentRate
  const delta = currentRate - prevRate
  const deltaText = delta >= 0 ? `+${delta}% vs last month` : `${delta}% vs last month`

  const avgRate = filteredTrend.length > 0
    ? Math.round(filteredTrend.reduce((s, m) => s + m.complianceRate, 0) / filteredTrend.length)
    : 0

  // Approval turnaround (mock: derive from test data)
  const approvalTurnaround = useMemo(() => {
    return filteredTrend.map(m => {
      const monthTests = allTests.filter(t => t.testMonth === m.month && t.approvedAt && t.submittedAt)
      if (monthTests.length === 0) return { month: monthLabel(m.month), days: 0 }
      const avg = monthTests.reduce((sum, t) => {
        const submitted = new Date(t.submittedAt!).getTime()
        const approved = new Date(t.approvedAt!).getTime()
        return sum + (approved - submitted) / (1000 * 60 * 60 * 24)
      }, 0) / monthTests.length
      return { month: monthLabel(m.month), days: Math.round(avg * 10) / 10 }
    })
  }, [filteredTrend, allTests])

  const avgDaysToApproval = approvalTurnaround.length > 0
    ? Math.round(approvalTurnaround.reduce((s, r) => s + r.days, 0) / approvalTurnaround.filter(r => r.days > 0).length * 10) / 10 || 0
    : 0

  // Recurring issues: buildings with rejected tests
  const recurringIssues = useMemo(() => {
    const issueMap: Record<string, { count: number; lastDate: string; zoneType: string }> = {}
    const rejectedTests = allTests.filter(t => t.status === 'REJECTED')
    for (const t of rejectedTests) {
      if (!issueMap[t.buildingId]) {
        issueMap[t.buildingId] = { count: 0, lastDate: t.testDate, zoneType: 'N/A' }
      }
      issueMap[t.buildingId].count++
      if (t.testDate > issueMap[t.buildingId].lastDate) {
        issueMap[t.buildingId].lastDate = t.testDate
      }
    }
    // Also count tests with zone issues
    const issueTests = allTests.filter(t => t.zonesIssue > 0)
    for (const t of issueTests) {
      if (!issueMap[t.buildingId]) {
        issueMap[t.buildingId] = { count: 0, lastDate: t.testDate, zoneType: 'N/A' }
      }
      issueMap[t.buildingId].count++
      if (t.testDate > issueMap[t.buildingId].lastDate) {
        issueMap[t.buildingId].lastDate = t.testDate
      }
    }

    return Object.entries(issueMap)
      .map(([bid, info]) => {
        const b = buildings.find(x => x.id === bid)
        return {
          buildingId: bid,
          buildingName: b?.name ?? bid,
          region: b?.region ?? '-',
          issueCount: info.count,
          lastIssueDate: info.lastDate,
          mostCommonZoneType: info.zoneType,
        }
      })
      .filter(r => !region || r.region === region)
      .sort((a, b) => b.issueCount - a.issueCount)
  }, [allTests, buildings, region])

  const buildingsWithIssues = recurringIssues.length

  // CSV export
  function handleExport() {
    const header = 'Month,Compliant,Total,ComplianceRate\n'
    const rows = filteredTrend.map(m => `${m.month},${m.compliant},${m.total},${m.complianceRate}`).join('\n')
    const csv = header + rows
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `alarm-trends-${range}mo.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) {
    return <div className="content fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>Loading...</div>
  }

  const lineData = filteredTrend.map(m => ({
    month: monthLabel(m.month),
    complianceRate: m.complianceRate,
  }))

  return (
    <div className="content fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Alarm Compliance Trends</h2>
        </div>
        <div className="ph-right">
          <select className="f-inp" style={{ width: 140, fontSize: 12, padding: '6px 10px' }} value={region} onChange={e => setRegion(e.target.value)}>
            <option value="">All Regions</option>
            {regions.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <div style={{ display: 'flex', gap: 4 }}>
            {([6, 12, 24] as RangePill[]).map(pill => (
              <button
                key={pill}
                className={range === pill ? 'btn btn-primary' : 'btn btn-outline'}
                style={{ fontSize: 11, padding: '5px 10px' }}
                onClick={() => setRange(pill)}
              >
                {pill}mo
              </button>
            ))}
          </div>
          <button className="btn btn-outline" onClick={handleExport}>Export Report</button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard
          label="Current Compliance"
          value={`${currentRate}%`}
          sub={deltaText}
          highlight={currentRate >= 80 ? 'green' : currentRate >= 60 ? 'amber' : 'red'}
          tooltip={{ what: 'Compliance rate for the most recent month.', how: '(Compliant buildings / Active buildings) x 100.' }}
        />
        <KpiCard
          label="12-Month Average"
          value={`${avgRate}%`}
          tooltip={{ what: 'Average compliance rate over the selected period.', how: 'Mean of monthly compliance rates.' }}
        />
        <KpiCard
          label="Avg Days to Approval"
          value={`${avgDaysToApproval} days`}
          tooltip={{ what: 'Average time from test submission to approval.', how: '(approvedAt - submittedAt) averaged across all approved tests.' }}
        />
        <KpiCard
          label="Buildings w/ Issues"
          value={buildingsWithIssues}
          highlight={buildingsWithIssues > 0 ? 'red' : false}
          tooltip={{ what: 'Buildings that have had rejected tests or zone issues.', how: 'Count of unique buildings with at least one rejected test or zone issue.' }}
        />
      </div>

      {/* ── Compliance Trend Chart ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Compliance Rate Over Time</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={lineData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ow2)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--ow2)' }} />
              <ReferenceLine y={80} stroke="#d97706" strokeDasharray="5 5" />
              <Line type="monotone" dataKey="complianceRate" stroke="#3a9458" strokeWidth={2} dot={{ r: 3, fill: '#3a9458' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Approval Turnaround Chart ── */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header">
          <span className="card-title">Approval Turnaround (Days)</span>
        </div>
        <div className="card-body">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={approvalTurnaround} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--ow2)" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid var(--ow2)' }} />
              <ReferenceLine y={5} stroke="#dc2626" strokeDasharray="5 5" label={{ value: 'SLA', position: 'right', fontSize: 10, fill: '#dc2626' }} />
              <Bar dataKey="days" radius={[4, 4, 0, 0]}>
                {approvalTurnaround.map((entry, idx) => (
                  <Cell
                    key={idx}
                    fill={entry.days > 5 ? '#dc2626' : entry.days > 3 ? '#d97706' : '#3a9458'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Recurring Issues Table ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Buildings with Recurring Issues</span>
          <span className="card-sub">{recurringIssues.length} building{recurringIssues.length !== 1 ? 's' : ''}</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {recurringIssues.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              No recurring issues found.
            </div>
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>Building</th>
                  <th>Issue Count</th>
                  <th>Last Issue Date</th>
                  <th>Most Common Zone Type</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {recurringIssues.map(row => {
                  const intensity = Math.min(row.issueCount * 15, 80)
                  return (
                    <tr key={row.buildingId}>
                      <td style={{ fontWeight: 500 }}>{row.buildingName}</td>
                      <td>
                        <span style={{
                          fontWeight: 700,
                          background: `rgba(220, 38, 38, ${intensity / 100})`,
                          color: intensity > 40 ? '#fff' : '#991b1b',
                          padding: '2px 8px', borderRadius: 6, fontSize: 12,
                        }}>
                          {row.issueCount}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>{new Date(row.lastIssueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</td>
                      <td style={{ fontSize: 12 }}>{row.mostCommonZoneType}</td>
                      <td>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => onNavigate('alarm-drilldown', { buildingId: row.buildingId, fromPanel: 'alarm-trends' })}
                        >
                          View
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
