import { useState, useEffect, useCallback } from 'react'
import { listAttachments, uploadAttachment, deleteAttachment } from '../../../api/alarm'
import type { AlarmTestAttachment } from '../../../mock/alarmData'
import FileUploadDropzone from '../../../components/alarm/FileUploadDropzone'
import type { UploadedFile } from '../../../components/alarm/FileUploadDropzone'
import EmptyState from '../../../components/ui/EmptyState'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function relativeTime(isoStr: string): string {
  const diff = Date.now() - new Date(isoStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'Just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}

const TYPE_BADGE: Record<string, { label: string; bg: string; color: string }> = {
  PDF:   { label: 'PDF',   bg: '#dbeafe', color: '#1d4ed8' },
  EXCEL: { label: 'Excel', bg: '#dcfce7', color: '#166534' },
  IMAGE: { label: 'Image', bg: '#f3e8ff', color: '#7c3aed' },
}

export default function AlarmUpload({ ctx, onNavigate }: Props) {
  const testId = ctx.testId ?? ''
  const buildingId = ctx.buildingId ?? ''

  const [attachments, setAttachments] = useState<AlarmTestAttachment[]>([])
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([])
  const [uploading, setUploading] = useState(false)

  // ── Load existing attachments on mount ─────────────────────────────────────
  useEffect(() => {
    if (!testId) return
    listAttachments(testId).then((list) => setAttachments(list))
  }, [testId])

  // ── Dropzone handlers ─────────────────────────────────────────────────────
  const handleFilesAdd = useCallback((added: UploadedFile[]) => {
    setPendingFiles((prev) => [...prev, ...added])

    // Auto-upload each file
    if (!testId) return
    setUploading(true)
    Promise.all(
      added.map((f) => uploadAttachment(testId, f.file)),
    ).then((uploaded) => {
      setAttachments((prev) => [...prev, ...uploaded])
      setPendingFiles((prev) =>
        prev.filter((p) => !added.some((a) => a.id === p.id)),
      )
    }).finally(() => setUploading(false))
  }, [testId])

  const handlePendingRemove = useCallback((fileId: string) => {
    setPendingFiles((prev) => prev.filter((f) => f.id !== fileId))
  }, [])

  const handleDeleteAttachment = useCallback(async (id: string) => {
    const ok = window.confirm('Delete this file?')
    if (!ok) return
    await deleteAttachment(id)
    setAttachments((prev) => prev.filter((a) => a.id !== id))
  }, [])

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* ── Page header ── */}
      <div className="ph">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <button
            className="btn btn-outline"
            onClick={() => onNavigate('alarm-test-form', { buildingId })}
          >
            ← Back to Test
          </button>
          <div>
            <h2>Upload Alarm Report</h2>
          </div>
        </div>
      </div>

      {/* ── Upload card ── */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Upload Files</span>
          {uploading && (
            <span style={{ fontSize: 12, color: 'var(--ts)' }}>Uploading...</span>
          )}
        </div>
        <div className="card-body">
          <FileUploadDropzone
            accept=".pdf,.xlsx,.xls,.jpg,.png"
            maxSizeMb={25}
            files={pendingFiles}
            onAdd={handleFilesAdd}
            onRemove={handlePendingRemove}
          />
        </div>
      </div>

      {/* ── Info alert ── */}
      <div className="alert-info">
        Upload the Customer Activity Report from your security company.
      </div>

      {/* ── Existing attachments card ── */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="card-title">Uploaded Documents</span>
            <span
              style={{
                background: 'var(--g0)',
                color: 'var(--g7)',
                padding: '2px 8px',
                borderRadius: 10,
                fontSize: 11,
                fontWeight: 600,
              }}
            >
              {attachments.length}
            </span>
          </div>
        </div>
        <div className="card-body" style={{ padding: attachments.length > 0 ? 0 : 16 }}>
          {attachments.length === 0 ? (
            <EmptyState icon="📎" title="No files uploaded yet" subtitle="Use the drop zone above to upload alarm test documents." />
          ) : (
            <table className="dt">
              <thead>
                <tr>
                  <th>File Name</th>
                  <th>Type</th>
                  <th>Size</th>
                  <th>Uploaded</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {attachments.map((att) => {
                  const badge = TYPE_BADGE[att.fileType] ?? TYPE_BADGE.PDF
                  return (
                    <tr key={att.id}>
                      <td style={{ fontWeight: 500 }}>{att.fileName}</td>
                      <td>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '2px 8px',
                            borderRadius: 6,
                            fontSize: 11,
                            fontWeight: 600,
                            background: badge.bg,
                            color: badge.color,
                          }}
                        >
                          {badge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--ts)', fontSize: 12 }}>{formatSize(att.fileSize)}</td>
                      <td style={{ color: 'var(--ts)', fontSize: 12 }}>{relativeTime(att.uploadedAt)}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDeleteAttachment(att.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--red)',
                            fontSize: 12,
                            fontWeight: 500,
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            padding: '4px 8px',
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
