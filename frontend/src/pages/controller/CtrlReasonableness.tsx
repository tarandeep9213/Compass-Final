import { useState, useMemo, useCallback, useEffect } from 'react'
import KpiCard from '../../components/KpiCard'
import { LOCATION_GROUPS, rtGetMaxValues, formatCurrency, todayStr, RTEST_STORE } from '../../mock/data'
import type { LocationGroup, RtMaxValues, RtLocReport } from '../../mock/data'
import { getFiscalPeriod, groupByFiscalPeriod } from '../../utils/fiscal'
import type { PeriodGroup } from '../../utils/fiscal'
import { getLocationGroups, generateReport, saveReport as apiSaveReport } from '../../api/reasonableness'
import type { LocationGroupApi } from '../../api/reasonableness'
import { getToken } from '../../api/client'

interface Props {
  controllerName: string
  locationIds: string[]
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

// ── Helper: format with sign ──────────────────────────────────────────────
function fmtSigned(n: number) {
  return n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n)
}

// ── Calculation row for one sub-location ──────────────────────────────────
interface CalcRow {
  loc: { id: string; label: string; imprest: number }
  data: RtMaxValues | null
  total: number
  expectedFund: number
  actualFund: number
  over: number
  cushion: number
  net: number
}

export default function CtrlReasonableness({ controllerName }: Props) {
  // ── API vs mock mode ─────────────────────────────────────────────────
  const [apiGroups, setApiGroups] = useState<LocationGroupApi[] | null>(null)
  const useApi = !!getToken() && apiGroups !== null

  useEffect(() => {
    if (!getToken()) return  // demo mode — use mock data
    getLocationGroups()
      .then(groups => setApiGroups(groups))
      .catch(() => setApiGroups(null))  // fallback to mock
  }, [])

  // Adapt API groups to same shape as mock LOCATION_GROUPS
  const locationGroups: LocationGroup[] = useMemo(() => {
    if (apiGroups) {
      return apiGroups.map(g => ({
        group: g.group,
        costCenter: g.cost_center,
        label: g.label,
        subLocs: g.sub_locs.map(sl => ({ id: sl.id, label: sl.label, imprest: sl.imprest })),
        defaultFactor: g.default_factor,
      }))
    }
    return LOCATION_GROUPS
  }, [apiGroups])

  // ── Step state ────────────────────────────────────────────────────────
  const [step, setStep] = useState<1 | 2>(1)

  // ── Step 1: Parameter selection ────────────────────────────────────────
  const [selectedGroup, setSelectedGroup] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState(() => {
    // Default to last day of previous completed month
    const now = new Date()
    const lastDay = new Date(now.getFullYear(), now.getMonth(), 0)
    const y = lastDay.getFullYear()
    const m = String(lastDay.getMonth() + 1).padStart(2, '0')
    const d = String(lastDay.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  })
  const [factor, setFactor] = useState('')
  const [preparer, setPreparer] = useState(controllerName)
  const [scope, setScope] = useState('')
  const [error, setError] = useState('')

  // ── Step 2: Calculation results ────────────────────────────────────────
  const [calcRows, setCalcRows] = useState<CalcRow[]>([])
  const [cushions, setCushions] = useState<Record<string, number>>({})
  const [conclusions, setConclusions] = useState<Record<string, string>>({})
  const [reqActions, setReqActions] = useState<Record<string, string>>({})
  const [actionDetails, setActionDetails] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [saved, setSaved] = useState(false)

  const today = todayStr()

  // RT-004: Date picker must block current and future months.
  // Latest selectable date = last day of the most recently completed month.
  const maxSelectableDate = useMemo(() => {
    const now = new Date()
    // First day of current month, then go back 1 day = last day of previous month
    const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
    const y = lastDayPrevMonth.getFullYear()
    const m = String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')
    const d = String(lastDayPrevMonth.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }, [])

  // ── Derived: selected group config ─────────────────────────────────────
  const groupConfig: LocationGroup | undefined = useMemo(
    () => locationGroups.find(g => g.group === selectedGroup),
    [selectedGroup]
  )

  // ── Auto-fill on location change ───────────────────────────────────────
  const handleGroupChange = useCallback((val: string) => {
    setSelectedGroup(val)
    const g = locationGroups.find(lg => lg.group === val)
    if (g && !factor) setFactor(String(g.defaultFactor))
  }, [factor])

  // ── Generate report ────────────────────────────────────────────────────
  function handleGenerate() {
    if (!selectedGroup) { setError('Please select a location.'); return }
    if (!fromDate) { setError('Please select a start date.'); return }
    if (!toDate) { setError('Please select an end date.'); return }
    if (fromDate > toDate) { setError('Start date must be before end date.'); return }
    if (!factor) { setError('Please select a factor multiplier.'); return }
    setError('')

    const g = locationGroups.find(lg => lg.group === selectedGroup)
    if (!g) return
    const f = parseFloat(factor)

    function applyRows(rows: CalcRow[]) {
      setCalcRows(rows)
      const c: Record<string, number> = {}
      rows.forEach(r => { c[r.loc.id] = -5000 })
      setCushions(c)
      setConclusions({})
      setReqActions({})
      setActionDetails({})
      setCompleted({})
      setSaved(false)
      setStep(2)
    }

    if (useApi) {
      generateReport({
        location_ids: g.subLocs.map(sl => sl.id),
        from_date: fromDate,
        to_date: toDate,
        factor: f,
      }).then(resp => {
        const rows: CalcRow[] = resp.calculations.map(calc => {
          const loc = g.subLocs.find(sl => sl.id === calc.loc_id) || { id: calc.loc_id, label: calc.loc_label, imprest: 0 }
          const total = calc.total
          const expectedFund = total * f
          const actualFund = calc.actual_fund
          const cushion = -5000
          const over = actualFund - expectedFund
          const net = over + cushion
          const data: RtMaxValues = {
            maxF: calc.max_f, maxH: calc.max_h, maxJ: calc.max_j, maxK: calc.max_k,
            total: calc.total, actualFund: calc.actual_fund,
            sectionAData: calc.section_a_data, avgSA: calc.avg_sa, count: calc.count,
          }
          return { loc, data, total, expectedFund, actualFund, over, cushion, net }
        })
        applyRows(rows)
      }).catch(err => {
        setError(`API error: ${err.message}. Falling back to mock data.`)
        // Fallback to mock
        const rows: CalcRow[] = g.subLocs.map(loc => {
          const data = rtGetMaxValues(loc.id, fromDate, toDate)
          const total = data ? data.total : 0
          const expectedFund = total * f
          const actualFund = data ? data.actualFund : 0
          const cushion = -5000
          const over = actualFund - expectedFund
          const net = over + cushion
          return { loc, data, total, expectedFund, actualFund, over, cushion, net }
        })
        applyRows(rows)
      })
    } else {
      // Mock mode
      const rows: CalcRow[] = g.subLocs.map(loc => {
        const data = rtGetMaxValues(loc.id, fromDate, toDate)
        const total = data ? data.total : 0
        const expectedFund = total * f
        const actualFund = data ? data.actualFund : 0
        const cushion = -5000
        const over = actualFund - expectedFund
        const net = over + cushion
        return { loc, data, total, expectedFund, actualFund, over, cushion, net }
      })
      applyRows(rows)
    }
  }

  // ── Recalc when cushion changes ────────────────────────────────────────
  function updateCushion(locId: string, val: number) {
    setCushions(prev => ({ ...prev, [locId]: val }))
  }

  // Recompute rows with updated cushions
  const liveCalcRows: CalcRow[] = useMemo(() => {
    return calcRows.map(r => {
      const c = cushions[r.loc.id] ?? -5000
      return { ...r, cushion: c, net: r.over + c }
    })
  }, [calcRows, cushions])

  // ── Period label ───────────────────────────────────────────────────────
  const periodLabel = useMemo(() => {
    if (!fromDate || !toDate) return ''
    const fp1 = getFiscalPeriod(fromDate)
    const fp2 = getFiscalPeriod(toDate)
    return fp1.p === fp2.p ? fp1.label : `${fp1.p} – ${fp2.p} FY${fp2.fy}`
  }, [fromDate, toDate])

  // ── Section A data ─────────────────────────────────────────────────────
  const sectionAGroups: { loc: { id: string; label: string }; periods: PeriodGroup[] }[] = useMemo(() => {
    return liveCalcRows.map(cr => ({
      loc: cr.loc,
      periods: cr.data ? groupByFiscalPeriod(cr.data.sectionAData) : [],
    }))
  }, [liveCalcRows])

  const allPeriodKeys: string[] = useMemo(() => {
    const keys: string[] = []
    sectionAGroups.forEach(lpg => {
      lpg.periods.forEach(pg => {
        const key = pg.p + '|' + pg.fy
        if (!keys.includes(key)) keys.push(key)
      })
    })
    return keys.sort()
  }, [sectionAGroups])

  const masterDates: string[] = useMemo(() => {
    if (!fromDate || !toDate) return []
    const dates: string[] = []
    const cur = new Date(fromDate + 'T12:00:00')
    const end = new Date(toDate + 'T12:00:00')
    while (cur <= end) {
      dates.push(cur.toISOString().slice(0, 10))
      cur.setDate(cur.getDate() + 1)
    }
    return dates
  }, [fromDate, toDate])

  // ── Mark complete ──────────────────────────────────────────────────────
  function handleMarkComplete(locId: string) {
    const conc = conclusions[locId] || ''
    if (conc.trim().length < 5) { alert('Please enter a conclusion note (min 5 characters).'); return }
    const req = reqActions[locId]
    if (!req) { alert('Please select Yes/No for Required Actions.'); return }
    if (req === 'yes') {
      const det = actionDetails[locId] || ''
      if (det.trim().length < 5) { alert('Please enter action details (min 5 characters).'); return }
    }
    setCompleted(prev => ({ ...prev, [locId]: true }))
  }

  // ── Save to admin dashboard ────────────────────────────────────────────
  function handleSave() {
    if (!groupConfig) return
    const locReports: RtLocReport[] = liveCalcRows.map(cr => ({
      locId: cr.loc.id,
      locLabel: cr.loc.label,
      total: cr.total,
      expectedFund: cr.expectedFund,
      actualFund: cr.actualFund,
      over: cr.over,
      cushion: cr.cushion,
      net: cr.net,
      status: cr.net > 0 ? 'Overfunded' as const : 'Reasonable' as const,
      conclusion: conclusions[cr.loc.id] || '',
      requiredActions: reqActions[cr.loc.id] || 'no',
      actionDetails: actionDetails[cr.loc.id] || '',
    }))
    const overallStatus = locReports.some(r => r.status === 'Overfunded') ? 'Overfunded' as const : 'Reasonable' as const

    if (useApi) {
      apiSaveReport({
        group_key: selectedGroup,
        cost_center: groupConfig.costCenter,
        location_labels: groupConfig.subLocs.map(l => l.label).join(' / '),
        from_date: fromDate,
        to_date: toDate,
        factor: parseFloat(factor),
        preparer, scope,
        status: overallStatus,
        location_reports: locReports.map(lr => ({
          loc_id: lr.locId, loc_label: lr.locLabel,
          total: lr.total, expected_fund: lr.expectedFund,
          actual_fund: lr.actualFund, over: lr.over,
          cushion: lr.cushion, net: lr.net,
          status: lr.status, conclusion: lr.conclusion,
          required_actions: lr.requiredActions, action_details: lr.actionDetails,
        })),
      }).then(() => {
        setSaved(true)
        alert('Report saved to Admin → Reasonableness Reports.')
      }).catch(err => {
        alert(`Save failed: ${err.message}. Saving locally.`)
        // Fallback to mock store
        RTEST_STORE.push({
          id: 'rt_' + Date.now(), group: selectedGroup, cc: groupConfig!.costCenter,
          locLabels: groupConfig!.subLocs.map(l => l.label).join(' / '),
          fromDate, toDate, factor: parseFloat(factor), preparer, scope, locReports,
          status: overallStatus, savedAt: new Date().toISOString(), savedBy: controllerName,
        })
        setSaved(true)
      })
    } else {
      RTEST_STORE.push({
        id: 'rt_' + Date.now(), group: selectedGroup, cc: groupConfig.costCenter,
        locLabels: groupConfig.subLocs.map(l => l.label).join(' / '),
        fromDate, toDate, factor: parseFloat(factor), preparer, scope, locReports,
        status: overallStatus, savedAt: new Date().toISOString(), savedBy: controllerName,
      })
      setSaved(true)
      alert('Report saved to Admin → Reasonableness Reports.')
    }
  }

  // ── Download HTML report ───────────────────────────────────────────────
  function handleDownload() {
    if (!groupConfig) return
    const f = parseFloat(factor)
    const lrs = liveCalcRows

    // Build Section A period groups for export
    const locPeriodGroups = lrs.map(cr => ({
      loc: cr.loc,
      periods: cr.data ? groupByFiscalPeriod(cr.data.sectionAData) : [],
    }))
    const expPeriodKeys: string[] = []
    locPeriodGroups.forEach(lpg => {
      lpg.periods.forEach(pg => {
        const key = pg.p + '|' + pg.fy
        if (!expPeriodKeys.includes(key)) expPeriodKeys.push(key)
      })
    })
    expPeriodKeys.sort()

    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Cash Reasonableness — ${lrs.map(r => r.loc.label).join('/')}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:20px;color:#000}
table{border-collapse:collapse}td,th{border:1px solid #999;padding:3px 8px;font-size:10.5pt}
.hdr{font-weight:bold;background:#f2f2f2;min-width:160px}.y{background:#FFFF00}
.green{background:#EBF1DE;font-weight:bold}.hloc{background:#dce6f1;font-weight:bold;text-align:center}
.tot{background:#D7E4BC;font-weight:bold}.over{background:#FFC7CE;color:#9C0006;font-weight:bold}
.ok{background:#C6EFCE;color:#276221;font-weight:bold}.right{text-align:right}
.peak{background:#EBF1DE;font-weight:bold}.avgrow{background:#EBF1DE;font-weight:bold}
@media print{.noprint{display:none}}</style></head><body>
<div class="noprint" style="margin-bottom:12px;padding:8px 12px;background:#e8f5e9;border:1px solid #4caf50;border-radius:4px">
<strong>CashRoom Compliance</strong> — Cash Reasonableness Test Report ·
<button onclick="window.print()" style="margin-left:8px;padding:4px 12px;background:#1f6138;color:#fff;border:none;border-radius:3px;cursor:pointer">Print / Save PDF</button></div>`

    // Header table
    html += `<table style="margin-bottom:12px"><tbody>
<tr><td class="hdr">Canteen Location:</td><td><strong>${lrs.map(r => r.loc.label).join(' / ')}</strong></td></tr>
<tr><td class="hdr">Canteen Cost Center</td><td>${groupConfig.costCenter}</td></tr>
<tr><td class="hdr">Test Performed:</td><td>Cashier's Fund Reasonableness</td></tr>
<tr><td class="hdr">Prepared By:</td><td>${preparer}</td></tr>
<tr><td class="hdr">Date:</td><td>${fmtDate(today)}</td></tr>
<tr><td class="hdr">Scope:</td><td>${scope || 'Daily Cashroom Reconciliations'}</td></tr>
<tr><td class="hdr">Period:</td><td>${fmtDate(fromDate)} – ${fmtDate(toDate)} (${periodLabel})</td></tr>
</tbody></table>`

    // Calculation table
    html += `<table style="margin-bottom:12px"><thead><tr><th style="background:#f2f2f2;width:280px">Highest Balance For:</th>`
    lrs.forEach(r => { html += `<th class="hloc" style="min-width:130px">${r.loc.label}</th>` })
    html += `<th style="background:#f2f2f2;min-width:200px">Comments</th></tr></thead><tbody>`

    const lineItems = [
      { label: 'Uncounted Funds (Form 403 - Line F)', field: 'maxF' as const },
      { label: 'Outstanding Changers/Includes Driver Funds (Form 403 - Line H)', field: 'maxH' as const },
      { label: 'Replenishment (Form 403 - Line J)', field: 'maxJ' as const },
      { label: 'Coin Purchase in Transit (Line K) - Regular', field: 'maxK' as const },
    ]
    lineItems.forEach(li => {
      html += `<tr><td>${li.label}</td>`
      lrs.forEach(r => { html += `<td class="right y">${formatCurrency(r.data?.[li.field] ?? 0)}</td>` })
      html += `<td></td></tr>`
    })
    html += `<tr class="tot"><td>Total</td>`
    lrs.forEach(r => { html += `<td class="right y">${formatCurrency(r.total)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td>Factor (${f})</td>`
    lrs.forEach(() => { html += `<td class="right y">${f}</td>` })
    html += `<td>1.25 single / 1.50 multiple cashrooms</td></tr>`
    html += `<tr><td colspan="${lrs.length + 2}" style="border:none;height:6px"></td></tr>`
    html += `<tr class="green"><td>Expected Fund Amount</td>`
    lrs.forEach(r => { html += `<td class="right y">${formatCurrency(r.expectedFund)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td colspan="${lrs.length + 2}" style="border:none;height:6px"></td></tr>`
    html += `<tr><td style="font-weight:bold">Actual Fund Amount</td>`
    lrs.forEach(r => { html += `<td class="right y">${formatCurrency(r.actualFund)}</td>` })
    html += `<td>Highest Cashier's Fund Balance</td></tr>`
    html += `<tr><td>Over/(Under) Funded By:</td>`
    lrs.forEach(r => { html += `<td class="right ${r.over > 0 ? 'over' : 'ok'}">${fmtSigned(r.over)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td>Less Cushion Permitted</td>`
    lrs.forEach(r => { html += `<td class="right">${fmtSigned(r.cushion)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td style="font-weight:bold">Net Result</td>`
    lrs.forEach(r => { html += `<td class="right ${r.net > 0 ? 'over' : 'ok'}">${fmtSigned(r.net)}</td>` })
    html += `<td></td></tr>`

    // Conclusions
    lrs.forEach(r => {
      html += `<tr><td colspan="${lrs.length + 2}" style="border:none;height:8px"></td></tr>`
      html += `<tr><td style="font-weight:bold;background:#f2f2f2">Conclusion — ${r.loc.label}</td>`
      html += `<td colspan="${lrs.length + 1}">${conclusions[r.loc.id] || '—'}</td></tr>`
      html += `<tr><td style="font-weight:bold;background:#f2f2f2">Required Actions</td>`
      const ra = reqActions[r.loc.id]
      html += `<td colspan="${lrs.length + 1}">${ra === 'yes' ? (actionDetails[r.loc.id] || 'Yes — see notes') : 'No'}</td></tr>`
    })
    html += `</tbody></table>`

    // Section A
    html += `<p style="font-weight:bold;margin-top:18px">Note — Loose currency in the room after the deposit has been prepared:<br>
<span style="font-weight:normal">[Section A on the Daily Room Count Sheet]</span></p>`
    html += `<table style="margin-bottom:12px"><thead><tr><th style="background:#f2f2f2;width:110px">Date</th>`
    locPeriodGroups.forEach(lpg => {
      html += `<th colspan="${expPeriodKeys.length}" class="hloc">${lpg.loc.label}</th>`
    })
    html += `</tr><tr><th style="background:#f2f2f2"></th>`
    locPeriodGroups.forEach(lpg => {
      expPeriodKeys.forEach(pk => {
        const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
        html += `<th class="hloc" style="min-width:90px">${pg ? pg.p : '—'}</th>`
      })
    })
    html += `</tr></thead><tbody>`
    masterDates.forEach(ds => {
      const fp = getFiscalPeriod(ds)
      const hasData = locPeriodGroups.some(lpg => lpg.periods.some(pg => pg.rows.some(r => r.date === ds)))
      if (!hasData) return
      html += `<tr><td>${fmtDate(ds)}</td>`
      locPeriodGroups.forEach(lpg => {
        const allSA = lpg.periods.flatMap(pg => pg.rows.map(r => r.sA))
        const peakSA = allSA.length ? Math.max(...allSA) : 0
        expPeriodKeys.forEach(pk => {
          const pKey = fp.p + '|' + fp.fy
          if (pk === pKey) {
            const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
            const rowEntry = pg?.rows.find(r => r.date === ds)
            const val = rowEntry?.sA ?? null
            html += `<td class="right${val !== null && val === peakSA ? ' peak' : ''}">${val !== null ? formatCurrency(val) : ''}</td>`
          } else {
            html += `<td style="background:#f9f9f9"></td>`
          }
        })
      })
      html += `</tr>`
    })
    // Average row
    html += `<tr class="avgrow"><td class="right">Average</td>`
    locPeriodGroups.forEach(lpg => {
      expPeriodKeys.forEach(pk => {
        const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
        const avg = pg && pg.rows.length ? pg.rows.reduce((s, r) => s + r.sA, 0) / pg.rows.length : null
        html += `<td class="right y">${avg !== null ? formatCurrency(avg) : '—'}</td>`
      })
    })
    html += `</tr></tbody></table>`
    html += `<p style="font-size:9pt;color:#777;border-top:1px solid #ccc;padding-top:6px;margin-top:16px">Generated by CashRoom Compliance System · ${fmtDate(today)} · ${preparer}</p></body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CashReasonableness_${lrs.map(r => r.loc.label.replace(/\s/g, '_')).join('_')}_${fromDate}_to_${toDate}.html`
    a.click()
    URL.revokeObjectURL(url)

    if (!saved) handleSave()
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 23 }}>Cash Reasonableness Test</h2>
          <p style={{ fontSize: 12.5, color: 'var(--ts)', marginTop: 2 }}>
            Cashier's Fund Reasonableness Report — generates Excel template B.1.4
          </p>
        </div>
        {step === 2 && (
          <button className="btn btn-outline" onClick={() => setStep(1)}>← Back to Parameters</button>
        )}
      </div>

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Quarterly Test" value={periodLabel || 'Select dates'} tooltip={{ what: 'Fiscal period for this reasonableness test', how: 'Fiscal year runs Oct 1 – Sep 30. Periods P1 (Oct) through P12 (Sep).' }} />
        <KpiCard label="Locations" value={String(locationGroups.reduce((s, g) => s + g.subLocs.length, 0))} sub="active cash rooms" tooltip={{ what: 'Number of active cash room locations', how: 'Count of all sub-locations across all cost center groups' }} />
        <KpiCard label="Reports Saved" value={String(RTEST_STORE.length)} highlight={RTEST_STORE.length > 0 ? 'green' : 'gray'} tooltip={{ what: 'Reasonableness reports saved this session', how: 'Reports saved to Admin dashboard via the Save button' }} />
      </div>

      {/* ═══ STEP 1 — Parameter Selection ═══ */}
      {step === 1 && (
        <div className="card">
          <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
            <span style={{ fontSize: 13.5, fontWeight: 600 }}>Step 1 — Select Parameters</span>
          </div>
          <div style={{ padding: 16, maxWidth: 700 }}>
            {error && (
              <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 8, padding: '10px 14px', fontSize: 13, color: '#991b1b', marginBottom: 14 }}>
                {error}
              </div>
            )}

            {/* Location */}
            <div style={{ marginBottom: 13 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                Cash Room Location <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <select className="inp" value={selectedGroup} onChange={e => handleGroupChange(e.target.value)}
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)' }}>
                <option value="">— Select location —</option>
                {locationGroups.map(g => (
                  <option key={g.group} value={g.group}>
                    {g.label}{g.subLocs.length > 1 ? ` (Unit ${g.costCenter} — incl. sub-locations)` : ''}
                  </option>
                ))}
              </select>
            </div>

            {/* Auto-filled fields */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 13 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>Cost Center</label>
                <input readOnly value={groupConfig?.costCenter || ''} placeholder="Auto-filled"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: '#e5e5e5', color: 'var(--ts)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>Sub-Locations</label>
                <input readOnly value={groupConfig?.subLocs.map(l => l.label).join(', ') || ''} placeholder="Auto-filled"
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: '#e5e5e5', color: 'var(--ts)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Date range */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 13 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Date Range From <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input type="date" value={fromDate} max={maxSelectableDate} onChange={e => setFromDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)', boxSizing: 'border-box' }} />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Date Range To <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <input type="date" value={toDate} max={maxSelectableDate} onChange={e => setToDate(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Factor + Prepared By */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 13 }}>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                  Factor Multiplier <span style={{ color: 'var(--red)' }}>*</span>
                </label>
                <select value={factor} onChange={e => setFactor(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)' }}>
                  <option value="">— Select factor —</option>
                  <option value="1.25">1.25 — Single Cash Room</option>
                  <option value="1.5">1.50 — Multiple Cash Rooms</option>
                </select>
                <div style={{ fontSize: 11.5, color: 'var(--ts)', marginTop: 4 }}>1.25 for one cashroom · 1.50 if 2+ cashrooms within unit</div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>Prepared By</label>
                <input value={preparer} onChange={e => setPreparer(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)', boxSizing: 'border-box' }} />
              </div>
            </div>

            {/* Scope */}
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>Scope Description</label>
              <input value={scope} onChange={e => setScope(e.target.value)} placeholder="e.g. Daily Cashroom Reconciliations for P4 and P5, FY2026"
                style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)', boxSizing: 'border-box' }} />
            </div>

            <button onClick={handleGenerate}
              style={{ width: '100%', padding: 12, borderRadius: 8, border: 'none', background: 'var(--g7, #1f6138)', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>
              Generate Reasonableness Report →
            </button>
          </div>
        </div>
      )}

      {/* ═══ STEP 2 — Results ═══ */}
      {step === 2 && liveCalcRows.length > 0 && (
        <>
          {/* Header info strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16, background: 'var(--bg-muted, #f7f5f0)', borderRadius: 8, padding: 12, fontSize: 12.5 }}>
            <div><span style={{ color: 'var(--ts)' }}>Location:</span> <strong>{groupConfig?.subLocs.map(l => l.label).join(' / ')}</strong></div>
            <div><span style={{ color: 'var(--ts)' }}>Cost Center:</span> <strong>{groupConfig?.costCenter}</strong></div>
            <div><span style={{ color: 'var(--ts)' }}>Prepared By:</span> <strong>{preparer}</strong></div>
            <div><span style={{ color: 'var(--ts)' }}>Period:</span> <strong>{periodLabel}</strong></div>
          </div>

          {/* ── Calculation Table ── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Step 2 — Reasonableness Calculation</span>
              <span style={{ fontSize: 12, color: 'var(--ts)' }}>{fmtDate(fromDate)} – {fmtDate(toDate)}</span>
            </div>
            <div style={{ padding: 16, overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%', fontFamily: 'Calibri, sans-serif', fontSize: 12, border: '2px solid #aaa' }}>
                <thead>
                  <tr>
                    <th style={{ background: '#f2f2f2', border: '1px solid #ccc', padding: '5px 10px', width: 280, textAlign: 'left' }}>Highest Balance For:</th>
                    {liveCalcRows.map(cr => (
                      <th key={cr.loc.id} style={{ background: '#dce6f1', border: '1px solid #ccc', padding: '5px 8px', textAlign: 'center', minWidth: 130 }}>{cr.loc.label}</th>
                    ))}
                    <th style={{ background: '#f2f2f2', border: '1px solid #ccc', padding: '5px 10px', minWidth: 200, textAlign: 'left' }}>Comments</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Line items */}
                  {[
                    { label: 'Uncounted Funds (Form 403 - Line F)', field: 'maxF' as const },
                    { label: 'Outstanding Changers/Includes Driver Funds (Form 403 - Line H)', field: 'maxH' as const },
                    { label: 'Replenishment (Form 403 - Line J)', field: 'maxJ' as const },
                    { label: 'Coin Purchase in Transit (Line K) - Regular', field: 'maxK' as const },
                  ].map(li => (
                    <tr key={li.field}>
                      <td style={{ border: '1px solid #ccc', padding: '3px 10px' }}>{li.label}</td>
                      {liveCalcRows.map(cr => (
                        <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '3px 8px', textAlign: 'right', background: '#FFFF99' }}>
                          {formatCurrency(cr.data?.[li.field] ?? 0)}
                        </td>
                      ))}
                      <td style={{ border: '1px solid #ccc', padding: '3px 8px' }}></td>
                    </tr>
                  ))}
                  {/* Total */}
                  <tr style={{ background: '#D7E4BC' }}>
                    <td style={{ border: '1px solid #ccc', padding: '4px 10px', fontWeight: 'bold' }}>Total</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', background: '#FFFF00' }}>
                        {formatCurrency(cr.total)}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px', fontSize: 10, color: '#666' }}>Sum of Line F + H + J + K</td>
                  </tr>
                  {/* Factor */}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '3px 10px' }}>Factor ({factor})</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '3px 8px', textAlign: 'center', background: '#FFFF99', fontWeight: 'bold' }}>{factor}</td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px', fontSize: 10, color: '#555' }}>1.25 single / 1.50 multiple cashrooms</td>
                  </tr>
                  {/* Spacer */}
                  <tr><td colSpan={liveCalcRows.length + 2} style={{ border: 'none', height: 6, background: 'transparent' }}></td></tr>
                  {/* Expected Fund */}
                  <tr style={{ background: '#EBF1DE' }}>
                    <td style={{ border: '1px solid #ccc', padding: '4px 10px', fontWeight: 'bold' }}>Expected Fund Amount</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold', background: '#FFFF00' }}>
                        {formatCurrency(cr.expectedFund)}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px' }}></td>
                  </tr>
                  {/* Spacer */}
                  <tr><td colSpan={liveCalcRows.length + 2} style={{ border: 'none', height: 6, background: 'transparent' }}></td></tr>
                  {/* Actual Fund */}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '3px 10px', fontWeight: 'bold' }}>Actual Fund Amount</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '3px 8px', textAlign: 'right', fontWeight: 'bold', background: '#f9f9f9' }}>
                        {formatCurrency(cr.actualFund)}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px', fontSize: 10, color: '#555' }}>Highest Cashier's Fund Balance from cashroom forms</td>
                  </tr>
                  {/* Over/Under */}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '3px 10px' }}>Over/(Under) Funded By:</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{
                        border: '1px solid #ccc', padding: '3px 8px', textAlign: 'right', fontWeight: 'bold',
                        background: cr.over > 0 ? '#FFC7CE' : '#C6EFCE',
                        color: cr.over > 0 ? '#9C0006' : '#276221',
                      }}>
                        {fmtSigned(cr.over)}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px' }}></td>
                  </tr>
                  {/* Cushion (editable) */}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '3px 10px' }}>Less Cushion Permitted</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{ border: '1px solid #ccc', padding: '2px 6px', textAlign: 'right' }}>
                        <input
                          type="number" value={cushions[cr.loc.id] ?? -5000} step={100}
                          onChange={e => updateCushion(cr.loc.id, parseFloat(e.target.value) || -5000)}
                          style={{ width: '100%', border: '1px solid #ccc', padding: '2px 4px', textAlign: 'right', fontFamily: 'Calibri, sans-serif', fontSize: 12, boxSizing: 'border-box' }}
                        />
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px', fontSize: 10, color: '#555' }}>Default –$5,000 · Editable</td>
                  </tr>
                  {/* Net Result */}
                  <tr>
                    <td style={{ border: '1px solid #ccc', padding: '4px 10px', fontWeight: 'bold' }}>Net Result</td>
                    {liveCalcRows.map(cr => (
                      <td key={cr.loc.id} style={{
                        border: '1px solid #ccc', padding: '4px 8px', textAlign: 'right', fontWeight: 'bold',
                        background: cr.net > 0 ? '#FFC7CE' : '#C6EFCE',
                        color: cr.net > 0 ? '#9C0006' : '#276221',
                      }}>
                        {fmtSigned(cr.net)}
                      </td>
                    ))}
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px' }}></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Section A — Daily Data ── */}
          <div className="card" style={{ marginBottom: 16 }}>
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13.5, fontWeight: 600 }}>Section A — Daily Data (Compare Periods)</span>
              <div style={{ fontSize: 12, color: 'var(--ts)', marginTop: 2 }}>Loose currency in the room after deposit has been prepared [Section A on Daily Room Count Sheet]</div>
            </div>
            <div style={{ padding: 16, overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', fontFamily: 'Calibri, sans-serif', fontSize: 11.5, border: '2px solid #aaa' }}>
                <thead>
                  {/* Row 1: location headers */}
                  <tr>
                    <th style={{ background: '#f2f2f2', border: '1px solid #ccc', padding: '4px 8px', width: 110 }}>SECTION A</th>
                    {sectionAGroups.map(lpg => (
                      <th key={lpg.loc.id} colSpan={allPeriodKeys.length} style={{ background: '#dce6f1', border: '1px solid #ccc', padding: '4px 10px', textAlign: 'center' }}>
                        {lpg.loc.label}
                      </th>
                    ))}
                  </tr>
                  {/* Row 2: period sub-headers */}
                  <tr>
                    <th style={{ background: '#f2f2f2', border: '1px solid #ccc', padding: '3px 6px' }}>Date</th>
                    {sectionAGroups.map(lpg =>
                      allPeriodKeys.map(pk => {
                        const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
                        return (
                          <th key={lpg.loc.id + pk} style={{ background: '#dce6f1', border: '1px solid #ccc', padding: '3px 8px', textAlign: 'center', minWidth: 90 }}>
                            {pg ? pg.p : '—'}
                          </th>
                        )
                      })
                    )}
                  </tr>
                </thead>
                <tbody>
                  {masterDates.map(ds => {
                    const fp = getFiscalPeriod(ds)
                    const hasData = sectionAGroups.some(lpg => lpg.periods.some(pg => pg.rows.some(r => r.date === ds)))
                    if (!hasData) return null
                    return (
                      <tr key={ds}>
                        <td style={{ border: '1px solid #ccc', padding: '2px 8px', whiteSpace: 'nowrap' }}>{fmtDate(ds)}</td>
                        {sectionAGroups.map(lpg => {
                          const allSA: number[] = lpg.periods.flatMap(pg => pg.rows.map(r => r.sA))
                          const peakSA = allSA.length ? Math.max(...allSA) : 0
                          return allPeriodKeys.map(pk => {
                            const pKey = fp.p + '|' + fp.fy
                            if (pk === pKey) {
                              const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
                              const rowEntry = pg?.rows.find(r => r.date === ds)
                              const val = rowEntry?.sA ?? null
                              const isPeak = val !== null && val === peakSA
                              return (
                                <td key={lpg.loc.id + pk} style={{
                                  border: '1px solid #ccc', padding: '2px 8px', textAlign: 'right',
                                  ...(isPeak ? { background: '#EBF1DE', fontWeight: 'bold' } : {}),
                                }}>
                                  {val !== null ? formatCurrency(val) : ''}
                                </td>
                              )
                            }
                            return <td key={lpg.loc.id + pk} style={{ border: '1px solid #ccc', padding: '2px 8px', background: '#f9f9f9' }}></td>
                          })
                        })}
                      </tr>
                    )
                  })}
                  {/* Average row */}
                  <tr style={{ background: '#EBF1DE', fontWeight: 'bold' }}>
                    <td style={{ border: '1px solid #ccc', padding: '3px 8px', textAlign: 'right' }}>Average</td>
                    {sectionAGroups.map(lpg =>
                      allPeriodKeys.map(pk => {
                        const pg = lpg.periods.find(p => (p.p + '|' + p.fy) === pk)
                        const avg = pg && pg.rows.length ? pg.rows.reduce((s, r) => s + r.sA, 0) / pg.rows.length : null
                        return (
                          <td key={lpg.loc.id + pk} style={{ border: '1px solid #ccc', padding: '3px 8px', textAlign: 'right', background: '#FFFF00' }}>
                            {avg !== null ? formatCurrency(avg) : '—'}
                          </td>
                        )
                      })
                    )}
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Conclusions per location ── */}
          {liveCalcRows.map(cr => {
            const isOver = cr.net > 0
            const isDone = completed[cr.loc.id]
            return (
              <div key={cr.loc.id} className="card" style={{ marginBottom: 12, opacity: isDone ? 0.65 : 1 }}>
                <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 13.5, fontWeight: 600 }}>Conclusion — {cr.loc.label}</span>
                  <span className={`badge ${isOver ? 'badge-red' : 'badge-green'}`}>
                    <span className="bdot"></span>{isOver ? 'Overfunded' : 'Reasonable'}
                  </span>
                </div>
                <div style={{ padding: 16 }}>
                  <div style={{ marginBottom: 13 }}>
                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                      Conclusion Notes <span style={{ color: 'var(--red)' }}>*</span>
                    </label>
                    <textarea
                      value={conclusions[cr.loc.id] || ''} disabled={isDone}
                      onChange={e => setConclusions(prev => ({ ...prev, [cr.loc.id]: e.target.value }))}
                      placeholder="e.g. Funds are reasonable, driver bags were reduced due to Loomis schedule."
                      style={{ width: '100%', minHeight: 70, padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 13 }}>
                    <div>
                      <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>Required Actions</label>
                      <select
                        value={reqActions[cr.loc.id] || ''} disabled={isDone}
                        onChange={e => setReqActions(prev => ({ ...prev, [cr.loc.id]: e.target.value }))}
                        style={{ width: '100%', padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, background: 'var(--bg-muted)' }}>
                        <option value="">— Select —</option>
                        <option value="no">No</option>
                        <option value="yes">Yes</option>
                      </select>
                    </div>
                    {reqActions[cr.loc.id] === 'yes' && (
                      <div>
                        <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--tm)', marginBottom: 5, letterSpacing: '.04em', textTransform: 'uppercase' }}>
                          Action Details <span style={{ color: 'var(--red)' }}>*</span>
                        </label>
                        <textarea
                          value={actionDetails[cr.loc.id] || ''} disabled={isDone}
                          onChange={e => setActionDetails(prev => ({ ...prev, [cr.loc.id]: e.target.value }))}
                          placeholder="Describe corrective actions required..."
                          style={{ width: '100%', minHeight: 55, padding: '9px 12px', borderRadius: 7, border: '1.5px solid var(--border)', fontSize: 13.5, fontFamily: 'inherit', resize: 'vertical', boxSizing: 'border-box' }}
                        />
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    {!isDone ? (
                      <button onClick={() => handleMarkComplete(cr.loc.id)}
                        style={{ padding: '8px 20px', borderRadius: 7, border: 'none', background: 'var(--g7, #1f6138)', color: '#fff', fontSize: 12.5, fontWeight: 500, cursor: 'pointer' }}>
                        ✓ Confirm & Mark Complete
                      </button>
                    ) : (
                      <span className="badge badge-green" style={{ fontSize: 13, padding: '7px 14px' }}>
                        <span className="bdot"></span>✓ Completed
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )
          })}

          {/* ── Action Buttons ── */}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border)' }}>
            <button onClick={handleDownload}
              style={{ padding: '10px 20px', borderRadius: 7, border: 'none', background: 'var(--g7, #1f6138)', color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
              Generate & Download Report
            </button>
            <button onClick={handleSave}
              style={{ padding: '10px 20px', borderRadius: 7, border: '1.5px solid var(--g4, #52b06e)', background: 'transparent', color: 'var(--g7, #1f6138)', fontSize: 13, fontWeight: 500, cursor: 'pointer' }}>
              Save to Admin Dashboard
            </button>
            {saved && (
              <div style={{ background: '#d6f0dc', border: '1px solid #84cc96', borderRadius: 8, padding: '8px 14px', fontSize: 12.5, color: '#1a4d30', alignSelf: 'center' }}>
                ✓ Report saved to Admin dashboard
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Date formatting helper ────────────────────────────────────────────────
function fmtDate(d: string): string {
  if (!d) return ''
  try {
    return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  } catch { return d }
}
