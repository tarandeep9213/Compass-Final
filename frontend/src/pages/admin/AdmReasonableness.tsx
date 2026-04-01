import { useState, useMemo, useEffect, useCallback } from 'react'
import KpiCard from '../../components/KpiCard'
import { RTEST_STORE, formatCurrency } from '../../mock/data'
import type { RtReport, RtLocReport } from '../../mock/data'
import { listReports } from '../../api/reasonableness'
import type { RtReportApi, RtLocReportApi } from '../../api/reasonableness'
import { getToken } from '../../api/client'

interface Props {
  adminName: string
}

function fmtDate(d: string): string {
  if (!d) return ''
  try { return new Date(d + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) }
  catch { return d }
}

function fmtSigned(n: number) {
  return n < 0 ? `(${formatCurrency(Math.abs(n))})` : formatCurrency(n)
}

const PAGE_SIZE = 10

function pageNums(cur: number, total: number): (number | 'gap')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i)
  if (cur <= 3) return [0, 1, 2, 3, 'gap', total - 1]
  if (cur >= total - 4) return [0, 'gap', total - 4, total - 3, total - 2, total - 1]
  return [0, 'gap', cur - 1, cur, cur + 1, 'gap', total - 1]
}

// Convert API report to mock RtReport shape for existing UI code
function apiToRtReport(r: RtReportApi): RtReport {
  return {
    id: r.id,
    group: r.group_key,
    cc: r.cost_center,
    locLabels: r.location_labels,
    fromDate: r.from_date,
    toDate: r.to_date,
    factor: r.factor,
    preparer: r.preparer,
    scope: r.scope || '',
    locReports: (r.location_reports as RtLocReportApi[]).map(lr => ({
      locId: lr.loc_id,
      locLabel: lr.loc_label,
      total: lr.total,
      expectedFund: lr.expected_fund,
      actualFund: lr.actual_fund,
      over: lr.over,
      cushion: lr.cushion,
      net: lr.net,
      status: lr.status as 'Reasonable' | 'Overfunded',
      conclusion: lr.conclusion,
      requiredActions: lr.required_actions,
      actionDetails: lr.action_details,
    })),
    status: r.status as 'Reasonable' | 'Overfunded',
    savedAt: r.created_at,
    savedBy: r.saved_by,
  }
}

export default function AdmReasonableness({ adminName }: Props) {
  const [detailReport, setDetailReport] = useState<RtReport | null>(null)
  const [_tick, setTick] = useState(0)
  const [statusFilter, setStatusFilter] = useState<'all' | 'Overfunded' | 'Reasonable'>('all')
  const [page, setPage] = useState(0)
  const [apiReports, setApiReports] = useState<RtReport[] | null>(null)
  const [apiTotal, setApiTotal] = useState(0)
  const [apiReasonable, setApiReasonable] = useState(0)
  const [apiOverfunded, setApiOverfunded] = useState(0)
  const useApi = !!getToken()

  const fetchReports = useCallback(() => {
    if (!useApi) return
    const params: { status?: string; page?: number; page_size?: number } = { page: page + 1, page_size: PAGE_SIZE }
    if (statusFilter !== 'all') params.status = statusFilter
    listReports(params)
      .then(data => {
        setApiReports(data.items.map(apiToRtReport))
        setApiTotal(data.total)
      })
      .catch(() => setApiReports(null))  // fallback to mock
    // Also fetch totals for KPIs (get all without filter)
    listReports({ page: 1, page_size: 1 }).then(() => {
      listReports({ status: 'Reasonable', page: 1, page_size: 1 }).then(r => setApiReasonable(r.total))
      listReports({ status: 'Overfunded', page: 1, page_size: 1 }).then(o => setApiOverfunded(o.total))
    }).catch(() => {})
  }, [useApi, page, statusFilter])

  useEffect(() => { fetchReports() }, [fetchReports])

  // Force re-render to pick up new RTEST_STORE entries from controller screen
  function refresh() {
    if (useApi) fetchReports()
    else setTick(t => t + 1)
  }

  // Mock data path
  const mockAllReports = useMemo(() => [...RTEST_STORE].reverse(), [_tick])

  // Decide data source
  const allReportsCount = useApi && apiReports !== null ? apiTotal : mockAllReports.length
  const reasonable = useApi && apiReports !== null ? apiReasonable : mockAllReports.filter(r => r.status === 'Reasonable').length
  const overfunded = useApi && apiReports !== null ? apiOverfunded : mockAllReports.filter(r => r.status === 'Overfunded').length

  // Filtered reports (mock path only — API does server-side filtering)
  const mockFiltered = useMemo(() => {
    if (statusFilter === 'all') return mockAllReports
    return mockAllReports.filter(r => r.status === statusFilter)
  }, [mockAllReports, statusFilter])

  const reports = useApi && apiReports !== null ? apiReports : mockFiltered

  // Pagination
  const totalPages = useApi && apiReports !== null
    ? Math.max(1, Math.ceil(apiTotal / PAGE_SIZE))
    : Math.max(1, Math.ceil(mockFiltered.length / PAGE_SIZE))
  const pagedReports = useApi && apiReports !== null
    ? reports  // API already returns paged results
    : mockFiltered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleFilterToggle(filter: 'Overfunded' | 'Reasonable') {
    setStatusFilter(prev => prev === filter ? 'all' : filter)
    setPage(0)
  }

  // ── Detail modal ──────────────────────────────────────────────────────
  function openDetail(r: RtReport) { setDetailReport(r) }
  function closeDetail() { setDetailReport(null) }

  function handleRedownload(r: RtReport) {
    // Trigger a simple re-download of the report summary as HTML
    const lrs = r.locReports
    let html = `<!DOCTYPE html><html><head><meta charset="UTF-8">
<title>Cash Reasonableness — ${r.locLabels}</title>
<style>body{font-family:Calibri,sans-serif;font-size:11pt;margin:20px;color:#000}
table{border-collapse:collapse}td,th{border:1px solid #999;padding:3px 8px;font-size:10.5pt}
.hdr{font-weight:bold;background:#f2f2f2;min-width:160px}.y{background:#FFFF00}
.green{background:#EBF1DE;font-weight:bold}.hloc{background:#dce6f1;font-weight:bold;text-align:center}
.over{background:#FFC7CE;color:#9C0006;font-weight:bold}
.ok{background:#C6EFCE;color:#276221;font-weight:bold}.right{text-align:right}
@media print{.noprint{display:none}}</style></head><body>
<div class="noprint" style="margin-bottom:12px;padding:8px 12px;background:#e8f5e9;border:1px solid #4caf50;border-radius:4px">
<strong>CashRoom Compliance</strong> — Cash Reasonableness Test Report ·
<button onclick="window.print()" style="margin-left:8px;padding:4px 12px;background:#1f6138;color:#fff;border:none;border-radius:3px;cursor:pointer">Print / Save PDF</button></div>`

    html += `<table style="margin-bottom:12px"><tbody>
<tr><td class="hdr">Canteen Location:</td><td><strong>${r.locLabels}</strong></td></tr>
<tr><td class="hdr">Canteen Cost Center</td><td>${r.cc}</td></tr>
<tr><td class="hdr">Test Performed:</td><td>Cashier's Fund Reasonableness</td></tr>
<tr><td class="hdr">Prepared By:</td><td>${r.preparer}</td></tr>
<tr><td class="hdr">Date:</td><td>${fmtDate(r.savedAt.slice(0, 10))}</td></tr>
<tr><td class="hdr">Scope:</td><td>${r.scope || 'Daily Cashroom Reconciliations'}</td></tr>
<tr><td class="hdr">Period:</td><td>${fmtDate(r.fromDate)} – ${fmtDate(r.toDate)}</td></tr>
</tbody></table>`

    html += `<table style="margin-bottom:12px"><thead><tr>
<th style="background:#f2f2f2;width:280px">Highest Balance For:</th>`
    lrs.forEach(lr => { html += `<th class="hloc" style="min-width:130px">${lr.locLabel}</th>` })
    html += `<th style="background:#f2f2f2;min-width:200px">Comments</th></tr></thead><tbody>`

    html += `<tr><td style="font-weight:bold">Total (F+H+J+K)</td>`
    lrs.forEach(lr => { html += `<td class="right y">${formatCurrency(lr.total)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td>Factor (${r.factor})</td>`
    lrs.forEach(() => { html += `<td class="right y">${r.factor}</td>` })
    html += `<td></td></tr>`
    html += `<tr class="green"><td>Expected Fund Amount</td>`
    lrs.forEach(lr => { html += `<td class="right y">${formatCurrency(lr.expectedFund)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td style="font-weight:bold">Actual Fund Amount</td>`
    lrs.forEach(lr => { html += `<td class="right y">${formatCurrency(lr.actualFund)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td>Over/(Under) Funded By:</td>`
    lrs.forEach(lr => { html += `<td class="right ${lr.over > 0 ? 'over' : 'ok'}">${fmtSigned(lr.over)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td>Less Cushion Permitted</td>`
    lrs.forEach(lr => { html += `<td class="right">${fmtSigned(lr.cushion)}</td>` })
    html += `<td></td></tr>`
    html += `<tr><td style="font-weight:bold">Net Result</td>`
    lrs.forEach(lr => { html += `<td class="right ${lr.net > 0 ? 'over' : 'ok'}">${fmtSigned(lr.net)}</td>` })
    html += `<td></td></tr>`

    lrs.forEach(lr => {
      html += `<tr><td colspan="${lrs.length + 2}" style="border:none;height:8px"></td></tr>`
      html += `<tr><td class="hdr">Conclusion — ${lr.locLabel}</td><td colspan="${lrs.length + 1}">${lr.conclusion || '—'}</td></tr>`
      html += `<tr><td class="hdr">Required Actions</td><td colspan="${lrs.length + 1}">${lr.requiredActions === 'yes' ? (lr.actionDetails || 'Yes') : 'No'}</td></tr>`
    })
    html += `</tbody></table>`
    html += `<p style="font-size:9pt;color:#777;border-top:1px solid #ccc;padding-top:6px;margin-top:16px">Generated by CashRoom Compliance System · ${r.preparer}</p></body></html>`

    const blob = new Blob([html], { type: 'text/html' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `CashReasonableness_${r.locLabels.replace(/[\s/]/g, '_')}_${r.fromDate}_to_${r.toDate}.html`
    a.click()
    URL.revokeObjectURL(url)
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div className="fade-up">
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h2 style={{ fontFamily: 'DM Serif Display, serif', fontSize: 23 }}>Reasonableness Reports</h2>
          <p style={{ fontSize: 12.5, color: 'var(--ts)', marginTop: 2 }}>
            All Cash Reasonableness Test reports submitted by controllers
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={refresh}>↻ Refresh</button>
          <button className="btn btn-outline">⬇ Export All</button>
        </div>
      </div>

      {/* KPIs — clickable to filter */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        <KpiCard label="Total Reports" value={String(allReportsCount)}
          onClick={() => { setStatusFilter('all'); setPage(0) }} selected={statusFilter === 'all'}
          tooltip={{ what: 'Total reasonableness test reports submitted', how: 'Click to show all reports' }} />
        <KpiCard label="Reasonable" value={String(reasonable)} highlight="green"
          onClick={() => handleFilterToggle('Reasonable')} selected={statusFilter === 'Reasonable'}
          tooltip={{ what: 'Reports where net result is within acceptable range', how: 'Click to filter to reasonable reports only' }} />
        <KpiCard label="Overfunded" value={String(overfunded)} highlight={overfunded > 0 ? 'red' : undefined}
          onClick={() => handleFilterToggle('Overfunded')} selected={statusFilter === 'Overfunded'}
          tooltip={{ what: 'Reports where cash room holds excess funds', how: 'Click to filter to overfunded reports only', flag: overfunded > 0 ? 'Overfunded locations represent security and insurance risk' : undefined }} />
      </div>

      {/* Active filter indicator */}
      {statusFilter !== 'all' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: 12.5, color: 'var(--ts)' }}>
          Showing: <span className={`badge ${statusFilter === 'Overfunded' ? 'badge-red' : 'badge-green'}`}><span className="bdot"></span>{statusFilter}</span>
          <button onClick={() => { setStatusFilter('all'); setPage(0) }}
            style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, padding: '2px 8px', fontSize: 11, cursor: 'pointer', color: 'var(--ts)' }}>
            ✕ Clear filter
          </button>
          <span style={{ marginLeft: 'auto' }}>{reports.length} of {allReportsCount} reports</span>
        </div>
      )}

      {/* Reports Table */}
      <div className="card">
        <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>All Reports</span>
          <span style={{ fontSize: 12, color: 'var(--ts)' }}>Reviewed by: {adminName}</span>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <table className="dtable" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['Location', 'Cost Center', 'Last Test Date', 'Period Tested', 'Status', 'Notes', 'Factor', 'Prepared By', ''].map(h => (
                  <th key={h} style={{
                    fontSize: 10.5, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.07em',
                    padding: '9px 12px', background: 'var(--bg-muted, #f7f5f0)', borderBottom: '1px solid var(--border)', textAlign: 'left', whiteSpace: 'nowrap',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pagedReports.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: 'var(--ts)', padding: 24, fontSize: 13 }}>
                    {statusFilter !== 'all' ? `No ${statusFilter.toLowerCase()} reports found.` : 'No reports yet. Controllers generate these from the Cash Reasonableness Test tab.'}
                  </td>
                </tr>
              ) : pagedReports.map(r => {
                const notesPreview = r.locReports.map(lr => `${lr.locLabel}: ${(lr.conclusion || '—').slice(0, 35)}`).join(' | ')
                return (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{r.locLabels}</td>
                    <td style={{ padding: '10px 12px', fontSize: 11, fontFamily: 'monospace', color: 'var(--ts)' }}>{r.cc}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{fmtDate(r.savedAt.slice(0, 10))}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{fmtDate(r.fromDate)} – {fmtDate(r.toDate)}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {r.status === 'Overfunded'
                        ? <span className="badge badge-red"><span className="bdot"></span>Overfunded</span>
                        : <span className="badge badge-green"><span className="bdot"></span>Reasonable</span>
                      }
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--ts)', maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{notesPreview}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{r.factor}×</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{r.preparer}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => openDetail(r)}
                        style={{ padding: '5px 10px', fontSize: 11, borderRadius: 6, border: '1.5px solid var(--g4, #52b06e)', background: 'transparent', color: 'var(--g7, #1f6138)', cursor: 'pointer', fontWeight: 500 }}>
                        View
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: 'var(--ts)' }}>
              Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, useApi ? apiTotal : mockFiltered.length)} of {useApi ? apiTotal : mockFiltered.length}
            </span>
            <div style={{ display: 'flex', gap: 4 }}>
              <button disabled={page === 0} onClick={() => setPage(p => p - 1)}
                style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: page === 0 ? 'var(--bg-muted)' : '#fff', cursor: page === 0 ? 'default' : 'pointer', fontSize: 12, color: page === 0 ? 'var(--ts)' : 'var(--td)' }}>
                ← Prev
              </button>
              {pageNums(page, totalPages).map((n, i) =>
                n === 'gap' ? (
                  <span key={'gap' + i} style={{ padding: '4px 6px', fontSize: 12, color: 'var(--ts)' }}>…</span>
                ) : (
                  <button key={n} onClick={() => setPage(n)}
                    style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: n === page ? 'var(--g7, #1f6138)' : '#fff', color: n === page ? '#fff' : 'var(--td)', cursor: 'pointer', fontSize: 12, fontWeight: n === page ? 600 : 400 }}>
                    {n + 1}
                  </button>
                )
              )}
              <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}
                style={{ padding: '4px 10px', borderRadius: 5, border: '1px solid var(--border)', background: page >= totalPages - 1 ? 'var(--bg-muted)' : '#fff', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontSize: 12, color: page >= totalPages - 1 ? 'var(--ts)' : 'var(--td)' }}>
                Next →
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Modal ── */}
      {detailReport && (
        <div onClick={closeDetail} style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          background: 'rgba(0,0,0,.5)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 14, maxWidth: 820, width: '94%', maxHeight: '90vh', overflowY: 'auto',
            boxShadow: '0 24px 64px rgba(0,0,0,.3)',
          }}>
            {/* Modal header */}
            <div style={{
              padding: '18px 22px', borderBottom: '1px solid var(--border)',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              position: 'sticky', top: 0, background: '#fff', zIndex: 1,
            }}>
              <div style={{ fontFamily: 'DM Serif Display, serif', fontSize: 19 }}>
                Reasonableness Report — {detailReport.locLabels}
              </div>
              <button onClick={closeDetail} style={{
                background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--ts)',
                width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>✕</button>
            </div>

            {/* Modal body */}
            <div style={{ padding: 24 }}>
              {/* Info grid */}
              <div style={{
                background: 'var(--bg-muted, #f7f5f0)', borderRadius: 8, padding: 12, marginBottom: 14, fontSize: 13,
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10,
              }}>
                <div><span style={{ color: 'var(--ts)' }}>Location:</span> <strong>{detailReport.locLabels}</strong></div>
                <div><span style={{ color: 'var(--ts)' }}>Cost Center:</span> <strong>{detailReport.cc}</strong></div>
                <div><span style={{ color: 'var(--ts)' }}>Period:</span> <strong>{fmtDate(detailReport.fromDate)} – {fmtDate(detailReport.toDate)}</strong></div>
                <div><span style={{ color: 'var(--ts)' }}>Test Date:</span> <strong>{fmtDate(detailReport.savedAt.slice(0, 10))}</strong></div>
                <div><span style={{ color: 'var(--ts)' }}>Prepared By:</span> <strong>{detailReport.preparer}</strong></div>
                <div>
                  <span style={{ color: 'var(--ts)' }}>Overall Status:</span>{' '}
                  {detailReport.status === 'Overfunded'
                    ? <span className="badge badge-red"><span className="bdot"></span>Overfunded</span>
                    : <span className="badge badge-green"><span className="bdot"></span>Reasonable</span>
                  }
                </div>
              </div>

              {/* Per sub-location cards */}
              {detailReport.locReports.map((lr: RtLocReport) => (
                <div key={lr.locId} className="card" style={{ marginBottom: 10 }}>
                  <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13.5, fontWeight: 600 }}>{lr.locLabel}</span>
                    {lr.status === 'Overfunded'
                      ? <span className="badge badge-red" style={{ marginLeft: 8 }}><span className="bdot"></span>Overfunded</span>
                      : <span className="badge badge-green" style={{ marginLeft: 8 }}><span className="bdot"></span>Reasonable</span>
                    }
                  </div>
                  <div style={{ padding: 16, fontSize: 13 }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 10 }}>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Total (F+H+J+K)</div>
                        <strong>{formatCurrency(lr.total)}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Expected Fund</div>
                        <strong style={{ color: 'var(--g6, #3a9458)' }}>{formatCurrency(lr.expectedFund)}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Actual Fund</div>
                        <strong>{formatCurrency(lr.actualFund)}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Over/(Under)</div>
                        <strong style={{ color: lr.over > 0 ? 'var(--red, #dc2626)' : 'var(--g6, #3a9458)' }}>{fmtSigned(lr.over)}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Less Cushion</div>
                        <strong>{fmtSigned(lr.cushion)}</strong>
                      </div>
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Net Result</div>
                        <strong style={{ color: lr.net > 0 ? 'var(--red, #dc2626)' : 'var(--g6, #3a9458)' }}>{fmtSigned(lr.net)}</strong>
                      </div>
                    </div>
                    <div style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Conclusion</div>
                      <div style={{ background: 'var(--bg-muted, #f7f5f0)', borderRadius: 6, padding: '8px 12px' }}>{lr.conclusion || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '.04em', marginBottom: 3 }}>Required Actions</div>
                      <div style={{
                        background: lr.requiredActions === 'yes' ? '#fef2f2' : 'var(--bg-muted, #f7f5f0)',
                        borderRadius: 6, padding: '8px 12px',
                      }}>
                        {lr.requiredActions === 'yes' ? (lr.actionDetails || 'Yes — details not provided') : 'No'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}

              {/* Report metadata + re-download */}
              <div style={{
                background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8,
                padding: '10px 14px', fontSize: 11.5, color: '#2563eb', marginTop: 12,
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8,
              }}>
                <span>Report ID: {detailReport.id} · Saved: {new Date(detailReport.savedAt).toLocaleString()} · By: {detailReport.savedBy}</span>
                <button onClick={() => handleRedownload(detailReport)}
                  style={{ padding: '5px 14px', fontSize: 11, borderRadius: 6, border: '1.5px solid var(--g4, #52b06e)', background: 'transparent', color: 'var(--g7, #1f6138)', cursor: 'pointer', fontWeight: 500 }}>
                  ⬇ Re-download Report
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
