import React, { useState, useEffect } from 'react'
import { listAlarmBuildings, listAlarmUsers, updateBuildingSetup } from '../../../api/alarm'
import type { AlarmBuilding, AlarmUser } from '../../../mock/alarmData'
import { toast } from '../../../components/ui/Toast'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

const NAV_PILLS: { label: string; panel: string }[] = [
  { label: 'Zones',     panel: 'alarm-zone-config' },
  { label: 'Buildings',  panel: 'alarm-building-setup' },
  { label: 'Rules',      panel: 'alarm-compliance-rules' },
  { label: 'Access',     panel: 'alarm-user-access' },
]

function pillStyle(active: boolean): React.CSSProperties {
  return {
    display: 'inline-flex',
    padding: '6px 16px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    border: `1.5px solid ${active ? 'var(--g7)' : 'var(--ow2)'}`,
    background: active ? 'var(--g7)' : 'transparent',
    color: active ? '#fff' : 'var(--tm)',
  }
}

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)          return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4)  return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

interface EditForm {
  securityCompanyName: string
  securityCustomerId: string
  securityCompanyPhone: string
  assignedTesters: string[]
  assignedApprover: string
  status: AlarmBuilding['status']
  exemptReason: string
  reactivationDate: string
}

export default function AlarmBuildingSetup({ adminName, onNavigate }: Props) {
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [users, setUsers]         = useState<AlarmUser[]>([])
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(0)
  const [editBuilding, setEditBuilding] = useState<AlarmBuilding | null>(null)
  const [form, setForm]           = useState<EditForm | null>(null)

  useEffect(() => {
    listAlarmBuildings().then(setBuildings)
    listAlarmUsers().then(setUsers)
  }, [])

  // Search filter
  const filtered = buildings.filter(b => {
    const q = search.toLowerCase()
    return !q
      || b.name.toLowerCase().includes(q)
      || b.region.toLowerCase().includes(q)
      || b.securityCompanyName.toLowerCase().includes(q)
      || b.securityCustomerId.toLowerCase().includes(q)
  })

  // KPI counts
  const totalBuildings = buildings.length
  const activeCount    = buildings.filter(b => b.status === 'active').length
  const exemptCount    = buildings.filter(b => b.status === 'temporarily_exempt').length
  const closedCount    = buildings.filter(b => b.status === 'closed').length

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  function userName(id: string): string {
    return users.find(u => u.id === id)?.name ?? ''
  }

  function openEdit(b: AlarmBuilding) {
    setEditBuilding(b)
    setForm({
      securityCompanyName: b.securityCompanyName,
      securityCustomerId: b.securityCustomerId,
      securityCompanyPhone: b.securityCompanyPhone,
      assignedTesters: [...b.assignedTesters],
      assignedApprover: b.assignedApprover,
      status: b.status,
      exemptReason: b.exemptReason ?? '',
      reactivationDate: '',
    })
  }

  function closeEdit() {
    setEditBuilding(null)
    setForm(null)
  }

  function toggleTester(userId: string) {
    if (!form) return
    const has = form.assignedTesters.includes(userId)
    setForm({
      ...form,
      assignedTesters: has
        ? form.assignedTesters.filter(id => id !== userId)
        : [...form.assignedTesters, userId],
    })
  }

  async function handleSave() {
    if (!editBuilding || !form) return
    await updateBuildingSetup(editBuilding.id, {
      securityCompanyName: form.securityCompanyName,
      securityCustomerId: form.securityCustomerId,
      securityCompanyPhone: form.securityCompanyPhone,
      assignedTesters: form.assignedTesters,
      assignedApprover: form.assignedApprover,
      status: form.status,
      exemptReason: form.status === 'temporarily_exempt' ? form.exemptReason : undefined,
    })
    toast.success('Building updated.')
    closeEdit()
    const refreshed = await listAlarmBuildings()
    setBuildings(refreshed)
  }

  const statusBadge = (status: AlarmBuilding['status']) => {
    if (status === 'active')
      return <span className="badge badge-green"><span className="bdot" /> Active</span>
    if (status === 'temporarily_exempt')
      return <span className="badge badge-amber"><span className="bdot" /> Exempt</span>
    return <span className="badge badge-gray">Closed</span>
  }

  return (
    <div className="fade-up">
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {NAV_PILLS.map(p => (
          <span
            key={p.panel}
            style={pillStyle(p.panel === 'alarm-building-setup')}
            onClick={() => onNavigate(p.panel)}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Page header */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Alarm Building Setup</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Manage building alarm configuration &middot; {adminName}</p>
        </div>
      </div>

      {/* KPI row */}
      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-lbl">Total Buildings</div>
          <div className="kpi-val">{totalBuildings}</div>
        </div>
        <div className="kpi" style={{ borderTopColor: 'var(--g4)' }}>
          <div className="kpi-lbl">Active</div>
          <div className="kpi-val" style={{ color: 'var(--g7)' }}>{activeCount}</div>
        </div>
        <div className="kpi amber">
          <div className="kpi-lbl">Exempt</div>
          <div className="kpi-val" style={{ color: 'var(--amb)' }}>{exemptCount}</div>
        </div>
        <div className="kpi" style={{ borderTopColor: 'var(--wg)' }}>
          <div className="kpi-lbl">Closed</div>
          <div className="kpi-val" style={{ color: 'var(--ts)' }}>{closedCount}</div>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 16 }}>
        <input
          className="f-inp"
          placeholder="Search buildings..."
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{ maxWidth: 360, fontSize: 13 }}
        />
      </div>

      {/* Table */}
      <div className="card">
        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No buildings found</div>
              <div>Try adjusting your search.</div>
            </div>
          )}
          {filtered.length > 0 && (<>
            <table className="dt">
              <thead>
                <tr>
                  <th>Building Name</th>
                  <th>Region</th>
                  <th>Security Company</th>
                  <th>Customer ID</th>
                  <th>Phone</th>
                  <th>Testers</th>
                  <th>Approver</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(b => {
                  const testerNames = b.assignedTesters.map(id => userName(id)).filter(Boolean)
                  const approverName = userName(b.assignedApprover)
                  return (
                    <tr key={b.id}>
                      <td style={{ fontWeight: 500, fontSize: 13 }}>{b.name}</td>
                      <td style={{ fontSize: 13 }}>{b.region}</td>
                      <td style={{ fontSize: 13 }}>{b.securityCompanyName}</td>
                      <td style={{ fontSize: 13 }}>{b.securityCustomerId}</td>
                      <td style={{ fontSize: 13 }}>{b.securityCompanyPhone}</td>
                      <td style={{ fontSize: 13 }}>
                        {testerNames.length > 0
                          ? testerNames.join(', ')
                          : <span style={{ color: 'var(--red)' }}>None</span>
                        }
                      </td>
                      <td style={{ fontSize: 13 }}>
                        {approverName
                          ? approverName
                          : <span style={{ color: 'var(--red)' }}>None</span>
                        }
                      </td>
                      <td style={{ textAlign: 'center' }}>{statusBadge(b.status)}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 12px' }}
                          onClick={() => openEdit(b)}
                        >
                          Edit
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            {/* Pagination */}
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromRow}–{toRow} of {filtered.length} buildings</span>
                <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</button>
                  {pageNums(page, totalPages).map((n, i) => n === 'gap'
                    ? <span key={`g${i}`} style={{ fontSize: 12, color: 'var(--ts)', padding: '0 4px' }}>…</span>
                    : <button key={n} onClick={() => setPage(n as number)} style={{ width: 30, height: 30, borderRadius: 6, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: page === n ? 700 : 400, border: `1px solid ${page === n ? 'var(--g4)' : 'var(--ow2)'}`, background: page === n ? 'var(--g7)' : '#fff', color: page === n ? '#fff' : 'var(--td)' }}>{(n as number) + 1}</button>
                  )}
                  <button className="btn btn-ghost" style={{ fontSize: 12, padding: '4px 12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</button>
                </div>
              </div>
            )}
          </>)}
        </div>
      </div>

      {/* Edit Modal */}
      {editBuilding && form && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 500, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 20 }}>
              Edit — {editBuilding.name}
            </h3>

            {/* Security Company Info */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Security Company Info</div>
            <div className="f-field">
              <label className="f-lbl">Company Name</label>
              <input
                className="f-inp"
                value={form.securityCompanyName}
                onChange={e => setForm({ ...form, securityCompanyName: e.target.value })}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Customer ID</label>
                <input
                  className="f-inp"
                  value={form.securityCustomerId}
                  onChange={e => setForm({ ...form, securityCustomerId: e.target.value })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Phone</label>
                <input
                  className="f-inp"
                  value={form.securityCompanyPhone}
                  onChange={e => setForm({ ...form, securityCompanyPhone: e.target.value })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Assignments */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 6 }}>Assignments</div>
            <div className="f-field">
              <label className="f-lbl">Testers</label>
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1.5px solid var(--ow2)', borderRadius: 7, padding: '6px 10px', background: 'var(--ow)' }}>
                {users.map(u => (
                  <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={form.assignedTesters.includes(u.id)}
                      onChange={() => toggleTester(u.id)}
                    />
                    <span>{u.name}</span>
                    <span style={{ fontSize: 11, color: 'var(--ts)' }}>({u.role})</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="f-field">
              <label className="f-lbl">Approver</label>
              <select
                className="f-sel"
                value={form.assignedApprover}
                onChange={e => setForm({ ...form, assignedApprover: e.target.value })}
                style={{ width: '100%', fontSize: 13 }}
              >
                <option value="">— Select Approver —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 6 }}>Status</div>
            <div className="f-field">
              {(['active', 'temporarily_exempt', 'closed'] as const).map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="building-status"
                    checked={form.status === s}
                    onChange={() => setForm({ ...form, status: s })}
                  />
                  <span>{s === 'active' ? 'Active' : s === 'temporarily_exempt' ? 'Temporarily Exempt' : 'Closed'}</span>
                </label>
              ))}
            </div>

            {form.status === 'temporarily_exempt' && (
              <>
                <div className="f-field">
                  <label className="f-lbl">Exempt Reason</label>
                  <textarea
                    className="f-ta"
                    value={form.exemptReason}
                    onChange={e => setForm({ ...form, exemptReason: e.target.value })}
                    style={{ width: '100%', fontSize: 13 }}
                    rows={3}
                  />
                </div>
                <div className="f-field">
                  <label className="f-lbl">Reactivation Date</label>
                  <input
                    className="f-inp"
                    type="date"
                    value={form.reactivationDate}
                    onChange={e => setForm({ ...form, reactivationDate: e.target.value })}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={closeEdit}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
