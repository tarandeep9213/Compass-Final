import React, { useState, useEffect } from 'react'
import { listZones, createZone, updateZone, deleteZone, listAlarmBuildings } from '../../../api/alarm'
import type { AlarmZone, AlarmBuilding } from '../../../mock/alarmData'
import { toast } from '../../../components/ui/Toast'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

const ZONE_TYPES: AlarmZone['zoneType'][] = [
  'ENTRY_EXIT', 'INTERIOR_MOTION', 'PANIC_SILENT', 'HOLDUP', 'FIRE_SMOKE', 'OTHER',
]

const ZONE_TYPE_LABELS: Record<AlarmZone['zoneType'], string> = {
  ENTRY_EXIT: 'Entry / Exit',
  INTERIOR_MOTION: 'Interior Motion',
  PANIC_SILENT: 'Panic Silent',
  HOLDUP: 'Holdup',
  FIRE_SMOKE: 'Fire / Smoke',
  OTHER: 'Other',
}

const ZONE_TYPE_COLORS: Record<AlarmZone['zoneType'], { bg: string; color: string }> = {
  ENTRY_EXIT:       { bg: '#dbeafe', color: '#1e40af' },
  INTERIOR_MOTION:  { bg: '#ede9fe', color: '#6d28d9' },
  PANIC_SILENT:     { bg: '#fee2e2', color: '#991b1b' },
  HOLDUP:           { bg: '#fef3c7', color: '#92400e' },
  FIRE_SMOKE:       { bg: '#ffedd5', color: '#9a3412' },
  OTHER:            { bg: '#f3f4f6', color: '#4b5563' },
}

const NAV_PILLS: { label: string; panel: string }[] = [
  { label: 'Buildings', panel: 'alarm-building-setup' },
  { label: 'Zones',     panel: 'alarm-zone-config' },
  { label: 'Rules',     panel: 'alarm-compliance-rules' },
  { label: 'Access',    panel: 'alarm-user-access' },
]

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3)          return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4)  return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

interface ZoneForm {
  zoneNumber: string
  zoneName: string
  zoneType: AlarmZone['zoneType']
  areaNumber: string
  otherDescription: string
}

const EMPTY_FORM: ZoneForm = {
  zoneNumber: '',
  zoneName: '',
  zoneType: 'ENTRY_EXIT',
  areaNumber: '1',
  otherDescription: '',
}

export default function AlarmZoneConfig({ adminName, onNavigate }: Props) {
  const [buildings,         setBuildings]         = useState<AlarmBuilding[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>('')
  const [zones,             setZones]             = useState<AlarmZone[]>([])
  const [page,              setPage]              = useState(0)
  const [modal,             setModal]             = useState<null | 'add' | { zone: AlarmZone }>(null)
  const [importModal,       setImportModal]       = useState(false)
  const [form,              setForm]              = useState<ZoneForm>(EMPTY_FORM)
  const [errors,            setErrors]            = useState<Record<string, string>>({})
  const [csvRows,           setCsvRows]           = useState<ZoneForm[]>([])
  const [csvFile,           setCsvFile]           = useState<string>('')

  // Track which zone IDs were created this session (deletable)
  const [newZoneIds, setNewZoneIds] = useState<Set<string>>(new Set())

  // Load buildings on mount
  useEffect(() => {
    listAlarmBuildings().then(b => {
      setBuildings(b)
      if (b.length > 0) setSelectedBuildingId(b[0].id)
    })
  }, [])

  // Load zones when building changes
  useEffect(() => {
    if (!selectedBuildingId) return
    listZones(selectedBuildingId).then(z => { setZones(z); setPage(0) })
  }, [selectedBuildingId])

  const selectedBuilding = buildings.find(b => b.id === selectedBuildingId)
  const totalPages = Math.max(1, Math.ceil(zones.length / PAGE_SIZE))
  const pageRows   = zones.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
  const fromRow    = zones.length === 0 ? 0 : page * PAGE_SIZE + 1
  const toRow      = Math.min((page + 1) * PAGE_SIZE, zones.length)

  // ── Modal helpers ──

  function openAdd() {
    setModal('add')
    setForm({ ...EMPTY_FORM })
    setErrors({})
  }

  function openEdit(zone: AlarmZone) {
    setModal({ zone })
    setForm({
      zoneNumber: String(zone.zoneNumber),
      zoneName: zone.zoneName,
      zoneType: zone.zoneType,
      areaNumber: String(zone.areaNumber),
      otherDescription: zone.otherDescription ?? '',
    })
    setErrors({})
  }

  function closeModal() { setModal(null); setErrors({}) }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {}
    const num = Number(form.zoneNumber)
    if (!form.zoneNumber || isNaN(num) || num <= 0) e.zoneNumber = 'Zone number required'
    // Unique check within building
    const editId = modal && typeof modal === 'object' ? modal.zone.id : null
    if (form.zoneNumber && zones.some(z => z.zoneNumber === num && z.id !== editId))
      e.zoneNumber = 'Zone number already exists in this building'
    if (!form.zoneName.trim()) e.zoneName = 'Zone name required'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }

    if (modal === 'add') {
      const created = await createZone({
        buildingId: selectedBuildingId,
        zoneNumber: Number(form.zoneNumber),
        zoneName: form.zoneName.trim(),
        zoneType: form.zoneType,
        areaNumber: Number(form.areaNumber) || 1,
        isActive: true,
        otherDescription: form.zoneType === 'OTHER' ? form.otherDescription.trim() : undefined,
      })
      setNewZoneIds(prev => new Set(prev).add(created.id))
      toast.success(`Zone "${created.zoneName}" added.`)
    } else if (modal && typeof modal === 'object') {
      await updateZone(modal.zone.id, {
        zoneNumber: Number(form.zoneNumber),
        zoneName: form.zoneName.trim(),
        zoneType: form.zoneType,
        areaNumber: Number(form.areaNumber) || 1,
        otherDescription: form.zoneType === 'OTHER' ? form.otherDescription.trim() : undefined,
      })
      toast.success('Zone updated.')
    }

    setModal(null)
    const refreshed = await listZones(selectedBuildingId)
    setZones(refreshed)
  }

  async function handleToggleActive(zone: AlarmZone) {
    const action = zone.isActive ? 'Deactivate' : 'Reactivate'
    if (!window.confirm(`${action} zone "${zone.zoneName}"?`)) return
    await updateZone(zone.id, { isActive: !zone.isActive })
    toast.success(`Zone ${zone.isActive ? 'deactivated' : 'reactivated'}.`)
    const refreshed = await listZones(selectedBuildingId)
    setZones(refreshed)
  }

  async function handleDelete(zone: AlarmZone) {
    if (!window.confirm(`Delete zone "${zone.zoneName}"? This cannot be undone.`)) return
    await deleteZone(zone.id)
    setNewZoneIds(prev => { const s = new Set(prev); s.delete(zone.id); return s })
    toast.success(`Zone "${zone.zoneName}" deleted.`)
    const refreshed = await listZones(selectedBuildingId)
    setZones(refreshed)
    if (page > 0 && page * PAGE_SIZE >= refreshed.length) setPage(p => p - 1)
  }

  // ── CSV Import ──

  function openImport() {
    setImportModal(true)
    setCsvRows([])
    setCsvFile('')
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file.name)
    const reader = new FileReader()
    reader.onload = (ev) => {
      const text = ev.target?.result as string
      const lines = text.split(/\r?\n/).filter(l => l.trim())
      if (lines.length < 2) { setCsvRows([]); return }
      // skip header row
      const rows: ZoneForm[] = []
      for (let i = 1; i < lines.length; i++) {
        const cols = lines[i].split(',').map(c => c.trim())
        if (cols.length < 3) continue
        const zoneType = ZONE_TYPES.includes(cols[2] as AlarmZone['zoneType'])
          ? (cols[2] as AlarmZone['zoneType'])
          : 'OTHER'
        rows.push({
          zoneNumber: cols[0] || '',
          zoneName: cols[1] || '',
          zoneType,
          areaNumber: cols[3] || '1',
          otherDescription: '',
        })
      }
      setCsvRows(rows)
    }
    reader.readAsText(file)
  }

  async function handleImportConfirm() {
    let count = 0
    for (const row of csvRows) {
      const num = Number(row.zoneNumber)
      if (!num || !row.zoneName.trim()) continue
      if (zones.some(z => z.zoneNumber === num)) continue
      const created = await createZone({
        buildingId: selectedBuildingId,
        zoneNumber: num,
        zoneName: row.zoneName.trim(),
        zoneType: row.zoneType,
        areaNumber: Number(row.areaNumber) || 1,
        isActive: true,
      })
      setNewZoneIds(prev => new Set(prev).add(created.id))
      count++
    }
    toast.success(`${count} zone${count !== 1 ? 's' : ''} imported.`)
    setImportModal(false)
    setCsvRows([])
    setCsvFile('')
    const refreshed = await listZones(selectedBuildingId)
    setZones(refreshed)
  }

  // ── Pill style helper ──

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

  // ── Render ──

  return (
    <div className="fade-up">
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {NAV_PILLS.map(p => (
          <span
            key={p.panel}
            style={pillStyle(p.panel === 'alarm-zone-config')}
            onClick={() => onNavigate(p.panel)}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Page header */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Alarm Zone Configuration</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Manage alarm zones per building &middot; {adminName}</p>
        </div>
        <div className="ph-right">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
            <label style={{ fontSize: 11, fontWeight: 600, color: 'var(--ts)', letterSpacing: '0.04em', textTransform: 'uppercase' }}>Building</label>
            <select
              className="f-sel"
              value={selectedBuildingId}
              onChange={e => setSelectedBuildingId(e.target.value)}
              style={{ fontSize: 13, width: 260 }}
            >
              {buildings.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Zone list card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Zones for {selectedBuilding?.name ?? '...'}</span>
          <span className="card-sub">
            {zones.length} total &middot; {zones.filter(z => z.isActive).length} active
            {zones.length > 0 && (<>
              {' '}&middot; {zones.filter(z => z.zoneType === 'ENTRY_EXIT').length} doors
              {' '}&middot; {zones.filter(z => z.zoneType === 'INTERIOR_MOTION').length} motion
              {' '}&middot; <strong style={{ color: 'var(--red)' }}>{zones.filter(z => z.zoneType === 'PANIC_SILENT' || z.zoneType === 'HOLDUP').length} panic/holdup</strong>
            </>)}
          </span>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
            <a
              href="/alarm-zones-sample.csv"
              download="alarm-zones-sample.csv"
              style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 10px', border: '1px dashed var(--g4)', borderRadius: 6, background: '#f0fdf4' }}
            >
              ⬇ Sample CSV
            </a>
            <button className="btn btn-outline" onClick={openImport}>Import CSV</button>
            <button className="btn btn-primary" onClick={openAdd}>+ Add Zone</button>
          </div>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {zones.length === 0 && (
            <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 8 }}>📍</div>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>No zones found</div>
              <div>Add a zone or import from CSV to get started.</div>
            </div>
          )}
          {zones.length > 0 && (<>
            <table className="dt">
              <thead>
                <tr>
                  <th style={{ textAlign: 'center' }}>Zone #</th>
                  <th>Zone Name</th>
                  <th>Type</th>
                  <th style={{ textAlign: 'center' }}>Area</th>
                  <th style={{ textAlign: 'center' }}>Status</th>
                  <th style={{ textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map(zone => {
                  const tc = ZONE_TYPE_COLORS[zone.zoneType]
                  return (
                    <tr key={zone.id} style={{ opacity: zone.isActive ? 1 : 0.6 }}>
                      <td style={{ textAlign: 'center', fontWeight: 700, fontSize: 14 }}>{zone.zoneNumber}</td>
                      <td><span style={{ fontWeight: 500, fontSize: 13 }}>{zone.zoneName}</span></td>
                      <td>
                        <span style={{
                          display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                          borderRadius: 20, fontSize: 11, fontWeight: 500,
                          background: tc.bg, color: tc.color,
                        }}>
                          {ZONE_TYPE_LABELS[zone.zoneType]}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: 13 }}>{zone.areaNumber}</td>
                      <td style={{ textAlign: 'center' }}>
                        {zone.isActive
                          ? <span className="badge badge-green"><span className="bdot" /> Active</span>
                          : <span className="badge badge-gray">Inactive</span>
                        }
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px' }}
                          onClick={() => openEdit(zone)}
                          title="Edit"
                        >
                          ✏️
                        </button>
                        <button
                          className="btn btn-ghost"
                          style={{ fontSize: 11, padding: '4px 10px', marginLeft: 4, color: zone.isActive ? 'var(--red)' : 'var(--g7)' }}
                          onClick={() => handleToggleActive(zone)}
                        >
                          {zone.isActive ? 'Deactivate' : 'Reactivate'}
                        </button>
                        {newZoneIds.has(zone.id) && (
                          <button
                            className="btn btn-ghost"
                            style={{ fontSize: 11, padding: '4px 10px', marginLeft: 4, color: 'var(--red)' }}
                            onClick={() => handleDelete(zone)}
                            title="Delete"
                          >
                            🗑️
                          </button>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderTop: '1px solid var(--ow2)', background: 'var(--ow)' }}>
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>Showing {fromRow}–{toRow} of {zones.length} zones</span>
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

      {/* ── Add / Edit Zone Modal ── */}
      {modal !== null && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 440, boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 20 }}>
              {modal === 'add' ? 'Add Zone' : `Edit Zone — ${(modal as { zone: AlarmZone }).zone.zoneName}`}
            </h3>

            {/* Zone Number + Area Number */}
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Zone Number</label>
                <input
                  className="f-inp"
                  type="number"
                  value={form.zoneNumber}
                  onChange={e => { setForm(p => ({ ...p, zoneNumber: e.target.value })); setErrors(p => ({ ...p, zoneNumber: '' })) }}
                  style={{ width: '100%', fontSize: 13 }}
                />
                {errors.zoneNumber && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.zoneNumber}</div>}
              </div>
              <div className="f-field">
                <label className="f-lbl">Area Number</label>
                <input
                  className="f-inp"
                  type="number"
                  value={form.areaNumber}
                  onChange={e => setForm(p => ({ ...p, areaNumber: e.target.value }))}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            </div>

            {/* Zone Name */}
            <div className="f-field">
              <label className="f-lbl">Zone Name</label>
              <input
                className="f-inp"
                value={form.zoneName}
                onChange={e => { setForm(p => ({ ...p, zoneName: e.target.value })); setErrors(p => ({ ...p, zoneName: '' })) }}
                style={{ width: '100%', fontSize: 13 }}
              />
              {errors.zoneName && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4 }}>{errors.zoneName}</div>}
            </div>

            {/* Zone Type */}
            <div className="f-field">
              <label className="f-lbl">Zone Type</label>
              <select
                className="f-sel"
                value={form.zoneType}
                onChange={e => setForm(p => ({ ...p, zoneType: e.target.value as AlarmZone['zoneType'] }))}
                style={{ width: '100%', fontSize: 13 }}
              >
                {ZONE_TYPES.map(t => (
                  <option key={t} value={t}>{ZONE_TYPE_LABELS[t]}</option>
                ))}
              </select>
            </div>

            {/* Conditional: OTHER description */}
            {form.zoneType === 'OTHER' && (
              <div className="f-field">
                <label className="f-lbl">Description</label>
                <input
                  className="f-inp"
                  value={form.otherDescription}
                  onChange={e => setForm(p => ({ ...p, otherDescription: e.target.value }))}
                  placeholder="Describe the zone type"
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
            )}

            {/* Footer */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={closeModal}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave}>Save</button>
            </div>
          </div>
        </div>
      )}

      {/* ── Import CSV Modal ── */}
      {importModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: '32px 28px', width: 520, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' }}>
            <h3 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, marginBottom: 20 }}>
              Import Zones from CSV
            </h3>

            <div className="f-field">
              <label className="f-lbl">CSV File</label>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileChange}
                style={{ fontSize: 13 }}
              />
              <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 4 }}>
                Expected columns: zone_number, zone_name, zone_type, area_number
              </div>
            </div>

            {csvFile && csvRows.length > 0 && (
              <>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tm)', marginBottom: 8 }}>
                  Preview — {csvRows.length} row{csvRows.length !== 1 ? 's' : ''} from "{csvFile}"
                </div>
                <div style={{ maxHeight: 260, overflowY: 'auto', border: '1px solid var(--ow2)', borderRadius: 8, marginBottom: 16 }}>
                  <table className="dt">
                    <thead>
                      <tr>
                        <th>Zone #</th>
                        <th>Name</th>
                        <th>Type</th>
                        <th>Area</th>
                      </tr>
                    </thead>
                    <tbody>
                      {csvRows.map((r, i) => (
                        <tr key={i}>
                          <td style={{ fontWeight: 700 }}>{r.zoneNumber}</td>
                          <td>{r.zoneName}</td>
                          <td>{ZONE_TYPE_LABELS[r.zoneType] ?? r.zoneType}</td>
                          <td>{r.areaNumber}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {csvFile && csvRows.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>
                No valid rows found in the CSV file.
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
              <button className="btn btn-outline" onClick={() => { setImportModal(false); setCsvRows([]); setCsvFile('') }}>Cancel</button>
              {csvRows.length > 0 && (
                <button className="btn btn-primary" onClick={handleImportConfirm}>
                  Import {csvRows.length} Zone{csvRows.length !== 1 ? 's' : ''}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
