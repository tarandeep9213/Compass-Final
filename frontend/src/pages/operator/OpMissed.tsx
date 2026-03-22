import { useState } from 'react'
import { getLocation, USERS, EXPLAINED_MISSED, MISSED_EXPLANATIONS } from '../../mock/data'
import { logMissedSubmission } from '../../api/submissions'
import type { MissedReason } from '../../api/types'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const REASONS = [
  { id: 'Illness',          label: 'Staff illness / absence' },
  { id: 'Technical Issue',  label: 'Technical issues (system/hardware)' },
  { id: 'Emergency',        label: 'Emergency closure' },
  { id: 'Public Holiday',   label: 'Public holiday / site closure' },
  { id: 'Training',         label: 'Staff training day' },
  { id: 'Other',            label: 'Other (specify below)' },
]

export default function OpMissed({ ctx, onNavigate }: Props) {
  const location = getLocation(ctx.locationId)
  const dateLabel = new Date(ctx.date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const [now] = useState(() => Date.now())
  const daysAgo = Math.floor((now - new Date(ctx.date + 'T12:00:00').getTime()) / 86400000)

  // Auto-populate supervisor from the location's controller
  const controller = USERS.find(u => u.role === 'controller' && u.locationIds.includes(ctx.locationId))

  const [reason, setReason] = useState('')
  const [detail, setDetail] = useState('')
  const [supervisorName, setSupervisorName] = useState(controller?.name ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  // View-only mode — explanation was already submitted
  const isViewOnly = ctx.viewOnly === 'true'

  async function handleSubmit() {
    if (!reason) { setError('Please select a reason.'); return }
    if (!detail.trim()) { setError('Please provide details.'); return }
    if (!supervisorName.trim()) { setError('Supervisor name is required.'); return }
    setError('')
    try {
      await logMissedSubmission({
        location_id: ctx.locationId,
        missed_date: ctx.date,
        reason: reason as MissedReason,
        detail: detail.trim(),
        supervisor_name: supervisorName.trim(),
      })
    } catch { /* API unavailable — show success in demo mode */ }
    EXPLAINED_MISSED.add(`${ctx.locationId}|${ctx.date}`)
    MISSED_EXPLANATIONS.set(`${ctx.locationId}|${ctx.date}`, {
      reason, detail: detail.trim(), supervisorName: supervisorName.trim(),
    })
    setSubmitted(true)
  }

  if (isViewOnly) {
    const saved = MISSED_EXPLANATIONS.get(`${ctx.locationId}|${ctx.date}`)
    const savedReason = saved?.reason ?? ''
    const savedDetail = saved?.detail ?? ''
    const savedSupervisor = saved?.supervisorName ?? ''
    return (
      <div className="fade-up">
        <div className="ph">
          <div>
            <h2>Missed Submission Explanation</h2>
            <p><strong>{location?.name}</strong> · {dateLabel}</p>
          </div>
          <div className="ph-right">
            <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>← Back</button>
          </div>
        </div>

        <div className="alert-info" style={{ marginBottom: 20 }}>
          <span>✅</span>
          <div style={{ fontSize: 13 }}>
            This explanation was submitted and sent to your controller. <strong>Read-only.</strong>
          </div>
        </div>

        <div className="card">
          <div className="card-header">
            <span className="card-title">Submitted Explanation</span>
          </div>
          <div className="card-body" style={{ maxWidth: 540 }}>
            {/* Location / Date */}
            <div className="f-row" style={{ marginBottom: 16 }}>
              <div className="f-field">
                <label className="f-lbl">Location</label>
                <input className="f-inp" value={location?.name ?? ''} disabled />
              </div>
              <div className="f-field">
                <label className="f-lbl">Date</label>
                <input className="f-inp" value={dateLabel} disabled />
              </div>
            </div>

            {/* Reason (read-only) */}
            <div className="f-field" style={{ marginBottom: 16 }}>
              <label className="f-lbl">Reason for missed submission</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
                {REASONS.map(r => (
                  <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13, opacity: r.id === savedReason ? 1 : 0.4 }}>
                    <input
                      type="radio" name="reason-view" value={r.id}
                      checked={r.id === savedReason}
                      readOnly
                      style={{ accentColor: 'var(--g7)' }}
                    />
                    {r.label}
                  </label>
                ))}
              </div>
            </div>

            {/* Detail (read-only) */}
            <div className="f-field" style={{ marginBottom: 16 }}>
              <label className="f-lbl">Additional details</label>
              <textarea
                className="f-ta" rows={4}
                value={savedDetail}
                disabled
                style={{ resize: 'none' }}
              />
            </div>

            {/* Supervisor (read-only) */}
            <div className="f-field" style={{ marginBottom: 16 }}>
              <label className="f-lbl">Supervisor / Manager name</label>
              <input className="f-inp" value={savedSupervisor} disabled />
            </div>

            <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>← Back to Submissions</button>
          </div>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="fade-up">
        <div className="ph"><div><h2>Explanation Submitted</h2></div></div>
        <div style={{
          background: 'var(--g0)', border: '1px solid var(--g1)', borderRadius: 10,
          padding: '28px 24px', textAlign: 'center', marginBottom: 20,
        }}>
          <div style={{ fontSize: 42, marginBottom: 12 }}>✅</div>
          <h3 style={{ fontFamily: 'DM Serif Display,serif', marginBottom: 8 }}>Explanation Recorded</h3>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Your missed submission explanation for <strong>{location?.name}</strong> on{' '}
            <strong>{dateLabel}</strong> has been logged and sent to your controller.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-primary" onClick={() => onNavigate('op-start')}>← Back to Submissions</button>
        </div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <h2>Missed Submission Explanation</h2>
          <p><strong>{location?.name}</strong> · {dateLabel}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('op-start')}>← Back</button>
        </div>
      </div>

      {/* Warning */}
      <div className="alert-warn" style={{ marginBottom: 20 }}>
        <span style={{ fontSize: 16 }}>⚠️</span>
        <div>
          <strong>No cash count was submitted for this date</strong>
          <div style={{ fontSize: 12, marginTop: 3 }}>
            This is {daysAgo} day{daysAgo !== 1 ? 's' : ''} ago. You must provide an explanation
            which will be reviewed by your controller. Unexplained missed submissions may trigger an escalation.
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <span className="card-title">Explanation Form</span>
          <span className="card-sub">Screen 8 of 22</span>
        </div>
        <div className="card-body" style={{ maxWidth: 540 }}>
          {/* Location / Date (read-only) */}
          <div className="f-row" style={{ marginBottom: 16 }}>
            <div className="f-field">
              <label className="f-lbl">Location</label>
              <input className="f-inp" value={location?.name ?? ''} disabled />
            </div>
            <div className="f-field">
              <label className="f-lbl">Date</label>
              <input className="f-inp" value={dateLabel} disabled />
            </div>
          </div>

          {/* Reason selector */}
          <div className="f-field">
            <label className="f-lbl">Reason for missed submission <span style={{ color: 'var(--red)' }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 4 }}>
              {REASONS.map(r => (
                <label key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 13 }}>
                  <input
                    type="radio" name="reason" value={r.id}
                    checked={reason === r.id}
                    onChange={() => { setReason(r.id); setError('') }}
                    style={{ accentColor: 'var(--g7)' }}
                  />
                  {r.label}
                </label>
              ))}
            </div>
          </div>

          {/* Detail */}
          <div className="f-field">
            <label className="f-lbl">
              {reason === 'other' ? 'Description' : 'Additional details'}
              <span style={{ color: 'var(--red)' }}> *</span>
            </label>
            <textarea
              className="f-ta"
              rows={4}
              placeholder={reason === 'other' ? 'Please describe the reason in detail...' : 'Provide any relevant details...'}
              value={detail}
              onChange={e => { setDetail(e.target.value); setError('') }}
            />
          </div>

          {/* Supervisor */}
          <div className="f-field">
            <label className="f-lbl">Supervisor / Manager name <span style={{ color: 'var(--red)' }}>*</span></label>
            <input
              type="text" className="f-inp"
              placeholder="Name of approving supervisor"
              value={supervisorName}
              onChange={e => { setSupervisorName(e.target.value); setError('') }}
            />
          </div>

          {error && <div className="login-error" style={{ marginTop: 4 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
            <button className="btn btn-primary" onClick={handleSubmit}>Submit Explanation →</button>
            <button className="btn btn-outline" onClick={() => onNavigate(ctx.from || 'op-start')}>Cancel</button>
          </div>

          <p style={{ fontSize: 11, color: 'var(--ts)', marginTop: 14 }}>
            This explanation will be recorded in the audit trail and sent to your controller for review.
          </p>
        </div>
      </div>
    </div>
  )
}
