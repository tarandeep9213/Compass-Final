import { useState, useMemo, useCallback, useEffect } from 'react'
import { todayStr } from '../../mock/data'
import { scheduleControllerVisit, listControllerVerifications } from '../../api/verifications'
import { listLocations } from '../../api/locations'
import type { ApiVerification, ApiLocation } from '../../api/types'

interface Props {
  controllerName: string
  locationIds: string[]
  ctx?: Record<string, string>          // ctx.locationId → pre-select from Dashboard
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const DOW_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const TIME_SLOTS: string[] = ['09:00', '11:00', '13:00', '15:00', '17:00']
const TIME_DISPLAY: Record<string, string> = {
  '09:00': '9:00 AM', '11:00': '11:00 AM',
  '13:00': '1:00 PM', '15:00': '3:00 PM', '17:00': '5:00 PM',
}

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

export default function CtrlLog({ controllerName, locationIds, ctx, onNavigate }: Props) {
  const today    = todayStr()

  // Pre-fill location from Dashboard context if valid
  const defaultLocation = (ctx?.locationId && locationIds.includes(ctx.locationId))
    ? ctx.locationId
    : (locationIds[0] ?? '')

  const [location,     setLocation]     = useState(defaultLocation)
  const [calYear,      setCalYear]      = useState(new Date().getFullYear())
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [selectedTime, setSelectedTime] = useState<string | null>(null)
  const [notes,        setNotes]        = useState('')
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [submitted,    setSubmitted]    = useState<ApiVerification | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [refresh,      setRefresh]      = useState(0)
  const [fetchError,   setFetchError]   = useState('')
  const [apiLocations,     setApiLocations]     = useState<ApiLocation[]>([])
  const [apiVerifications, setApiVerifications] = useState<ApiVerification[]>([])

  // ── Fetch real data on mount ────────────────────────────────────────────
  useEffect(() => {
    listLocations().then(setApiLocations).catch(() => {})
    listControllerVerifications({ page_size: 500 })
      .then(r => setApiVerifications(r.items))
      .catch(() => {})
  }, [])

  // ── Calendar grid ──────────────────────────────────────────────────────
  // Returns null-padded array: null = empty leading cell, number = day-of-month
  const calCells = useMemo<(number | null)[]>(() => {
    const firstDow    = new Date(calYear, calMonth, 1).getDay()   // 0=Sun
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calYear, calMonth])

  // ── Visit presence map for selected location ───────────────────────────
  // Maps date → ApiVerification for booked slots so we can read the status
  const bookedMap = useMemo<Map<string, ApiVerification>>(() => {
    if (!location) return new Map()
    const map = new Map<string, ApiVerification>()
    apiVerifications
      .filter(v => v.verification_type === 'CONTROLLER' && v.location_id === location)
      .forEach(v => {
        if (v.status !== 'cancelled') {
          map.set(v.verification_date, v)
        }
      })
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, apiVerifications, refresh])

  // ── Active visits for selected location ────────────────────────────────
  const activeVisits = useMemo(() => {
    if (!location) return []
    return apiVerifications.filter(v =>
      v.verification_type === 'CONTROLLER' && v.location_id === location &&
      (v.status === 'completed' || v.status === 'scheduled')
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, apiVerifications, refresh])

  // Helper to get conflicts for a specific date (4-week lookback from that date)
  const getDowConflicts = useCallback((targetDateStr: string) => {
    const targetTime = new Date(targetDateStr + 'T12:00:00').getTime()
    const cutoffTime = targetTime - 28 * 86400000 // 28 days lookback
    const targetDow  = new Date(targetDateStr + 'T12:00:00').getDay()

    return activeVisits.filter(v =>
      v.day_of_week === targetDow &&
      v.verification_date < targetDateStr &&
      new Date(v.verification_date + 'T12:00:00').getTime() >= cutoffTime
    )
  }, [activeVisits])

  // ── DOW warning for currently selected date ────────────────────────────
  const dowWarning = useMemo(() => {
    if (!selectedDate) return null
    const matches = getDowConflicts(selectedDate)
    if (!matches.length) return null
    
    const last = [...matches].sort((a, b) => b.verification_date.localeCompare(a.verification_date))[0]
    return {
      dayLabel: DOW_LABELS[new Date(selectedDate + 'T12:00:00').getDay()],
      lastDate: new Date(last.verification_date + 'T12:00:00').toLocaleDateString('en-GB', {
        day: 'numeric', month: 'short', year: 'numeric',
      }),
      count: matches.length,
    }
  }, [selectedDate, getDowConflicts])

  // ── Calendar navigation ────────────────────────────────────────────────
  const prevDisabled =
    calYear === new Date().getFullYear() && calMonth <= new Date().getMonth()

  function prevMonth() {
    if (prevDisabled) return
    if (calMonth === 0) { setCalYear(y => y - 1); setCalMonth(11) }
    else setCalMonth(m => m - 1)
  }
  function nextMonth() {
    if (calMonth === 11) { setCalYear(y => y + 1); setCalMonth(0) }
    else setCalMonth(m => m + 1)
  }

  // ── Location change clears selection ──────────────────────────────────
  function handleLocationChange(loc: string) {
    setLocation(loc); setSelectedDate(null); setSelectedTime(null); setErrors({})
  }

  // ── Date cell click ────────────────────────────────────────────────────
  function handleDateSelect(dateStr: string) {
    if (dateStr < today) return          // past: not bookable (today IS allowed)
    if (selectedDate === dateStr) { setSelectedDate(null); setSelectedTime(null); return }
    setSelectedDate(dateStr); setSelectedTime(null)
    setErrors(p => ({ ...p, date: '' }))
  }

  // ── Validate + submit ──────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!selectedDate)                     e.date = 'Please select a visit date from the calendar.'
    else if (bookedMap.has(selectedDate))  e.date = 'This date is already booked for this location. Choose another.'
    else if (!selectedTime)                e.time = 'Please select a time slot.'
    // DOW warning is non-blocking, so no validation is needed here
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const dow = new Date(selectedDate! + 'T12:00:00').getDay()
    try {
      const res = await scheduleControllerVisit({
        location_id:              location,
        date:                     selectedDate!,
        scheduled_time:           selectedTime! as '09:00' | '11:00' | '13:00' | '15:00' | '17:00',
        dow_warning_acknowledged: !!dowWarning,
        dow_warning_reason:       null,
        notes:                    notes.trim() || null,
      })
      setApiVerifications(prev => [...prev, res])
      setFetchError('')
      setSaving(false)
      setSubmitted(res)
    } catch {
      setFetchError('Could not reach the server. Make sure the backend is running on port 8000.')
      const loc = apiLocations.find(l => l.id === location)
      setSaving(false)
      setSubmitted({
        id:                  `VER-S${Date.now()}`,
        location_id:         location,
        location_name:       loc?.name ?? location,
        verifier_id:         '',
        verifier_name:       controllerName,
        verification_type:   'CONTROLLER',
        status:              'scheduled',
        verification_date:   selectedDate!,
        scheduled_time:      selectedTime,
        day_of_week:         dow,
        day_name:            DOW_LABELS[dow],
        warning_flag:        !!dowWarning,
        warning_reason:      null,
        observed_total:      null,
        variance_vs_imprest: null,
        variance_pct:        null,
        notes:               notes.trim(),
        missed_reason:       null,
        month_year:          selectedDate!.slice(0, 7),
        created_at:          new Date().toISOString(),
        updated_at:          new Date().toISOString(),
      })
    }
  }

  function handleReset() {
    setSelectedDate(null); setSelectedTime(null)
    setNotes(''); setErrors({}); setSubmitted(null)
    setRefresh(r => r + 1) // Re-evaluates the calendar hooks so the new visit instantly appears
  }

  // ── Success screen ──────────────────────────────────────────────────────
  if (submitted) {
    const sLoc       = apiLocations.find(l => l.id === submitted.location_id)
    const sDateLabel = new Date(submitted.verification_date + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    return (
      <div className="fade-up">
        <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '44px 36px' }}>
          <div style={{ fontSize: 54, marginBottom: 14 }}>📅</div>
          <h2 style={{ fontFamily: 'DM Serif Display,serif', marginBottom: 8 }}>Visit Scheduled</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 28 }}>
            Your visit to <strong style={{ color: 'var(--td)' }}>{sLoc?.name ?? submitted.location_name ?? submitted.location_id}</strong> has been booked.
          </p>

          <div className="kpi-row" style={{ marginBottom: 24 }}>
            <div className="kpi">
              <div className="kpi-lbl">Location</div>
              <div style={{ fontSize: 12, fontWeight: 600, paddingTop: 6, color: 'var(--td)', lineHeight: 1.4 }}>
                {sLoc?.name ?? submitted.location_name ?? submitted.location_id}
              </div>
              <div className="kpi-sub">{submitted.location_id}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Date</div>
              <div style={{ fontSize: 11, fontWeight: 600, paddingTop: 6, color: 'var(--td)', lineHeight: 1.5 }}>
                {sDateLabel}
              </div>
              <div className="kpi-sub">{DOW_LABELS[submitted.day_of_week]}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Time Slot</div>
              <div style={{ fontSize: 18, fontWeight: 700, paddingTop: 4, color: 'var(--g7)' }}>
                {submitted.scheduled_time ? (TIME_DISPLAY[submitted.scheduled_time] ?? submitted.scheduled_time) : '—'}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--g0)', border: '1px solid var(--g1)',
            borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--ts)',
            marginBottom: 22, textAlign: 'left', lineHeight: 1.65,
          }}>
            💡 On the day of your visit, open the <strong>Dashboard</strong> and click{' '}
            <strong>✓ Complete</strong> to record the observed cash total.
            If you can't attend, click <strong>× Missed</strong> to log the reason.
          </div>

          {submitted.warning_flag && (
            <div style={{
              background: 'var(--amb-bg)', border: '1px solid #fcd34d', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: '#92400e', marginBottom: 18, textAlign: 'left',
            }}>
              ⚠️ Day-of-week pattern flag recorded — visible in compliance reports.
            </div>
          )}

          {fetchError && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 18, textAlign: 'left',
            }}>
              ⚠️ {fetchError} (Running locally)
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('ctrl-dashboard')}>← Dashboard</button>
            <button className="btn btn-outline" onClick={handleReset}>+ Schedule Another</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────
  const selectedDow = selectedDate ? new Date(selectedDate + 'T12:00:00').getDay() : -1
  const selectedDateLabel = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : ''
  const selectedDateBooked = selectedDate ? bookedMap.has(selectedDate) : false

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 20 }}>
        <div>
          <h2>Schedule a Visit</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Select a location, pick a date from the calendar and choose a time slot
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('ctrl-dashboard')}>
            ← Dashboard
          </button>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-header">
          <span className="card-title">Visit Details</span>
          <span className="card-sub">{controllerName}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 26 }}>

          {/* ── Location ── */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
              Location *
            </label>
            <div style={{ position: 'relative' }}>
              {/* Pin icon */}
              <span style={{
                position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
                fontSize: 15, pointerEvents: 'none', lineHeight: 1,
              }}>📍</span>

              <select
                value={location}
                onChange={e => handleLocationChange(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 40px 10px 36px',
                  fontSize: 13.5, fontWeight: 600, fontFamily: 'inherit',
                  border: '1.5px solid var(--ow2)', borderRadius: 8,
                  background: '#fff', color: 'var(--td)',
                  cursor: 'pointer', outline: 'none',
                  appearance: 'none', WebkitAppearance: 'none',
                  /* custom chevron */
                  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%230d3320' stroke-width='1.8' fill='none' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                  backgroundRepeat: 'no-repeat',
                  backgroundPosition: 'right 12px center',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.07)',
                  transition: 'border-color 0.15s, box-shadow 0.15s',
                }}
                onFocus={e => { e.currentTarget.style.borderColor = 'var(--g4)'; e.currentTarget.style.boxShadow = '0 0 0 3px rgba(52,160,110,0.12)' }}
                onBlur={e  => { e.currentTarget.style.borderColor = 'var(--ow2)'; e.currentTarget.style.boxShadow = '0 1px 4px rgba(0,0,0,0.07)' }}
              >
                {locationIds.map(id => {
                  const loc = apiLocations.find(l => l.id === id)
                  return <option key={id} value={id}>{loc?.name ?? id} ({id})</option>
                })}
              </select>
            </div>
          </div>

          {/* ── Calendar + Time Slots side by side ── */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* ── Calendar ── */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 10 }}>
                Select Visit Date *
              </label>

              <div style={{
                border: '1px solid var(--ow2)', borderRadius: 12,
                padding: '16px 18px', background: '#fff',
                display: 'inline-block', minWidth: 320,
              }}>
                {/* Month navigation */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <button
                    onClick={prevMonth}
                    disabled={prevDisabled}
                    style={{
                      width: 32, height: 32, border: '1px solid var(--ow2)', borderRadius: 7,
                      background: prevDisabled ? 'var(--ow)' : '#fff',
                      cursor: prevDisabled ? 'default' : 'pointer',
                      color: prevDisabled ? '#ccc' : 'var(--td)',
                      fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, padding: 0,
                    }}
                  >‹</button>

                  <span style={{ fontWeight: 700, fontSize: 14, color: 'var(--td)', minWidth: 150, textAlign: 'center' }}>
                    {MONTH_LABELS[calMonth]} {calYear}
                  </span>

                  <button
                    onClick={nextMonth}
                    style={{
                      width: 32, height: 32, border: '1px solid var(--ow2)', borderRadius: 7,
                      background: '#fff', cursor: 'pointer', color: 'var(--td)',
                      fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      lineHeight: 1, padding: 0,
                    }}
                  >›</button>
                </div>

                {/* Day-of-week headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', gap: '2px 0', marginBottom: 4 }}>
                  {DOW_LABELS.map(d => (
                    <div key={d} style={{
                      width: 40, textAlign: 'center', fontSize: 10,
                      fontWeight: 800, color: 'var(--ts)', paddingBottom: 6,
                      letterSpacing: '0.04em',
                    }}>
                      {d.toUpperCase()}
                    </div>
                  ))}
                </div>

                {/* Date cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', gap: 2 }}>
                  {calCells.map((day, idx) => {
                    if (day === null) return <div key={`e-${idx}`} style={{ width: 40, height: 40 }} />

                    const dateStr    = padDate(calYear, calMonth, day)
                    const isPast     = dateStr < today         // past = not bookable (today is allowed)
                    const isToday    = dateStr === today
                    const isSelected = selectedDate === dateStr
                    const isBooked   = bookedMap.has(dateStr)
                    const isDowWarn  = !isPast && getDowConflicts(dateStr).length > 0

                    // ── Cell styles ──
                    let bg     = 'transparent'
                    let color  = isPast ? '#c8c8c8' : 'var(--td)'
                    let border = 'none'
                    let fw     = 400

                    if (isSelected && !isBooked) {
                      bg = isDowWarn ? '#f59e0b' : '#1d4ed8'; color = '#fff'; fw = 700
                    } else if (isBooked && !isPast) {
                      bg = 'var(--g0)'; color = 'var(--g7)'
                    } else if (isBooked && isPast) {
                      bg = '#f3f4f6'
                    } else if (isToday) {
                      border = `2px solid var(--g4)`; color = 'var(--g7)'; fw = 600
                    } else if (isDowWarn) {
                      border = '2px dashed #f59e0b'; color = '#d97706'; fw = 600
                    }

                    return (
                      <div
                        key={day}
                        title={
                          isBooked && !isPast
                            ? `Visit ${bookedMap.get(dateStr)?.status === 'scheduled' ? 'scheduled' : bookedMap.get(dateStr)?.status} — ${bookedMap.get(dateStr)?.scheduled_time ? TIME_DISPLAY[bookedMap.get(dateStr)!.scheduled_time!] ?? '' : 'see dashboard'}`
                            : isDowWarn && !isPast
                            ? `Same weekday visit detected in past 4 weeks`
                            : undefined
                        }
                        onClick={() => !isPast && handleDateSelect(dateStr)}
                        style={{
                          width: 40, height: 40,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%', background: bg, color, border,
                          fontSize: 13, fontWeight: fw,
                          cursor: isPast ? 'default' : 'pointer',
                          position: 'relative',
                          opacity: isPast ? 0.4 : 1,
                          transition: 'background 0.1s, color 0.1s',
                          userSelect: 'none',
                        }}
                      >
                        {day}

                        {/* Green dot — existing visit */}
                        {isBooked && !isSelected && (
                          <span style={{
                            position: 'absolute', bottom: 4, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 4, height: 4, borderRadius: '50%',
                            background: isPast ? '#c8c8c8' : 'var(--g7)',
                          }} />
                        )}

                        {/* Amber dot — DOW pattern (only on unbooked days) */}
                        {isDowWarn && !isBooked && !isSelected && (
                          <span style={{
                            position: 'absolute', bottom: 4, left: '50%',
                            transform: 'translateX(-50%)',
                            width: 4, height: 4, borderRadius: '50%',
                            background: '#d97706',
                          }} />
                        )}
                      </div>
                    )
                  })}
                </div>

                {/* Legend */}
                <div style={{
                  display: 'flex', gap: 14, marginTop: 14, paddingTop: 12,
                  borderTop: '1px solid var(--ow2)', flexWrap: 'wrap',
                }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ts)', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--g7)', display: 'inline-block' }} />
                    Booked
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: '#d97706', fontWeight: 600 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', border: '2px dashed #f59e0b', display: 'inline-block' }} />
                    DOW pattern — avoid
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ts)', fontWeight: 600 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#1d4ed8', display: 'inline-block' }} />
                    Selected
                  </span>
                </div>
              </div>

              {errors.date && (
                <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{errors.date}</div>
              )}
            </div>

            {/* ── Right panel: time slots + DOW warning + notes ── */}
            <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {!selectedDate && (
                <div style={{
                  border: '1.5px dashed var(--ow2)', borderRadius: 12,
                  padding: '36px 24px', textAlign: 'center',
                  color: 'var(--ts)', fontSize: 13,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                  <div style={{ fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Pick a date</div>
                  <div style={{ fontSize: 12 }}>Select any available date on the calendar to see time slots</div>
                </div>
              )}

              {selectedDate && selectedDateBooked && (() => {
                const existing = bookedMap.get(selectedDate)!
                const isMissed = existing.status === 'missed'
                const isCompleted = existing.status === 'completed'
                
                const bgCol  = isMissed ? '#fff5f5' : isCompleted ? '#f0fdf4' : '#fff3cd'
                const brdCol = isMissed ? '#fca5a5' : isCompleted ? '#bbf7d0' : '#fcd34d'
                const txtCol = isMissed ? '#991b1b' : isCompleted ? '#166534' : '#92400e'
                const icon   = isMissed ? '❌' : isCompleted ? '✅' : '📅'
                const title  = isMissed ? 'Visit Missed' : isCompleted ? 'Visit Completed' : 'Already Booked'
                
                return (
                  <div style={{
                    background: bgCol, border: `1px solid ${brdCol}`,
                    borderRadius: 10, padding: '16px 18px',
                  }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: txtCol, marginBottom: 4 }}>
                      {icon} {title}
                    </div>
                    <div style={{ fontSize: 12, color: txtCol, lineHeight: 1.6 }}>
                      A visit is already {existing.status} on <strong>{selectedDateLabel}</strong>
                      {existing.scheduled_time
                        ? ` at ${TIME_DISPLAY[existing.scheduled_time] ?? existing.scheduled_time}`
                        : ''}.
                      <br />Please choose a different date from the calendar.
                    </div>
                  </div>
                )
              })()}

              {selectedDate && !selectedDateBooked && (
                <>
                  {/* Time slots */}
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 10 }}>
                      Available Slots —&nbsp;
                      <span style={{ fontWeight: 400, color: 'var(--ts)' }}>{selectedDateLabel}</span>
                      {selectedDow >= 0 && (
                        <span style={{
                          marginLeft: 8, fontSize: 10, fontWeight: 800, padding: '2px 8px',
                          borderRadius: 10, background: 'var(--g0)', color: 'var(--g7)',
                          border: '1px solid var(--g1)', letterSpacing: '0.03em',
                        }}>
                          {DOW_LABELS[selectedDow].toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
                      {TIME_SLOTS.map(slot => {
                        const active = selectedTime === slot
                        return (
                          <button
                            key={slot}
                            onClick={() => {
                              setSelectedTime(active ? null : slot)
                              setErrors(p => ({ ...p, time: '' }))
                            }}
                            style={{
                              padding: '11px 14px', borderRadius: 9, fontSize: 13, fontWeight: 600,
                              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'center',
                              transition: 'all 0.12s',
                              border: active ? '2px solid var(--g4)' : '1.5px solid var(--ow2)',
                              background: active ? 'var(--g7)' : '#fff',
                              color: active ? '#fff' : 'var(--td)',
                              boxShadow: active
                                ? '0 2px 10px rgba(52,160,110,0.22)'
                                : '0 1px 3px rgba(0,0,0,0.06)',
                            }}
                          >
                            {TIME_DISPLAY[slot]}
                          </button>
                        )
                      })}
                    </div>

                    {errors.time && (
                      <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 6 }}>{errors.time}</div>
                    )}
                  </div>

                  </>
              )}

              {/* Notes */}
              <div>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
                  Notes&nbsp;<span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                </label>
                <textarea
                  className="f-inp"
                  rows={3}
                  placeholder="e.g. Follow-up on last visit's Section B discrepancy."
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                />
              </div>

              {/* DOW warning — prominent, non-blocking */}
              {dowWarning && (
                <div style={{
                  padding: '14px 18px', borderRadius: 10,
                  background: '#fffbeb', border: '2px dashed #f59e0b',
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                }}>
                  <span style={{ fontSize: 22, flexShrink: 0 }}>⚠️</span>
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 800, color: '#92400e', marginBottom: 4 }}>
                      Avoid This Day — DOW Pattern Detected
                    </div>
                    <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                      You visited this location on a <strong>{dowWarning.dayLabel}</strong> on{' '}
                      <strong>{dowWarning.lastDate}</strong>{dowWarning.count > 1 ? ` and ${dowWarning.count - 1} other time${dowWarning.count > 2 ? 's' : ''}` : ''} in the last 4 weeks.
                      Repeating the same weekday reduces unpredictability and flags a compliance exception.
                    </div>
                    <div style={{ fontSize: 11, color: '#d97706', fontWeight: 600, marginTop: 8 }}>
                      ↩ Pick a different day of the week to avoid the compliance flag. (You can still submit — this is a warning only.)
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Submit row ── */}
          <div style={{ borderTop: '1px solid var(--ow2)', paddingTop: 18, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 28px', fontSize: 14 }}
              onClick={handleSubmit}
              disabled={saving}
            >
              {saving ? 'Scheduling…' : '📅 Schedule Visit'}
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('ctrl-dashboard')}>
              Cancel
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}