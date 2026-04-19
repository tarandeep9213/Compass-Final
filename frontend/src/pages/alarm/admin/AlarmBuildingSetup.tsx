import React, { useState, useEffect, useRef } from 'react'
import { listAlarmBuildings, listAlarmUsers, updateBuildingSetup, createBuilding, importBuildings, resetBuildings } from '../../../api/alarm'
import type { AlarmBuilding, AlarmUser } from '../../../mock/alarmData'
import { toast } from '../../../components/ui/Toast'

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

const REGIONS = ['Midwest', 'Southeast', 'Northeast', 'Southwest', 'Northwest', 'West']

const CSV_COLUMNS = ['name', 'region', 'security_company_name', 'security_customer_id', 'security_company_phone', 'status'] as const

type CsvRow = {
  name: string
  region: string
  security_company_name: string
  security_customer_id: string
  security_company_phone: string
  status: string
}

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

interface BuildingForm {
  name: string
  region: string
  securityCompanyName: string
  securityCustomerId: string
  securityCompanyPhone: string
  assignedTesters: string[]
  assignedApprover: string
  status: AlarmBuilding['status']
  exemptReason: string
  reactivationDate: string
}

const EMPTY_FORM: BuildingForm = {
  name: '',
  region: REGIONS[0],
  securityCompanyName: '',
  securityCustomerId: '',
  securityCompanyPhone: '',
  assignedTesters: [],
  assignedApprover: '',
  status: 'active',
  exemptReason: '',
  reactivationDate: '',
}

export default function AlarmBuildingSetup({ adminName, onNavigate }: Props) {
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [users, setUsers]         = useState<AlarmUser[]>([])
  const [search, setSearch]       = useState('')
  const [page, setPage]           = useState(0)

  // modal: null = closed, 'add' = new building, AlarmBuilding = editing
  const [modal, setModal]   = useState<null | 'add' | AlarmBuilding>(null)
  const [form, setForm]     = useState<BuildingForm>(EMPTY_FORM)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // CSV import state
  const [importModal, setImportModal] = useState(false)
  const [csvFile, setCsvFile]         = useState<string>('')
  const [csvRows, setCsvRows]         = useState<CsvRow[]>([])
  const [csvError, setCsvError]       = useState<string>('')
  const csvInputRef = useRef<HTMLInputElement>(null)

  // Reset confirmation
  const [showReset, setShowReset] = useState(false)

  useEffect(() => {
    listAlarmBuildings().then(setBuildings)
    listAlarmUsers().then(setUsers)
  }, [])

  // ── Search filter ─────────────────────────────────────────────────────────
  const filtered = buildings.filter(b => {
    const q = search.toLowerCase()
    return !q
      || b.name.toLowerCase().includes(q)
      || b.region.toLowerCase().includes(q)
      || b.securityCompanyName.toLowerCase().includes(q)
      || b.securityCustomerId.toLowerCase().includes(q)
  })

  // ── KPI counts ────────────────────────────────────────────────────────────
  const totalBuildings = buildings.length
  const activeCount    = buildings.filter(b => b.status === 'active').length
  const exemptCount    = buildings.filter(b => b.status === 'temporarily_exempt').length
  const closedCount    = buildings.filter(b => b.status === 'closed').length

  // ── Pagination ────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const pageRows   = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = filtered.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, filtered.length)

  function userName(id: string): string {
    return users.find(u => u.id === id)?.name ?? ''
  }

  // ── Modal helpers ─────────────────────────────────────────────────────────
  function openAdd() {
    setModal('add')
    setForm({ ...EMPTY_FORM })
    setErrors({})
  }

  function openEdit(b: AlarmBuilding) {
    setModal(b)
    setForm({
      name: b.name,
      region: b.region,
      securityCompanyName: b.securityCompanyName,
      securityCustomerId: b.securityCustomerId,
      securityCompanyPhone: b.securityCompanyPhone,
      assignedTesters: [...b.assignedTesters],
      assignedApprover: b.assignedApprover,
      status: b.status,
      exemptReason: b.exemptReason ?? '',
      reactivationDate: '',
    })
    setErrors({})
  }

  function closeModal() {
    setModal(null)
    setErrors({})
  }

  function toggleTester(userId: string) {
    const has = form.assignedTesters.includes(userId)
    setForm(f => ({
      ...f,
      assignedTesters: has
        ? f.assignedTesters.filter(id => id !== userId)
        : [...f.assignedTesters, userId],
    }))
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    if (!form.name.trim())                 e.name = 'Building name is required'
    if (!form.region)                      e.region = 'Region is required'
    if (!form.securityCompanyName.trim())  e.securityCompanyName = 'Security company name is required'
    if (!form.securityCustomerId.trim())   e.securityCustomerId = 'Customer ID is required'
    if (!form.securityCompanyPhone.trim()) e.securityCompanyPhone = 'Phone is required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    if (modal === 'add') {
      await createBuilding({
        name: form.name.trim(),
        region: form.region,
        securityCompanyName: form.securityCompanyName.trim(),
        securityCustomerId: form.securityCustomerId.trim(),
        securityCompanyPhone: form.securityCompanyPhone.trim(),
        assignedTesters: form.assignedTesters,
        assignedApprover: form.assignedApprover,
        status: form.status,
        exemptReason: form.status === 'temporarily_exempt' ? form.exemptReason : undefined,
      })
      toast.success(`Building "${form.name.trim()}" added.`)
    } else if (modal && typeof modal === 'object') {
      await updateBuildingSetup(modal.id, {
        name: form.name.trim(),
        region: form.region,
        securityCompanyName: form.securityCompanyName.trim(),
        securityCustomerId: form.securityCustomerId.trim(),
        securityCompanyPhone: form.securityCompanyPhone.trim(),
        assignedTesters: form.assignedTesters,
        assignedApprover: form.assignedApprover,
        status: form.status,
        exemptReason: form.status === 'temporarily_exempt' ? form.exemptReason : undefined,
      })
      toast.success('Building updated.')
    }

    closeModal()
    const refreshed = await listAlarmBuildings()
    setBuildings(refreshed)
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
      const missing = CSV_COLUMNS.filter(c => !header.includes(c))
      if (missing.length) {
        setCsvError(`Missing columns: ${missing.join(', ')}`)
        return
      }
      const rows: CsvRow[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''))
        const get = (col: string) => cols[header.indexOf(col)] ?? ''
        const name = get('name')
        if (!name) continue
        rows.push({
          name,
          region: get('region'),
          security_company_name: get('security_company_name'),
          security_customer_id: get('security_customer_id'),
          security_company_phone: get('security_company_phone'),
          status: get('status') || 'active',
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

  async function handleImportConfirm() {
    const payload = csvRows.map(r => ({
      name: r.name,
      region: r.region,
      securityCompanyName: r.security_company_name,
      securityCustomerId: r.security_customer_id,
      securityCompanyPhone: r.security_company_phone,
      status: r.status as AlarmBuilding['status'],
    }))
    await importBuildings(payload)
    toast.success(`${csvRows.length} building${csvRows.length !== 1 ? 's' : ''} imported.`)
    closeImport()
    const refreshed = await listAlarmBuildings()
    setBuildings(refreshed)
  }

  // ── Reset ─────────────────────────────────────────────────────────────────
  async function handleReset() {
    await resetBuildings()
    setShowReset(false)
    const refreshed = await listAlarmBuildings()
    setBuildings(refreshed)
    toast.success('Buildings reset to original seed data.')
  }

  const statusBadge = (status: AlarmBuilding['status']) => {
    if (status === 'active')
      return <span className="badge badge-green"><span className="bdot" /> Active</span>
    if (status === 'temporarily_exempt')
      return <span className="badge badge-amber"><span className="bdot" /> Exempt</span>
    return <span className="badge badge-gray">Closed</span>
  }

  const isAdd = modal === 'add'
  const modalTitle = isAdd ? 'Add Building' : modal && typeof modal === 'object' ? `Edit — ${modal.name}` : ''

  return (
    <div className="fade-up">
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {NAV_PILLS.map(p => (
          <span
            key={p.panel}
            data-screenshot-trigger={`sub-${p.panel}`}
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

      {/* Building list card */}
      <div className="card">
        {/* Card header */}
        <div className="card-header" style={{ flexWrap: 'wrap', gap: 8 }}>
          <span className="card-title">Buildings</span>
          <span className="card-sub">{buildings.length} total</span>
          {/* Search */}
          <div style={{ marginLeft: 8, flex: 1, minWidth: 200, maxWidth: 300, position: 'relative' }}>
            <span style={{
              position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)',
              fontSize: 14, color: 'var(--ts)', pointerEvents: 'none',
            }}>🔍</span>
            <input
              className="f-inp"
              placeholder="Search by name, region, security co..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(0) }}
              style={{ paddingLeft: 32, fontSize: 13, height: 36, width: '100%' }}
            />
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Sample CSV — always visible */}
            <a
              href="/alarm-buildings-sample.csv"
              download="alarm-buildings-sample.csv"
              style={{
                fontSize: 12, color: 'var(--g7)', fontWeight: 500,
                textDecoration: 'none', padding: '5px 11px', borderRadius: 6,
                border: '1.5px dashed var(--g4)', background: 'var(--g0)',
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              ⬇ Sample CSV
            </a>
            <button className="btn btn-outline" onClick={openImport}>Import CSV</button>
            <button className="btn btn-primary" data-screenshot-trigger="add-building" onClick={openAdd}>+ Add Building</button>
            <button
              className="btn btn-outline"
              style={{ color: 'var(--red)', borderColor: 'var(--red)' }}
              onClick={() => setShowReset(true)}
              title="Reset to original seed data"
            >
              Reset
            </button>
          </div>
        </div>

        <div className="card-body" style={{ padding: 0 }}>
          {filtered.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>🏢</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>
                {search ? 'No buildings match your search' : 'No buildings yet'}
              </div>
              <div>
                {search
                  ? 'Try a different search term.'
                  : 'Click "+ Add Building" or "Import CSV" to get started.'}
              </div>
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
                        {approverName || <span style={{ color: 'var(--red)' }}>None</span>}
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

      {/* ── Add / Edit Building Modal ── */}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 520, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 20 }}>
              {modalTitle}
            </h3>

            {/* Basic Info */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>Building Info</div>
            <div className="f-field">
              <label className="f-lbl">Building Name</label>
              <input
                className="f-inp"
                value={form.name}
                onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setErrors(p => ({ ...p, name: '' })) }}
                placeholder="e.g. Canteen Vending - Wausau"
                style={{ width: '100%', fontSize: 13 }}
              />
              {errors.name && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.name}</div>}
            </div>
            <div className="f-field">
              <label className="f-lbl">Region</label>
              <select
                className="f-sel"
                value={form.region}
                onChange={e => { setForm(f => ({ ...f, region: e.target.value })); setErrors(p => ({ ...p, region: '' })) }}
                style={{ width: '100%', fontSize: 13 }}
              >
                {REGIONS.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
              {errors.region && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.region}</div>}
            </div>

            {/* Security Company Info */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 4 }}>Security Company Info</div>
            <div className="f-field">
              <label className="f-lbl">Company Name</label>
              <input
                className="f-inp"
                value={form.securityCompanyName}
                onChange={e => { setForm(f => ({ ...f, securityCompanyName: e.target.value })); setErrors(p => ({ ...p, securityCompanyName: '' })) }}
                placeholder="e.g. AES IntelliNet"
                style={{ width: '100%', fontSize: 13 }}
              />
              {errors.securityCompanyName && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.securityCompanyName}</div>}
            </div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Customer ID</label>
                <input
                  className="f-inp"
                  value={form.securityCustomerId}
                  onChange={e => { setForm(f => ({ ...f, securityCustomerId: e.target.value })); setErrors(p => ({ ...p, securityCustomerId: '' })) }}
                  placeholder="e.g. AES9925"
                  style={{ width: '100%', fontSize: 13 }}
                />
                {errors.securityCustomerId && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.securityCustomerId}</div>}
              </div>
              <div className="f-field">
                <label className="f-lbl">Phone</label>
                <input
                  className="f-inp"
                  value={form.securityCompanyPhone}
                  onChange={e => { setForm(f => ({ ...f, securityCompanyPhone: e.target.value })); setErrors(p => ({ ...p, securityCompanyPhone: '' })) }}
                  placeholder="e.g. (800) 555-0101"
                  style={{ width: '100%', fontSize: 13 }}
                />
                {errors.securityCompanyPhone && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.securityCompanyPhone}</div>}
              </div>
            </div>

            {/* Assignments */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 4 }}>Assignments</div>
            <div className="f-field">
              <label className="f-lbl">Testers</label>
              <div style={{ maxHeight: 140, overflowY: 'auto', border: '1.5px solid var(--ow2)', borderRadius: 7, padding: '6px 10px', background: 'var(--ow)' }}>
                {users.length === 0
                  ? <div style={{ fontSize: 12, color: 'var(--ts)', padding: '6px 0' }}>No users available</div>
                  : users.map(u => (
                    <label key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', fontSize: 13, cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={form.assignedTesters.includes(u.id)}
                        onChange={() => toggleTester(u.id)}
                      />
                      <span>{u.name}</span>
                      <span style={{ fontSize: 11, color: 'var(--ts)' }}>({u.role})</span>
                    </label>
                  ))
                }
              </div>
            </div>
            <div className="f-field">
              <label className="f-lbl">Approver</label>
              <select
                className="f-sel"
                value={form.assignedApprover}
                onChange={e => setForm(f => ({ ...f, assignedApprover: e.target.value }))}
                style={{ width: '100%', fontSize: 13 }}
              >
                <option value="">— Select Approver —</option>
                {users.map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
                ))}
              </select>
            </div>

            {/* Status */}
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10, marginTop: 4 }}>Status</div>
            <div className="f-field">
              {(['active', 'temporarily_exempt', 'closed'] as const).map(s => (
                <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '5px 0', fontSize: 13, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="building-status"
                    checked={form.status === s}
                    onChange={() => setForm(f => ({ ...f, status: s }))}
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
                    onChange={e => setForm(f => ({ ...f, exemptReason: e.target.value }))}
                    style={{ width: '100%', fontSize: 13 }}
                    rows={3}
                  />
                </div>
                <div className="f-field">
                  <label className="f-lbl">Expected Reactivation Date</label>
                  <input
                    className="f-inp"
                    type="date"
                    value={form.reactivationDate}
                    onChange={e => setForm(f => ({ ...f, reactivationDate: e.target.value }))}
                    style={{ width: '100%', fontSize: 13 }}
                  />
                </div>
              </>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 24 }}>
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>
                {isAdd ? 'Add Building' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', width: 580, maxHeight: '88vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 6 }}>Import Buildings from CSV</h3>
            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 20 }}>
              Upload a CSV with columns: <code style={{ fontSize: 12, background: 'var(--ow2)', padding: '1px 5px', borderRadius: 4 }}>name, region, security_company_name, security_customer_id, security_company_phone, status</code>
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
                        <th>Name</th>
                        <th>Region</th>
                        <th>Security Co.</th>
                        <th>Cust. ID</th>
                        <th>Phone</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i}>
                          <td>{r.name}</td>
                          <td>{r.region}</td>
                          <td>{r.security_company_name}</td>
                          <td>{r.security_customer_id}</td>
                          <td>{r.security_company_phone}</td>
                          <td>{r.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={closeImport}>Cancel</button>
              {csvRows.length > 0 && (
                <button className="btn btn-primary" onClick={handleImportConfirm}>
                  Import {csvRows.length} Building{csvRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Reset Confirmation ── */}
      {showReset && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '28px', width: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 10 }}>Reset Buildings?</h3>
            <p style={{ fontSize: 13, color: 'var(--tm)', marginBottom: 20 }}>
              This will remove all imported and manually added buildings, restoring the original 12 seed buildings. Any edits made to existing buildings will also be lost.
            </p>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button className="btn btn-outline" onClick={() => setShowReset(false)}>Cancel</button>
              <button
                className="btn"
                style={{ background: 'var(--red)', color: '#fff' }}
                onClick={handleReset}
              >
                Yes, Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
