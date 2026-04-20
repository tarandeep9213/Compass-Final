import { useState, useEffect, useMemo } from 'react'
import { getOverdueBuildings, listAlarmBuildings } from '../../../api/alarm'
import type { OverdueBuilding } from '../../../api/alarm'
import type { AlarmBuilding } from '../../../mock/alarmData'
import KpiCard from '../../../components/KpiCard'
import { toast } from '../../../components/ui/Toast'

interface Props {
  adminName: string
  onNavigate: (p: string, c?: Record<string, string>) => void
}

interface EscalationRow extends OverdueBuilding {
  tier: 1 | 2 | 3
  lastReminderSent: string | null
  assignedTesterName: string
}

const TIER_STYLES: Record<1 | 2 | 3, { label: string; bg: string; color: string; border: string }> = {
  1: { label: 'Tier 1', bg: '#fffbeb', color: '#92400e', border: '#fcd34d' },
  2: { label: 'Tier 2', bg: '#fff7ed', color: '#9a3412', border: '#fed7aa' },
  3: { label: 'Tier 3', bg: '#fef2f2', color: '#991b1b', border: '#fca5a5' },
}

function getTier(days: number): 1 | 2 | 3 {
  if (days >= 45) return 3
  if (days >= 30) return 2
  return 1
}

export default function AlarmEscalation({ adminName: _adminName, onNavigate }: Props) {
  const [overdue, setOverdue] = useState<OverdueBuilding[]>([])
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [loading, setLoading] = useState(true)
  const [reminderMap, setReminderMap] = useState<Record<string, string>>({})

  useEffect(() => {
    setLoading(true)
    Promise.all([
      getOverdueBuildings(),
      listAlarmBuildings(),
    ]).then(([od, blds]) => {
      setOverdue(od)
      setBuildings(blds)
      setLoading(false)
    })
  }, [])

  const rows: EscalationRow[] = useMemo(() => {
    return overdue
      .map(o => {
        const bld = buildings.find(b => b.id === o.buildingId)
        const tier = getTier(o.daysSinceLastTest)
        return {
          ...o,
          tier,
          lastReminderSent: reminderMap[o.buildingId] ?? null,
          assignedTesterName: o.assignedTesters.length > 0
            ? o.assignedTesters.join(', ')
            : bld?.assignedTesters.join(', ') ?? '-',
        }
      })
      .sort((a, b) => b.daysSinceLastTest - a.daysSinceLastTest)
  }, [overdue, buildings, reminderMap])

  const totalOverdue = rows.length
  const tier1Count = rows.filter(r => r.tier === 1).length
  const tier2Count = rows.filter(r => r.tier === 2).length
  const tier3Count = rows.filter(r => r.tier === 3).length

  function handleSendReminder(row: EscalationRow) {
    const confirmed = window.confirm(`Send escalation email to ${row.assignedTesterName}?`)
    if (!confirmed) return
    setReminderMap(prev => ({ ...prev, [row.buildingId]: 'Just now' }))
    toast.success('Reminder sent')
  }

  // Derive last test date
  function formatLastTest(days: number): string {
    if (days >= 999) return 'Never'
    const d = new Date()
    d.setDate(d.getDate() - days)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  if (loading) {
    return <div className="content fade-up" style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>Loading...</div>
  }

  // Empty state
  if (totalOverdue === 0) {
    return (
      <div className="content fade-up">
        <div className="ph">
          <div>
            <h2>Overdue Buildings</h2>
            <p>Buildings that have not completed their monthly alarm test</p>
          </div>
          <div className="ph-right">
            <button className="btn btn-outline" onClick={() => onNavigate('alarm-approval')}>&larr; Back</button>
          </div>
        </div>
        <div className="card" style={{ marginTop: 20 }}>
          <div className="card-body" style={{ padding: '60px 20px', textAlign: 'center' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>&#127881;</div>
            <div style={{ fontSize: 18, fontWeight: 600, fontFamily: 'DM Serif Display, serif', color: 'var(--td)' }}>
              All buildings are compliant!
            </div>
            <div style={{ fontSize: 13, color: 'var(--ts)', marginTop: 6 }}>
              No overdue alarm tests this month
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="content fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Overdue Buildings</h2>
          <p>Buildings that have not completed their monthly alarm test</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-approval')}>&larr; Back</button>
        </div>
      </div>

      {/* ── KPI Row ── */}
      <div className="kpi-row" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <KpiCard
          label="Total Overdue"
          value={totalOverdue}
          highlight="red"
          tooltip={{ what: 'Total number of buildings without an approved test this month.', how: 'Count of active buildings missing an approved test for the current month.' }}
        />
        <KpiCard
          label="Tier 1 (Reminder)"
          value={tier1Count}
          accent="var(--amb)"
          highlight="amber"
          tooltip={{ what: 'Buildings overdue less than 30 days.', how: 'Days since last approved test < 30.' }}
        />
        <KpiCard
          label="Tier 2 (Deadline)"
          value={tier2Count}
          accent="#ea580c"
          highlight="amber"
          tooltip={{ what: 'Buildings overdue 30-44 days.', how: 'Days since last approved test between 30 and 44.' }}
        />
        <KpiCard
          label="Tier 3 (Critical)"
          value={tier3Count}
          highlight="red"
          tooltip={{ what: 'Buildings overdue 45+ days.', how: 'Days since last approved test >= 45. Requires immediate escalation.' }}
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
                <th>Assigned Tester</th>
                <th>Last Test</th>
                <th>Days Overdue</th>
                <th>Escalation Tier</th>
                <th>Last Reminder</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(row => {
                const tierStyle = TIER_STYLES[row.tier]
                return (
                  <tr key={row.buildingId}>
                    <td>
                      <span
                        style={{ fontWeight: 500, color: 'var(--g7)', cursor: 'pointer' }}
                        onClick={() => onNavigate('alarm-drilldown', { buildingId: row.buildingId, fromPanel: 'alarm-escalation' })}
                      >
                        {row.buildingName}
                      </span>
                    </td>
                    <td style={{ fontSize: 12 }}>{row.region}</td>
                    <td style={{ fontSize: 12 }}>{row.assignedTesterName}</td>
                    <td style={{ fontSize: 12 }}>{formatLastTest(row.daysSinceLastTest)}</td>
                    <td>
                      <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--red)' }}>
                        {row.daysSinceLastTest >= 999 ? '999+' : row.daysSinceLastTest}
                      </span>
                    </td>
                    <td>
                      <span style={{
                        display: 'inline-flex', alignItems: 'center', gap: 4,
                        padding: '3px 9px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background: tierStyle.bg, color: tierStyle.color,
                        border: `1px solid ${tierStyle.border}`,
                      }}>
                        <span style={{
                          width: 5, height: 5, borderRadius: '50%', display: 'inline-block',
                          background: tierStyle.color,
                        }} />
                        {tierStyle.label}
                      </span>
                    </td>
                    <td style={{ fontSize: 12, color: row.lastReminderSent ? 'var(--g7)' : 'var(--ts)' }}>
                      {row.lastReminderSent ?? 'Never'}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary"
                        style={{ fontSize: 11, padding: '5px 12px' }}
                        onClick={() => handleSendReminder(row)}
                      >
                        Send Reminder
                      </button>
                    </td>
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
