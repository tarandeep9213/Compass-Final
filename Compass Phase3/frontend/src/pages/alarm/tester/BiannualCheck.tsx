import { useState, useEffect } from 'react'
import { listAlarmBuildings, listBiannualChecks, createBiannualCheck } from '../../../api/alarm'
import type { AlarmBuilding, BiannualCheck as BiannualCheckType } from '../../../mock/alarmData'
import FileUploadDropzone from '../../../components/alarm/FileUploadDropzone'
import type { UploadedFile } from '../../../components/alarm/FileUploadDropzone'
import { toast } from '../../../components/ui/Toast'

interface Props {
  userName: string
  locationIds: string[]
  ctx?: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const PAGE_SIZE = 10

function todayStr(): string {
  return new Date().toISOString().slice(0, 10)
}

function addMonths(dateStr: string, months: number): string {
  const d = new Date(dateStr)
  d.setMonth(d.getMonth() + months)
  return d.toISOString().slice(0, 10)
}

function formatDate(dateStr: string): string {
  if (!dateStr) return '—'
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function isOverdue(nextDue?: string): boolean {
  if (!nextDue) return false
  return nextDue < todayStr()
}

type ResultValue = 'PASS' | 'FAIL' | ''

export default function BiannualCheck({ userName, locationIds, ctx, onNavigate }: Props) {
  // ── Buildings ──────────────────────────────────────────────────────────────
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState('')

  // ── Existing checks ────────────────────────────────────────────────────────
  const [existingChecks, setExistingChecks] = useState<BiannualCheckType[]>([])
  const [loadingChecks, setLoadingChecks] = useState(false)

  // ── Cellular form ──────────────────────────────────────────────────────────
  const [cellDate, setCellDate] = useState(todayStr())
  const [cellResult, setCellResult] = useState<ResultValue>('')
  const [cellNotes, setCellNotes] = useState('')
  const [cellFiles, setCellFiles] = useState<UploadedFile[]>([])
  const [cellSaving, setCellSaving] = useState(false)

  // ── Camera form ────────────────────────────────────────────────────────────
  const [camDate, setCamDate] = useState(todayStr())
  const [camResult, setCamResult] = useState<ResultValue>('')
  const [camNotes, setCamNotes] = useState('')
  const [camFiles, setCamFiles] = useState<UploadedFile[]>([])
  const [camDaysVerified, setCamDaysVerified] = useState<number | ''>('')
  const [camSaving, setCamSaving] = useState(false)

  // ── Pagination ─────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)

  // ── Load buildings ─────────────────────────────────────────────────────────
  useEffect(() => {
    listAlarmBuildings().then((all) => {
      const filtered = locationIds.length > 0
        ? all.filter((b) => locationIds.includes(b.locationId))
        : all
      const list = filtered.length > 0 ? filtered : all
      setBuildings(list)
      if (ctx?.buildingId && list.some(b => b.id === ctx.buildingId)) {
        setSelectedBuildingId(ctx.buildingId)
      }
    })
  }, [locationIds, ctx])

  // ── Load checks when building changes ──────────────────────────────────────
  useEffect(() => {
    if (!selectedBuildingId) {
      setExistingChecks([])
      return
    }
    setLoadingChecks(true)
    listBiannualChecks(selectedBuildingId).then((checks) => {
      setExistingChecks(checks.sort((a, b) => b.checkDate.localeCompare(a.checkDate)))
      setLoadingChecks(false)
    })
  }, [selectedBuildingId])

  // Reset forms when building changes
  useEffect(() => {
    setCellDate(todayStr())
    setCellResult('')
    setCellNotes('')
    setCellFiles([])
    setCamDate(todayStr())
    setCamResult('')
    setCamNotes('')
    setCamFiles([])
    setCamDaysVerified('')
    setPage(1)
  }, [selectedBuildingId])

  // ── Derived: last checks ───────────────────────────────────────────────────
  const lastCellular = existingChecks.find((c) => c.checkType === 'CELLULAR_BACKUP')
  const lastCamera = existingChecks.find((c) => c.checkType === 'CAMERA_BACKUP')

  // ── Duplicate check guards ──────────────────────────────────────────────────
  const cellularBlocked = lastCellular?.status === 'COMPLIANT' && lastCellular.nextDueDate > todayStr()
  const cameraBlocked = lastCamera?.status === 'COMPLIANT' && lastCamera.nextDueDate > todayStr()

  // ── Status dot helper ──────────────────────────────────────────────────────
  function statusDotColor(lastCheck?: BiannualCheckType): string {
    if (!lastCheck) return 'var(--ts)' // gray
    if (lastCheck.status === 'COMPLIANT' && !isOverdue(lastCheck.nextDueDate)) return '#3a9458'
    if (isOverdue(lastCheck.nextDueDate)) return '#dc2626'
    return 'var(--ts)'
  }

  // ── Submit cellular ────────────────────────────────────────────────────────
  async function handleCellularSubmit() {
    if (!cellDate || !cellResult) {
      toast.error('Please fill in the check date and select a result.')
      return
    }
    setCellSaving(true)
    try {
      await createBiannualCheck({
        buildingId: selectedBuildingId,
        checkType: 'CELLULAR_BACKUP',
        checkDate: cellDate,
        nextDueDate: addMonths(cellDate, 6),
        checkedBy: userName,
        checkedByName: userName,
        status: cellResult === 'PASS' ? 'COMPLIANT' : 'NON_COMPLIANT',
        evidencePath: cellFiles.length > 0 ? cellFiles.map((f) => f.name).join(', ') : undefined,
        notes: cellNotes || undefined,
      })
      toast.success('Cellular backup check recorded successfully.')
      // Reload checks
      const checks = await listBiannualChecks(selectedBuildingId)
      setExistingChecks(checks.sort((a, b) => b.checkDate.localeCompare(a.checkDate)))
      // Clear form
      setCellDate(todayStr())
      setCellResult('')
      setCellNotes('')
      setCellFiles([])
    } catch {
      toast.error('Failed to record cellular check.')
    } finally {
      setCellSaving(false)
    }
  }

  // ── Submit camera ──────────────────────────────────────────────────────────
  async function handleCameraSubmit() {
    if (!camDate || !camResult) {
      toast.error('Please fill in the check date and select a result.')
      return
    }
    setCamSaving(true)
    try {
      await createBiannualCheck({
        buildingId: selectedBuildingId,
        checkType: 'CAMERA_BACKUP',
        checkDate: camDate,
        nextDueDate: addMonths(camDate, 6),
        checkedBy: userName,
        checkedByName: userName,
        status: camResult === 'PASS' ? 'COMPLIANT' : 'NON_COMPLIANT',
        evidencePath: camFiles.length > 0 ? camFiles.map((f) => f.name).join(', ') : undefined,
        notes: camNotes || undefined,
      })
      toast.success('Camera backup check recorded successfully.')
      const checks = await listBiannualChecks(selectedBuildingId)
      setExistingChecks(checks.sort((a, b) => b.checkDate.localeCompare(a.checkDate)))
      setCamDate(todayStr())
      setCamResult('')
      setCamNotes('')
      setCamFiles([])
      setCamDaysVerified('')
    } catch {
      toast.error('Failed to record camera check.')
    } finally {
      setCamSaving(false)
    }
  }

  // ── Pagination ─────────────────────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(existingChecks.length / PAGE_SIZE))
  const pagedChecks = existingChecks.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Status badge helper ────────────────────────────────────────────────────
  function statusBadge(status: BiannualCheckType['status']) {
    if (status === 'COMPLIANT')
      return <span className="badge badge-green"><span className="bdot" /> Compliant</span>
    if (status === 'NON_COMPLIANT')
      return <span className="badge badge-red"><span className="bdot" /> Non-Compliant</span>
    return <span className="badge badge-amber"><span className="bdot" /> Pending</span>
  }

  // ── Result pill style ──────────────────────────────────────────────────────
  function pillStyle(selected: boolean, type: 'pass' | 'fail'): React.CSSProperties {
    if (selected && type === 'pass') {
      return { background: '#d6f0dc', border: '1.5px solid #3a9458', color: '#1a4d30', borderRadius: 20, padding: '7px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1, textAlign: 'center' }
    }
    if (selected && type === 'fail') {
      return { background: '#fef2f2', border: '1.5px solid #dc2626', color: '#991b1b', borderRadius: 20, padding: '7px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1, textAlign: 'center' }
    }
    return { background: '#fff', border: '1.5px solid var(--ow2)', color: 'var(--tm)', borderRadius: 20, padding: '7px 20px', fontSize: 13, fontWeight: 500, cursor: 'pointer', fontFamily: 'inherit', flex: 1, textAlign: 'center' }
  }

  // ── Building name lookup ───────────────────────────────────────────────────
  function buildingName(id: string): string {
    return buildings.find((b) => b.id === id)?.name ?? id
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* Page header */}
      <div className="ph">
        <div>
          <h2>Biannual Compliance Checks</h2>
          <p>Cellular backup and camera backup verification</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-history')}>
            &larr; Back
          </button>
        </div>
      </div>

      {/* Building selector */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-body">
          <div className="f-field" style={{ marginBottom: 0 }}>
            <label className="f-lbl">Select Building</label>
            <select
              className="f-inp"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              <option value="">— Choose a building —</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>{b.name} — {b.region}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {selectedBuildingId && (
        <>
          {/* Two side-by-side cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {/* ── Left: Cellular Backup Test ─────────────────────────────── */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  Cellular Backup Test
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusDotColor(lastCellular), display: 'inline-block' }} />
                </span>
              </div>
              <div className="card-body">
                {/* Recent check info */}
                {lastCellular && (
                  <div style={{ background: 'var(--g0)', border: '1px solid var(--g1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--g8)', marginBottom: 12 }}>
                    <strong>Last Check:</strong> {formatDate(lastCellular.checkDate)} &nbsp;|&nbsp;
                    <strong>By:</strong> {lastCellular.checkedByName} &nbsp;|&nbsp;
                    <strong>Status:</strong> {statusBadge(lastCellular.status)} &nbsp;|&nbsp;
                    <strong>Next Due:</strong> {formatDate(lastCellular.nextDueDate)}
                  </div>
                )}

                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ow2)' }} />

                {cellularBlocked ? (
                  <div style={{ background: '#eef8f1', border: '1px solid #d6f0dc', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--g8)', marginBottom: 4 }}>
                      Cellular backup is compliant.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                      Next check due: {formatDate(lastCellular!.nextDueDate)}. No new check needed until then.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Record New Check</div>

                    <div className="f-field">
                      <label className="f-lbl">Check Date</label>
                      <input
                        type="date"
                        className="f-inp"
                        value={cellDate}
                        onChange={(e) => setCellDate(e.target.value)}
                      />
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Result</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          style={pillStyle(cellResult === 'PASS', 'pass')}
                          onClick={() => setCellResult('PASS')}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          style={pillStyle(cellResult === 'FAIL', 'fail')}
                          onClick={() => setCellResult('FAIL')}
                        >
                          Fail
                        </button>
                      </div>
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Notes</label>
                      <textarea
                        className="f-ta"
                        value={cellNotes}
                        onChange={(e) => setCellNotes(e.target.value)}
                        placeholder="Optional notes about this check..."
                      />
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Evidence Upload</label>
                      <FileUploadDropzone
                        accept=".pdf,.jpg,.png"
                        maxSizeMb={10}
                        files={cellFiles}
                        onAdd={(newFiles) => setCellFiles((prev) => [...prev, ...newFiles])}
                        onRemove={(id) => setCellFiles((prev) => prev.filter((f) => f.id !== id))}
                      />
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: 12 }}
                      disabled={cellSaving}
                      onClick={handleCellularSubmit}
                    >
                      {cellSaving ? 'Saving...' : 'Record Cellular Check'}
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* ── Right: Camera Backup Verification ──────────────────────── */}
            <div className="card" style={{ marginBottom: 16 }}>
              <div className="card-header">
                <span className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  30-Day Camera Backup
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: statusDotColor(lastCamera), display: 'inline-block' }} />
                </span>
              </div>
              <div className="card-body">
                {/* Recent check info */}
                {lastCamera && (
                  <div style={{ background: 'var(--g0)', border: '1px solid var(--g1)', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: 'var(--g8)', marginBottom: 12 }}>
                    <strong>Last Check:</strong> {formatDate(lastCamera.checkDate)} &nbsp;|&nbsp;
                    <strong>By:</strong> {lastCamera.checkedByName} &nbsp;|&nbsp;
                    <strong>Status:</strong> {statusBadge(lastCamera.status)} &nbsp;|&nbsp;
                    <strong>Next Due:</strong> {formatDate(lastCamera.nextDueDate)}
                  </div>
                )}

                <hr style={{ margin: '16px 0', border: 'none', borderTop: '1px solid var(--ow2)' }} />

                {cameraBlocked ? (
                  <div style={{ background: '#eef8f1', border: '1px solid #d6f0dc', borderRadius: 8, padding: '14px 16px' }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--g8)', marginBottom: 4 }}>
                      Camera backup is compliant.
                    </div>
                    <div style={{ fontSize: 12, color: 'var(--ts)' }}>
                      Next check due: {formatDate(lastCamera!.nextDueDate)}. No new check needed until then.
                    </div>
                  </div>
                ) : (
                  <>
                    <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 12 }}>Record New Check</div>

                    <div className="f-field">
                      <label className="f-lbl">Check Date</label>
                      <input
                        type="date"
                        className="f-inp"
                        value={camDate}
                        onChange={(e) => setCamDate(e.target.value)}
                      />
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Days of backup verified</label>
                      <input
                        type="number"
                        className="f-inp"
                        value={camDaysVerified}
                        onChange={(e) => setCamDaysVerified(e.target.value === '' ? '' : Number(e.target.value))}
                        placeholder="e.g. 30"
                        min={0}
                      />
                      {camDaysVerified !== '' && (
                        <div style={{ marginTop: 6, fontSize: 12, fontWeight: 600 }}>
                          {Number(camDaysVerified) >= 30 ? (
                            <span style={{ color: '#3a9458' }}>Meets 30-day requirement &#10003;</span>
                          ) : (
                            <span style={{ color: '#dc2626' }}>Below 30-day requirement &#10007;</span>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Result</label>
                      <div style={{ display: 'flex', gap: 8 }}>
                        <button
                          type="button"
                          style={pillStyle(camResult === 'PASS', 'pass')}
                          onClick={() => setCamResult('PASS')}
                        >
                          Pass
                        </button>
                        <button
                          type="button"
                          style={pillStyle(camResult === 'FAIL', 'fail')}
                          onClick={() => setCamResult('FAIL')}
                        >
                          Fail
                        </button>
                      </div>
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Notes</label>
                      <textarea
                        className="f-ta"
                        value={camNotes}
                        onChange={(e) => setCamNotes(e.target.value)}
                        placeholder="Optional notes about this check..."
                      />
                    </div>

                    <div className="f-field">
                      <label className="f-lbl">Evidence Upload</label>
                      <FileUploadDropzone
                        accept=".pdf,.jpg,.png"
                        maxSizeMb={10}
                        files={camFiles}
                        onAdd={(newFiles) => setCamFiles((prev) => [...prev, ...newFiles])}
                        onRemove={(id) => setCamFiles((prev) => prev.filter((f) => f.id !== id))}
                      />
                    </div>

                    <button
                      className="btn btn-primary"
                      style={{ width: '100%', marginTop: 12 }}
                      disabled={camSaving}
                      onClick={handleCameraSubmit}
                    >
                      {camSaving ? 'Saving...' : 'Record Camera Check'}
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* ── History table ──────────────────────────────────────────────── */}
          <div className="card">
            <div className="card-header">
              <span className="card-title">Check History</span>
              <span className="card-sub">{existingChecks.length} record{existingChecks.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="card-body" style={{ padding: 0 }}>
              {loadingChecks ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>Loading checks...</div>
              ) : existingChecks.length === 0 ? (
                <div style={{ padding: 32, textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>No checks recorded for this building yet.</div>
              ) : (
                <>
                  <table className="dt">
                    <thead>
                      <tr>
                        <th>Check Type</th>
                        <th>Date</th>
                        <th>Building</th>
                        <th>Status</th>
                        <th>Checked By</th>
                        <th>Next Due</th>
                        <th>Notes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedChecks.map((check) => (
                        <tr key={check.id}>
                          <td>
                            {check.checkType === 'CELLULAR_BACKUP' ? (
                              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#dbeafe', color: '#1e40af' }}>Cellular</span>
                            ) : (
                              <span style={{ display: 'inline-block', padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: '#ede9fe', color: '#5b21b6' }}>Camera</span>
                            )}
                          </td>
                          <td>{formatDate(check.checkDate)}</td>
                          <td>{buildingName(check.buildingId)}</td>
                          <td>{statusBadge(check.status)}</td>
                          <td>{check.checkedByName}</td>
                          <td>{formatDate(check.nextDueDate)}</td>
                          <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{check.notes ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  {/* Pagination */}
                  {totalPages > 1 && (
                    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--ow2)' }}>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '5px 12px', fontSize: 12 }}
                        disabled={page <= 1}
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span style={{ fontSize: 12, color: 'var(--ts)' }}>
                        Page {page} of {totalPages}
                      </span>
                      <button
                        className="btn btn-outline"
                        style={{ padding: '5px 12px', fontSize: 12 }}
                        disabled={page >= totalPages}
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
