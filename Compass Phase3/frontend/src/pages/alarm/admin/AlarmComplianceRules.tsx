import React, { useState, useEffect, useCallback } from 'react'
import { getComplianceRules, updateComplianceRules } from '../../../api/alarm'
import type { ComplianceRules } from '../../../mock/alarmData'
import { toast } from '../../../components/ui/Toast'

interface Props {
  adminName: string
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

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

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid var(--ow2)' }}>
      <div
        onClick={() => onChange(!value)}
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: value ? 'var(--g5)' : 'var(--ow2)',
          cursor: 'pointer',
          position: 'relative',
          flexShrink: 0,
          transition: 'background 0.2s',
        }}
      >
        <div style={{
          width: 16,
          height: 16,
          borderRadius: '50%',
          background: '#fff',
          position: 'absolute',
          top: 3,
          left: value ? 21 : 3,
          transition: 'left 0.2s',
          boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
        }} />
      </div>
      <span style={{ fontSize: 13, color: 'var(--tm)' }}>{label}</span>
    </div>
  )
}

export default function AlarmComplianceRules({ adminName, onNavigate }: Props) {
  const [loaded, setLoaded]   = useState<ComplianceRules | null>(null)
  const [form, setForm]       = useState<ComplianceRules | null>(null)

  useEffect(() => {
    getComplianceRules().then(r => {
      setLoaded(structuredClone(r))
      setForm(structuredClone(r))
    })
  }, [])

  const isDirty = useCallback(() => {
    if (!loaded || !form) return false
    return JSON.stringify(loaded) !== JSON.stringify(form)
  }, [loaded, form])

  async function handleSave() {
    if (!form) return
    await updateComplianceRules(form)
    toast.success('Compliance rules updated')
    setLoaded(structuredClone(form))
  }

  if (!form) {
    return (
      <div className="fade-up">
        <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
          {NAV_PILLS.map(p => (
            <span key={p.panel} style={pillStyle(p.panel === 'alarm-compliance-rules')} onClick={() => onNavigate(p.panel)}>{p.label}</span>
          ))}
        </div>
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--ts)' }}>Loading...</div>
      </div>
    )
  }

  return (
    <div className="fade-up">
      {/* Sub-nav pill bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        {NAV_PILLS.map(p => (
          <span
            key={p.panel}
            style={pillStyle(p.panel === 'alarm-compliance-rules')}
            onClick={() => onNavigate(p.panel)}
          >
            {p.label}
          </span>
        ))}
      </div>

      {/* Page header */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Compliance Rules</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Configure alarm testing compliance requirements &middot; {adminName}</p>
        </div>
      </div>

      {/* Monthly Test Requirements Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Monthly Test Requirements</span>
        </div>
        <div className="card-body">
          <div className="f-row">
            <div className="f-field">
              <label className="f-lbl">Monthly Deadline Day</label>
              <input
                type="number"
                min={1}
                max={31}
                className="f-inp"
                value={form.monthlyDeadlineDay}
                onChange={e => setForm({ ...form, monthlyDeadlineDay: Number(e.target.value) || 1 })}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
            <div className="f-field">
              <label className="f-lbl">Approval SLA Days</label>
              <input
                type="number"
                className="f-inp"
                value={form.approvalSlaDays}
                onChange={e => setForm({ ...form, approvalSlaDays: Number(e.target.value) || 1 })}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          </div>

          <Toggle
            value={form.requireAllZonesTested}
            onChange={v => setForm({ ...form, requireAllZonesTested: v })}
            label="Require all zones tested for compliance"
          />
          <Toggle
            value={form.requireReportUpload}
            onChange={v => setForm({ ...form, requireReportUpload: v })}
            label="Require alarm report upload"
          />
          <Toggle
            value={form.requireApproverSignoff}
            onChange={v => setForm({ ...form, requireApproverSignoff: v })}
            label="Require approver sign-off"
          />
        </div>
      </div>

      {/* Escalation Configuration Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Escalation Configuration</span>
        </div>
        <div className="card-body">
          {/* Tier 1 */}
          <div style={{ borderLeft: '4px solid #d97706', paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 8 }}>Tier 1 — Reminder</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days Before Deadline</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.escalation.tier1.daysBefore}
                  onChange={e => setForm({
                    ...form,
                    escalation: {
                      ...form.escalation,
                      tier1: { ...form.escalation.tier1, daysBefore: Number(e.target.value) || 0 },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester</div>
              </div>
            </div>
          </div>

          {/* Tier 2 */}
          <div style={{ borderLeft: '4px solid #ea580c', paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 8 }}>Tier 2 — Deadline</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days After Deadline</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.escalation.tier2.daysAfter}
                  onChange={e => setForm({
                    ...form,
                    escalation: {
                      ...form.escalation,
                      tier2: { ...form.escalation.tier2, daysAfter: Number(e.target.value) || 0 },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester, Approver</div>
              </div>
            </div>
          </div>

          {/* Tier 3 */}
          <div style={{ borderLeft: '4px solid #dc2626', paddingLeft: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>Tier 3 — Critical</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days After Deadline</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.escalation.tier3.daysAfter}
                  onChange={e => setForm({
                    ...form,
                    escalation: {
                      ...form.escalation,
                      tier3: { ...form.escalation.tier3, daysAfter: Number(e.target.value) || 0 },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester, Approver, Regional</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Biannual Check Configuration Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Biannual Check Configuration</span>
        </div>
        <div className="card-body">
          <div className="f-row">
            <div className="f-field">
              <label className="f-lbl">Cellular Frequency (months)</label>
              <input
                type="number"
                className="f-inp"
                value={form.biannual.cellularFrequencyMonths}
                onChange={e => setForm({
                  ...form,
                  biannual: { ...form.biannual, cellularFrequencyMonths: Number(e.target.value) || 1 },
                })}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
            <div className="f-field">
              <label className="f-lbl">Camera Check Frequency (days)</label>
              <input
                type="number"
                className="f-inp"
                value={form.biannual.cameraCheckFrequencyDays}
                onChange={e => setForm({
                  ...form,
                  biannual: { ...form.biannual, cameraCheckFrequencyDays: Number(e.target.value) || 1 },
                })}
                style={{ width: '100%', fontSize: 13 }}
              />
            </div>
          </div>
          <div className="f-field">
            <label className="f-lbl">Reminder Days Before Due</label>
            <input
              type="number"
              className="f-inp"
              value={form.biannual.reminderDaysBefore}
              onChange={e => setForm({
                ...form,
                biannual: { ...form.biannual, reminderDaysBefore: Number(e.target.value) || 1 },
              })}
              style={{ width: '100%', fontSize: 13 }}
            />
          </div>
        </div>
      </div>

      {/* Biannual Check Escalation Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Biannual Check Escalation</span>
          <span className="card-sub">Notify when cellular or camera checks are overdue</span>
        </div>
        <div className="card-body">
          {/* Tier 1 */}
          <div style={{ borderLeft: '4px solid #d97706', paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d97706', marginBottom: 8 }}>Tier 1 — Overdue Reminder</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days Overdue</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.biannual.escalation.tier1.daysOverdue}
                  onChange={e => setForm({
                    ...form,
                    biannual: {
                      ...form.biannual,
                      escalation: {
                        ...form.biannual.escalation,
                        tier1: { ...form.biannual.escalation.tier1, daysOverdue: Number(e.target.value) || 0 },
                      },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester, Approver</div>
              </div>
            </div>
          </div>

          {/* Tier 2 */}
          <div style={{ borderLeft: '4px solid #ea580c', paddingLeft: 16, marginBottom: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#ea580c', marginBottom: 8 }}>Tier 2 — Escalate to Regional</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days Overdue</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.biannual.escalation.tier2.daysOverdue}
                  onChange={e => setForm({
                    ...form,
                    biannual: {
                      ...form.biannual,
                      escalation: {
                        ...form.biannual.escalation,
                        tier2: { ...form.biannual.escalation.tier2, daysOverdue: Number(e.target.value) || 0 },
                      },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester, Approver, Regional</div>
              </div>
            </div>
          </div>

          {/* Tier 3 */}
          <div style={{ borderLeft: '4px solid #dc2626', paddingLeft: 16 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#dc2626', marginBottom: 8 }}>Tier 3 — Critical / DGM Alert</div>
            <div className="f-row">
              <div className="f-field">
                <label className="f-lbl">Days Overdue</label>
                <input
                  type="number"
                  className="f-inp"
                  value={form.biannual.escalation.tier3.daysOverdue}
                  onChange={e => setForm({
                    ...form,
                    biannual: {
                      ...form.biannual,
                      escalation: {
                        ...form.biannual.escalation,
                        tier3: { ...form.biannual.escalation.tier3, daysOverdue: Number(e.target.value) || 0 },
                      },
                    },
                  })}
                  style={{ width: '100%', fontSize: 13 }}
                />
              </div>
              <div className="f-field">
                <label className="f-lbl">Recipients</label>
                <div style={{ padding: '9px 12px', fontSize: 13, color: 'var(--ts)', background: 'var(--ow)', border: '1.5px solid var(--ow2)', borderRadius: 7 }}>Tester, Approver, Regional, DGM</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Notification Settings Card */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Notification Settings</span>
          <span className="card-sub">Configure how users receive alarm compliance notifications</span>
        </div>
        <div className="card-body">
          <Toggle
            value={form.notifications.enableEmail}
            onChange={v => setForm({
              ...form,
              notifications: { ...form.notifications, enableEmail: v },
            })}
            label="Send email notifications for escalations and status changes"
          />
          <Toggle
            value={form.notifications.enableInApp}
            onChange={v => setForm({
              ...form,
              notifications: { ...form.notifications, enableInApp: v },
            })}
            label="Show in-app notification banners and alerts"
          />
        </div>
      </div>

      {/* Sticky Save Footer */}
      <div style={{
        position: 'sticky',
        bottom: 0,
        background: '#fff',
        borderTop: '1px solid var(--ow2)',
        padding: '14px 24px',
        display: 'flex',
        justifyContent: 'flex-end',
        alignItems: 'center',
        gap: 16,
      }}>
        {isDirty() && (
          <div className="alert-warn" style={{ marginBottom: 0, flex: 1 }}>
            You have unsaved changes
          </div>
        )}
        <button className="btn btn-primary" onClick={handleSave}>Save Rules</button>
      </div>
    </div>
  )
}
