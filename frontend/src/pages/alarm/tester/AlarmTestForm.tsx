import { useState, useEffect } from 'react'
import { listAlarmBuildings, listZones, listTests, createTest, updateTest, submitTest } from '../../../api/alarm'
import type { AlarmBuilding, AlarmZone, AlarmTest } from '../../../mock/alarmData'
import ZoneChecklist from '../../../components/alarm/ZoneChecklist'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import FileUploadDropzone from '../../../components/alarm/FileUploadDropzone'
import type { UploadedFile } from '../../../components/alarm/FileUploadDropzone'
import { toast } from '../../../components/ui/Toast'

interface Props {
  userName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function AlarmTestForm({ userName, locationIds, onNavigate }: Props) {
  const [buildings, setBuildings] = useState<AlarmBuilding[]>([])
  const [selectedBuildingId, setSelectedBuildingId] = useState('')
  const [zones, setZones] = useState<AlarmZone[]>([])
  const [zoneResults, setZoneResults] = useState<Record<string, { result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'; notes: string }>>({})
  const [files, setFiles] = useState<UploadedFile[]>([])
  const [testDate, setTestDate] = useState(new Date().toISOString().slice(0, 10))
  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [notes, setNotes] = useState('')
  const [draftId, setDraftId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [zonesLoading, setZonesLoading] = useState(false)

  // ── Computed values ──────────────────────────────────────────────────────
  const testedCount = Object.values(zoneResults).filter((r) => r.result === 'TESTED').length
  const notTestedCount = Object.values(zoneResults).filter((r) => r.result === 'NOT_TESTED').length
  const issueCount = Object.values(zoneResults).filter((r) => r.result === 'ISSUE_FOUND').length
  const unmarkedCount = zones.length - Object.keys(zoneResults).length
  const markedCount = Object.keys(zoneResults).length
  const canSubmit = markedCount > 0 && files.length > 0

  // ── Load buildings ───────────────────────────────────────────────────────
  useEffect(() => {
    listAlarmBuildings().then((all) => {
      // Try to filter by user's assigned locations; fall back to all if no matches (demo mode)
      const filtered = locationIds.length > 0
        ? all.filter((b) => locationIds.includes(b.locationId))
        : all
      setBuildings(filtered.length > 0 ? filtered : all)
    })
  }, [locationIds])

  // ── Building change → load zones + check for draft ───────────────────────
  useEffect(() => {
    if (!selectedBuildingId) {
      setZones([])
      setZoneResults({})
      setDraftId(null)
      return
    }

    setZonesLoading(true)
    setZoneResults({})
    setDraftId(null)
    setFiles([])
    setNotes('')
    setStartTime('')
    setEndTime('')

    listZones(selectedBuildingId).then((z) => {
      setZones(z)
      setZonesLoading(false)
    })

    // Check for existing draft
    listTests({ buildingId: selectedBuildingId, status: 'DRAFT' }).then((drafts) => {
      if (drafts.length > 0) {
        const draft = drafts[0]
        setDraftId(draft.id)
        setTestDate(draft.testDate)
        setStartTime(draft.testStartTime ?? '')
        setEndTime(draft.testEndTime ?? '')
        setNotes(draft.notes ?? '')
      }
    })
  }, [selectedBuildingId])

  // ── Selected building info ───────────────────────────────────────────────
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  // ── Handlers ─────────────────────────────────────────────────────────────
  const handleZoneChange = (zoneId: string, result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND', zoneNotes: string) => {
    setZoneResults((prev) => ({ ...prev, [zoneId]: { result, notes: zoneNotes } }))
  }

  const handleFilesAdd = (added: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...added])
  }

  const handleFileRemove = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const buildTestPayload = (): Partial<AlarmTest> => ({
    buildingId: selectedBuildingId,
    testDate,
    testMonth: testDate.slice(0, 7),
    testerName: userName,
    testStartTime: startTime || undefined,
    testEndTime: endTime || undefined,
    notes: notes || undefined,
    zonesTotal: zones.length,
    zonesTested: testedCount,
    zonesIssue: issueCount,
  })

  const handleSaveDraft = async () => {
    if (!selectedBuildingId) return
    setSaving(true)
    try {
      if (draftId) {
        await updateTest(draftId, buildTestPayload())
      } else {
        const created = await createTest(buildTestPayload())
        setDraftId(created.id)
      }
      toast.success('Draft saved')
    } catch {
      toast.error('Failed to save draft')
    } finally {
      setSaving(false)
    }
  }

  const handleSubmit = async () => {
    if (!selectedBuildingId) return

    // Warn about unmarked zones
    if (unmarkedCount > 0) {
      const ok = window.confirm(`${unmarkedCount} zones have not been marked. Continue?`)
      if (!ok) return
    }

    // Warn about NOT_TESTED zones
    if (notTestedCount > 0) {
      const ok = window.confirm(`${notTestedCount} zones are marked as Not Tested. Are you sure?`)
      if (!ok) return
    }

    setSaving(true)
    try {
      // Save first if no draft
      let id = draftId
      if (!id) {
        const created = await createTest(buildTestPayload())
        id = created.id
        setDraftId(id)
      } else {
        await updateTest(id, buildTestPayload())
      }

      await submitTest(id)
      toast.success('Test submitted for approval')
      onNavigate('alarm-history')
    } catch {
      toast.error('Failed to submit test')
    } finally {
      setSaving(false)
    }
  }

  // ── Status text ──────────────────────────────────────────────────────────
  let statusText = ''
  if (draftId) statusText = 'Draft saved'
  if (zones.length > 0 && markedCount > 0) {
    statusText = `${markedCount}/${zones.length} zones marked`
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div className="ph">
        <div>
          <h2>Monthly Alarm Test</h2>
          <p>Complete zone-by-zone testing for your assigned building</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-history')}>
            View History
          </button>
          <button className="btn btn-outline" onClick={() => onNavigate('biannual-check')}>
            Biannual Checks
          </button>
        </div>
      </div>

      {/* ── Building selector card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Select Building</span>
        </div>
        <div className="card-body">
          <div className="f-field">
            <label className="f-lbl">Building</label>
            <select
              className="f-sel"
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
            >
              <option value="">-- Select a building --</option>
              {buildings.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} — {b.securityCompanyName}
                </option>
              ))}
            </select>
          </div>

          {selectedBuilding && (
            <div
              style={{
                background: '#eef8f1',
                border: '1px solid #d6f0dc',
                borderRadius: 8,
                padding: '12px 16px',
                fontSize: 13,
                color: 'var(--g8)',
              }}
            >
              Security Company: <strong>{selectedBuilding.securityCompanyName}</strong> | Customer ID:{' '}
              <strong>{selectedBuilding.securityCustomerId}</strong> | Phone:{' '}
              <strong>{selectedBuilding.securityCompanyPhone}</strong>
            </div>
          )}
        </div>
      </div>

      {/* ── Test metadata card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Test Details</span>
        </div>
        <div className="card-body">
          <div className="f-row">
            <div className="f-field">
              <label className="f-lbl">Date</label>
              <input
                type="date"
                className="f-inp"
                value={testDate}
                onChange={(e) => setTestDate(e.target.value)}
              />
            </div>
            <div className="f-field">
              <label className="f-lbl">Tester Name</label>
              <input
                type="text"
                className="f-inp"
                value={userName}
                disabled
              />
            </div>
          </div>
          <div className="f-row">
            <div className="f-field">
              <label className="f-lbl">Test Start Time</label>
              <input
                type="time"
                className="f-inp"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </div>
            <div className="f-field">
              <label className="f-lbl">Test End Time</label>
              <input
                type="time"
                className="f-inp"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </div>
          </div>
          <div className="f-field">
            <label className="f-lbl">General Notes</label>
            <textarea
              className="f-ta"
              placeholder="Optional notes about this test..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* ── Zone checklist card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Zone Testing Checklist</span>
          {zones.length > 0 && (
            <ZoneSummaryBar
              tested={testedCount}
              notTested={notTestedCount}
              issues={issueCount}
              total={zones.length}
              width={180}
            />
          )}
        </div>
        <div className="card-body">
          {zonesLoading ? (
            <div style={{ fontSize: 13, color: 'var(--ts)', padding: '12px 0' }}>
              Loading zones...
            </div>
          ) : zones.length === 0 && selectedBuildingId ? (
            <div className="alert-warn">
              No zones configured for this building. Contact admin.
            </div>
          ) : zones.length > 0 ? (
            <ZoneChecklist
              zones={zones}
              results={zoneResults}
              onChange={handleZoneChange}
            />
          ) : (
            <div style={{ fontSize: 13, color: 'var(--ts)', padding: '12px 0' }}>
              Select a building to view zones.
            </div>
          )}
        </div>
      </div>

      {/* ── File upload card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Alarm Company Report</span>
        </div>
        <div className="card-body">
          <FileUploadDropzone
            accept=".pdf,.xlsx,.xls"
            files={files}
            onAdd={handleFilesAdd}
            onRemove={handleFileRemove}
          />
          <div
            className="alert-info"
            style={{ marginTop: 12 }}
          >
            Upload the Customer Activity Report from your security company. PDF format preferred.
          </div>
        </div>
      </div>

      {/* ── Sticky action footer ── */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          background: '#fff',
          borderTop: '1px solid var(--ow2)',
          padding: '14px 24px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          zIndex: 10,
          marginTop: 16,
        }}
      >
        <button
          className="btn btn-outline"
          onClick={handleSaveDraft}
          disabled={saving || !selectedBuildingId}
        >
          {saving ? 'Saving...' : 'Save Draft'}
        </button>

        <span style={{ fontSize: 12, color: 'var(--ts)' }}>
          {statusText}
        </span>

        <button
          className="btn btn-primary"
          onClick={handleSubmit}
          disabled={saving || !canSubmit}
        >
          {saving ? 'Submitting...' : 'Submit for Approval'}
        </button>
      </div>
    </div>
  )
}
