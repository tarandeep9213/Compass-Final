import { useState, useEffect } from 'react'
import { getTest, approveTestAll, rejectTest, getBiannualContext } from '../../../api/alarm'
import type { BiannualContext } from '../../../api/alarm'
import type { AlarmTest, AlarmTestZone, AlarmTestAttachment, AlarmZone } from '../../../mock/alarmData'
import { listZones } from '../../../api/alarm'
import ZoneChecklist from '../../../components/alarm/ZoneChecklist'
import ZoneSummaryBar from '../../../components/alarm/ZoneSummaryBar'
import AlarmStatusBadge from '../../../components/alarm/AlarmStatusBadge'
import { toast } from '../../../components/ui/Toast'

interface Props {
  userName: string
  userRole: string
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso)
  return d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMonthYear(testMonth: string): string {
  if (!testMonth) return ''
  const [y, m] = testMonth.split('-')
  const d = new Date(Number(y), Number(m) - 1)
  return d.toLocaleDateString('en-AU', { month: 'long', year: 'numeric' })
}

function relativeTime(iso?: string): string {
  if (!iso) return '—'
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  return `${days}d ago`
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function fileEmoji(type: string): string {
  if (type === 'IMAGE') return '\uD83D\uDDBC'
  if (type === 'EXCEL') return '\uD83D\uDCCA'
  return '\uD83D\uDCC4'
}

// ── Component ───────────────────────────────────────────────────────────────

export default function AlarmReview({ userName: _userName, userRole, ctx, onNavigate }: Props) {
  const testId = ctx.testId ?? ''

  const [test, setTest] = useState<AlarmTest | null>(null)
  const [zones, setZones] = useState<AlarmZone[]>([])
  const [testZones, setTestZones] = useState<AlarmTestZone[]>([])
  const [attachments, setAttachments] = useState<AlarmTestAttachment[]>([])
  const [biannualCtx, setBiannualCtx] = useState<BiannualContext | null>(null)
  const [loading, setLoading] = useState(true)
  const [rejectModal, setRejectModal] = useState(false)
  const [rejectReason, setRejectReason] = useState('')
  const [reviewerNotes, setReviewerNotes] = useState('')

  // ── Load data ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!testId) return
    setLoading(true)
    getTest(testId)
      .then(({ test: t, zones: tz, attachments: att }) => {
        setTest(t)
        setTestZones(tz)
        setAttachments(att)
        return listZones(t.buildingId)
      })
      .then((z) => setZones(z))
      .catch(() => toast.error('Failed to load test'))
      .finally(() => setLoading(false))
    // Load biannual context for this test (cellular & camera status)
    getBiannualContext(testId).then(setBiannualCtx).catch(() => { /* no biannual context, OK */ })
  }, [testId])

  // ── Derived ───────────────────────────────────────────────────────────────
  const buildingName = test ? test.buildingId : ''
  const monthYear = test ? formatMonthYear(test.testMonth) : ''

  const zoneResultsMap: Record<string, { result: 'TESTED' | 'NOT_TESTED' | 'ISSUE_FOUND'; notes: string }> = {}
  for (const tz of testZones) {
    zoneResultsMap[tz.alarmZoneId] = {
      result: tz.result,
      notes: tz.notes ?? '',
    }
  }

  const testedCount = test?.zonesTested ?? 0
  const totalCount = test?.zonesTotal ?? 0
  const issueCount = test?.zonesIssue ?? 0
  const notTestedCount = totalCount - testedCount - issueCount
  const compliancePct = totalCount > 0 ? Math.round((testedCount / totalCount) * 100) : 0

  // ── Compliance auto-checks ────────────────────────────────────────────────
  const allZonesTested = test ? test.zonesTested === test.zonesTotal : false
  const hasAttachments = attachments.length > 0
  const testInMonth = test
    ? test.testDate.slice(0, 7) === test.testMonth
    : false
  const noUnresolved = test ? test.zonesIssue === 0 : false
  const allPass = allZonesTested && hasAttachments && testInMonth && noUnresolved

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleBack = () => {
    onNavigate(ctx.fromPanel || 'alarm-approval')
  }

  const handleApprove = async () => {
    const submittedBiannuals = [
      biannualCtx?.cellular.pendingCheck,
      biannualCtx?.camera.pendingCheck,
    ].filter(c => c && c.approval_status === 'SUBMITTED')

    const msg = submittedBiannuals.length > 0
      ? `Approve this test AND ${submittedBiannuals.length} linked biannual check(s)?`
      : 'Approve this test?'
    if (!window.confirm(msg)) return
    try {
      await approveTestAll(testId, reviewerNotes || undefined)
      const successMsg = submittedBiannuals.length > 0
        ? `Test + ${submittedBiannuals.length} biannual approved`
        : 'Test approved'
      toast.success(successMsg)
      onNavigate(ctx.fromPanel || 'alarm-approval')
    } catch {
      toast.error('Failed to approve')
    }
  }

  const handleRejectConfirm = async () => {
    if (!rejectReason.trim()) return
    try {
      await rejectTest(testId, rejectReason.trim())
      toast.success('Test rejected. Tester and approver will be notified.')
      setRejectModal(false)
      onNavigate(ctx.fromPanel || 'alarm-approval')
    } catch {
      toast.error('Failed to reject test')
    }
  }

  // ── Loading / error ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontSize: 13, color: 'var(--ts)' }}>
        Loading test...
      </div>
    )
  }

  if (!test) {
    return (
      <div style={{ padding: 40, textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 8 }}>&#9888;</div>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Test not found</div>
        <button className="btn btn-outline" onClick={handleBack}>Go Back</button>
      </div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div>
      {/* ── Page header ── */}
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button className="btn btn-outline" onClick={handleBack}>
            &larr; Back
          </button>
          <div>
            <h2>Alarm Test Review</h2>
            <p>{buildingName} &mdash; {monthYear}</p>
          </div>
        </div>
        <div className="ph-right">
          <AlarmStatusBadge status={test.status} />
        </div>
      </div>

      {/* ── Test summary card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Test Summary</span>
        </div>
        <div className="card-body">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Tester</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{test.testerName}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Test Date</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{formatDate(test.testDate)}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Test Window</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>
                {test.testStartTime && test.testEndTime
                  ? `${test.testStartTime} \u2014 ${test.testEndTime}`
                  : 'Not recorded'}
              </div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Submitted</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{relativeTime(test.submittedAt)}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Building</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{test.buildingId}</div>
            </div>
            <div>
              <span style={{ fontSize: 11, color: 'var(--ts)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>Security Co</span>
              <div style={{ fontSize: 13, marginTop: 2 }}>{test.buildingId}</div>
            </div>
          </div>
          <ZoneSummaryBar
            tested={testedCount}
            notTested={notTestedCount}
            issues={issueCount}
            total={totalCount}
            showLegend
          />
        </div>
      </div>

      {/* ── Zone results card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Zone-by-Zone Results</span>
          <span style={{ fontSize: 12, color: 'var(--ts)' }}>
            {testedCount}/{totalCount} zones tested ({compliancePct}% compliance)
          </span>
        </div>
        <div className="card-body">
          <ZoneChecklist
            zones={zones}
            results={zoneResultsMap}
            readOnly
            highlightMissing
          />
        </div>
      </div>

      {/* ── Compliance auto-check card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Compliance Verification</span>
        </div>
        <div className="card-body">
          {[
            { pass: allZonesTested, label: 'All configured zones have been tested' },
            { pass: hasAttachments, label: 'Alarm company report uploaded' },
            { pass: testInMonth, label: 'Test completed within declared month' },
            { pass: noUnresolved, label: 'No unresolved zone issues' },
          ].map((item, i) => (
            <div
              key={i}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '8px 0',
                borderBottom: i < 3 ? '1px solid var(--ow2)' : undefined,
              }}
            >
              <span style={{ fontSize: 18, marginRight: 8, color: item.pass ? '#3a9458' : '#dc2626' }}>
                {item.pass ? '\u2705' : '\u274C'}
              </span>
              <span style={{ fontSize: 13, color: item.pass ? 'var(--td)' : 'var(--red)' }}>
                {item.label}
              </span>
            </div>
          ))}
          {!allPass && (
            <div className="alert-warn" style={{ marginTop: 12 }}>
              <span>&#9888;</span>
              <span>This test does not meet full compliance criteria</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Attachments card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Attached Reports</span>
          <span className="badge badge-gray">{attachments.length}</span>
        </div>
        <div className="card-body">
          {attachments.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--ts)', fontSize: 13 }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>&#128196;</div>
              No reports attached
            </div>
          ) : (
            attachments.map((att) => (
              <div
                key={att.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '10px 0',
                  borderBottom: '1px solid var(--ow2)',
                }}
              >
                <span style={{ fontSize: 20 }}>{fileEmoji(att.fileType)}</span>
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{att.fileName}</span>
                <span className="badge badge-gray" style={{ fontSize: 10 }}>{att.fileType}</span>
                <span style={{ fontSize: 12, color: 'var(--ts)' }}>{formatFileSize(att.fileSize)}</span>
                <button
                  className="btn btn-outline"
                  style={{ padding: '5px 12px', fontSize: 11 }}
                  onClick={() => toast.info('Download not available in demo')}
                >
                  Download
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── Biannual checks summary ── */}
      {biannualCtx && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Biannual Checks (will be approved together)</span>
          </div>
          <div className="card-body" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <BiannualSummaryCard title="Cellular Backup" slot={biannualCtx.cellular} />
            <BiannualSummaryCard title="Camera Backup" slot={biannualCtx.camera} />
          </div>
        </div>
      )}

      {/* ── Approval action card (only for SUBMITTED + approver roles) ── */}
      {test.status === 'SUBMITTED' && (userRole === 'admin' || userRole === 'regional-controller' || userRole === 'alarm-approver') && (
        <div className="card">
          <div className="card-header">
            <span className="card-title">Approval Decision</span>
          </div>
          <div className="card-body">
            <div className="f-field">
              <label className="f-lbl">Reviewer Notes</label>
              <textarea
                className="f-ta"
                placeholder="Optional notes for the tester..."
                value={reviewerNotes}
                onChange={(e) => setReviewerNotes(e.target.value)}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
              <button
                onClick={handleApprove}
                style={{
                  background: '#3a9458',
                  color: '#fff',
                  padding: '10px 24px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  border: 'none',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Approve Test
              </button>
              <button
                onClick={() => setRejectModal(true)}
                style={{
                  border: '1.5px solid #dc2626',
                  color: '#dc2626',
                  background: 'transparent',
                  padding: '10px 24px',
                  borderRadius: 8,
                  fontWeight: 600,
                  fontSize: 13,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                }}
              >
                Reject Test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Reject modal ── */}
      {rejectModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setRejectModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 12,
              padding: 24,
              width: 440,
              maxWidth: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.2)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 12 }}>Reject Test</h3>
            <p style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 12 }}>
              Please provide a reason for rejection. The tester and approver will be notified.
            </p>
            <div className="f-field">
              <label className="f-lbl">Rejection Reason (required)</label>
              <textarea
                className="f-ta"
                placeholder="Explain what needs to be corrected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={{ minHeight: 90 }}
              />
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 8 }}>
              <button className="btn btn-outline" onClick={() => setRejectModal(false)}>
                Cancel
              </button>
              <button
                className="btn"
                style={{
                  background: '#dc2626',
                  color: '#fff',
                  opacity: rejectReason.trim() ? 1 : 0.5,
                  cursor: rejectReason.trim() ? 'pointer' : 'not-allowed',
                }}
                disabled={!rejectReason.trim()}
                onClick={handleRejectConfirm}
              >
                Confirm Rejection
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Biannual summary card (compact view for approver) ────────────────────────
function BiannualSummaryCard({ title, slot }: { title: string; slot: import('../../../api/alarm').BiannualSlotInfo }) {
  const pending = slot.pendingCheck
  const last = slot.lastCheck
  const icon = (s: string | undefined) => s === 'COMPLIANT' ? '\u2713' : s === 'NON_COMPLIANT' ? '\u26a0' : '\u2014'
  const color = (s: string | undefined) => s === 'COMPLIANT' ? '#15803d' : s === 'NON_COMPLIANT' ? '#991b1b' : '#64748b'
  const bg = (s: string | undefined) => s === 'COMPLIANT' ? '#dcfce7' : s === 'NON_COMPLIANT' ? '#fee2e2' : '#f1f5f9'

  return (
    <div style={{ border: '1px solid var(--ow2)', borderRadius: 8, padding: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13 }}>{title}</div>
        {slot.overdue && (
          <span style={{ background: '#fee2e2', color: '#991b1b', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4 }}>
            OVERDUE
          </span>
        )}
      </div>
      {pending ? (
        <div style={{ background: bg(pending.status), padding: '8px 10px', borderRadius: 6 }}>
          <div style={{ fontSize: 12, color: color(pending.status), fontWeight: 700 }}>
            {icon(pending.status)} New check this cycle: {pending.status}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 3 }}>
            Date: {pending.checkDate} \u00b7 By: {pending.checkedByName}
          </div>
          {pending.notes && <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 3, fontStyle: 'italic' }}>"{pending.notes}"</div>}
        </div>
      ) : (
        <div style={{ fontSize: 12, color: 'var(--ts)' }}>No new check submitted with this test.</div>
      )}
      {last && (
        <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--ow2)' }}>
          Previous: {last.checkDate} ({last.status}) \u00b7 Next due: {last.nextDueDate ?? '\u2014'}
        </div>
      )}
    </div>
  )
}
