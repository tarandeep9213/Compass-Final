import { useState, useRef } from 'react'
import * as XLSX from 'xlsx'
import { importRoster, listLocations, listUsers, resetAll } from '../../api/admin'
import type { ImportRow as ApiImportRow } from '../../api/types'
import { LOCATIONS, USERS, saveStored } from '../../mock/data'
import type { Location, User } from '../../mock/data'
import KpiCard from '../../components/KpiCard'

interface ImportRow {
  cc: string                    // internal only — not shown in preview
  district: string              // = Location name
  cashroomLead: string
  cashroomLeadEmail: string
  controller: string
  controllerEmail: string
  dgm: string
  dgmEmail: string
  regionalController: string
  regionalControllerEmail: string
  divisionContact: string       // imported as Regional Controller role
  divisionContactEmail: string
}

type OwnerRole = 'location' | 'operator' | 'controller' | 'dgm' | 'regional-controller'

const ROLE_BADGE: Record<OwnerRole, { label: string; bg: string; color: string }> = {
  location:              { label: 'Location',            bg: '#eff6ff', color: '#1d4ed8' },
  operator:              { label: 'Operator',            bg: '#fefce8', color: '#92400e' },
  controller:            { label: 'Controller',          bg: '#fdf4ff', color: '#7e22ce' },
  dgm:                   { label: 'DGM',                 bg: '#f0fdf4', color: '#15803d' },
  'regional-controller': { label: 'Regional Controller', bg: '#f0f9ff', color: '#0369a1' },
}

// Only columns that are displayed in the preview table (CC# and Manager are excluded)
const COL_MAP: { key: keyof ImportRow; label: string; color: string; role: OwnerRole }[] = [
  { key: 'district',           label: 'Location',            color: '#eff6ff', role: 'location'            },
  { key: 'cashroomLead',       label: 'Operator',            color: '#fefce8', role: 'operator'            },
  { key: 'controller',         label: 'Controller',          color: '#fdf4ff', role: 'controller'          },
  { key: 'dgm',                label: 'DGM / RD',            color: '#f0fdf4', role: 'dgm'                 },
  { key: 'regionalController', label: 'Regional Controller', color: '#f0f9ff', role: 'regional-controller' },
  { key: 'divisionContact',    label: 'Division Contact',    color: '#f0f9ff', role: 'regional-controller' },
]

interface Props {
  adminName: string
}

export default function AdmImport({ adminName }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [rows,        setRows]        = useState<ImportRow[]>([])
  const [fileName,    setFileName]    = useState('')
  const [error,       setError]       = useState('')
  const [imported,    setImported]    = useState(false)
  const [importing,   setImporting]   = useState(false)
  const [importResult, setImportResult] = useState<{ locations_created: number; users_created: number; skipped_duplicates?: number } | null>(null)
  const [resetConfirm, setResetConfirm] = useState(false)
  const [resetting,    setResetting]    = useState(false)
  const [resetMsg,     setResetMsg]     = useState('')
  const [importError,  setImportError]  = useState('')

  function handleFile(file: File) {
    setError(''); setImported(false)
    if (!file.name.match(/\.(xlsx|xls|csv)$/i)) {
      setError('Please upload an .xlsx, .xls, or .csv file.')
      return
    }
    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = e => {
      try {
        const data  = new Uint8Array(e.target!.result as ArrayBuffer)
        const wb    = XLSX.read(data, { type: 'array' })

        // Pick the best sheet: prefer tall format (Designation+Name+Email → has real emails),
        // then wide format (Cashroom+District), then fall back to first sheet.
        let bestSheet = wb.Sheets[wb.SheetNames[0]]
        let foundTall = false
        for (const sheetName of wb.SheetNames) {
          const candidate = wb.Sheets[sheetName]
          const sampleRows = XLSX.utils.sheet_to_json<string[]>(candidate, { header: 1, defval: '' }) as string[][]
          const hasTall = sampleRows.some(r =>
            r.some(c => String(c).trim().toUpperCase() === 'DESIGNATION') &&
            r.some(c => String(c).trim().toUpperCase() === 'NAME')
          )
          if (hasTall) { bestSheet = candidate; foundTall = true; break }
          const hasWide = sampleRows.some(r =>
            r.some(c => String(c).trim().toUpperCase().includes('CASHROOM')) &&
            r.some(c => String(c).trim().toUpperCase().includes('DISTRICT'))
          )
          if (hasWide && !foundTall) bestSheet = candidate
        }
        const ws  = bestSheet
        const raw = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][]

        // Find the header row
        // Wide format: has both "District" and "Cashroom" as separate columns
        // Tall format: has "Designation" and "Name" columns
        let headerIdx = raw.findIndex(row =>
          row.some(cell => String(cell).trim().toUpperCase().includes('DISTRICT')) &&
          row.some(cell => String(cell).trim().toUpperCase().includes('CASHROOM'))
        )
        const isTallFormat = headerIdx < 0 && raw.some(row =>
          row.some(cell => String(cell).trim().toUpperCase() === 'DESIGNATION') &&
          row.some(cell => String(cell).trim().toUpperCase() === 'NAME')
        )
        if (headerIdx < 0) {
          headerIdx = raw.findIndex(row =>
            row.some(cell => String(cell).trim().toUpperCase() === 'DESIGNATION')
          )
        }
        if (headerIdx < 0) headerIdx = 0

        const headerRow = raw[headerIdx]
        const parsed: ImportRow[] = []

        if (isTallFormat) {
          // ── Tall format: CC#, District, Designation, Name, Email ──────────────
          // Each row = one person; group by (CC, District) into ImportRows
          let iCC = -1, iDistrict = -1, iDesignation = -1, iName = -1, iEmail = -1
          headerRow.forEach((cell, idx) => {
            const h = String(cell ?? '').trim().toUpperCase()
            if      (h.startsWith('CC'))            iCC = idx
            else if (h.includes('DISTRICT'))        iDistrict = idx
            else if (h === 'DESIGNATION')           iDesignation = idx
            else if (h === 'NAME')                  iName = idx
            else if (h === 'EMAIL')                 iEmail = idx
          })

          // Designation → ImportRow field mapping
          const DESIG_MAP: Record<string, { name: keyof ImportRow; email: keyof ImportRow }> = {
            'CASHROOM LEAD':        { name: 'cashroomLead',       email: 'cashroomLeadEmail' },
            'CONTROLLER':           { name: 'controller',         email: 'controllerEmail' },
            'DGM/RD':               { name: 'dgm',                email: 'dgmEmail' },
            'DGM':                  { name: 'dgm',                email: 'dgmEmail' },
            'RD':                   { name: 'dgm',                email: 'dgmEmail' },
            'REGIONAL CONTROLLER':  { name: 'regionalController', email: 'regionalControllerEmail' },
            'DIVISION CONTACT':     { name: 'divisionContact',    email: 'divisionContactEmail' },
          }

          // Group rows by key = "CC|District"
          const locMap = new Map<string, ImportRow>()
          const locOrder: string[] = []
          let currentCC = '', currentDistrict = ''

          for (let i = headerIdx + 1; i < raw.length; i++) {
            const r = raw[i]
            const cell = (j: number) => j >= 0 ? String(r[j] ?? '').trim() : ''

            const rawCC    = cell(iCC)
            const rawDist  = cell(iDistrict).replace(/\n/g, '').trim()
            const desig    = cell(iDesignation).trim().toUpperCase()
            const name     = cell(iName)
            const email    = cell(iEmail)

            if (rawCC)   currentCC       = rawCC
            if (rawDist) currentDistrict = rawDist
            if (!currentDistrict || !name || !desig) continue

            const key = `${currentCC}|${currentDistrict}`
            if (!locMap.has(key)) {
              locMap.set(key, {
                cc: currentCC, district: currentDistrict,
                cashroomLead: '', cashroomLeadEmail: '',
                controller: '', controllerEmail: '',
                dgm: '', dgmEmail: '',
                regionalController: '', regionalControllerEmail: '',
                divisionContact: '', divisionContactEmail: '',
              })
              locOrder.push(key)
            }
            const row = locMap.get(key)!
            const mapping = DESIG_MAP[desig]
            if (mapping) {
              row[mapping.name] = name as never
              if (email) row[mapping.email] = email as never
            }
          }
          parsed.push(...locOrder.map(k => locMap.get(k)!))

        } else {
          // ── Wide format: separate columns per role ────────────────────────────
          // EMAIL checks must come before their matching name checks in the else-if chain
          let iCC = -1, iDistrict = -1
          let iCashroomLead = -1,       iCashroomLeadEmail = -1
          let iController = -1,         iControllerEmail = -1
          let iDGM = -1,                iDGMEmail = -1
          let iRegionalController = -1, iRegionalControllerEmail = -1
          let iDivisionContact = -1,    iDivisionContactEmail = -1

          headerRow.forEach((cell, idx) => {
            const h = String(cell ?? '').trim().toUpperCase()
            if      (h.startsWith('CC'))                                                        iCC = idx
            else if (h.includes('DISTRICT'))                                                    iDistrict = idx
            else if (h.includes('CASHROOM') && h.includes('EMAIL'))                            iCashroomLeadEmail = idx
            else if (h.includes('CASHROOM'))                                                    iCashroomLead = idx
            else if (h.includes('REGIONAL') && h.includes('EMAIL'))                            iRegionalControllerEmail = idx
            else if (h.includes('REGIONAL'))                                                    iRegionalController = idx
            else if (h.includes('CONTROLLER') && h.includes('EMAIL'))                          iControllerEmail = idx
            else if (h.includes('CONTROLLER'))                                                  iController = idx
            else if ((h.includes('DGM') || h.includes(' RD')) && h.includes('EMAIL'))          iDGMEmail = idx
            else if (h.includes('DGM') || h.includes(' RD'))                                   iDGM = idx
            else if ((h.includes('DIVISION') || h.includes('CONTACT')) && h.includes('EMAIL')) iDivisionContactEmail = idx
            else if (h.includes('DIVISION') || h.includes('CONTACT'))                          iDivisionContact = idx
          })

          let currentCC = ''
          let currentDistrict = ''
          let currentCashroomLead = '', currentCashroomLeadEmail = ''
          let currentController = '',   currentControllerEmail = ''
          let currentDGM = '',          currentDGMEmail = ''
          let currentRC = '',           currentRCEmail = ''

          for (let i = headerIdx + 1; i < raw.length; i++) {
            const r = raw[i]
            const cell = (j: number) => j >= 0 ? String(r[j] ?? '').trim() : ''

            const rawCC       = cell(iCC)
            const rawDistrict = cell(iDistrict)

            // Skip truly blank rows
            const hasAnyData = Boolean(rawCC || rawDistrict ||
              [iCashroomLead, iController, iDGM, iRegionalController, iDivisionContact]
                .some(j => j >= 0 && cell(j) !== ''))
            if (!hasAnyData) continue

            if (rawCC)       currentCC       = rawCC
            if (rawDistrict) currentDistrict = rawDistrict.replace(/\n/g, '').trim()

            const newCashroomLead = cell(iCashroomLead)
            if (newCashroomLead) { currentCashroomLead = newCashroomLead; currentCashroomLeadEmail = cell(iCashroomLeadEmail) }

            const newController = cell(iController)
            if (newController) { currentController = newController; currentControllerEmail = cell(iControllerEmail) }

            const newDGM = cell(iDGM)
            if (newDGM) { currentDGM = newDGM; currentDGMEmail = cell(iDGMEmail) }

            const newRC = cell(iRegionalController)
            if (newRC) { currentRC = newRC; currentRCEmail = cell(iRegionalControllerEmail) }

            const divContact      = cell(iDivisionContact)
            const divContactEmail = divContact ? cell(iDivisionContactEmail) : ''

            if (!currentDistrict) continue

            parsed.push({
              cc:                      currentCC,
              district:                currentDistrict,
              cashroomLead:            currentCashroomLead,
              cashroomLeadEmail:       currentCashroomLeadEmail,
              controller:              currentController,
              controllerEmail:         currentControllerEmail,
              dgm:                     currentDGM,
              dgmEmail:                currentDGMEmail,
              regionalController:      currentRC,
              regionalControllerEmail: currentRCEmail,
              divisionContact:         divContact,
              divisionContactEmail:    divContactEmail,
            })
          }
        }

        if (parsed.length === 0) {
          setError('No data rows found. Check the file format matches the expected template.')
          return
        }
        setRows(parsed)
      } catch {
        setError('Could not parse the file. Make sure it is a valid Excel or CSV file.')
      }
    }
    reader.readAsArrayBuffer(file)
  }

  async function handleReset() {
    setResetting(true)
    try {
      const res = await resetAll()
      USERS.splice(0, USERS.length)
      LOCATIONS.splice(0, LOCATIONS.length)
      setRows([])
      setFileName('')
      setImported(false)
      setImportResult(null)
      setResetConfirm(false)
      setResetMsg(`Reset complete — ${res.users_deleted} users and ${res.locations_deleted} locations removed. Ready for new import.`)
      setTimeout(() => setResetMsg(''), 6000)
    } catch (err: unknown) {
      setResetConfirm(false)
      const msg = err instanceof Error ? err.message : String(err)
      setResetMsg(`Reset failed: ${msg}`)
      setTimeout(() => setResetMsg(''), 8000)
    } finally {
      setResetting(false)
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFile(file)
  }

  const roleSummary = {
    locations:           new Set(rows.map(r => r.district).filter(Boolean)).size,
    operators:           new Set(rows.map(r => r.cashroomLead).filter(Boolean)).size,
    controllers:         new Set(rows.map(r => r.controller).filter(Boolean)).size,
    dgms:                new Set(rows.map(r => r.dgm).filter(Boolean)).size,
    regionalControllers: new Set([
      ...rows.map(r => r.regionalController),
      ...rows.map(r => r.divisionContact),
    ].filter(Boolean)).size,
  }

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Import Users &amp; Locations</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Upload a Cashroom roster Excel to preview roles and location assignments · {adminName}
          </p>
        </div>
        <div className="ph-right">
          <button
            className="btn btn-ghost"
            style={{ fontSize: 12, color: '#b45309', border: '1px solid #f59e0b', background: '#fffbeb' }}
            onClick={() => setResetConfirm(true)}
          >
            ↺ Reset (Users + Locations)
          </button>
        </div>

        {rows.length > 0 && !imported && (
          <div className="ph-right">
            <button
              className="btn btn-primary"
              disabled={importing}
              onClick={async () => {
                setImporting(true)
                setImportError('')
                try {
                  const apiRows: ApiImportRow[] = rows.map(r => ({
                    location_code: r.cc,
                    location_name: r.district || r.cc,
                    district: r.district || undefined,
                    cashroom_lead: r.cashroomLead || undefined,
                    cashroom_lead_email: r.cashroomLeadEmail || undefined,
                    controller: r.controller || undefined,
                    controller_email: r.controllerEmail || undefined,
                    dgm: r.dgm || undefined,
                    dgm_email: r.dgmEmail || undefined,
                    regional_controller: r.regionalController || undefined,
                    regional_controller_email: r.regionalControllerEmail || undefined,
                    division_contacts: r.divisionContact || undefined,
                    division_contacts_email: r.divisionContactEmail || undefined,
                  }))
                  const result = await importRoster(apiRows)
                  setImportResult({ locations_created: result.locations_created, users_created: result.users_created, skipped_duplicates: result.skipped_duplicates })
                  // Sync in-memory arrays so current session sees new data immediately
                  listLocations().then(r => {
                    LOCATIONS.length = 0
                    r.items.forEach(l => LOCATIONS.push({
                      id: l.id, name: l.name, city: l.city,
                      expectedCash: l.expected_cash,
                      tolerancePct: l.effective_tolerance_pct,
                      active: l.active,
                    } as Location))
                    saveStored('compass_locations', LOCATIONS)
                  }).catch(() => {})
                  listUsers({ page_size: 100 }).then(r => {
                    USERS.length = 0
                    r.items.forEach(u => USERS.push({
                      id: u.id, name: u.name, email: u.email,
                      role: u.role.toLowerCase() as User['role'],
                      locationIds: u.location_ids ?? [],
                      active: u.active,
                    }))
                    saveStored('compass_users', USERS)
                  }).catch(() => {})
                  setImported(true)
                } catch (err: unknown) {
                  setImportError(err instanceof Error ? err.message : 'Import failed. Make sure the backend is running.')
                } finally {
                  setImporting(false)
                }
              }}
            >
              {importing ? 'Importing…' : `✓ Confirm Import (${rows.length} rows)`}
            </button>
          </div>
        )}
      </div>

      {/* ── Reset confirmation banner ── */}
      {resetConfirm && (
        <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '14px 20px', marginBottom: 16, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#92400e', flex: 1 }}>
            ↺ This will permanently delete ALL users (except your admin account) and ALL locations. Cannot be undone.
          </span>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 16px', color: '#b45309', border: '1px solid #f59e0b', fontWeight: 700 }} onClick={handleReset} disabled={resetting}>
            {resetting ? 'Resetting…' : 'Yes, Reset Everything'}
          </button>
          <button className="btn btn-ghost" style={{ fontSize: 12, padding: '5px 14px' }} onClick={() => setResetConfirm(false)} disabled={resetting}>
            Cancel
          </button>
        </div>
      )}

      {importError && (
        <div style={{ marginBottom: 16, background: '#fff1f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: 'var(--red)', fontWeight: 500 }}>
          ⚠ Import failed: {importError}
        </div>
      )}

      {resetMsg && (
        <div style={{ marginBottom: 16, background: '#f0fdf4', border: '1px solid var(--g2)', borderRadius: 10, padding: '12px 20px', fontSize: 13, color: '#15803d', fontWeight: 500 }}>
          ✓ {resetMsg}
        </div>
      )}

      {imported && (
        <div style={{ marginBottom: 20, background: '#f0fdf4', border: '1px solid var(--g2)', borderRadius: 10, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 18 }}>✅</span>
            <div style={{ fontSize: 13 }}>
              {importResult ? (
                <><strong>{importResult.locations_created} locations</strong> and <strong>{importResult.users_created} users</strong> imported successfully.{(importResult.skipped_duplicates ?? 0) > 0 && <> <strong>{importResult.skipped_duplicates} duplicate {importResult.skipped_duplicates === 1 ? 'entry' : 'entries'}</strong> skipped.</>}</>
              ) : (
                <><strong>{rows.length} records</strong> imported successfully.</>
              )}
            </div>
          </div>
          <div style={{ marginTop: 14, background: '#fff', border: '1px solid var(--g2)', borderRadius: 8, padding: '12px 16px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--td)', marginBottom: 8 }}>Login Credentials</div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', fontSize: 12, color: 'var(--ts)' }}>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Email (username)</div>
                <div style={{ fontFamily: 'monospace', background: 'var(--ow)', padding: '4px 8px', borderRadius: 5, fontSize: 12 }}>
                  As listed in the roster file
                </div>
              </div>
              <div>
                <div style={{ fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Password</div>
                <div style={{ background: 'var(--ow)', padding: '4px 8px', borderRadius: 5, fontSize: 12 }}>
                  Generated from each user's name (e.g. <span style={{ fontFamily: 'monospace' }}>AliceT@2026</span>)
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10, fontSize: 11, color: 'var(--g7)', fontWeight: 500 }}>
              ✉ Welcome emails with login credentials have been sent to all newly created users.
            </div>
          </div>
        </div>
      )}

      {/* ── Upload zone ── */}
      <div
        className="card"
        style={{ marginBottom: 22 }}
        onDragOver={e => e.preventDefault()}
        onDrop={handleDrop}
      >
        <div className="card-header">
          <span className="card-title">Upload Roster File</span>
          <span className="card-sub">Supports .xlsx · .xls · .csv</span>
        </div>
        <div className="card-body" style={{ textAlign: 'center', padding: '36px 24px' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📂</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
            {fileName ? `Selected: ${fileName}` : 'Drag & drop your file here, or click to browse'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 18 }}>
            Expected columns: District (Location), Cashroom Lead (Operator), Controller, DGM/RD, Regional Controller
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              className="btn btn-primary"
              onClick={() => fileRef.current?.click()}
            >
              Browse File
            </button>
            <a
              href="/User_details_sample.xlsx"
              download="User_details_sample.xlsx"
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                fontSize: 13, fontWeight: 600, color: 'var(--g7)',
                background: 'var(--g0)', border: '1px solid var(--g3)',
                borderRadius: 7, padding: '8px 16px', textDecoration: 'none',
              }}
            >
              ⬇ Sample Excel
            </a>
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            style={{ display: 'none' }}
            onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]) }}
          />
          {error && (
            <div style={{ marginTop: 14, fontSize: 12, color: 'var(--red)', fontWeight: 500 }}>⚠ {error}</div>
          )}
        </div>
      </div>

      {rows.length > 0 && (
        <>
          {/* ── Summary KPIs ── */}
          <div className="kpi-row" style={{ marginBottom: 22 }}>
            <KpiCard
              label="Locations"
              value={roleSummary.locations}
              sub="districts"
              tooltip={{
                what: "Number of distinct district/location names found in the uploaded roster file.",
                how: "Deduplicated from the District column. Each unique district name becomes one Location record in the system.",
                formula: "COUNT(DISTINCT district values in file)",
              }}
            />
            <KpiCard
              label="Operators"
              value={roleSummary.operators}
              sub="unique"
              tooltip={{
                what: "Number of unique Cashroom Lead individuals parsed from the roster.",
                how: "Cashroom Leads are the operators who submit daily cash counts. Names are split on '&' and ',' to handle multi-person entries. Email is generated if blank.",
                formula: "COUNT(DISTINCT operator names across all rows)",
              }}
            />
            <KpiCard
              label="Controllers"
              value={roleSummary.controllers}
              sub="unique"
              tooltip={{
                what: "Number of unique Controller individuals parsed from the roster.",
                how: "Controllers review operator submissions and schedule physical verification visits. Carry-forward applies — a blank name inherits from the row above within the same designation.",
                formula: "COUNT(DISTINCT controller names)",
              }}
            />
            <KpiCard
              label="DGMs / RDs"
              value={roleSummary.dgms}
              sub="unique"
              tooltip={{
                what: "Number of unique District General Managers / Regional Directors parsed from the roster.",
                how: "DGMs conduct monthly physical verification visits. The same individual may appear across multiple districts.",
                formula: "COUNT(DISTINCT DGM/RD names)",
              }}
            />
            <KpiCard
              label="Regional Controllers"
              value={roleSummary.regionalControllers}
              sub="unique"
              tooltip={{
                what: "Number of unique Regional Controllers (and Division Contacts) parsed from the roster.",
                how: "Regional Controllers oversee compliance across multiple districts. Division Contacts use their real compass-usa.com email addresses from the file.",
                formula: "COUNT(DISTINCT regional controller names)",
              }}
            />
          </div>

          {/* ── Preview table ── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Preview — {rows.length} rows</span>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                {(Object.entries(ROLE_BADGE) as [OwnerRole, typeof ROLE_BADGE[OwnerRole]][]).map(([, b]) => (
                  <span key={b.label} style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                    background: b.bg, color: b.color, border: `1px solid ${b.color}30`,
                    letterSpacing: '0.04em',
                  }}>
                    {b.label.toUpperCase()}
                  </span>
                ))}
                <span style={{ fontSize: 11, color: 'var(--ts)' }}>— column ownership by role</span>
              </div>
            </div>
            <div className="card-body" style={{ padding: 0, overflowX: 'auto' }}>
              <table className="dt" style={{ minWidth: 900 }}>
                <thead>
                  <tr>
                    {COL_MAP.map(c => {
                      const badge = ROLE_BADGE[c.role]
                      return (
                        <th key={c.key} style={{ background: c.color, whiteSpace: 'nowrap', verticalAlign: 'bottom' }}>
                          <div>{c.label}</div>
                          <div style={{
                            display: 'inline-block', marginTop: 4,
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.04em',
                            padding: '2px 6px', borderRadius: 4,
                            background: badge.bg, color: badge.color,
                            border: `1px solid ${badge.color}30`,
                          }}>
                            {badge.label.toUpperCase()}
                          </div>
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {COL_MAP.map(c => {
                        // Direct lookup avoids double-indirection TypeScript issues
                        const emailValMap: Partial<Record<keyof ImportRow, string>> = {
                          cashroomLead:       row.cashroomLeadEmail,
                          controller:         row.controllerEmail,
                          dgm:                row.dgmEmail,
                          regionalController: row.regionalControllerEmail,
                          divisionContact:    row.divisionContactEmail,
                        }
                        const emailVal = emailValMap[c.key] || ''
                        return (
                          <td
                            key={c.key}
                            data-email={emailVal}
                            style={{
                              fontSize: 12,
                              background: row[c.key] ? undefined : '#fafafa',
                              color: row[c.key] ? 'var(--td)' : 'var(--wg)',
                            }}
                          >
                            {row[c.key] || '—'}
                            {emailVal && (
                              <div style={{ fontSize: 10, color: 'var(--ts)', marginTop: 2 }}>{emailVal}</div>
                            )}
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
