import { useMemo, useState, useEffect } from 'react'
import { formatCurrency, todayStr } from '../../mock/data'
import { listLocations } from '../../api/locations'
import { getSectionTrends } from '../../api/reports'
import type { SectionTrends } from '../../api/types'
import KpiCard from '../../components/KpiCard'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

interface Props { adminName: string }

function formatCC(cc: string | undefined | null): string {
  if (!cc || cc === 'null' || cc === 'undefined') return 'N/A';
  return cc.toString().replace(/^loc-/i, '').toUpperCase();
}

type Granularity = 'daily' | 'weekly' | 'monthly' | 'quarterly'

// Section labels matching the operator cash form (Sections A–L)
const SECTIONS = [
  { key: 'secA', label: 'Currency',                                      short: 'A', color: '#2563eb' },
  { key: 'secB', label: 'Rolled Coin',                                   short: 'B', color: '#059669' },
  { key: 'secC', label: 'Coins in Counting Machines (Sorter/Counter)',   short: 'C', color: '#7c3aed' },
  { key: 'secD', label: 'Bagged Coin (Full for Bank)',                   short: 'D', color: '#db2777' },
  { key: 'secE', label: 'Unissued Changer Funds in Cashroom or Vault',   short: 'E', color: '#d97706' },
  { key: 'secF', label: 'Returned but Uncounted Manual Change',          short: 'F', color: '#64748b' },
  { key: 'secG', label: 'Mutilated Currency, Foreign, and/or Bent Coin', short: 'G', color: '#e11d48' },
  { key: 'secH', label: 'Changer Funds Outstanding',                     short: 'H', color: '#0891b2' },
  { key: 'secI', label: 'Net Unreimbursed Bill Changer',                 short: 'I', color: '#8b5cf6' },
  { key: 'secJ', label: 'Coin Purchase in transit to/from bank',         short: 'J', color: '#f59e0b' },
  { key: 'secK', label: "Total Cashier's Fund - TODAY",                  short: 'K', color: '#10b981' },
  { key: 'secL', label: 'Variance - Short or (Over)',                    short: 'L', color: '#65a30d' },
]

type DataPoint = { period: string; [key: string]: string | number }

// ── Period options ─────────────────────────────────────────────────────────
const PERIOD_OPTIONS: Record<Granularity, { label: string; n: number }[]> = {
  daily:     [{ label: '7 days',  n: 7  }, { label: '14 days', n: 14 }, { label: '30 days', n: 30 }],
  weekly:    [{ label: '8 wks',   n: 8  }, { label: '12 wks',  n: 12 }, { label: '24 wks',  n: 24 }],
  monthly:   [{ label: '6 mo',    n: 6  }, { label: '12 mo',   n: 12 }],
  quarterly: [{ label: '4 qtrs',  n: 4  }, { label: '8 qtrs',  n: 8  }],
}

// ── CSV export ─────────────────────────────────────────────────────────────
function downloadCSV(chartData: DataPoint[], sectionKey: string, activeSecLabel: string, locationId: string, granularity: Granularity, allLocs: {id:string;name:string}[]) {
  const locName = locationId === 'all' ? 'All Locations' : (allLocs.find(l => l.id === locationId)?.name || locationId)
  const headers = ['Location', 'Period', 'Granularity', `Section ${activeSecLabel}`]
  const rows: string[][] = chartData.map(pt => {
    const val = pt[sectionKey] !== undefined ? String(pt[sectionKey]) : '0'
    return [locName, pt.period, granularity, val]
  })
  const csv = [headers, ...rows]
    .map(row => row.map(cell => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = `cash-trends-${granularity}-${todayStr()}.csv`
  a.click()
  URL.revokeObjectURL(url)
}

function calcPeriodsFromRange(gran: Granularity, from: string, to: string): number {
  const ms   = new Date(to + 'T00:00:00').getTime() - new Date(from + 'T00:00:00').getTime()
  const days = Math.max(1, Math.ceil(ms / 86400000) + 1)
  if (gran === 'daily')     return Math.min(days, 90)
  if (gran === 'weekly')    return Math.min(Math.ceil(days / 7), 52)
  if (gran === 'monthly')   return Math.min(Math.ceil(days / 30), 24)
  return Math.min(Math.ceil(days / 91), 12)
}

// ── Component ──────────────────────────────────────────────────────────────
export default function RcTrends({ adminName }: Props) {
  const today = todayStr()

  const [granularity,    setGranularity]    = useState<Granularity>('monthly')
  const [periodN,        setPeriodN]        = useState(6)
  const [useCustomRange, setUseCustomRange] = useState(false)
  const [customFrom,     setCustomFrom]     = useState('')
  const [customTo,       setCustomTo]       = useState(today)
  const [locationId,     setLocationId]     = useState('all')
  const [sectionKey,     setSectionKey]     = useState('secA')
  const [apiTrends,      setApiTrends]      = useState<SectionTrends | null>(null)
  const [apiLocs,        setApiLocs]        = useState<{id:string;name:string;active:boolean;cost_center?:string|null}[]>([])
  const [fetchError,     setFetchError]     = useState('')
  const [isLoading,      setIsLoading]      = useState(false)

  useEffect(() => {
    listLocations().then(locs => setApiLocs(locs.map(l => ({
      id: l.id, name: l.name, active: l.active,
      cost_center: (l as unknown as {cost_center?:string|null}).cost_center ?? null,
    })))).catch(() => {})
  }, [])

  const allLocs = apiLocs

  const activeSec = SECTIONS.find(s => s.key === sectionKey)!

  const effectivePeriodN = useCustomRange && customFrom && customTo
    ? calcPeriodsFromRange(granularity, customFrom, customTo)
    : periodN

  function handleGranularityChange(g: Granularity) {
    setGranularity(g)
    setPeriodN(PERIOD_OPTIONS[g][0].n)
    setUseCustomRange(false)
  }

  useEffect(() => {
    setIsLoading(true)
    setFetchError('')
    getSectionTrends({
      section:     activeSec.short,
      granularity: granularity,
      periods:     effectivePeriodN,
      location_id: locationId === 'all' ? undefined : locationId,
    }).then(data => {
      setApiTrends(data)
    }).catch((err) => {
      setApiTrends(null)
      const error = err instanceof Error ? err : new Error(String(err))
      setFetchError(error.message || 'Failed to load trends data.')
    }).finally(() => setIsLoading(false))
  }, [sectionKey, granularity, effectivePeriodN, locationId]) // eslint-disable-line react-hooks/exhaustive-deps

  const chartData = useMemo((): DataPoint[] => {
    if (!apiTrends?.data?.length) return []
    return apiTrends.data.map(p => ({ period: p.period, [sectionKey]: p.avg_total }))
  }, [apiTrends, sectionKey])

  const values    = chartData.map((r: DataPoint) => Number(r[sectionKey] ?? 0))
  const latest    = values.length > 0 ? values[values.length - 1] : 0
  const prev      = values.length > 1 ? values[values.length - 2] : latest
  const avg       = values.length > 0 ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0
  const peak      = values.length > 0 ? Math.max(...values) : 0
  const total     = values.reduce((a, b) => a + b, 0)
  const pctChange = prev > 0 ? ((latest - prev) / prev) * 100 : 0
  const changeUp  = pctChange >= 0

  const periodUnit = granularity === 'daily' ? 'days' : granularity === 'weekly' ? 'wks' : granularity === 'monthly' ? 'mo' : 'qtrs'

  return (
    <div className="fade-up">
      {/* ── Header ── */}
      <div className="ph" style={{ marginBottom: 18 }}>
        <div>
          <h2>Cash Count Trends</h2>
          <p style={{ color: 'var(--ts)', fontSize: 13 }}>
            Section totals per submission over time · {adminName}
          </p>
        </div>
        <div className="ph-right">
          <button
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}
            onClick={() => downloadCSV(chartData, sectionKey, activeSec.label, locationId, granularity, allLocs)}
          >
            ↓ Download CSV
          </button>
        </div>
      </div>

      {fetchError && (
        <div style={{
          background: '#fff5f5', border: '1px solid #fca5a5', borderRadius: 8,
          padding: '10px 14px', fontSize: 12, color: 'var(--red)', marginBottom: 18,
          display: 'flex', alignItems: 'center', gap: 8
        }}>
          <span>⚠️</span> {fetchError}
        </div>
      )}

      {/* ── Filter bar ── */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-body" style={{ padding: '16px 20px', display: 'flex', gap: 28, flexWrap: 'wrap', alignItems: 'flex-start' }}>

          {/* Granularity + Custom range */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ts)', letterSpacing: '0.06em', marginBottom: 8 }}>GRANULARITY</div>
            <div style={{ display: 'flex', borderRadius: 8, overflow: 'hidden', border: '1px solid var(--ow2)' }}>
              {(['daily', 'weekly', 'monthly', 'quarterly'] as Granularity[]).map(g => (
                <button key={g} onClick={() => handleGranularityChange(g)} style={{
                  padding: '6px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border: 'none', outline: 'none',
                  background: granularity === g ? 'var(--g7)' : '#fff',
                  color:      granularity === g ? '#fff'      : 'var(--ts)',
                  fontWeight: granularity === g ? 700         : 400,
                  textTransform: 'capitalize',
                }}>
                  {g}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 10, flexWrap: 'wrap' }}>
              <button onClick={() => setUseCustomRange(v => !v)} style={{
                padding: '5px 14px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 7,
                border:     `1px solid ${useCustomRange ? 'var(--g4)' : 'var(--ow2)'}`,
                background: useCustomRange ? 'var(--g0)' : '#fff',
                color:      useCustomRange ? 'var(--g7)' : 'var(--ts)',
                fontWeight: useCustomRange ? 700 : 400,
              }}>
                Custom range
              </button>
              {useCustomRange && (
                <>
                  <input type="date" className="f-inp" value={customFrom} max={customTo || today}
                    onChange={e => setCustomFrom(e.target.value)}
                    style={{ fontSize: 12, width: 140 }} />
                  <span style={{ fontSize: 12, color: 'var(--ts)' }}>→</span>
                  <input type="date" className="f-inp" value={customTo} max={today}
                    onChange={e => setCustomTo(e.target.value)}
                    style={{ fontSize: 12, width: 140 }} />
                  {customFrom && customTo && (
                    <span style={{ fontSize: 11, color: 'var(--ts)' }}>
                      ({effectivePeriodN} {periodUnit})
                    </span>
                  )}
                </>
              )}
            </div>
          </div>

          {/* Period */}
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ts)', letterSpacing: '0.06em', marginBottom: 8 }}>LAST</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {PERIOD_OPTIONS[granularity].map(opt => (
                <button key={opt.n} onClick={() => { setPeriodN(opt.n); setUseCustomRange(false) }} style={{
                  padding: '6px 12px', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', borderRadius: 7,
                  border:     `1px solid ${!useCustomRange && periodN === opt.n ? 'var(--g4)' : 'var(--ow2)'}`,
                  background: !useCustomRange && periodN === opt.n ? 'var(--g0)' : '#fff',
                  color:      !useCustomRange && periodN === opt.n ? 'var(--g7)' : 'var(--ts)',
                  fontWeight: !useCustomRange && periodN === opt.n ? 700 : 400,
                }}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Location pills */}
          <div style={{ flex: 1, minWidth: 260 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--ts)', letterSpacing: '0.06em', marginBottom: 8 }}>LOCATION</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button
                onClick={() => setLocationId('all')}
                style={{
                  padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                  border:     `1.5px solid ${locationId === 'all' ? 'var(--g4)' : 'var(--ow2)'}`,
                  background: locationId === 'all' ? 'var(--g7)' : '#fff',
                  color:      locationId === 'all' ? '#fff'      : 'var(--ts)',
                  fontWeight: locationId === 'all' ? 700 : 400,
                }}
              >
                All
              </button>
              {allLocs.filter(l => l.active).map(l => {
                const cc = formatCC(l.cost_center);
                return (
                  <button
                    key={l.id}
                    onClick={() => setLocationId(l.id)}
                    title={`${l.name} (CC: ${cc})`}
                    style={{
                      padding: '5px 14px', borderRadius: 20, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit',
                      border:     `1.5px solid ${locationId === l.id ? 'var(--g4)' : 'var(--ow2)'}`,
                      background: locationId === l.id ? 'var(--g7)' : '#fff',
                      color:      locationId === l.id ? '#fff'      : 'var(--td)',
                      fontWeight: locationId === l.id ? 700 : 400,
                      maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}
                  >
                    {l.name} (CC: {cc})
                  </button>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* ── Section tabs ── */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 18 }}>
        {SECTIONS.map(s => {
          const active = sectionKey === s.key
          return (
            <button
              key={s.key}
              onClick={() => setSectionKey(s.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 7,
                padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: active ? 700 : 500,
                cursor: 'pointer', fontFamily: 'inherit',
                border:     `1.5px solid ${active ? s.color : 'var(--ow2)'}`,
                background: active ? s.color : '#fff',
                color:      active ? '#fff'  : 'var(--td)',
                boxShadow:  active ? `0 2px 8px ${s.color}40` : 'none',
                transition: 'all 0.15s',
              }}
            >
              <span style={{
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                width: 18, height: 18, borderRadius: 5, flexShrink: 0,
                background: active ? 'rgba(255,255,255,0.25)' : `${s.color}20`,
                color:      active ? '#fff' : s.color,
                fontSize: 10, fontWeight: 800,
              }}>
                {s.short}
              </span>
              {s.label}
            </button>
          )
        })}
      </div>

      {/* ── KPI summary ── */}
      <div className="kpi-row" style={{ marginBottom: 18 }}>
        <KpiCard
          label="Latest"
          value={formatCurrency(latest)}
          sub={pctChange === 0 ? '—' : `${changeUp ? '▲' : '▼'} ${Math.abs(pctChange).toFixed(1)}% vs prev`}
          accent={activeSec.color}
          tooltip={{
            what: "The most recent period's section total from the selected location and time range.",
            how: "Takes the last data point in the chart series. The % change shown below compares it to the immediately preceding period.",
            formula: "current_period_value vs previous_period_value; change = (current - prev) / prev x 100",
          }}
        />
        <KpiCard
          label="Average"
          value={formatCurrency(avg)}
          sub={`across ${chartData.length} ${periodUnit}`}
          tooltip={{
            what: "Mean section total across all periods in the selected range.",
            how: "Sums all data points in the chart and divides by the number of periods.",
            formula: "sum(period values) / COUNT(periods)",
          }}
        />
        <KpiCard
          label="Peak"
          value={formatCurrency(peak)}
          sub="highest in range"
          tooltip={{
            what: "The highest section total recorded across all periods in the selected range.",
            how: "Simple maximum of all data points in the chart series.",
            formula: "MAX(period values)",
          }}
        />
        <KpiCard
          label={`Total (${chartData.length} ${periodUnit})`}
          value={formatCurrency(total)}
          sub={`${activeSec.label} sum`}
          accent={activeSec.color}
          tooltip={{
            what: "Sum of the selected section's values across all periods in the range.",
            how: "Adds up every data point in the chart. Useful for understanding cumulative cash volume over time.",
            formula: "sum(all period values)",
          }}
        />
        <KpiCard
          label="Section"
          value={<span style={{ fontSize: 22, fontFamily: 'DM Sans,sans-serif', fontWeight: 700, color: activeSec.color }}>{activeSec.short}</span>}
          sub={activeSec.label}
          tooltip={{
            what: "The currently selected cash form section being charted.",
            how: "Sections A-L correspond to different cash categories from the operator's daily submission form. Select a different section using the tabs above the chart.",
          }}
        />
      </div>

      {/* ── Area chart ── */}
      <div className="card">
        <div className="card-header">
          <div>
            <span className="card-title">{activeSec.label} — Trend</span>
            <span style={{ marginLeft: 10, fontSize: 11, color: 'var(--ts)' }}>
              avg per submission · {chartData.length} {periodUnit}
            </span>
          </div>
          <div style={{
            fontSize: 11, fontWeight: 700, padding: '2px 10px', borderRadius: 6,
            background: `${activeSec.color}14`, color: activeSec.color,
            border: `1px solid ${activeSec.color}30`,
          }}>
            Section {activeSec.short}
          </div>
        </div>
        <div className="card-body" style={{ padding: '20px 12px 12px', position: 'relative', opacity: isLoading ? 0.5 : 1, transition: 'opacity 0.2s' }}>
          {isLoading && <div style={{position:'absolute', top:'50%', left:'50%', transform:'translate(-50%, -50%)', fontWeight:600, color:'var(--ts)', zIndex:10}}>Loading data...</div>}
          {!isLoading && chartData.length === 0 && !fetchError && (
            <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--ts)' }}>
              No data available for this section and time range.
            </div>
          )}
          {chartData.length > 0 && (
            <ResponsiveContainer width="100%" height={380}>
              <AreaChart data={chartData} margin={{ top: 8, right: 24, left: 8, bottom: 4 }}>
                <defs>
                  <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={activeSec.color} stopOpacity={0.20} />
                    <stop offset="95%" stopColor={activeSec.color} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                <XAxis
                  dataKey="period"
                  tick={{ fontSize: 11, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tickFormatter={v => {
                    const num = v as number;
                    return num < 0 ? `-$${(Math.abs(num) / 1000).toFixed(1)}k` : `$${(num / 1000).toFixed(1)}k`;
                  }}
                  tick={{ fontSize: 11, fill: '#888' }}
                  axisLine={false}
                  tickLine={false}
                  width={60}
                />
                <Tooltip
                  formatter={(value: unknown) => [formatCurrency(Number(value) || 0), activeSec.label]}
                  contentStyle={{
                    fontSize: 12, borderRadius: 8,
                    border: `1px solid ${activeSec.color}40`,
                    boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
                  }}
                  labelStyle={{ fontWeight: 600, marginBottom: 4 }}
                  cursor={{ stroke: activeSec.color, strokeWidth: 1, strokeDasharray: '4 2' }}
                />
                <Area
                  key={sectionKey}
                  type="monotone"
                  dataKey={sectionKey}
                  stroke={activeSec.color}
                  strokeWidth={2.5}
                  fill="url(#areaGrad)"
                  dot={{ r: 4, fill: activeSec.color, strokeWidth: 2, stroke: '#fff' }}
                  activeDot={{ r: 6, fill: activeSec.color, strokeWidth: 2, stroke: '#fff' }}
                  isAnimationActive={true}
                />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
