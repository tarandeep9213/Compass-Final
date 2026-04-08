import { useState, useEffect, useRef } from 'react'
import { listAlarmBuildings, listZones, listTests, getTest, createTest, updateTest, submitTest, saveTestZones, reopenTest, listAttachments, uploadAttachment, deleteAttachment } from '../../../api/alarm'
import type { AlarmBuilding, AlarmZone, AlarmTest } from '../../../mock/alarmData'
import ZoneChecklist from '../../../components/alarm/ZoneChecklist'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import FileUploadDropzone from '../../../components/alarm/FileUploadDropzone'
import type { UploadedFile } from '../../../components/alarm/FileUploadDropzone'
import { toast } from '../../../components/ui/Toast'

interface Props {
  userName: string
  locationIds: string[]
  ctx?: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

export default function AlarmTestForm({ userName, locationIds, ctx, onNavigate }: Props) {
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
  const [lastSaved, setLastSaved] = useState<string>('')
  const [zonesLoading, setZonesLoading] = useState(false)
  const [existingTestBlock, setExistingTestBlock] = useState<{ status: string; testMonth: string } | null>(null)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const draftIdRef = useRef<string | null>(null)

  // Keep ref in sync so auto-save closure always has the latest draftId
  useEffect(() => { draftIdRef.current = draftId }, [draftId])

  // ── Rejected test notifications ──────────────────────────────────────────
  const [rejectedNotifs, setRejectedNotifs] = useState<AlarmTest[]>([])
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    listTests({ status: 'REJECTED' }).then((all) => {
      const mine = all.filter((t) => t.testerName === userName)
      setRejectedNotifs(mine)
    })
  }, [userName])

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
      const list = filtered.length > 0 ? filtered : all
      setBuildings(list)
      // Auto-select building if passed via ctx (e.g. "Continue" from history)
      if (ctx?.buildingId && list.some(b => b.id === ctx.buildingId)) {
        setSelectedBuildingId(ctx.buildingId)
      }
    })
  }, [locationIds, ctx])

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
    setExistingTestBlock(null)

    listZones(selectedBuildingId).then((z) => {
      setZones(z)
      setZonesLoading(false)
    })

    // Check for existing tests this month: block if SUBMITTED or APPROVED already exists
    const curMonth = new Date().toISOString().slice(0, 7)
    Promise.all([
      listTests({ buildingId: selectedBuildingId, status: 'DRAFT' }),
      listTests({ buildingId: selectedBuildingId, status: 'REJECTED' }),
      listTests({ buildingId: selectedBuildingId, status: 'SUBMITTED' }),
      listTests({ buildingId: selectedBuildingId, status: 'APPROVED' }),
    ]).then(async ([drafts, rejected, submitted, approved]) => {
      // Block if there's already a submitted or approved test this month
      const submittedThisMonth = submitted.find(t => t.testMonth === curMonth)
      const approvedThisMonth = approved.find(t => t.testMonth === curMonth)
      if (approvedThisMonth) {
        setExistingTestBlock({ status: 'APPROVED', testMonth: curMonth })
        return
      }
      if (submittedThisMonth) {
        setExistingTestBlock({ status: 'SUBMITTED', testMonth: curMonth })
        return
      }

      // Prefer draft; fall back to rejected test for editing
      const resumable = drafts[0] ?? rejected[0]
      if (resumable) {
        // If it was rejected, reopen it to DRAFT status
        if (resumable.status === 'REJECTED') {
          await reopenTest(resumable.id)
        }
        setDraftId(resumable.id)
        setTestDate(resumable.testDate)
        setStartTime(resumable.testStartTime ?? '')
        setEndTime(resumable.testEndTime ?? '')
        setNotes(resumable.notes ?? '')

        // Restore saved zone results
        try {
          const { zones: savedZones } = await getTest(resumable.id)
          if (savedZones.length > 0) {
            const restored: Record<string, { result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'; notes: string }> = {}
            for (const tz of savedZones) {
              restored[tz.alarmZoneId] = { result: tz.result, notes: tz.notes ?? '' }
            }
            setZoneResults(restored)
          }
        } catch { /* no saved zones yet */ }

        // Restore saved attachments
        try {
          const savedAttachments = await listAttachments(resumable.id)
          if (savedAttachments.length > 0) {
            setFiles(savedAttachments.map(a => {
              const mimeType = a.fileType === 'PDF' ? 'application/pdf' : a.fileType === 'EXCEL' ? 'application/vnd.ms-excel' : 'image/png'
              return {
                id: a.id,
                file: new File([''], a.fileName, { type: mimeType }),
                name: a.fileName,
                size: a.fileSize,
                type: mimeType,
              }
            }))
          }
        } catch { /* no saved attachments */ }
      }
    })
  }, [selectedBuildingId])

  // ── Selected building info ───────────────────────────────────────────────
  const selectedBuilding = buildings.find((b) => b.id === selectedBuildingId)

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleZoneChange = (zoneId: string, result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND', zoneNotes: string) => {
    setZoneResults((prev) => {
      const updated = { ...prev, [zoneId]: { result, notes: zoneNotes } }

      // Debounced auto-save using ref — avoids stale closure on draftId and counts
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
      autoSaveTimer.current = setTimeout(async () => {
        if (!selectedBuildingId) return
        const tested  = Object.values(updated).filter((r) => r.result === 'TESTED').length
        const issues  = Object.values(updated).filter((r) => r.result === 'ISSUE_FOUND').length
        const payload = {
          buildingId: selectedBuildingId,
          testDate,
          testMonth: testDate.slice(0, 7),
          testerName: userName,
          testStartTime: startTime || undefined,
          testEndTime: endTime || undefined,
          notes: notes || undefined,
          zonesTotal: zones.length,
          zonesTested: tested,
          zonesIssue: issues,
        }
        try {
          const currentDraftId = draftIdRef.current
          if (currentDraftId) {
            await updateTest(currentDraftId, payload)
            await saveTestZones(currentDraftId, updated)
          } else {
            const created = await createTest(payload)
            draftIdRef.current = created.id
            setDraftId(created.id)
            await saveTestZones(created.id, updated)
          }
          setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
        } catch { /* silent */ }
      }, 1000)

      return updated
    })
  }

  const handleFilesAdd = async (added: UploadedFile[]) => {
    setFiles((prev) => [...prev, ...added])
    // Persist to API if draft exists
    const currentDraftId = draftIdRef.current
    if (currentDraftId) {
      for (const f of added) {
        try {
          const fakeFile = new File([''], f.name, { type: f.type })
          Object.defineProperty(fakeFile, 'size', { value: f.size })
          await uploadAttachment(currentDraftId, fakeFile)
        } catch { /* silent */ }
      }
    }
  }

  const handleFileRemove = async (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId))
    // Remove from API
    try {
      await deleteAttachment(fileId)
    } catch { /* silent */ }
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
      let id = draftId
      if (id) {
        await updateTest(id, buildTestPayload())
      } else {
        const created = await createTest(buildTestPayload())
        id = created.id
        setDraftId(id)
        draftIdRef.current = id
      }
      await saveTestZones(id!, zoneResults)
      setLastSaved(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }))
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
        draftIdRef.current = id
      } else {
        await updateTest(id, buildTestPayload())
      }

      await saveTestZones(id, zoneResults)
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
  if (zones.length > 0 && markedCount > 0) {
    statusText = `${markedCount}/${zones.length} zones marked`
  }
  if (lastSaved) {
    statusText += (statusText ? ' · ' : '') + `Saved ${lastSaved}`
  } else if (draftId && !lastSaved) {
    statusText += (statusText ? ' · ' : '') + 'Draft loaded'
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
          <button className="btn btn-outline" onClick={() => onNavigate('alarm-history')}>← Back to History</button>
        </div>
      </div>

      {/* ── Rejection notifications ── */}
      {rejectedNotifs.filter(t => !dismissedIds.has(t.id)).map(t => {
        const bld = buildings.find(b => b.id === t.buildingId)
        return (
          <div key={t.id} style={{
            background: '#fef2f2',
            border: '1px solid #fca5a5',
            borderLeft: '4px solid var(--red)',
            borderRadius: 8,
            padding: '12px 16px',
            marginBottom: 12,
            display: 'flex',
            alignItems: 'flex-start',
            gap: 12,
          }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>❌</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#991b1b', marginBottom: 3 }}>
                Test Rejected — {bld?.name ?? t.buildingId} ({t.testMonth})
              </div>
              <div style={{ fontSize: 12, color: '#7f1d1d' }}>
                <strong>Reason:</strong> {t.rejectionReason ?? 'No reason provided'}
              </div>
              <button
                className="btn btn-outline"
                style={{ marginTop: 8, fontSize: 11, padding: '4px 12px', color: 'var(--red)', borderColor: 'var(--red)' }}
                onClick={() => {
                  setSelectedBuildingId(t.buildingId)
                  setDismissedIds(prev => new Set([...prev, t.id]))
                  toast.info('Rejected test loaded for editing. Fix the issues and resubmit.')
                }}
              >
                Fix &amp; Resubmit
              </button>
            </div>
            <button
              onClick={() => setDismissedIds(prev => new Set([...prev, t.id]))}
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, color: '#fca5a5', flexShrink: 0, lineHeight: 1 }}
              title="Dismiss"
            >
              ✕
            </button>
          </div>
        )
      })}

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

      {/* ── Duplicate test block ── */}
      {existingTestBlock && (
        <div style={{
          background: existingTestBlock.status === 'APPROVED' ? '#eef8f1' : '#fffbeb',
          border: `1px solid ${existingTestBlock.status === 'APPROVED' ? '#d6f0dc' : '#fde68a'}`,
          borderLeft: `4px solid ${existingTestBlock.status === 'APPROVED' ? 'var(--g5)' : '#d97706'}`,
          borderRadius: 8,
          padding: '16px 20px',
          marginBottom: 16,
        }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: existingTestBlock.status === 'APPROVED' ? 'var(--g8)' : '#92400e', marginBottom: 4 }}>
            {existingTestBlock.status === 'APPROVED'
              ? 'This building already has an approved test for this month.'
              : 'This building already has a test submitted for approval this month.'}
          </div>
          <div style={{ fontSize: 12, color: 'var(--ts)' }}>
            {existingTestBlock.status === 'APPROVED'
              ? 'No additional test is needed. You can view the approved test in your history.'
              : 'Please wait for the approver to review the submitted test. If rejected, you can edit and resubmit.'}
          </div>
          <button
            className="btn btn-outline"
            style={{ marginTop: 10, fontSize: 11, padding: '4px 12px' }}
            onClick={() => onNavigate('alarm-history')}
          >
            View History
          </button>
        </div>
      )}

      {/* ── Test form (hidden when building already has a test this month) ── */}
      {!existingTestBlock && <>
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
        {!canSubmit && !saving && (
          <span style={{ fontSize: 11, color: 'var(--ts)', fontStyle: 'italic', marginLeft: 8 }}>
            {files.length === 0 ? 'Upload alarm company report first' : 'Mark at least one zone to submit'}
          </span>
        )}
      </div>
      </>}
    </div>
  )
}
