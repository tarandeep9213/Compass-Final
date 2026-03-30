import { useState, useMemo, useEffect } from 'react'
import { getLocation, todayStr } from '../../mock/data'
import { listLocations } from '../../api/locations'
import type { VerificationRecord } from '../../mock/data'
import { scheduleDgmVisit, cancelDgmVisit, listDgmVerifications } from '../../api/verifications'
import type { ApiVerification } from '../../api/types'

interface Props {
  dgmName: string
  locationIds: string[]
  ctx?: Record<string, string>   // ctx.locationId → pre-select from Dashboard
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const DOW_LABELS   = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_LABELS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

function padDate(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}
function monthYearOf(dateStr: string) {
  return dateStr.slice(0, 7)   // "YYYY-MM"
}

function mapApiVerification(v: ApiVerification): VerificationRecord {
  return {
    id: v.id, locationId: v.location_id, verifierName: v.verifier_name,
    type: v.verification_type === 'CONTROLLER' ? 'controller' : 'dgm',
    date: v.verification_date, monthYear: v.month_year ?? undefined,
    observedTotal: v.observed_total ?? undefined, notes: v.notes,
    dayOfWeek: v.day_of_week, warningFlag: v.warning_flag, status: v.status,
    missedReason: v.missed_reason ?? undefined, scheduledTime: v.scheduled_time ?? undefined,
  }
}

export default function DGMLog({ dgmName, locationIds, ctx, onNavigate }: Props) {
  const today = todayStr()

  // Pre-fill location from Dashboard context if valid
  const defaultLocation = (ctx?.locationId && locationIds.includes(ctx.locationId))
    ? ctx.locationId
    : (locationIds[0] ?? '')

  const [location,     setLocation]     = useState(defaultLocation)
  const [calYear,      setCalYear]      = useState(new Date().getFullYear())
  const [calMonth,     setCalMonth]     = useState(new Date().getMonth())
  const [selectedDate, setSelectedDate] = useState<string | null>(null)
  const [notes,        setNotes]        = useState('')
  const [errors,       setErrors]       = useState<Record<string, string>>({})
  const [submitted,    setSubmitted]    = useState<VerificationRecord | null>(null)
  const [saving,       setSaving]       = useState(false)
  const [refresh,      setRefresh]      = useState(0)
  const [fetchError,   setFetchError]   = useState('')

  const [apiVerifs, setApiVerifs] = useState<VerificationRecord[]>([])
  const [verifsLoaded, setVerifsLoaded] = useState(false)
  const [apiLocs, setApiLocs] = useState<{id:string;name:string;cost_center?:string|null}[]>([])
  useEffect(() => {
    setVerifsLoaded(false)
    listDgmVerifications({ page_size: 200 })
      .then(r => { setApiVerifs(r.items.map(mapApiVerification)); setVerifsLoaded(true) })
      .catch(() => setVerifsLoaded(true))
    listLocations()
      .then(locs => setApiLocs(locs.map(l => ({ id: l.id, name: l.name, cost_center: (l as unknown as {cost_center?:string|null}).cost_center ?? null }))))
      .catch(() => {})
  }, [refresh])

  // ── Calendar grid ──────────────────────────────────────────────────────
  const calCells = useMemo<(number | null)[]>(() => {
    const firstDow    = new Date(calYear, calMonth, 1).getDay()
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate()
    const cells: (number | null)[] = Array(firstDow).fill(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [calYear, calMonth])

// -- Booked months for selected location --------------------------------
  // DGM rule: ONE visit per location per calendar month.
  // Exception: If a visit is 'cancelled' or 'missed', the month is freed for a new booking.
  // Active visits (scheduled/completed) for this location — used for 30-day rolling block
  const activeVisits = useMemo<VerificationRecord[]>(() => {
    if (!location) return []
    let sessionUpdates: Record<string, { status: string }> = {}
    try {
      const saved = sessionStorage.getItem('dgm_session_updates')
      if (saved) sessionUpdates = JSON.parse(saved)
    } catch { /* ignore */ }

    return apiVerifs
      .filter(v => v.type === 'dgm' && v.locationId === location)
      .map(v => ({ ...v, status: (sessionUpdates[v.id]?.status || v.status) as VerificationRecord['status'] }))
      .filter(v => v.status === 'scheduled' || v.status === 'completed')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location, refresh, apiVerifs])

  // Check if a date is within 30 days of any active visit
  function getBlockingVisit(dateStr: string): VerificationRecord | undefined {
    const d = new Date(dateStr + 'T12:00:00').getTime()
    const THIRTY_DAYS = 30 * 24 * 3600 * 1000
    return activeVisits.find(v => {
      if (v.date === dateStr) return true // same date — already booked
      const vd = new Date(v.date + 'T12:00:00').getTime()
      return Math.abs(d - vd) < THIRTY_DAYS // strictly less than 30 days = blocked
    })
  }

  // Legacy compat — bookedMonths map for parts of UI that still reference it
  const bookedMonths = useMemo<Map<string, VerificationRecord>>(() => {
    const map = new Map<string, VerificationRecord>()
    activeVisits.forEach(v => {
      const my = v.monthYear ?? monthYearOf(v.date)
      if (!map.has(my)) map.set(my, v)
    })
    return map
  }, [activeVisits])

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
    setLocation(loc); setSelectedDate(null); setErrors({})
  }

  // ── Date cell click ────────────────────────────────────────────────────
  function handleDateSelect(dateStr: string) {
    if (dateStr < today) return          // past: not schedulable
    
    // We now allow selection even if the month is already visited/finalized 
    // so the DOM Caution warning can be displayed. Validation will still block submission.
    if (selectedDate === dateStr) { setSelectedDate(null); return }
    setSelectedDate(dateStr)
    setErrors(p => ({ ...p, date: '' }))
    setFetchError('')
  }

  // ── DOM Warning Check (3-month lookback) ────────────────────────────────
  const domWarning = useMemo(() => {
    if (!selectedDate) return null
    const selDate = new Date(selectedDate + 'T12:00:00')
    const selDOM = selDate.getDate()

    // Look for any visit in past 3 months (~92 days) on the same day-of-month
    const activeVisits = apiVerifs.filter(v =>
      v.type === 'dgm' && v.locationId === location &&
      (v.status === 'completed' || v.status === 'scheduled')
    )
    const matches = activeVisits.filter(v => {
      const vDate = new Date(v.date + 'T12:00:00')
      const diff = (selDate.getTime() - vDate.getTime()) / 86400000
      return vDate.getDate() === selDOM && diff > 0 && diff <= 92 && v.date !== selectedDate
    })

    if (matches.length === 0) return null
    const last = [...matches].sort((a, b) => b.date.localeCompare(a.date))[0]
    return {
      dayOfMonth: selDOM,
      lastDate: new Date(last.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }),
      count: matches.length,
    }
  }, [selectedDate, apiVerifs, location])

  // Helper to check DOM conflict for any date (for calendar indicators)
  function getDomConflict(dateStr: string): boolean {
    const d = new Date(dateStr + 'T12:00:00')
    const dom = d.getDate()
    return apiVerifs.some(v =>
      v.type === 'dgm' && v.locationId === location &&
      (v.status === 'completed' || v.status === 'scheduled') &&
      new Date(v.date + 'T12:00:00').getDate() === dom &&
      (d.getTime() - new Date(v.date + 'T12:00:00').getTime()) / 86400000 > 0 &&
      (d.getTime() - new Date(v.date + 'T12:00:00').getTime()) / 86400000 <= 92 &&
      v.date !== dateStr
    )
  }

  // ── Validate + submit ──────────────────────────────────────────────────
  function validate() {
    const e: Record<string, string> = {}
    if (!selectedDate)
      e.date = 'Please select a visit date from the calendar.'
    else {
      const blocker = getBlockingVisit(selectedDate)
      if (blocker && blocker.date !== selectedDate) {
        const days = Math.abs(Math.round((new Date(selectedDate + 'T12:00:00').getTime() - new Date(blocker.date + 'T12:00:00').getTime()) / 86400000))
        e.date = `Too close to existing visit on ${new Date(blocker.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${days} days away). Must be 30+ days apart.`
      } else if (blocker && blocker.date === selectedDate) {
        e.date = 'A visit is already scheduled for this date.'
      }
    }
    return e
  }

  async function handleSubmit() {
    const e = validate()
    if (Object.keys(e).length) { setErrors(e); return }
    setSaving(true)
    const dow = new Date(selectedDate! + 'T12:00:00').getDay()
    const my  = monthYearOf(selectedDate!)

    // New Schedule Flow
    const rec: VerificationRecord = {
        id:           `VER-DGM-SCH${Date.now()}`,
        locationId:   location,
        verifierName: dgmName,
        type:         'dgm',
        date:         selectedDate!,
        monthYear:    my,
        notes:        notes.trim(),
        dayOfWeek:    dow,
        // The warningFlag is saved as true if the DOM matches the last completed visit
        warningFlag:  !!domWarning,
        status:       'scheduled',
      }
      try {
        const res = await scheduleDgmVisit({
          location_id: location,
          date:        selectedDate!,
          notes:       notes.trim() || null,
        })
        rec.id = res.id
        setFetchError('')
      } catch (err) {
        const error = err instanceof Error ? err : new Error(String(err));
        const isNetworkError = error instanceof TypeError || error.message === 'Failed to fetch' || error.message === 'Network Error';
        if (!isNetworkError) {
          setFetchError(error.message || 'Failed to schedule visit. Validation error.');
          setSaving(false);
          return;
        }
        setFetchError('Could not reach the server. Please check your connection.')
    }
    setSaving(false)
    setSubmitted(rec)
  }

  function handleReset() {
    setSelectedDate(null); setNotes(''); setErrors({}); setSubmitted(null); setRefresh(r => r + 1)
  }

  // ── Success screen ─────────────────────────────────────────────────────
  if (submitted) {
    const sLoc       = getLocation(submitted.locationId)
    const sDateLabel = new Date(submitted.date + 'T12:00:00').toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    })
    const [y, m] = submitted.monthYear!.split('-')
    const mLabel = `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
    const isReschedule = (submitted as VerificationRecord & { _isReschedule?: boolean })._isReschedule

    return (
      <div className="fade-up">
        <div className="card" style={{ maxWidth: 520, margin: '0 auto', textAlign: 'center', padding: '44px 36px' }}>
          <div style={{ fontSize: 54, marginBottom: 14 }}>📅</div>
          <h2 style={{ fontFamily: 'DM Serif Display,serif', marginBottom: 8 }}>{isReschedule ? 'Visit Rescheduled' : 'Visit Scheduled'}</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13, marginBottom: 28 }}>
            Your monthly visit to{' '}
            <strong style={{ color: 'var(--td)' }}>{sLoc?.name ?? submitted.locationId}</strong>{' '}
            has been {isReschedule ? 'updated' : 'booked'}.
          </p>

          <div className="kpi-row" style={{ marginBottom: 24 }}>
            <div className="kpi">
              <div className="kpi-lbl">Location</div>
              <div style={{ fontSize: 12, fontWeight: 600, paddingTop: 6, color: 'var(--td)', lineHeight: 1.4 }}>
                {sLoc?.name ?? submitted.locationId}
              </div>
              <div className="kpi-sub">{submitted.locationId}</div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Scheduled Date</div>
              <div style={{ fontSize: 11, fontWeight: 600, paddingTop: 6, color: 'var(--td)', lineHeight: 1.5 }}>
                {sDateLabel}
              </div>
            </div>
            <div className="kpi">
              <div className="kpi-lbl">Coverage Month</div>
              <div style={{ fontSize: 13, fontWeight: 700, paddingTop: 6, color: 'var(--g7)' }}>
                {mLabel}
              </div>
            </div>
          </div>

          <div style={{
            background: 'var(--g0)', border: '1px solid var(--g1)',
            borderRadius: 8, padding: '12px 16px', fontSize: 12, color: 'var(--ts)',
            marginBottom: 22, textAlign: 'left', lineHeight: 1.65,
          }}>
            💡 On the day of your visit, open the <strong>Coverage Dashboard</strong> and click{' '}
            <strong>+ Log Visit</strong> on the location card to record the observed cash total.
          </div>

          {fetchError && (
            <div style={{
              background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
              padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 18, textAlign: 'left',
            }}>
              ⚠️ {fetchError} (Running locally)
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button className="btn btn-primary" onClick={() => onNavigate('dgm-dash')}>← Dashboard</button>
            <button className="btn btn-outline" onClick={handleReset}>+ Schedule Another</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Form ──────────────────────────────────────────────────────────────
  const selectedMonthYear     = selectedDate ? monthYearOf(selectedDate) : null
  const selectedBlocker       = selectedDate ? getBlockingVisit(selectedDate) : undefined
  const selectedIsVisitDay    = selectedBlocker?.date === selectedDate
  const selectedMonthBooked   = selectedMonthYear ? bookedMonths.has(selectedMonthYear) : false
  const existingVisit         = selectedBlocker || (selectedMonthYear ? bookedMonths.get(selectedMonthYear) : undefined)
  const selectedDateLabel     = selectedDate
    ? new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
      })
    : ''
  const selectedMonthLabel    = selectedMonthYear
    ? (() => {
        const [y, m] = selectedMonthYear.split('-')
        return `${MONTH_LABELS[parseInt(m) - 1]} ${y}`
      })()
    : ''

  // Months shown in current calendar view that are booked
  const calMonthYear = padDate(calYear, calMonth, 1).slice(0, 7)
  const calMonthBooked = bookedMonths.has(calMonthYear)
  const calMonthVisit  = bookedMonths.get(calMonthYear)

  return (
    <div className="fade-up">

      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 20 }}>
        <div>
          <h2>Schedule a Visit</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Select a location, then pick an available date — one visit allowed per location per month
          </p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('dgm-dash')}>
            ← Dashboard
          </button>
        </div>
      </div>

      {/* ── Form card ── */}
      <div className="card" style={{ maxWidth: 760 }}>
        <div className="card-header">
          <span className="card-title">Visit Details</span>
          <span className="card-sub">{dgmName}</span>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

          {/* ── Location ── */}
          <div>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
              Location *
            </label>
            <div style={{ position: 'relative' }}>
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
                  const loc = apiLocs.find(l => l.id === id) ?? getLocation(id)
                  const name = loc?.name ?? id
                  const cc = (loc as unknown as {cost_center?:string|null})?.cost_center
                  return <option key={id} value={id}>{name}{cc ? ` (CC: ${cc})` : ''}</option>
                })}
              </select>
            </div>
          </div>

          {/* ── Calendar + right panel ── */}
          <div style={{ display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* ── Calendar ── */}
            <div>
              <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 10 }}>
                Select Visit Date *
                <span style={{ fontWeight: 400, color: 'var(--ts)', marginLeft: 6 }}>
                  (one visit per location per month)
                </span>
              </label>

              {/* Month coverage banner */}
              {calMonthBooked && calMonthVisit && (
                <div style={{
                  marginBottom: 10, padding: '8px 14px', borderRadius: 8,
                  background: 'var(--g0)', border: '1px solid var(--g2)',
                  fontSize: 12, color: 'var(--g7)', fontWeight: 600,
                }}>
                  ✅ {MONTH_LABELS[calMonth]} {calYear} already has a visit on{' '}
                  {new Date(calMonthVisit.date + 'T12:00:00').toLocaleDateString('en-GB', {
                    day: 'numeric', month: 'short',
                  })}
                  {calMonthVisit.status === 'scheduled' ? ' (scheduled)' : ' (completed)'}
                </div>
              )}

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
                    {calMonthBooked && (
                      <span style={{
                        marginLeft: 8, fontSize: 9, fontWeight: 800, padding: '2px 6px',
                        borderRadius: 6, background: 'var(--g1)', color: 'var(--g7)',
                        letterSpacing: '0.04em', verticalAlign: 'middle',
                        textTransform: 'uppercase'
                      }}>
                        {calMonthVisit?.status === 'completed' ? 'VISITED' : calMonthVisit?.status === 'missed' ? 'MISSED' : 'SCHEDULED'}
                      </span>
                    )}
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

                {/* DOW headers */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', gap: '2px 0', marginBottom: 4 }}>
                  {DOW_LABELS.map(d => (
                    <div key={d} style={{
                      width: 40, textAlign: 'center', fontSize: 10,
                      fontWeight: 800, color: 'var(--ts)', paddingBottom: 6,
                      letterSpacing: '0.04em',
                    }}>{d.toUpperCase()}</div>
                  ))}
                </div>

                {/* Date cells */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 40px)', gap: 2 }}>
                  {calCells.map((day, idx) => {
                    if (day === null) return <div key={`e-${idx}`} style={{ width: 40, height: 40 }} />

                    const dateStr    = padDate(calYear, calMonth, day)
                    const isPast     = dateStr < today
                    const isToday    = dateStr === today
                    const isSelected = selectedDate === dateStr
                    const blocker    = !isPast ? getBlockingVisit(dateStr) : undefined
                    const isVisitDay = blocker?.date === dateStr
                    const isBlocked  = !isPast && !!blocker
                    const isDomWarn  = !isPast && !blocker && getDomConflict(dateStr)
                    const notClickable = isPast || isBlocked || !verifsLoaded

                    let bg     = 'transparent'
                    let color  = isPast ? '#c8c8c8' : 'var(--td)'
                    let border = 'none'
                    let fw     = 400

                    if (isSelected && !isBlocked) {
                      bg = isDomWarn ? '#f59e0b' : '#1d4ed8'; color = '#fff'; fw = 700
                    } else if (isVisitDay) {
                      bg = 'var(--g0)'; color = 'var(--g7)'; fw = 600
                    } else if (isBlocked) {
                      bg = '#fef2f2'; color = '#b91c1c'
                    } else if (isToday) {
                      border = `2px solid var(--g4)`; color = 'var(--g7)'; fw = 600
                    } else if (isDomWarn) {
                      bg = '#fffbeb'
                    }

                    const daysAway = blocker ? Math.abs(Math.round((new Date(dateStr + 'T12:00:00').getTime() - new Date(blocker.date + 'T12:00:00').getTime()) / 86400000)) : 0
                    let tooltip: string | undefined
                    if (isPast && !isToday)   tooltip = 'Past date — cannot schedule'
                    else if (isToday && !blocker) tooltip = 'Today'
                    else if (isVisitDay)      tooltip = `Visit ${blocker?.status} on this date`
                    else if (isBlocked)       tooltip = `Blocked — visit ${blocker?.status} on ${new Date(blocker!.date + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} (${daysAway} days away, must be 30+ days apart)`
                    else if (isDomWarn)       tooltip = `Caution — same day-of-month (${day}) visited recently. Consider a different date.`

                    return (
                      <div
                        key={day}
                        title={tooltip}
                        onClick={() => !notClickable && handleDateSelect(dateStr)}
                        style={{
                          width: 40, height: 40,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          borderRadius: '50%', background: bg, color, border,
                          fontSize: 13, fontWeight: fw,
                          cursor: notClickable ? 'not-allowed' : 'pointer',
                          position: 'relative',
                          opacity: isPast ? 0.4 : 1,
                          transition: 'background 0.1s, color 0.1s',
                          userSelect: 'none',
                        }}
                      >
                        {day}

                        {/* Green dot on the actual visit day */}
                        {isVisitDay && !isSelected && (
                          <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: 'var(--g7)' }} />
                        )}

                        {/* Red dot — blocked by 30-day rule */}
                        {isBlocked && !isVisitDay && !isSelected && (
                          <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#dc2626' }} />
                        )}

                        {/* Amber dot — DOM pattern */}
                        {isDomWarn && !isVisitDay && !isSelected && (
                          <span style={{ position: 'absolute', bottom: 4, left: '50%', transform: 'translateX(-50%)', width: 4, height: 4, borderRadius: '50%', background: '#d97706' }} />
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
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ts)', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#dc2626', display: 'inline-block' }} />
                    Blocked (30-day)
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ts)', fontWeight: 600 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#d97706', display: 'inline-block' }} />
                    DOM warning
                  </span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: 'var(--ts)', fontWeight: 600 }}>
                    <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#1d4ed8', display: 'inline-block' }} />
                    Selected
                  </span>
                </div>
              </div>
            </div>

            {/* ── Right panel ── */}
            <div style={{ flex: 1, minWidth: 240, display: 'flex', flexDirection: 'column', gap: 18 }}>

              {!selectedDate && (
                <div style={{
                  border: '1.5px dashed var(--ow2)', borderRadius: 12,
                  padding: '36px 24px', textAlign: 'center',
                  color: 'var(--ts)', fontSize: 13,
                }}>
                  <div style={{ fontSize: 32, marginBottom: 10 }}>📅</div>
                  <div style={{ fontWeight: 600, color: 'var(--td)', marginBottom: 4 }}>Pick a date</div>
                  <div style={{ fontSize: 12 }}>
                    Select any available date on the calendar. Months already visited are blocked.
                  </div>
                </div>
              )}

              {selectedDate && selectedBlocker && !selectedIsVisitDay && (
                <div style={{
                  background: '#fff3cd', border: '1px solid #fcd34d',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: '#92400e', marginBottom: 4 }}>
                    📅 Too Close to Existing Visit
                  </div>
                  <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.6 }}>
                    A visit is {selectedBlocker.status} on{' '}
                    <strong>
                      {new Date(selectedBlocker.date + 'T12:00:00').toLocaleDateString('en-GB', {
                        weekday: 'long', day: 'numeric', month: 'long',
                      })}
                    </strong>.
                    Visits must be at least 30 days apart. Select a date after{' '}
                    <strong>
                      {new Date(new Date(selectedBlocker.date + 'T12:00:00').getTime() + 30 * 86400000).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </strong>.
                  </div>
                </div>
              )}

              {selectedDate && existingVisit && existingVisit.status === 'scheduled' && existingVisit.date === selectedDate && (
                <div style={{
                  background: 'var(--g0)', border: '1px solid var(--g2)',
                  borderRadius: 10, padding: '16px 18px',
                }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--g7)', marginBottom: 4 }}>
                    ✅ Visit Already Scheduled
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--td)', lineHeight: 1.6 }}>
                    A DGM visit is already scheduled for <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</strong> at <strong>{getLocation(location)?.name ?? location}</strong>.
                    <br />Select a different date to reschedule, or go to the Dashboard to manage this visit.
                  </div>
                </div>
              )}

              {selectedDate && !selectedBlocker && (
                <>
                  {/* DOM Warning Alert */}
                  {domWarning && (
                    <div style={{
                      padding: '12px 16px', borderRadius: 8,
                      background: '#fffbeb', border: '1px solid #fcd34d',
                      display: 'flex', gap: 10, alignItems: 'flex-start'
                    }}>
                      <span style={{ fontSize: 16 }}>⚠️</span>
                      <div>
                        <div style={{ fontSize: 12, fontWeight: 700, color: '#92400e', marginBottom: 2 }}>
                          Caution — Same day-of-month pattern
                        </div>
                        <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.5 }}>
                          This location was visited on the <strong>{domWarning.dayOfMonth}th</strong> as recently as <strong>{domWarning.lastDate}</strong>.
                          Consider selecting a different date to vary your visit pattern.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Confirmation chip */}
                  <div style={{
                    padding: '14px 18px', borderRadius: 10,
                    background: 'var(--g0)', border: '1px solid var(--g2)',
                    fontSize: 13, color: 'var(--g7)',
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 4, letterSpacing: '0.03em' }}>
                          {existingVisit?.status === 'scheduled' ? 'RESCHEDULE VISIT' : 'MONTH AVAILABLE'}
                        </div>
                        <div style={{ fontWeight: 600 }}>
                          {selectedMonthLabel}
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 4 }}>
                          Scheduling visit for{' '}
                          <strong style={{ color: 'var(--td)' }}>{selectedDateLabel}</strong>
                          <span style={{
                            marginLeft: 8, fontSize: 10, fontWeight: 800, padding: '2px 7px',
                            borderRadius: 10, background: 'var(--g1)', color: 'var(--g7)',
                            border: '1px solid var(--g2)', letterSpacing: '0.03em',
                          }}>
                            {DOW_LABELS[new Date(selectedDate + 'T12:00:00').getDay()].toUpperCase()}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Notes */}
                  <div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: 'var(--td)', marginBottom: 6 }}>
                      Notes&nbsp;<span style={{ fontWeight: 400, color: 'var(--ts)' }}>(optional)</span>
                    </label>
                    <textarea
                      className="f-inp"
                      rows={4}
                      placeholder="e.g. Quarterly compliance review. Will check Sections A–I."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      style={{ width: '100%', resize: 'vertical', fontSize: 13 }}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Validation Error Message - Positioned here to prevent UI jumping */}
          {errors.date && (
            <div style={{ 
              fontSize: 12, color: 'var(--red)', fontWeight: 600, 
              background: '#fff1f2', border: '1px solid #fca5a5', 
              padding: '10px 14px', borderRadius: 8, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>⚠️</span> {errors.date}
            </div>
          )}

          {fetchError && (
            <div style={{
              fontSize: 12, color: 'var(--red)', fontWeight: 600,
              background: '#fff1f2', border: '1px solid #fca5a5',
              padding: '10px 14px', borderRadius: 8, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <span>⚠️</span> {fetchError}
            </div>
          )}

          {/* ── Submit row ── */}
          <div style={{ borderTop: '1px solid var(--ow2)', paddingTop: 18, display: 'flex', gap: 10 }}>
            <button
              className="btn btn-primary"
              style={{ padding: '10px 28px', fontSize: 14 }}
              onClick={handleSubmit}
              disabled={!selectedDate || !!selectedBlocker || saving}
            >
              {saving ? 'Saving…' : '📅 Schedule Visit'}
            </button>
            <button className="btn btn-ghost" onClick={() => onNavigate('dgm-dash')}>
              Back
            </button>
          </div>

        </div>
      </div>

    </div>
  )
}