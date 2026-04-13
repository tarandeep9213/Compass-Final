import { useState, useEffect } from 'react'
import { LOCATIONS, formatCurrency } from '../../mock/data'
import { getConfig, updateConfig, setLocationOverride, removeLocationOverride } from '../../api/admin'

interface Props { adminName: string }

const GLOBALS_DEFAULT = { imprest: '9575', tolerancePct: '0.5', slaHours: '24', dowLookbackWeeks: '6', reminderTime: '08:00', retentionYears: '7' }

function LabelRow({ label, sub, children }: { label: string; sub?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, paddingBottom: 18, borderBottom: '1px solid var(--ow2)', marginBottom: 18 }}>
      <div style={{ flex: '0 0 220px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--td)' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: 'var(--ts)', marginTop: 3, lineHeight: 1.5 }}>{sub}</div>}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

export default function AdmConfig({ adminName }: Props) {
  const [globals, setGlobals] = useState(GLOBALS_DEFAULT)
  const [locOverrides, setLocOverrides] = useState<Record<string, { tolerancePct: string }>>({})
  const [saved, setSaved] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Load config from API on mount
  useEffect(() => {
    getConfig().then(cfg => {
      setGlobals({
        imprest:          String(9575),   // imprest not in API config; keep default
        tolerancePct:     String(cfg.global.default_tolerance_pct),
        slaHours:         String(cfg.global.approval_sla_hours),
        dowLookbackWeeks: String(cfg.global.dow_lookback_weeks),
        reminderTime:     cfg.global.daily_reminder_time,
        retentionYears:   String(cfg.global.data_retention_years),
      })
      const overrides: Record<string, { tolerancePct: string }> = {}
      cfg.location_overrides.forEach(o => {
        overrides[o.location_id] = { tolerancePct: String(o.tolerance_pct) }
      })
      setLocOverrides(overrides)
    }).catch(() => { /* use defaults */ })
  }, [])

  function setG(k: keyof typeof GLOBALS_DEFAULT, v: string) {
    setGlobals(p => ({ ...p, [k]: v })); setErrors(p => ({ ...p, [k]: '' })); setSaved(false)
  }
  function setLoc(id: string, v: string) {
    setLocOverrides(p => ({ ...p, [id]: { tolerancePct: v } })); setSaved(false)
  }
  function clearOverride(id: string) {
    setLocOverrides(p => { const n = { ...p }; delete n[id]; return n }); setSaved(false)
  }

  function validate() {
    const e: Record<string, string> = {}
    if (!globals.imprest || Number(globals.imprest) <= 0) e.imprest = 'Enter valid amount'
    if (!globals.tolerancePct || Number(globals.tolerancePct) <= 0 || Number(globals.tolerancePct) > 20) e.tolerancePct = '1–20%'
    if (!globals.slaHours || Number(globals.slaHours) < 1) e.slaHours = 'Min 1h'
    if (!globals.dowLookbackWeeks || ![4,6].includes(Number(globals.dowLookbackWeeks))) e.dowLookbackWeeks = '4 or 6'
    return e
  }

  async function handleSave() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaveError('')
    try {
      await updateConfig({
        default_tolerance_pct: Number(globals.tolerancePct),
        approval_sla_hours:    Number(globals.slaHours),
        dow_lookback_weeks:    Number(globals.dowLookbackWeeks) as 4 | 6,
        daily_reminder_time:   globals.reminderTime,
        data_retention_years:  Number(globals.retentionYears),
      })
      // Sync per-location overrides
      await Promise.all(LOCATIONS.map(loc => {
        const ov = locOverrides[loc.id]?.tolerancePct
        if (ov) return setLocationOverride(loc.id, Number(ov)).catch(() => {})
        return removeLocationOverride(loc.id).catch(() => {})
      }))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save settings'
      setSaveError(msg)
    }
  }

  return (
    <div className="fade-up">
      <div className="ph" style={{ marginBottom: 24 }}>
        <div>
          <h2>Configuration</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>Global settings and per-location overrides · {adminName}</p>
        </div>
        <div className="ph-right">
          {saved && <span style={{ fontSize: 12, color: 'var(--g7)', fontWeight: 600 }}>✓ Settings saved</span>}
          {saveError && <span style={{ fontSize: 12, color: 'var(--red)', fontWeight: 600 }}>{saveError}</span>}
          <button className="btn btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>

      {/* Global settings */}
      <div className="card" style={{ marginBottom: 22 }}>
        <div className="card-header"><span className="card-title">Global Settings</span></div>
        <div className="card-body" style={{ maxWidth: 700 }}>

          <LabelRow label="Imprest Amount" sub="Expected cash total for all locations (used as baseline for variance).">
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', fontSize: 13, color: 'var(--ts)', pointerEvents: 'none' }}>$</span>
              <input className="f-inp" type="number" value={globals.imprest} onChange={e => setG('imprest', e.target.value)} style={{ width: 160, paddingLeft: 26, fontSize: 14, fontWeight: 600 }} />
            </div>
            <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 4 }}>Current: {formatCurrency(Number(globals.imprest) || 0)}</div>
            {errors.imprest && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.imprest}</div>}
          </LabelRow>

          <LabelRow label="Default Tolerance %" sub="Variance beyond this % triggers a mandatory note and exception flag.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="f-inp" type="number" value={globals.tolerancePct} onChange={e => setG('tolerancePct', e.target.value)} style={{ width: 80, fontSize: 14, fontWeight: 600 }} />
              <span style={{ fontSize: 13, color: 'var(--ts)' }}>%</span>
            </div>
            {errors.tolerancePct && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.tolerancePct}</div>}
          </LabelRow>

          <LabelRow label="Approval SLA" sub="Submissions pending beyond this window are flagged as overdue and escalation emails are sent.">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="f-inp" type="number" value={globals.slaHours} onChange={e => setG('slaHours', e.target.value)} style={{ width: 80, fontSize: 14, fontWeight: 600 }} />
              <span style={{ fontSize: 13, color: 'var(--ts)' }}>hours</span>
            </div>
            {errors.slaHours && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.slaHours}</div>}
          </LabelRow>

          <LabelRow label="DOW Lookback Window" sub="Number of weeks the system checks for same day-of-week controller visits.">
            <div style={{ display: 'flex', gap: 10 }}>
              {['4', '6'].map(v => (
                <button key={v} onClick={() => setG('dowLookbackWeeks', v)} style={{
                  padding: '8px 22px', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                  border: globals.dowLookbackWeeks === v ? '2px solid var(--g4)' : '1.5px solid var(--ow2)',
                  background: globals.dowLookbackWeeks === v ? 'var(--g7)' : '#fff',
                  color: globals.dowLookbackWeeks === v ? '#fff' : 'var(--td)',
                }}>{v} weeks</button>
              ))}
            </div>
            {errors.dowLookbackWeeks && <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 3 }}>{errors.dowLookbackWeeks}</div>}
          </LabelRow>

          <LabelRow label="Daily Reminder Time" sub="Time of day to send operators their daily submission reminder email.">
            <input className="f-inp" type="time" value={globals.reminderTime} onChange={e => setG('reminderTime', e.target.value)} style={{ width: 120, fontSize: 14, fontWeight: 600 }} />
          </LabelRow>

          <LabelRow label="Data Retention" sub="How long submission and audit records are retained (1–7 years, default 7 to align with audit standards).">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input className="f-inp" type="number" value={globals.retentionYears} min={1} max={7} onChange={e => setG('retentionYears', e.target.value)} style={{ width: 80, fontSize: 14, fontWeight: 600 }} />
              <span style={{ fontSize: 13, color: 'var(--ts)' }}>years</span>
            </div>
          </LabelRow>

        </div>
      </div>

      {/* Per-location tolerance overrides */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Per-Location Tolerance Overrides</span>
          <span className="card-sub">Leave blank to use global default ({globals.tolerancePct}%)</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="dt">
            <thead>
              <tr>
                <th>Location</th>
                <th style={{ textAlign: 'center' }}>Global Default</th>
                <th style={{ textAlign: 'center' }}>Override %</th>
                <th style={{ textAlign: 'center' }}>Effective</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {LOCATIONS.map(loc => {
                const ov = locOverrides[loc.id]?.tolerancePct ?? ''
                const effective = ov ? Number(ov) : Number(globals.tolerancePct)
                return (
                  <tr key={loc.id}>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: 13 }}>{loc.name}</div>
                      <div style={{ fontSize: 11, fontFamily: 'monospace', color: 'var(--ts)' }}>{loc.id}</div>
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 13 }}>{globals.tolerancePct}%</td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
                        <input className="f-inp" type="number" placeholder="—" value={ov}
                          onChange={e => setLoc(loc.id, e.target.value)}
                          style={{ width: 70, textAlign: 'center', fontSize: 13 }} />
                        <span style={{ fontSize: 12, color: 'var(--ts)' }}>%</span>
                      </div>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: ov ? 'var(--g7)' : 'var(--ts)' }}>
                        {effective}%{ov ? ' ★' : ''}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {ov && (
                        <button className="btn btn-ghost" style={{ fontSize: 11, padding: '3px 10px' }} onClick={() => clearOverride(loc.id)}>
                          Reset
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
