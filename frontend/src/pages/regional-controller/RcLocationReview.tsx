import { useState, useEffect, useMemo } from 'react'
import { listLocations } from '../../api/locations'
import { listSubmissions } from '../../api/submissions'
import { formatCurrency } from '../../mock/data'
import type { ApiLocation, ApiSubmission } from '../../api/types'

interface Props {
  userName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function RcLocationReview({ userName, onNavigate }: Props) {
  const [locations, setLocations] = useState<ApiLocation[]>([])
  const [submissions, setSubmissions] = useState<ApiSubmission[]>([])
  const [loading, setLoading] = useState(true)

  const today = useMemo(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }, [])

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

  function getOperatorSub(locId: string): ApiSubmission | undefined {
    return subsByLoc[locId]?.find(s => s.submitted_by_role === 'OPERATOR' && s.status !== 'draft')
  }

  function getSubStatus(locId: string): 'approved' | 'pending' | 'rejected' | 'none' {
    const opSub = getOperatorSub(locId)
    if (!opSub) return 'none'
    if (opSub.status === 'approved') return 'approved'
    if (opSub.status === 'rejected') return 'rejected'
    return 'pending'
  }

  const STATUS_STYLE: Record<string, { bg: string; color: string; border: string; label: string }> = {
    approved: { bg: 'var(--g0)', color: 'var(--g7)', border: 'var(--g2)', label: 'Approved' },
    pending:  { bg: '#fffbeb', color: 'var(--amb)', border: '#fcd34d', label: 'Pending Approval' },
    rejected: { bg: '#fff1f2', color: 'var(--red)', border: '#fca5a5', label: 'Rejected' },
    none:     { bg: '#f8fafc', color: '#94a3b8', border: '#e2e8f0', label: 'No Submission' },
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
                  <th style={{ minWidth: 120, textAlign: 'center' }}>Submission Status</th>
                  <th style={{ minWidth: 130 }}>Submitted By</th>
                  <th style={{ textAlign: 'right', minWidth: 100 }}>Total Cash</th>
                  <th style={{ textAlign: 'right', minWidth: 100 }}>Variance</th>
                  <th style={{ minWidth: 120, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {locations.map(loc => {
                  const status = getSubStatus(loc.id)
                  const ss = STATUS_STYLE[status]
                  const opSub = getOperatorSub(loc.id)
                  const canFill = status === 'none' || status === 'rejected'
                  const canView = status === 'approved' || status === 'pending'

                  return (
                    <tr key={loc.id}>
                      <td>
                        <div style={{ fontWeight: 600, fontSize: 13 }}>{loc.name}</div>
                        <div style={{ fontSize: 10, fontFamily: 'monospace', color: 'var(--ts)' }}>{loc.id}</div>
                      </td>
                      <td style={{ fontSize: 12, color: 'var(--ts)' }}>{loc.cost_center || '—'}</td>
                      <td style={{ textAlign: 'center' }}>
                        <span style={{
                          fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
                          background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                          whiteSpace: 'nowrap',
                        }}>
                          {ss.label}
                        </span>
                      </td>
                      <td style={{ fontSize: 12 }}>
                        {opSub ? (
                          <div>
                            <span style={{ fontWeight: 500 }}>{opSub.operator_name}</span>
                            {opSub.submitted_by_role !== 'OPERATOR' && (
                              <span style={{
                                marginLeft: 6, fontSize: 9, fontWeight: 700, padding: '1px 5px',
                                borderRadius: 4, background: '#f0fdf4', color: '#15803d',
                                border: '1px solid #15803d30',
                              }}>
                                {opSub.submitted_by_role}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#bbb' }}>—</span>
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
                          {canView && (
                            <button
                              className="btn btn-ghost"
                              style={{ fontSize: 11, padding: '4px 12px' }}
                              onClick={() => onNavigate('op-readonly', {
                                locationId: loc.id,
                                date: today,
                                submissionId: opSub?.id ?? '',
                                fromPanel: 'rc-location-review',
                              })}
                            >
                              View Form
                            </button>
                          )}
                          {canFill && (
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
                          )}
                          {status === 'none' && (
                            <span style={{ fontSize: 11, color: '#bbb', alignSelf: 'center' }}>No submission yet</span>
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
