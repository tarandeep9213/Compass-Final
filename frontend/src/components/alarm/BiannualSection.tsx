import { useState, useEffect } from 'react'
import type { BiannualContext, BiannualSlotInfo } from '../../api/alarm'
import { addBiannualToTest, getBiannualContext } from '../../api/alarm'
import { toast } from '../ui/Toast'

interface Props {
  testId: string | null  // null until a draft test is created
}

interface SlotFormState {
  date: string
  status: 'COMPLIANT' | 'NON_COMPLIANT'
  notes: string
  daysVerified: number | null
  saving: boolean
  // The id of the saved DRAFT/SUBMITTED check (so we can edit it)
  pendingId: string | null
}

const TODAY = () => new Date().toISOString().slice(0, 10)

function statusBadge(slot: BiannualSlotInfo, hasPendingFresh: boolean) {
  if (hasPendingFresh) {
    return { color: '#0369a1', bg: '#e0f2fe', text: 'Will submit with test', icon: '\u2713' }
  }
  if (slot.overdue) {
    return { color: '#991b1b', bg: '#fee2e2', text: `Overdue by ${Math.abs(slot.daysUntilDue ?? 0)} days`, icon: '\u26a0' }
  }
  if (slot.due && slot.lastCheck) {
    return { color: '#92400e', bg: '#fef3c7', text: `Due in ${slot.daysUntilDue ?? 0} days`, icon: '\u23f0' }
  }
  if (slot.due && !slot.lastCheck) {
    return { color: '#991b1b', bg: '#fee2e2', text: 'Never checked', icon: '\u26a0' }
  }
  return { color: '#15803d', bg: '#dcfce7', text: `Valid until ${slot.lastCheck?.nextDueDate ?? '—'}`, icon: '\u2713' }
}

export default function BiannualSection({ testId }: Props) {
  const [context, setContext] = useState<BiannualContext | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)

  const [cellular, setCellular] = useState<SlotFormState>({
    date: TODAY(), status: 'COMPLIANT', notes: '', daysVerified: null, saving: false, pendingId: null,
  })
  const [camera, setCamera] = useState<SlotFormState>({
    date: TODAY(), status: 'COMPLIANT', notes: '', daysVerified: 30, saving: false, pendingId: null,
  })

  useEffect(() => {
    if (!testId) {
      setContext(null)
      return
    }
    setLoading(true)
    getBiannualContext(testId)
      .then(ctx => {
        setContext(ctx)
        // Pre-fill if there's a pending check (DRAFT/SUBMITTED) already
        if (ctx.cellular.pendingCheck) {
          const p = ctx.cellular.pendingCheck
          setCellular(s => ({
            ...s,
            date: p.checkDate,
            status: (p.status === 'NON_COMPLIANT' ? 'NON_COMPLIANT' : 'COMPLIANT'),
            notes: p.notes ?? '',
            pendingId: p.id,
          }))
        }
        if (ctx.camera.pendingCheck) {
          const p = ctx.camera.pendingCheck
          setCamera(s => ({
            ...s,
            date: p.checkDate,
            status: (p.status === 'NON_COMPLIANT' ? 'NON_COMPLIANT' : 'COMPLIANT'),
            notes: p.notes ?? '',
            pendingId: p.id,
          }))
        }
        // Auto-collapse if nothing is due AND no pending checks
        const anythingDue = ctx.cellular.due || ctx.camera.due || ctx.cellular.pendingCheck || ctx.camera.pendingCheck
        setExpanded(!!anythingDue)
      })
      .finally(() => setLoading(false))
  }, [testId])

  const saveSlot = async (
    type: 'CELLULAR_BACKUP' | 'CAMERA_BACKUP',
    state: SlotFormState,
    setState: (s: SlotFormState) => void,
  ) => {
    if (!testId) return
    setState({ ...state, saving: true })
    try {
      const saved = await addBiannualToTest(testId, {
        checkType: type,
        checkDate: state.date,
        status: state.status,
        notes: state.notes || undefined,
        daysVerified: type === 'CAMERA_BACKUP' ? (state.daysVerified ?? undefined) : undefined,
      })
      setState({ ...state, saving: false, pendingId: saved.id })
      toast.success(`${type === 'CELLULAR_BACKUP' ? 'Cellular' : 'Camera'} check saved`)
    } catch (err) {
      setState({ ...state, saving: false })
      const msg = err instanceof Error ? err.message : 'Save failed'
      toast.error(msg)
    }
  }

  if (!testId) {
    return (
      <div style={panelStyle}>
        <div style={{ padding: '14px 18px', color: 'var(--ts)', fontSize: 13 }}>
          Save a draft to enable biannual checks.
        </div>
      </div>
    )
  }
  if (loading) {
    return (
      <div style={panelStyle}>
        <div style={{ padding: '14px 18px', color: 'var(--ts)', fontSize: 13 }}>Loading biannual context...</div>
      </div>
    )
  }
  if (!context) return null

  const cellularPendingFresh = !!cellular.pendingId
  const cameraPendingFresh = !!camera.pendingId
  const cellularBadge = statusBadge(context.cellular, cellularPendingFresh)
  const cameraBadge = statusBadge(context.camera, cameraPendingFresh)

  // Show banner if anything overdue or due that hasn't been filled
  const cellularNeeds = (context.cellular.due || context.cellular.overdue) && !cellularPendingFresh
  const cameraNeeds = (context.camera.due || context.camera.overdue) && !cameraPendingFresh
  const showWarning = cellularNeeds || cameraNeeds

  return (
    <div style={panelStyle}>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{
          padding: '12px 18px', cursor: 'pointer', display: 'flex',
          justifyContent: 'space-between', alignItems: 'center',
          borderBottom: expanded ? '1px solid var(--ow2)' : 'none',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--td)' }}>
            Biannual Checks
            {showWarning && (
              <span style={{ marginLeft: 8, color: '#92400e', fontSize: 11, fontWeight: 600 }}>
                Optional - some checks due
              </span>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 2 }}>
            Cellular &amp; camera backup verification (every 6 months). Optional &mdash; submit will not be blocked.
          </div>
        </div>
        <span style={{ fontSize: 14, color: 'var(--ts)' }}>{expanded ? '\u25b2' : '\u25bc'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '16px 18px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          {/* Cellular */}
          <SlotEditor
            title="Cellular Backup"
            slot={context.cellular}
            badge={cellularBadge}
            state={cellular}
            setState={setCellular}
            onSave={() => saveSlot('CELLULAR_BACKUP', cellular, setCellular)}
            isCamera={false}
          />
          {/* Camera */}
          <SlotEditor
            title="Camera Backup"
            slot={context.camera}
            badge={cameraBadge}
            state={camera}
            setState={setCamera}
            onSave={() => saveSlot('CAMERA_BACKUP', camera, setCamera)}
            isCamera={true}
          />
        </div>
      )}
    </div>
  )
}

const panelStyle: React.CSSProperties = {
  background: '#fff',
  border: '1px solid var(--ow2)',
  borderRadius: 10,
  marginBottom: 16,
  overflow: 'hidden',
}

function SlotEditor({
  title, slot, badge, state, setState, onSave, isCamera,
}: {
  title: string
  slot: BiannualSlotInfo
  badge: { color: string; bg: string; text: string; icon: string }
  state: SlotFormState
  setState: (s: SlotFormState) => void
  onSave: () => void
  isCamera: boolean
}) {
  const lastCheckedSummary = slot.lastCheck
    ? `Last: ${slot.lastCheck.checkDate} by ${slot.lastCheck.checkedByName} (${slot.lastCheck.status})`
    : 'No previous check'

  // If we have an APPROVED check that's not due yet AND no pending changes, show read-only summary
  const showReadOnly = slot.lastCheck && !slot.due && !slot.overdue && !state.pendingId

  return (
    <div style={{ border: '1px solid var(--ow2)', borderRadius: 8, padding: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--td)' }}>{title}</div>
        <span style={{
          background: badge.bg, color: badge.color, borderRadius: 4,
          padding: '2px 8px', fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap',
        }}>
          {badge.icon} {badge.text}
        </span>
      </div>

      <div style={{ fontSize: 11, color: 'var(--ts)', marginBottom: 10 }}>{lastCheckedSummary}</div>

      {showReadOnly ? (
        <div style={{ fontSize: 12, color: 'var(--tm)', fontStyle: 'italic' }}>
          Not due yet. You can skip this section.
        </div>
      ) : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
            <div>
              <label style={labelStyle}>Check Date</label>
              <input
                type="date" value={state.date}
                onChange={e => setState({ ...state, date: e.target.value })}
                style={inputStyle}
              />
            </div>
            <div>
              <label style={labelStyle}>Result</label>
              <select
                value={state.status}
                onChange={e => setState({ ...state, status: e.target.value as 'COMPLIANT' | 'NON_COMPLIANT' })}
                style={inputStyle}
              >
                <option value="COMPLIANT">Compliant (Pass)</option>
                <option value="NON_COMPLIANT">Non-Compliant (Fail)</option>
              </select>
            </div>
          </div>

          {isCamera && (
            <div style={{ marginBottom: 8 }}>
              <label style={labelStyle}>Days Verified</label>
              <input
                type="number" min={0} max={365}
                value={state.daysVerified ?? ''}
                onChange={e => setState({ ...state, daysVerified: e.target.value ? Number(e.target.value) : null })}
                style={inputStyle}
                placeholder="30"
              />
            </div>
          )}

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Notes</label>
            <input
              type="text" value={state.notes}
              onChange={e => setState({ ...state, notes: e.target.value })}
              style={inputStyle}
              placeholder="Optional"
            />
          </div>

          <button
            onClick={onSave}
            disabled={state.saving}
            style={{
              width: '100%',
              padding: '7px 14px', borderRadius: 6, border: 'none',
              background: state.pendingId ? '#0ea5e9' : 'var(--g7)', color: '#fff',
              fontWeight: 600, fontSize: 12, cursor: 'pointer',
            }}
          >
            {state.saving ? 'Saving...' : state.pendingId ? 'Update Check' : 'Save Check'}
          </button>
        </>
      )}
    </div>
  )
}

const labelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: 'var(--ts)',
  display: 'block', marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.04em',
}

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', borderRadius: 6,
  border: '1px solid var(--ow2)', fontSize: 12, boxSizing: 'border-box', background: '#fff',
}
