import { useState } from 'react'
import { ApiError } from '../../api/client'
import { createClosure } from '../../api/closures'
import type { ApiClosure, ClosureReason } from '../../api/types'

interface Props {
  locationId: string
  locationName: string
  closureDate: string          // YYYY-MM-DD — already validated Mon-Fri upstream
  onClose: () => void
  onCreated: (c: ApiClosure) => void
}

const REASONS: { value: ClosureReason; label: string; blurb: string }[] = [
  { value: 'HOLIDAY', label: 'Holiday',   blurb: 'Public or observed holiday' },
  { value: 'WEATHER', label: 'Weather',   blurb: 'Closure due to weather event' },
  { value: 'OTHER',   label: 'Other',     blurb: 'Requires a note below' },
]

export default function OpClosureModal({
  locationId, locationName, closureDate, onClose, onCreated,
}: Props) {
  const [reason, setReason] = useState<ClosureReason | ''>('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const otherNeedsNotes = reason === 'OTHER' && !notes.trim()
  const canSubmit = !!reason && !otherNeedsNotes && !saving

  async function handleSubmit() {
    setError('')
    setSaving(true)
    try {
      const c = await createClosure({
        location_id: locationId,
        closure_date: closureDate,
        reason: reason as ClosureReason,
        notes: notes.trim(),
      })
      onCreated(c)
    } catch (e) {
      if (e instanceof ApiError) {
        setError(e.message || 'Could not report closure.')
      } else {
        setError('Could not report closure. Please try again.')
      }
    } finally {
      setSaving(false)
    }
  }

  const dateLabel = new Date(closureDate + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.42)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 800, padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#fff', borderRadius: 10, maxWidth: 460, width: '100%',
          padding: 24, boxShadow: '0 20px 48px rgba(0,0,0,0.2)',
        }}
      >
        <h3 style={{ fontFamily: 'DM Serif Display, serif', margin: 0, marginBottom: 4, color: 'var(--g8)' }}>
          Report no cashroom count
        </h3>
        <div style={{ fontSize: 13, color: 'var(--ts)', marginBottom: 18 }}>
          {locationName} · {dateLabel}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tm)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Reason
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 16 }}>
          {REASONS.map(r => {
            const active = reason === r.value
            return (
              <label
                key={r.value}
                style={{
                  display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 12px',
                  border: `1.5px solid ${active ? 'var(--g6)' : 'var(--g3)'}`,
                  background: active ? 'var(--g0)' : '#fff',
                  borderRadius: 8, cursor: 'pointer', transition: 'border-color 100ms',
                }}
              >
                <input
                  type="radio"
                  name="closure-reason"
                  value={r.value}
                  checked={active}
                  onChange={() => setReason(r.value)}
                  style={{ marginTop: 2 }}
                />
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--g8)' }}>{r.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--ts)' }}>{r.blurb}</div>
                </div>
              </label>
            )
          })}
        </div>

        <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--tm)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: 0.4 }}>
          Notes {reason === 'OTHER' && <span style={{ color: 'var(--red)' }}>*</span>}
        </div>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={3}
          placeholder={reason === 'OTHER' ? 'Briefly explain the closure' : 'Optional'}
          style={{
            width: '100%', padding: '8px 10px', border: '1.5px solid var(--g3)',
            borderRadius: 6, fontFamily: 'inherit', fontSize: 13, resize: 'vertical',
            boxSizing: 'border-box',
          }}
        />
        {otherNeedsNotes && (
          <div style={{ fontSize: 12, color: 'var(--red)', marginTop: 4 }}>
            Notes are required when the reason is “Other”.
          </div>
        )}

        {error && (
          <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 12 }}>
            {error}
          </div>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 20 }}>
          <button
            onClick={onClose}
            disabled={saving}
            style={{
              padding: '7px 14px', fontSize: 13, border: '1px solid var(--g3)',
              background: '#fff', color: 'var(--g8)', borderRadius: 6,
              cursor: saving ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              padding: '7px 14px', fontSize: 13, fontWeight: 600,
              border: '1px solid var(--g6)',
              background: canSubmit ? 'var(--g6)' : 'var(--g3)',
              color: '#fff', borderRadius: 6,
              cursor: canSubmit ? 'pointer' : 'not-allowed',
            }}
          >
            {saving ? 'Reporting…' : 'Report closure →'}
          </button>
        </div>
      </div>
    </div>
  )
}
