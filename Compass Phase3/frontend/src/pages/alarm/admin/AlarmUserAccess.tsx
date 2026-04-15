import React, { useState, useEffect, useRef } from 'react'
import { listAlarmUsers, listAlarmBuildings } from '../../../api/alarm'
import type { AlarmUser, AlarmBuilding } from '../../../mock/alarmData'
import { toast } from '../../../components/ui/Toast'

const ACCESS_CSV_COLUMNS = ['user_name', 'access_type', 'building_names'] as const

type AccessCsvRow = {
  user_name: string
  access_type: string
  building_names: string
}

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

const NAV_PILLS: { label: string; panel: string }[] = [
  { label: 'Buildings', panel: 'alarm-building-setup' },
  { label: 'Zones',     panel: 'alarm-zone-config' },
  { label: 'Rules',     panel: 'alarm-compliance-rules' },
  { label: 'Access',    panel: 'alarm-user-access' },
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

interface Assignment {
  id: string
  userId: string
  userName: string
  userRole: string
  accessType: 'Tester' | 'Approver'
  buildingIds: string[]
  grantedDate: string
  notes: string
}

export default function AlarmUserAccess({ adminName, onNavigate }: Props) {
  const [users, setUsers]           = useState<AlarmUser[]>([])
  const [buildings, setBuildings]   = useState<AlarmBuilding[]>([])
  const [assignments, setAssignments] = useState<Assignment[]>([])
  const [showForm, setShowForm]     = useState(false)
  const [filter, setFilter]         = useState<'All' | 'Testers' | 'Approvers'>('All')
  const [search, setSearch]         = useState('')
  const [page, setPage]             = useState(0)

  // Add form state
  const [formUserId, setFormUserId]         = useState('')
  const [formAccessType, setFormAccessType] = useState<'Tester' | 'Approver'>('Tester')
  const [formBuildings, setFormBuildings]   = useState<string[]>([])
  const [formNotes, setFormNotes]           = useState('')

  // CSV import state
  const [importModal, setImportModal] = useState(false)
  const [csvFile, setCsvFile]         = useState<string>('')
  const [csvRows, setCsvRows]         = useState<AccessCsvRow[]>([])
  const [csvError, setCsvError]       = useState<string>('')
  const csvInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    Promise.all([listAlarmUsers(), listAlarmBuildings()]).then(([u, b]) => {
      setUsers(u)
      setBuildings(b)

      // Pre-populate assignments from mock data
      const initial: Assignment[] = []
      let idSeq = 1

      // Testers: any user assigned as tester in buildings gets alarm_tester
      const testerMap = new Map<string, string[]>()
      for (const bld of b) {
        for (const tid of bld.assignedTesters) {
          if (!testerMap.has(tid)) testerMap.set(tid, [])
          testerMap.get(tid)!.push(bld.id)
        }
      }
      for (const [uid, bldIds] of testerMap) {
        const user = u.find(x => x.id === uid)
        if (!user) continue
        initial.push({
          id: `assign-${idSeq++}`,
          userId: uid,
          userName: user.name,
          userRole: user.role,
          accessType: 'Tester',
          buildingIds: bldIds,
          grantedDate: '2025-01-15',
          notes: '',
        })
      }

      // Approvers: any user assigned as approver in buildings gets alarm_approver
      const approverMap = new Map<string, string[]>()
      for (const bld of b) {
        if (bld.assignedApprover) {
          if (!approverMap.has(bld.assignedApprover)) approverMap.set(bld.assignedApprover, [])
          approverMap.get(bld.assignedApprover)!.push(bld.id)
        }
      }
      for (const [uid, bldIds] of approverMap) {
        const user = u.find(x => x.id === uid)
        if (!user) continue
        initial.push({
          id: `assign-${idSeq++}`,
          userId: uid,
          userName: user.name,
          userRole: user.role,
          accessType: 'Approver',
          buildingIds: bldIds,
          grantedDate: '2025-01-15',
          notes: '',
        })
      }

      // Safety Mgrs get approver access if not already there
      for (const user of u) {
        if (user.role === 'Safety Mgr' && !approverMap.has(user.id)) {
          initial.push({
            id: `assign-${idSeq++}`,
            userId: user.id,
            userName: user.name,
            userRole: user.role,
            accessType: 'Approver',
            buildingIds: b.filter(bld => bld.region === user.region).map(bld => bld.id),
            grantedDate: '2025-01-15',
            notes: '',
          })
        }
      }

      setAssignments(initial)
    })
  }, [])

  // Derived counts
  const testerCount   = assignments.filter(a => a.accessType === 'Tester').length
  const approverCount = assignments.filter(a => a.accessType === 'Approver').length

  // Filtered assignments
  const filteredAssignments = assignments.filter(a => {
    if (filter === 'Testers' && a.accessType !== 'Tester') return false
    if (filter === 'Approvers' && a.accessType !== 'Approver') return false
    if (search) {
      const q = search.toLowerCase()
      if (!a.userName.toLowerCase().includes(q) && !a.userRole.toLowerCase().includes(q)) return false
    }
    return true
  })

  const totalPages = Math.max(1, Math.ceil(filteredAssignments.length / PAGE_SIZE))
  const pageRows   = filteredAssignments.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filteredAssignments.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filteredAssignments.length)

  function buildingName(id: string): string {
    return buildings.find(b => b.id === id)?.name ?? id
  }

  function resetForm() {
    setFormUserId('')
    setFormAccessType('Tester')
    setFormBuildings([])
    setFormNotes('')
  }

  function handleAddOpen() {
    resetForm()
    setShowForm(true)
  }

  function handleAddCancel() {
    setShowForm(false)
    resetForm()
  }

  function handleAddSave() {
    if (!formUserId || formBuildings.length === 0) return
    const user = users.find(u => u.id === formUserId)
    if (!user) return

    const newAssignment: Assignment = {
      id: `assign-${Date.now()}`,
      userId: formUserId,
      userName: user.name,
      userRole: user.role,
      accessType: formAccessType,
      buildingIds: [...formBuildings],
      grantedDate: new Date().toISOString().slice(0, 10),
      notes: formNotes,
    }

    setAssignments(prev => [...prev, newAssignment])
    toast.success('Access granted')
    setShowForm(false)
    resetForm()
  }

  function handleRevoke(a: Assignment) {
    if (!window.confirm(`Revoke alarm access for ${a.userName}?`)) return
    setAssignments(prev => prev.filter(x => x.id !== a.id))
    toast.success('Access revoked')
  }

  function toggleBuilding(bldId: string) {
    setFormBuildings(prev =>
      prev.includes(bldId) ? prev.filter(id => id !== bldId) : [...prev, bldId]
    )
  }

  function selectAllBuildings() {
    setFormBuildings(buildings.map(b => b.id))
  }

  function clearBuildings() {
    setFormBuildings([])
  }

  // ── CSV Import ────────────────────────────────────────────────────────────
  function openImport() {
    setImportModal(true)
    setCsvFile('')
    setCsvRows([])
    setCsvError('')
  }

  function closeImport() {
    setImportModal(false)
    setCsvFile('')
    setCsvRows([])
    setCsvError('')
    if (csvInputRef.current) csvInputRef.current.value = ''
  }

  function handleCsvFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file.name)
    setCsvRows([])
    setCsvError('')

    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? ''
      const lines = text.split('\n').map(l => l.trim()).filter(Boolean)
      if (lines.length < 2) {
        setCsvError('File is empty or has no data rows.')
        return
      }
      const header = lines[0].split(',').map(h => h.trim().toLowerCase().replace(/\s+/g, '_'))
      const missing = ACCESS_CSV_COLUMNS.filter(c => !header.includes(c))
      if (missing.length) {
        setCsvError(`Missing columns: ${missing.join(', ')}`)
        return
      }
      const rows: AccessCsvRow[] = []
      for (let i = 1; i < lines.length; i++) {
        // Handle commas inside quoted strings
        const cols: string[] = []
        let current = ''
        let inQuotes = false
        for (const ch of lines[i]) {
          if (ch === '"') { inQuotes = !inQuotes; continue }
          if (ch === ',' && !inQuotes) { cols.push(current.trim()); current = ''; continue }
          current += ch
        }
        cols.push(current.trim())

        const get = (col: string) => cols[header.indexOf(col)] ?? ''
        const userName = get('user_name')
        if (!userName) continue
        const accessType = get('access_type')
        if (accessType !== 'Tester' && accessType !== 'Approver') {
          setCsvError(`Row ${i}: access_type must be "Tester" or "Approver", got "${accessType}"`)
          return
        }
        rows.push({
          user_name: userName,
          access_type: accessType,
          building_names: get('building_names'),
        })
      }
      if (rows.length === 0) {
        setCsvError('No valid rows found in the CSV file.')
        return
      }
      setCsvRows(rows)
    }
    reader.readAsText(file)
  }

  function handleImportConfirm() {
    let added = 0
    const newAssignments: Assignment[] = []

    for (const row of csvRows) {
      const user = users.find(u => u.name.toLowerCase() === row.user_name.toLowerCase())
      if (!user) continue

      const bldNames = row.building_names.split(',').map(n => n.trim()).filter(Boolean)
      const bldIds = bldNames
        .map(name => buildings.find(b => b.name.toLowerCase() === name.toLowerCase())?.id)
        .filter((id): id is string => !!id)
      if (bldIds.length === 0) continue

      newAssignments.push({
        id: `assign-${Date.now()}-${added}`,
        userId: user.id,
        userName: user.name,
        userRole: user.role,
        accessType: row.access_type as 'Tester' | 'Approver',
        buildingIds: bldIds,
        grantedDate: new Date().toISOString().slice(0, 10),
        notes: '',
      })
      added++
    }

    if (added === 0) {
      setCsvError('No rows could be matched to existing users and buildings.')
      return
    }

    setAssignments(prev => [...prev, ...newAssignments])
    toast.success(`${added} assignment${added !== 1 ? 's' : ''} imported.`)
    closeImport()
  }

  return (
    <div className="fade-up">
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {NAV_PILLS.map(p => (
          <span
            key={p.panel}
            style={pillStyle(p.panel === 'alarm-user-access')}
            onClick={() => onNavigate(p.panel)}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Page header */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Alarm User Access</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Manage alarm testing and approval access &middot; {adminName}</p>
        </div>
      </div>

      {/* Summary row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: 'var(--g7)' }}>{testerCount}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tm)', marginTop: 4 }}>Testers</div>
            <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 2 }}>Users with alarm testing access</div>
          </div>
        </div>
        <div className="card">
          <div className="card-body" style={{ textAlign: 'center', padding: '20px 16px' }}>
            <div style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, color: 'var(--g7)' }}>{approverCount}</div>
            <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--tm)', marginTop: 4 }}>Approvers</div>
            <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 2 }}>Users with approval access</div>
          </div>
        </div>
      </div>

      {/* Manage Access Card */}
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title">Manage Access</span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="/alarm-access-sample.csv"
              download="alarm-access-sample.csv"
              style={{ fontSize: 11, color: 'var(--g7)', border: '1px dashed var(--g5)', padding: '4px 10px', borderRadius: 6, cursor: 'pointer', textDecoration: 'none' }}
            >
              Sample CSV
            </a>
            <button className="btn btn-outline" onClick={openImport}>Import CSV</button>
            <button className="btn btn-primary" onClick={handleAddOpen}>Add Assignment</button>
          </div>
        </div>

        {/* Inline add form */}
        {showForm && (
          <div className="card-body" style={{ borderBottom: '1px solid var(--ow2)', background: 'var(--g0)' }}>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">User</label>
                <select
                  className="f-sel"
                  value={formUserId}
                  onChange={e => setFormUserId(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                >
                  <option value="">— Select User —</option>
                  {users.map(u => (
                    <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                  ))}
                </select>
              </div>
              <div className="f-field">
                <label className="f-lbl">Access Type</label>
                <select
                  className="f-sel"
                  value={formAccessType}
                  onChange={e => setFormAccessType(e.target.value as 'Tester' | 'Approver')}
                  style={{ width: '100%', fontSize: 13 }}
                >
                  <option value="Tester">Tester</option>
                  <option value="Approver">Approver</option>
                </select>
              </div>
            </div>

            <div className="f-field">
              <label className="f-lbl">Buildings</label>
              <div style={{ marginBottom: 6, display: 'flex', gap: 12 }}>
                <span
                  onClick={selectAllBuildings}
                  style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Select All
                </span>
                <span
                  onClick={clearBuildings}
                  style={{ fontSize: 12, color: 'var(--g7)', cursor: 'pointer', textDecoration: 'underline' }}
                >
                  Clear
                </span>
              </div>
              <div style={{ maxHeight: 160, overflowY: 'auto', border: '1.5px solid var(--ow2)', borderRadius: 7, padding: '6px 10px', background: '#fff' }}>
                {buildings.map(b => (
                  <label key={b.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formBuildings.includes(b.id)}
                      onChange={() => toggleBuilding(b.id)}
                    />
                    <span>{b.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="f-row">
              <div className="f-field" style={{ gridColumn: '1 / -1' }}>
                <label className="f-lbl">Notes (optional)</label>
                <textarea
                  className="f-ta"
                  value={formNotes}
                  onChange={e => setFormNotes(e.target.value)}
                  style={{ width: '100%', fontSize: 13 }}
                  rows={2}
                />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
              <button className="btn btn-outline" onClick={handleAddCancel}>Cancel</button>
              <button className="btn btn-primary" onClick={handleAddSave}>Save</button>
            </div>
          </div>
        )}

        {/* Filter row */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--ow2)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {(['All', 'Testers', 'Approvers'] as const).map(f => (
            <span
              key={f}
              onClick={() => { setFilter(f); setPage(0) }}
              style={{
                display: 'inline-flex',
                padding: '5px 14px',
                borderRadius: 20,
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
                border: `1.5px solid ${filter === f ? 'var(--g7)' : 'var(--ow2)'}`,
                background: filter === f ? 'var(--g7)' : 'transparent',
                color: filter === f ? '#fff' : 'var(--tm)',
              }}
            >
              {f}
            </span>
          ))}
          <input
            className="f-inp"
            placeholder="Search by name..."
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(0) }}
            style={{ marginLeft: 'auto', width: 200, fontSize: 12, padding: '6px 10px' }}
          />
        </div>

        {/* Assignments table */}
        <div style={{ padding: 0 }}>
          {filteredAssignments.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No assignments found</div>
              <div>Add an assignment to get started.</div>
            </div>
          )}
          {filteredAssignments.length > 0 && (<>
            <table className="dt">
              <thead>
                <tr>
                  <th>User</th>
                  <th>Access Type</th>
                  <th>Buildings</th>
                  <th>Granted Date</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(a => {
                  const bldNames = a.buildingIds.map(buildingName)
                  const displayNames = bldNames.slice(0, 3).join(', ')
                  const extra = bldNames.length > 3 ? bldNames.length - 3 : 0
                  return (
                    <tr key={a.id}>
                      <td>
                        <div style={{ fontWeight: 500, fontSize: 13 }}>{a.userName}</div>
                        <div style={{ fontSize: 11, color: 'var(--ts)' }}>{a.userRole}</div>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          padding: '3px 10px',
                          borderRadius: 20,
                          fontSize: 11,
                          fontWeight: 500,
                          background: a.accessType === 'Tester' ? '#dbeafe' : 'var(--g1)',
                          color: a.accessType === 'Tester' ? '#1e40af' : 'var(--g8)',
                        }}>
                          {a.accessType}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>
                        <span title={bldNames.join(', ')}>
                          {displayNames}
                          {extra > 0 && (
                            <span style={{ fontSize: 11, color: 'var(--ts)', marginLeft: 4 }}>+{extra} more</span>
                          )}
                        </span>
                      </td>
                      <td style={{ fontSize: 13 }}>{a.grantedDate}</td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn"
                          style={{
                            fontSize: 11,
                            padding: '4px 10px',
                            background: 'transparent',
                            color: 'var(--red)',
                            border: '1.5px solid var(--red)',
                            borderRadius: 6,
                          }}
                          onClick={() => handleRevoke(a)}
                        >
                          Revoke
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
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromRow}–{toRow} of {filteredAssignments.length} assignments</span>
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

      {/* ── Import CSV Modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 6 }}>Import Access Assignments from CSV</h3>
            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 20 }}>
              Upload a CSV with columns: <code style={{ fontSize: 12, background: 'var(--ow2)', padding: '1px 5px', borderRadius: 4 }}>user_name, access_type, building_names</code>
            </p>

            <div className="f-field">
              <label className="f-lbl">CSV File</label>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvFile}
                style={{ fontSize: 13, width: '100%' }}
              />
            </div>

            {csvError && (
              <div style={{ background: 'var(--red-bg)', border: '1px solid #fca5a5', borderRadius: 7, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
                {csvError}
              </div>
            )}

            {csvFile && csvRows.length > 0 && (
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--ts)', marginBottom: 8 }}>
                  Preview — {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} from &ldquo;{csvFile}&rdquo;
                </div>
                <div style={{ border: '1px solid var(--ow2)', borderRadius: 8, overflow: 'hidden', maxHeight: 240, overflowY: 'auto' }}>
                  <table className="dt" style={{ fontSize: 12 }}>
                    <thead>
                      <tr>
                        <th>User Name</th>
                        <th>Access Type</th>
                        <th>Buildings</th>
                        <th>Match</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => {
                        const userMatch = users.some(u => u.name.toLowerCase() === r.user_name.toLowerCase())
                        const bldNames = r.building_names.split(',').map(n => n.trim()).filter(Boolean)
                        const matchedCount = bldNames.filter(name => buildings.some(b => b.name.toLowerCase() === name.toLowerCase())).length
                        return (
                          <tr key={i}>
                            <td style={{ color: userMatch ? 'inherit' : 'var(--red)' }}>{r.user_name}{!userMatch && ' (not found)'}</td>
                            <td>{r.access_type}</td>
                            <td>{bldNames.length} building{bldNames.length !== 1 ? 's' : ''}</td>
                            <td>
                              <span style={{ color: matchedCount === bldNames.length ? 'var(--g7)' : 'var(--amb)', fontWeight: 500 }}>
                                {matchedCount}/{bldNames.length}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={closeImport}>Cancel</button>
              {csvRows.length > 0 && (
                <button className="btn btn-primary" onClick={handleImportConfirm}>
                  Import {csvRows.length} Assignment{csvRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
