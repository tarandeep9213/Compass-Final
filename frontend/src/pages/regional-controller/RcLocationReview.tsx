import { useState, useEffect, useMemo } from 'react'
import { listLocations } from '../../api/locations'
import { listSubmissions } from '../../api/submissions'
import { formatCurrency } from '../../mock/data'
import { mostRecentBusinessDateISO, isBusinessDay } from '../../utils/businessDays'
import type { ApiLocation, ApiSubmission } from '../../api/types'

interface Props {
  userName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function RcLocationReview({ userName, onNavigate }: Props) {
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([])
  const [loading, setLoading] = useState(true)

  // Cashrooms are closed Sat/Sun — on a weekend, land the user on the most
  // recent business day (Friday) instead of showing an empty Sat/Sun page.
  // `todayIsBusinessDay` controls a small "showing Friday" banner below.
  const today = useMemo(() => mostRecentBusinessDateISO(), [])
  const todayIsBusinessDay = useMemo(() => isBusinessDay(new Date()), [])

  useEffect(() => {
    setLoading(true)
    Promise.all([
      listLocations(),
      listSubmissions({ date_from: today, date_to: today, page_size: 200 }),
    ])
      .then(([locs, subs]) => {
        setLocations(locs)
        setSubmissions(subs.items)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [today])

  // Group submissions by location
  const subsByLoc = useMemo(() => {
    const map: Record<string, ApiSubmission[]> = {}
    for (const s of submissions) {
      if (!map[s.location_id]) map[s.location_id] = []
      map[s.location_id].push(s)
    }
    return map
  }, [submissions])

  const ROLES = ['OPERATOR', 'CONTROLLER', 'DGM', 'REGIONAL_CONTROLLER'] as const
  type RoleKey = typeof ROLES[number]

  function getSubsByRole(locId: string): Partial<Record<RoleKey, ApiSubmission>> {
    const out: Partial<Record<RoleKey, ApiSubmission>> = {}
    for (const s of subsByLoc[locId] ?? []) {
      if (s.status === 'draft') continue
      const role = (s.submitted_by_role || 'OPERATOR') as RoleKey
      if (ROLES.includes(role) && !out[role]) out[role] = s
    }
    return out
  }

  const ROLE_SHORT: Record<RoleKey, string> = {
    OPERATOR: 'OP', CONTROLLER: 'CTRL', DGM: 'DGM', REGIONAL_CONTROLLER: 'RC',
  }

  const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
    approved: { bg: 'var(--g0)', color: 'var(--g7)', border: 'var(--g2)' },
    pending:  { bg: '#fffbeb', color: 'var(--amb)', border: '#fcd34d' },
    rejected: { bg: '#fff1f2', color: 'var(--red)', border: '#fca5a5' },
  }

  const dateLabel = new Date(today + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="fade-up">
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Location Review</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Review submissions and fill forms for any location · {userName} · {dateLabel}
          </p>
        </div>
      </div>

      {!todayIsBusinessDay && (
        <div
          style={{
            padding: '10px 16px',
            background: 'var(--g0)',
            border: '1px solid var(--g3)',
            borderRadius: 8,
            color: 'var(--g8)',
            fontSize: 13,
            marginBottom: 16,
          }}
        >
          Cashrooms are closed weekends — showing the most recent business day ({dateLabel}).
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ts)' }}>Loading...</div>
      ) : locations.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--ts)' }}>No locations found.</div>
      ) : (
        <div className="card">
          <div className="card-header">
            <span className="card-title">All Locations — Today</span>
            <span className="card-sub">{locations.length} location{locations.length !== 1 ? 's' : ''}</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            <table className="dt">
              <thead>
                <tr>
                  <th style={{ minWidth: 160 }}>Location</th>
                  <th style={{ minWidth: 80 }}>CC</th>
                  <th style={{ minWidth: 220 }}>Submissions Today</th>
                  <th style={{ textAlign: 'right', minWidth: 110 }}>Operator Total</th>
                  <th style={{ textAlign: 'right', minWidth: 110 }}>Operator Variance</th>
                  <th style={{ minWidth: 120, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => {
                  const byRole = getSubsByRole(loc.id)
                  const opSub = byRole.OPERATOR
                  const rcSub = byRole.REGIONAL_CONTROLLER
                  const hasAny = Object.keys(byRole).length > 0
                  const canFill = !rcSub   // RC can submit once per day

                  return (
                    <tr key={loc.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{loc.name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ts)' }}>{loc.id}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ts)' }}>{loc.cost_center || '—'}</td>
                      <td>
                        {hasAny ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {ROLES.map(role => {
                              const sub = byRole[role]
                              if (!sub) return null
                              const sstyle = STATUS_STYLE[sub.status] || STATUS_STYLE.pending
                              return (
                                <button
                                  key={role}
                                  title={`${role} · ${sub.status} · ${sub.operator_name}`}
                                  onClick={() => onNavigate('op-readonly', {
                                    locationId: loc.id,
                                    date: today,
                                    submissionId: sub.id,
                                    fromPanel: 'rc-location-review',
                                  })}
                                  style={{
                                    cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                    padding: '3px 9px', borderRadius: 6,
                                    background: sstyle.bg, color: sstyle.color,
                                    border: `1px solid ${sstyle.border}`, whiteSpace: 'nowrap',
                                  }}
                                >
                                  {ROLE_SHORT[role]} · {sub.status}
                                </button>
                              )
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: 11, color: '#bbb' }}>No submissions yet</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14 }}>
                        {opSub ? formatCurrency(opSub.total_cash) : <span style={{ color: '#bbb' }}>—</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {opSub ? (
                          <span style={{
                            fontWeight: 500, fontSize: 13,
                            color: Math.abs(opSub.variance_pct) > 5 ? 'var(--red)' : Math.abs(opSub.variance_pct) > 2.5 ? 'var(--amb)' : 'var(--g7)',
                          }}>
                            {opSub.variance >= 0 ? '+' : ''}{formatCurrency(opSub.variance)}
                            <div style={{ fontSize: 10, color: 'var(--ts)' }}>
                              ({opSub.variance_pct >= 0 ? '+' : ''}{opSub.variance_pct.toFixed(2)}%)
                            </div>
                          </span>
                        ) : (
                          <span style={{ color: '#bbb' }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {canFill ? (
                            <button
                              className="btn btn-primary"
                              style={{ fontSize: 11, padding: '4px 12px' }}
                              onClick={() => onNavigate('op-form', {
                                locationId: loc.id,
                                date: today,
                                from: 'rc-location-review',
                                verifierFillMode: 'true',
                                verifierRole: 'REGIONAL_CONTROLLER',
                              })}
                            >
                              Fill Form
                            </button>
                          ) : (
                            <span style={{ fontSize: 11, color: 'var(--g7)', alignSelf: 'center', fontWeight: 600 }}>
                              ✓ RC filled
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
