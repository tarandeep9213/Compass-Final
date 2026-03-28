import { useState, useRef, useEffect } from 'react'
import { getLocation, formatCurrency, IMPREST } from '../../mock/data'
import { createSubmission, updateDraft, submitDraft, getSubmission } from '../../api/submissions'
import { listLocations } from '../../api/locations'
import { api } from '../../api/client'

// ── Excel prefill helper ───────────────────────────────────────────────────────

// ── Excel prefill helper ───────────────────────────────────────────────────────
interface ExcelPrefill {
  denomDetail: {
    A: Record<string, number>
    B: Record<string, number>
    C: Record<string, { m1: number; m2: number }>
    D: Record<string, number>
    E: { left: { qty: number; amount: number }[]; right: { qty: number; amount: number }[] }
    F: { qty: number; amount: number }[]
    G: { currency: number; coin: number }
    H: { value: number }
    I: { yesterday: number; today: number }
  }
  sections: { A: number; B: number; C: number; D: number; E: number; F: number; G: number; H: number; I: number }
  totalFund: number
  fileName: string
  holdover?: number
  replenishment?: number
  coinTransit?: number
  varianceNote?: string
}

function getExcelPrefill(ctx: Record<string, string>): ExcelPrefill | null {
  // 1. Check for Excel Prefill
  if (ctx.fromExcel === 'true') {
    try {
      const raw = sessionStorage.getItem(`excel_prefill_${ctx.locationId}_${ctx.date}`)
      if (raw) return JSON.parse(raw) as ExcelPrefill
    } catch {
      /* ignore JSON parse error */
    }
  }
  
  // 2. Pre-fill existing submission data for rejected status
  if (ctx.submissionId) {
    try {
      const raw = sessionStorage.getItem(`denom_${ctx.submissionId}`)
      if (raw) {
        const d = JSON.parse(raw)
        return {
          denomDetail: {
            A: d.A || {}, B: d.B || {}, C: d.C || {}, D: d.D || {},
            E: d.E || { left: [], right: [] }, F: d.F || [], G: d.G || {},
            H: d.H || {}, I: d.I || {}
          },
          sections: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 },
          totalFund: 0,
          fileName: 'Previous Submission',
          holdover: d.holdover,
          coinTransit: d.coinTransit,
          varianceNote: d.varianceNote
        }
      }
    } catch {
      /* ignore JSON parse error */
    }
  }

  // 3. Load Draft Data
  if (ctx.draftId) {
    try {
      const raw = sessionStorage.getItem(`denom_${ctx.draftId}`)
      if (raw) {
        const d = JSON.parse(raw)
        return {
          denomDetail: {
            A: d.A || {}, B: d.B || {}, C: d.C || {}, D: d.D || {},
            E: d.E || { left: [], right: [] }, F: d.F || [], G: d.G || {},
            H: d.H || {}, I: d.I || {}
          },
          sections: { A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0, H: 0, I: 0 },
          totalFund: 0,
          fileName: 'Saved Draft',
          holdover: d.holdover,
          coinTransit: d.coinTransit,
          varianceNote: d.varianceNote
        }
      }
    } catch {
      /* ignore JSON parse error */
    }
  }

  return null
}

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

// ── Yellow cell (formula / read-only) style ─────────────────────────────────
const YC: React.CSSProperties = {
  background: '#fffde7',
  color: '#78590a',
  fontWeight: 600,
  textAlign: 'right',
  fontSize: 13,
}

// ── Section definitions (matching Excel exactly) ─────────────────────────────
const SEC_A = [
  { key: 'ones',     label: 'Ones',     value: 1 },
  { key: 'twos',     label: 'Twos',     value: 2 },
  { key: 'fives',    label: 'Fives',    value: 5 },
  { key: 'tens',     label: 'Tens',     value: 10 },
  { key: 'twenties', label: 'Twenties', value: 20 },
  { key: 'fifties',  label: 'Fifties',  value: 50 },
  { key: 'hundreds', label: 'Hundreds', value: 100 },
  { key: 'other',    label: 'Other',    value: 0 },   // direct $ entry
]
const SEC_B = [
  { key: 'bDollar',   label: 'Dollars',  value: 1.00 },
  { key: 'bHalves',   label: 'Halves',   value: 0.50 },
  { key: 'bQuarters', label: 'Quarters', value: 0.25 },
  { key: 'bDimes',    label: 'Dimes',    value: 0.10 },
  { key: 'bNickels',  label: 'Nickels',  value: 0.05 },
  { key: 'bPennies',  label: 'Pennies',  value: 0.01 },
]
const SEC_C = [
  { key: 'cDollar',   label: 'Dollars',  value: 1.00 },
  { key: 'cHalves',   label: 'Halves',   value: 0.50 },
  { key: 'cQuarters', label: 'Quarters', value: 0.25 },
  { key: 'cDimes',    label: 'Dimes',    value: 0.10 },
  { key: 'cNickels',  label: 'Nickels',  value: 0.05 },
  { key: 'cPennies',  label: 'Pennies',  value: 0.01 },
]
const SEC_D = [
  { key: 'dDollar',   label: 'Dollars',  value: 1.00 },
  { key: 'dQuarters', label: 'Quarters', value: 0.25 },
  { key: 'dDimes',    label: 'Dimes',    value: 0.10 },
  { key: 'dNickels',  label: 'Nickels',  value: 0.05 },
]

type FieldMap  = Record<string, string>
type MachMap   = Record<string, { m1: string; m2: string }>
type QARow     = { qty: string; amount: string }
const emptyQA  = (): QARow => ({ qty: '', amount: '' })

// ── Sub-components (defined outside to avoid re-mount on render) ─────────────
function NumInput({
  val, onChange, width = 72, step = '1',
}: { val: string; onChange: (v: string) => void; width?: number; step?: string }) {
  return (
    <input
      type="number" min="0" step={step}
      className="f-inp"
      style={{ width, textAlign: 'right', padding: '4px 6px', fontSize: 12 }}
      placeholder="0"
      value={val}
      onChange={e => onChange(e.target.value)}
    />
  )
}

function SecHead({ id, title, total }: { id: string; title: string; total: number }) {
  return (
    <div style={{
      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
      padding: '8px 12px', background: 'var(--g1)', borderBottom: '1px solid var(--ow2)',
    }}>
      <span style={{ fontWeight: 700, fontSize: 12, color: 'var(--g8)' }}>{id}. {title}</span>
      <span style={{ ...YC, background: 'transparent', fontSize: 13 }}>
        {total > 0 ? formatCurrency(total) : <span style={{ color: 'var(--ts)' }}>—</span>}
      </span>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────
interface FormLocation {
  id?: string;
  name?: string;
  expectedCash?: number;
  expected_cash?: number;
  tolerancePct?: number;
  tolerance_pct?: number;
  effective_tolerance_pct?: number;
  tolerance_pct_override?: number;
  [key: string]: unknown;
}

export default function OpForm({ ctx, onNavigate }: Props) {
  const [location, setLocation] = useState<FormLocation | undefined>(() => getLocation(ctx.locationId) as unknown as FormLocation)
  const [realTolerance, setRealTolerance] = useState<number | null>(null)

  useEffect(() => {
    listLocations().then(locs => {
      const loc = locs.find(l => l.id === ctx.locationId)
      if (loc) setLocation(loc as unknown as FormLocation)
    }).catch(() => {})

    // Fetch config to get the exact admin-set tolerance override
    interface ConfigResponse {
      global_config?: { default_tolerance_pct?: number };
      location_overrides?: Array<{ location_id: string; tolerance_pct: number }>;
    }
    api.get<ConfigResponse>('/config').then(conf => {
      const override = conf.location_overrides?.find(o => o.location_id === ctx.locationId)
      if (override && override.tolerance_pct !== undefined) {
        setRealTolerance(override.tolerance_pct)
      } else if (conf.global_config && conf.global_config.default_tolerance_pct !== undefined) {
        setRealTolerance(conf.global_config.default_tolerance_pct)
      }
    }).catch(() => {})
  }, [ctx.locationId])

  const dateLabel = new Date(ctx.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })

  // Section scroll refs
  const refA = useRef<HTMLDivElement>(null)
  const refB = useRef<HTMLDivElement>(null)
  const refC = useRef<HTMLDivElement>(null)
  const refD = useRef<HTMLDivElement>(null)
  const refE = useRef<HTMLDivElement>(null)
  const refF = useRef<HTMLDivElement>(null)
  const refG = useRef<HTMLDivElement>(null)
  const refH = useRef<HTMLDivElement>(null)
  const refI = useRef<HTMLDivElement>(null)

  // ── State ──────────────────────────────────────────────────────────────────
  const [aQty,       setAQty]       = useState<FieldMap>(() => {
    const pf = getExcelPrefill(ctx)
    if (!pf) return {} as FieldMap
    const d = pf.denomDetail.A
    return {
      ones:     d.ones     ? String(d.ones)     : '',
      twos:     d.twos     ? String(d.twos)     : '',
      fives:    d.fives    ? String(d.fives)    : '',
      tens:     d.tens     ? String(d.tens)     : '',
      twenties: d.twenties ? String(d.twenties) : '',
      fifties:  d.fifties  ? String(d.fifties)  : '',
      hundreds: d.hundreds ? String(d.hundreds) : '',
    }
  })
  const [aOther,     setAOther]     = useState(() => {
    const pf = getExcelPrefill(ctx)
    return pf?.denomDetail.A?.other ? String(pf.denomDetail.A.other) : ''
  })
  const [bQty,       setBQty]       = useState<FieldMap>(() => {
    const pf = getExcelPrefill(ctx)
    if (!pf) return {} as FieldMap
    const d = pf.denomDetail.B
    return {
      bDollar:   d.dollar   ? String(d.dollar)   : '',
      bHalves:   d.halves   ? String(d.halves)   : '',
      bQuarters: d.quarters ? String(d.quarters) : '',
      bDimes:    d.dimes    ? String(d.dimes)    : '',
      bNickels:  d.nickels  ? String(d.nickels)  : '',
      bPennies:  d.pennies  ? String(d.pennies)  : '',
    }
  })
  const [cMach,      setCMach]      = useState<MachMap>(() => {
    const pf = getExcelPrefill(ctx)
    if (!pf) return {}
    const c = pf.denomDetail.C
    if (!c || Object.keys(c).length === 0) return {}
    const result: MachMap = {}
    for (const [key, val] of Object.entries(c)) {
      result[key] = { m1: val.m1 ? String(val.m1) : '', m2: val.m2 ? String(val.m2) : '' }
    }
    return result
  })
  const [dBags,      setDBags]      = useState<FieldMap>(() => {
    const pf = getExcelPrefill(ctx)
    if (!pf) return {}
    const d = pf.denomDetail.D
    if (!d || Object.keys(d).length === 0) return {}
    const result: FieldMap = {}
    for (const [key, val] of Object.entries(d)) {
      if (val) result[key] = String(val)
    }
    return result
  })
  const [eLeft,      setELeft]      = useState<QARow[]>(() => {
    const pf = getExcelPrefill(ctx)
    const empty: QARow[] = [emptyQA(), emptyQA(), emptyQA(), emptyQA(), emptyQA()]
    if (!pf?.denomDetail.E?.left?.length) return empty
    return pf.denomDetail.E.left
      .map(r => ({ qty: String(r.qty), amount: String(r.amount) }))
      .concat(empty)
      .slice(0, 5)
  })
  const [eRight,     setERight]     = useState<QARow[]>(() => {
    const pf = getExcelPrefill(ctx)
    const empty: QARow[] = [emptyQA(), emptyQA(), emptyQA(), emptyQA(), emptyQA()]
    if (!pf?.denomDetail.E?.right?.length) return empty
    return pf.denomDetail.E.right
      .map(r => ({ qty: String(r.qty), amount: String(r.amount) }))
      .concat(empty)
      .slice(0, 5)
  })
  const [fRows,      setFRows]      = useState<QARow[]>(() => {
    const pf = getExcelPrefill(ctx)
    const empty: QARow[] = [emptyQA(), emptyQA(), emptyQA(), emptyQA()]
    if (!pf?.denomDetail.F?.length) return empty
    return pf.denomDetail.F
      .map(r => ({ qty: String(r.qty), amount: String(r.amount) }))
      .concat(empty)
      .slice(0, 4)
  })
  const [gCurr,      setGCurr]      = useState(() => { const pf = getExcelPrefill(ctx); return pf?.denomDetail.G?.currency  ? String(pf.denomDetail.G.currency)  : '' })
  const [gCoin,      setGCoin]      = useState(() => { const pf = getExcelPrefill(ctx); return pf?.denomDetail.G?.coin       ? String(pf.denomDetail.G.coin)       : '' })
  const [hVal,       setHVal]       = useState(() => { const pf = getExcelPrefill(ctx); return pf?.denomDetail.H?.value      ? String(pf.denomDetail.H.value)      : '' })
  const [iYest,      setIYest]      = useState(() => { const pf = getExcelPrefill(ctx); return pf?.denomDetail.I?.yesterday  ? String(pf.denomDetail.I.yesterday)  : '' })
  const [iToday,     setIToday]     = useState(() => { const pf = getExcelPrefill(ctx); return pf?.denomDetail.I?.today      ? String(pf.denomDetail.I.today)      : '' })
  const [holdover,     setHoldover]    = useState(() => { const pf = getExcelPrefill(ctx); return pf?.holdover !== undefined ? String(pf.holdover) : '' })
  const [replenishment,setReplenishment]= useState(() => { const pf = getExcelPrefill(ctx); return pf?.replenishment !== undefined ? String(pf.replenishment) : '' })
  const [coinTransit,  setCoinTransit] = useState(() => { const pf = getExcelPrefill(ctx); return pf?.coinTransit !== undefined ? String(pf.coinTransit) : '' })
  const [varianceNote, setVarianceNote] = useState(() => { const pf = getExcelPrefill(ctx); return pf?.varianceNote ? String(pf.varianceNote) : '' })
  const [submitError,  setSubmitError]  = useState('')
  const [submitting,   setSubmitting]   = useState(false)
  const [draftId,      setDraftId]      = useState<string | null>(ctx.draftId ?? null)
  const [globalRejectReason, setGlobalRejectReason] = useState('')

  const [formLoading, setFormLoading] = useState(!!ctx.submissionId && ctx.fromExcel !== 'true')
  const [editingStatus, setEditingStatus] = useState<string | null>(null)

  // ── Pre-fill from API when editing an existing submission ─────────────────
  useEffect(() => {
    if (!ctx.submissionId || ctx.fromExcel === 'true') return
    setFormLoading(true)
    getSubmission(ctx.submissionId).then(sub => {
      setEditingStatus(sub.status)
      interface ParsedSections {
        A?: { ones?: number; twos?: number; fives?: number; tens?: number; twenties?: number; fifties?: number; hundreds?: number; other?: number };
        B?: { dollar?: number; halves?: number; quarters?: number; dimes?: number; nickels?: number; pennies?: number };
        C?: { machines?: Record<string, { m1?: number; m2?: number }> };
        D?: { bags?: Record<string, number> };
        E?: { set1?: { qty?: number; amount?: number }[]; set2?: { qty?: number; amount?: number }[] };
        F?: { rows?: { qty?: number; amount?: number }[] };
        G?: { currency?: number; coin?: number };
        H?: { value?: number };
        I?: { yesterday?: number; today?: number };
        holdover?: number;
        coin_transit?: number;
        [key: string]: unknown;
      }
      const s = sub.sections as ParsedSections
      const emptyQA5 = (): QARow[] => [emptyQA(), emptyQA(), emptyQA(), emptyQA(), emptyQA()]
      const emptyQA4 = (): QARow[] => [emptyQA(), emptyQA(), emptyQA(), emptyQA()]

      {
        const a = s.A ?? {}
        setAQty({
        ones:     a.ones     ? String(a.ones)     : '',
        twos:     a.twos     ? String(a.twos)     : '',
        fives:    a.fives    ? String(a.fives)    : '',
        tens:     a.tens     ? String(a.tens)     : '',
        twenties: a.twenties ? String(a.twenties) : '',
        fifties:  a.fifties  ? String(a.fifties)  : '',
        hundreds: a.hundreds ? String(a.hundreds) : '',
      })
      if (a.other) setAOther(String(a.other))

      const b = s.B ?? {}
      setBQty({
        bDollar:   b.dollar   ? String(b.dollar)   : '',
        bHalves:   b.halves   ? String(b.halves)   : '',
        bQuarters: b.quarters ? String(b.quarters) : '',
        bDimes:    b.dimes    ? String(b.dimes)    : '',
        bNickels:  b.nickels  ? String(b.nickels)  : '',
        bPennies:  b.pennies  ? String(b.pennies)  : '',
      })

      const cRaw = (s.C?.machines ?? {}) as Record<string, { m1: unknown; m2: unknown }>
      const cNew: MachMap = {}
      for (const [k, v] of Object.entries(cRaw)) {
        cNew[k] = { m1: v.m1 ? String(v.m1) : '', m2: v.m2 ? String(v.m2) : '' }
      }
      setCMach(cNew)

      const dRaw = (s.D?.bags ?? {}) as Record<string, unknown>
      const dNew: FieldMap = {}
      for (const [k, v] of Object.entries(dRaw)) { if (v) dNew[k] = String(v) }
      setDBags(dNew)

      const set1 = (s.E?.set1 ?? []) as { qty: unknown; amount: unknown }[]
      const set2 = (s.E?.set2 ?? []) as { qty: unknown; amount: unknown }[]
      setELeft(set1.length ? set1.map(r => ({ qty: String(r.qty), amount: String(r.amount) })).concat(emptyQA5()).slice(0, 5) : emptyQA5())
      setERight(set2.length ? set2.map(r => ({ qty: String(r.qty), amount: String(r.amount) })).concat(emptyQA5()).slice(0, 5) : emptyQA5())

      const fRaw = (s.F?.rows ?? []) as { qty: unknown; amount: unknown }[]
      setFRows(fRaw.length ? fRaw.map(r => ({ qty: String(r.qty), amount: String(r.amount) })).concat(emptyQA4()).slice(0, 4) : emptyQA4())

      const g = s.G ?? {}
      if (g.currency) setGCurr(String(g.currency))
      if (g.coin) setGCoin(String(g.coin))

      const h = s.H ?? {}
      if (h.value) setHVal(String(h.value))

      const i = s.I ?? {}
        if (i.yesterday) setIYest(String(i.yesterday))
        if (i.today) setIToday(String(i.today))
      }

      // Always populate these fields if they are empty, as older session caches may lack them
      if (s.holdover !== undefined && s.holdover !== null) {
        setHoldover(prev => prev === '' ? String(s.holdover) : prev)
      }
      if (s.replenishment !== undefined && s.replenishment !== null) {
        setReplenishment(prev => prev === '' ? String(s.replenishment) : prev)
      }
      if (s.coin_transit !== undefined && s.coin_transit !== null) {
        setCoinTransit(prev => prev === '' ? String(s.coin_transit) : prev)
      }
      if (sub.variance_note) {
        setVarianceNote(prev => prev === '' ? (sub.variance_note ?? '') : prev)
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      if ((sub as any).rejection_reason) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setGlobalRejectReason((sub as any).rejection_reason)
      }
    }).catch(() => { /* keep empty if fetch fails */ })
      .finally(() => setFormLoading(false))
  }, [ctx.submissionId]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Totals (formula cells) ─────────────────────────────────────────────────
  const totA = SEC_A.reduce((s, r) =>
    r.key === 'other'
      ? s + (parseFloat(aOther) || 0)
      : s + (parseFloat(aQty[r.key]) || 0)
  , 0)
  const totB = SEC_B.reduce((s, r) => s + (parseFloat(bQty[r.key]) || 0), 0)
  const totC = SEC_C.reduce((s, r) => {
    const m = cMach[r.key] ?? { m1: '', m2: '' }
    return s + ((parseFloat(m.m1) || 0) + (parseFloat(m.m2) || 0)) * r.value
  }, 0)
  const totD = SEC_D.reduce((s, r) => s + (parseFloat(dBags[r.key]) || 0) * r.value, 0)
  const totE = [...eLeft, ...eRight].reduce(
    (s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.amount) || 0), 0)
  const totF = fRows.reduce(
    (s, r) => s + (parseFloat(r.qty) || 0) * (parseFloat(r.amount) || 0), 0)
  const totG        = (parseFloat(gCurr) || 0) + (parseFloat(gCoin) || 0)
  const totH        = parseFloat(hVal) || 0
  const totI        = (parseFloat(iYest) || 0) + (parseFloat(iToday) || 0)
  const holdoverAmt    = parseFloat(holdover) || 0
  const replenishAmt   = parseFloat(replenishment) || 0
  const coinTransAmt   = parseFloat(coinTransit) || 0
  const totalCash      = totA + totB + totC + totD + totE + totF + totG - holdoverAmt
  const totalFund      = totalCash + totH + totI + replenishAmt + coinTransAmt

  const expectedCash = location?.expected_cash ?? location?.expectedCash ?? IMPREST
  const tolerance    = realTolerance ?? location?.tolerance_pct_override ?? location?.effective_tolerance_pct ?? location?.tolerancePct ?? 0.5
  const variance     = totalFund - expectedCash
  const variancePct  = expectedCash > 0 ? (variance / expectedCash) * 100 : 0
  const requiresNote = Math.abs(variancePct) > tolerance
  const varColor     = Math.abs(variancePct) > tolerance
    ? 'var(--red)'
    : Math.abs(variancePct) > tolerance * 0.5
    ? 'var(--amb)'
    : 'var(--g7)'

  // Section pills data (for sticky bar)
  const SECTIONS = [
    { key: 'A', label: 'Currency',            total: totA,           ref: refA },
    { key: 'B', label: 'Rolled Coin',          total: totB,           ref: refB },
    { key: 'C', label: 'Coins in Machines',    total: totC,           ref: refC },
    { key: 'D', label: 'Bagged Coin',          total: totD,           ref: refD },
    { key: 'E', label: 'Unissued Changers',    total: totE,           ref: refE },
    { key: 'F', label: 'Returned Funds',       total: totF,           ref: refF },
    { key: 'G', label: 'Mutilated/Foreign',    total: totG,           ref: refG },
    { key: 'H', label: 'Changer Outstanding',  total: totH,           ref: refH },
    { key: 'I', label: 'Net Shortfall',        total: Math.abs(totI), ref: refI },
  ]

  function scrollTo(ref: React.RefObject<HTMLDivElement | null>) {
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  // ── Section payload ────────────────────────────────────────────────────────
  function buildSections(): Record<string, unknown> {
    return {
      A: { total: totA, ones: parseFloat(aQty.ones)||0, twos: parseFloat(aQty.twos)||0, fives: parseFloat(aQty.fives)||0, tens: parseFloat(aQty.tens)||0, twenties: parseFloat(aQty.twenties)||0, fifties: parseFloat(aQty.fifties)||0, hundreds: parseFloat(aQty.hundreds)||0, other: parseFloat(aOther)||0 },
      B: { total: totB, dollar: parseFloat(bQty.bDollar)||0, halves: parseFloat(bQty.bHalves)||0, quarters: parseFloat(bQty.bQuarters)||0, dimes: parseFloat(bQty.bDimes)||0, nickels: parseFloat(bQty.bNickels)||0, pennies: parseFloat(bQty.bPennies)||0 },
      C: { total: totC, machines: cMach },
      D: { total: totD, bags: dBags },
      E: { total: totE, set1: eLeft, set2: eRight },
      F: { total: totF, rows: fRows },
      G: { total: totG, currency: parseFloat(gCurr)||0, coin: parseFloat(gCoin)||0 },
      H: { total: totH, value: parseFloat(hVal)||0 },
      I: { total: totI, yesterday: parseFloat(iYest)||0, today: parseFloat(iToday)||0 },
      holdover: holdoverAmt,
      replenishment: replenishAmt,
      coin_transit: coinTransAmt,
    }
  }

  // ── Actions ────────────────────────────────────────────────────────────────
  async function handleSubmit() {
    if (editingStatus === 'approved') {
      setSubmitError('This submission has been approved and cannot be modified.')
      return
    }
    if (requiresNote && !varianceNote.trim()) {
      setSubmitError('A variance note is required when variance exceeds the tolerance threshold.')
      return
    }
    setSubmitError('')
    setSubmitting(true)
    const denomDetail = {
      A: { ones: parseFloat(aQty.ones)||0, twos: parseFloat(aQty.twos)||0, fives: parseFloat(aQty.fives)||0, tens: parseFloat(aQty.tens)||0, twenties: parseFloat(aQty.twenties)||0, fifties: parseFloat(aQty.fifties)||0, hundreds: parseFloat(aQty.hundreds)||0, other: parseFloat(aOther)||0 },
      B: { dollar: parseFloat(bQty.bDollar)||0, halves: parseFloat(bQty.bHalves)||0, quarters: parseFloat(bQty.bQuarters)||0, dimes: parseFloat(bQty.bDimes)||0, nickels: parseFloat(bQty.bNickels)||0, pennies: parseFloat(bQty.bPennies)||0 },
      C: cMach,
      D: dBags,
      E: { left: eLeft, right: eRight },
      F: fRows,
      G: { currency: parseFloat(gCurr)||0, coin: parseFloat(gCoin)||0 },
      H: { value: parseFloat(hVal)||0 },
      I: { yesterday: parseFloat(iYest)||0, today: parseFloat(iToday)||0 },
      holdover: holdoverAmt,
      replenishment: replenishAmt,
      coinTransit: coinTransAmt,
      varianceNote: requiresNote ? varianceNote.trim() : ''
    }
    try {
      let submissionId: string
      const targetId = draftId || ctx.submissionId

      if (targetId) {
        // Save any changes made to the draft or rejected submission before submitting
        await updateDraft(targetId, {
          location_id: ctx.locationId,
          submission_date: ctx.date,
          source: ctx.fromExcel === 'true' ? 'EXCEL' : 'FORM',
          sections: buildSections(),
          variance_note: requiresNote ? varianceNote.trim() : null,
          save_as_draft: true,
        })
        // Submit existing record
        const res = await submitDraft(targetId, requiresNote ? varianceNote.trim() : null)
        submissionId = res.id
      } else {
        // Create and immediately submit
        const res = await createSubmission({
          location_id: ctx.locationId,
          submission_date: ctx.date,
          source: ctx.fromExcel === 'true' ? 'EXCEL' : 'FORM',
          sections: buildSections(),
          variance_note: requiresNote ? varianceNote.trim() : null,
          save_as_draft: false,
        })
        submissionId = res.id
      }
      sessionStorage.setItem(`op_status_${submissionId}`, 'pending_approval')
      sessionStorage.setItem(`op_status_${ctx.locationId}_${ctx.date}`, 'pending_approval')
      sessionStorage.setItem(`denom_${submissionId}`, JSON.stringify(denomDetail))
      onNavigate(ctx.from || 'op-start') // Route to previous context or Dashboard
    } catch (err) {
      // Strict Fallback Rule: Only fallback to session storage if backend is unreachable (Network Error)
      const error = err instanceof Error ? err : new Error(String(err));
      const isNetworkError = error instanceof TypeError || error.message === 'Failed to fetch' || error.message === 'Network Error';
      if (!isNetworkError) {
        setSubmitError(error.message || 'Submission failed due to a server or validation error.');
        setSubmitting(false);
        return;
      }
      
      setSubmitError('Could not reach the server. Please check your connection and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function handleDiscard() {
    if (!window.confirm("Are you sure you want to discard this form? Any unsaved progress will be lost.")) return;
    const targetId = draftId || ctx.submissionId;
    if (targetId) sessionStorage.removeItem(`denom_${targetId}`);
    sessionStorage.removeItem(`excel_prefill_${ctx.locationId}_${ctx.date}`);
    onNavigate(ctx.from || 'op-start');
  }

  async function handleSaveDraft() {
    const body = {
      location_id: ctx.locationId,
      submission_date: ctx.date,
      source: (ctx.fromExcel === 'true' ? 'EXCEL' : 'FORM') as 'EXCEL' | 'FORM',
      sections: buildSections(),
      variance_note: null,
      save_as_draft: true,
    }

    const denomDetail = {
      A: { ones: parseFloat(aQty.ones)||0, twos: parseFloat(aQty.twos)||0, fives: parseFloat(aQty.fives)||0, tens: parseFloat(aQty.tens)||0, twenties: parseFloat(aQty.twenties)||0, fifties: parseFloat(aQty.fifties)||0, hundreds: parseFloat(aQty.hundreds)||0, other: parseFloat(aOther)||0 },
      B: { dollar: parseFloat(bQty.bDollar)||0, halves: parseFloat(bQty.bHalves)||0, quarters: parseFloat(bQty.bQuarters)||0, dimes: parseFloat(bQty.bDimes)||0, nickels: parseFloat(bQty.bNickels)||0, pennies: parseFloat(bQty.bPennies)||0 },
      C: cMach, D: dBags, E: { left: eLeft, right: eRight }, F: fRows,
      G: { currency: parseFloat(gCurr)||0, coin: parseFloat(gCoin)||0 },
      H: { value: parseFloat(hVal)||0 },
      I: { yesterday: parseFloat(iYest)||0, today: parseFloat(iToday)||0 },
      holdover: holdoverAmt,
      replenishment: replenishAmt,
      coinTransit: coinTransAmt,
      varianceNote: varianceNote.trim()
    }

    try {
      const targetId = draftId || ctx.submissionId
      if (targetId) {
        await updateDraft(targetId, body)
        sessionStorage.setItem(`denom_${targetId}`, JSON.stringify(denomDetail))
      } else {
        const res = await createSubmission(body)
        setDraftId(res.id)
        sessionStorage.setItem(`denom_${res.id}`, JSON.stringify(denomDetail))
      }
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      window.alert(error.message || 'Failed to save draft. Please check your connection.');
      return;
    }
    onNavigate(ctx.from || 'op-start')
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  if (formLoading) {
    return (
      <div className="fade-up">
        <div className="ph"><div><h2>Loading Submission…</h2></div></div>
      </div>
    )
  }

  return (
    <div className="fade-up">

      {/* Page header */}
      <div className="ph">
        <div>
          <h2>Cash Count Form</h2>
          <p><strong>{location?.name}</strong> · {dateLabel}</p>
        </div>
        <div className="ph-right" style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={() => onNavigate(ctx.from || 'op-start', ctx)}>
            ← Back
          </button>
          <button className="btn btn-outline" style={{ color: 'var(--red)', borderColor: '#fca5a5' }} onClick={handleDiscard}>
            🗑 Discard
          </button>
          <button className="btn btn-outline" onClick={handleSaveDraft}>{editingStatus === 'pending_approval' ? '💾 Save Changes' : '💾 Save Draft'}</button>
        </div>
      </div>

      {/* ── Excel prefill banner ── */}
      {(() => {
        const pf = getExcelPrefill(ctx)
        if (!pf) return null
        const hasManualSections = pf.sections.C + pf.sections.D + pf.sections.E + pf.sections.F > 0
        return (
          <div className="alert-info" style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 16 }}>📊</span>
            <div style={{ fontSize: 13 }}>
              Pre-filled from <strong>{pf.fileName}</strong>. All sections have been populated from your spreadsheet — please verify and adjust the detail breakdown as needed.
              {hasManualSections && (
                <> Sections C, D, E, F are pre-filled to match the section total — the denomination detail may need redistribution.</>
              )}
            </div>
          </div>
        )
      })()}

      {globalRejectReason && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '14px 18px', borderRadius: 10, marginBottom: 16,
          background: 'var(--red-bg)', border: '1px solid #fca5a5',
        }}>
          <span style={{ fontSize: 24 }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--red)', marginBottom: 4 }}>
              Submission Rejected
            </div>
            <div style={{ fontSize: 13, color: 'var(--red)', lineHeight: 1.5 }}>
              {globalRejectReason}
            </div>
          </div>
        </div>
      )}

      {globalRejectReason && editingStatus === 'rejected' && (
        <div style={{
          display: 'flex', gap: 12, alignItems: 'flex-start',
          padding: '14px 18px', borderRadius: 10, marginBottom: 18,
          background: 'var(--red-bg)', border: '1px solid #fca5a5',
        }}>
          <span style={{ fontSize: 20 }}>❌</span>
          <div>
            <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
              Submission Rejected
            </div>
            <div style={{ fontSize: 12, color: 'var(--red)' }}>
              Reason: {globalRejectReason}
            </div>
          </div>
        </div>
      )}

      {/* ── Auto-filled form header ── */}
      <div className="card" style={{ marginBottom: 16, overflow: 'hidden' }}>
        <div style={{
          padding: '10px 16px', background: 'var(--g8)', color: '#fff',
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', opacity: 0.7 }}>
            Canteen Vending Services
          </div>
          <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 16, marginTop: 2 }}>
            Daily Cashroom Count Worksheet
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)' }}>
          {[
            ['Location',    location?.name ?? '—'],
            ['Date',        dateLabel],
            ['Counted By',  'A. Patel'],
            ['Verified By', '—'],
          ].map(([label, value], i) => (
            <div key={label} style={{
              padding: '10px 14px',
              borderTop: '1px solid var(--ow2)',
              borderRight: i < 3 ? '1px solid var(--ow2)' : undefined,
            }}>
              <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 3 }}>
                {label}
              </div>
              <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--td)' }}>{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Variance + section pills ── */}
      <div style={{
        background: '#fff',
        border: '1px solid var(--ow2)', borderRadius: 10, padding: '10px 16px',
        display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16,
        flexWrap: 'wrap',
      }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Total Fund</div>
          <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 22, color: 'var(--td)' }}>{formatCurrency(totalFund)}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--ow2)' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Expected</div>
          <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 16, color: 'var(--ts)' }}>{formatCurrency(expectedCash)}</div>
        </div>
        <div style={{ width: 1, height: 32, background: 'var(--ow2)' }} />
        <div>
          <div style={{ fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Variance</div>
          <div style={{ fontFamily: 'DM Serif Display,serif', fontSize: 20, color: varColor }}>
            {variance >= 0 ? '+' : ''}{formatCurrency(variance)}
            <span style={{ fontSize: 12, marginLeft: 5, fontFamily: 'DM Sans,sans-serif', fontWeight: 500 }}>
              ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(2)}%)
            </span>
          </div>
        </div>
        {requiresNote && (
          <span className="badge badge-red"><span className="bdot" />Exceeds ±{tolerance.toFixed(1)}%</span>
        )}
        {!requiresNote && totalFund > 0 && Math.abs(variancePct) > tolerance * 0.5 && (
          <span className="badge badge-amber"><span className="bdot" />Approaching limit</span>
        )}
        {!requiresNote && totalFund > 0 && Math.abs(variancePct) <= tolerance * 0.5 && (
          <span className="badge badge-green"><span className="bdot" />Within ±{tolerance.toFixed(1)}%</span>
        )}
        {/* Clickable section pills */}
        <div style={{ marginLeft: 'auto', display: 'flex', flexWrap: 'wrap', gap: 5, justifyContent: 'flex-end', maxWidth: 460 }}>
          {SECTIONS.map(s => (
            <button
              key={s.key}
              onClick={() => scrollTo(s.ref)}
              style={{
                padding: '3px 9px', borderRadius: 6, border: '1px solid',
                fontSize: 11, fontWeight: 600, cursor: 'pointer', lineHeight: 1.6,
                background:   s.total > 0 ? 'var(--g1)'  : 'var(--ow)',
                borderColor:  s.total > 0 ? 'var(--g4)'  : 'var(--ow2)',
                color:        s.total > 0 ? 'var(--g8)'  : 'var(--ts)',
              }}
            >
              {s.key} · {s.label}
            </button>
          ))}
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 1 — Sections A · B · C  (A/B narrow, C takes remaining space)
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: 'auto auto 1fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        {/* ── Section A: Currency ── */}
        <div className="card" ref={refA}>
          <SecHead id="A" title="Currency" total={totA} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Denomination</th>
                <th style={{ textAlign: 'right' }}>Amount $</th>
              </tr>
            </thead>
            <tbody>
              {SEC_A.map(r => {
                if (r.key === 'other') {
                  return (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: 'right' }}>
                        <NumInput val={aOther} onChange={setAOther} step="0.01" />
                      </td>
                    </tr>
                  )
                }
                return (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>
                      <NumInput val={aQty[r.key] || ''} onChange={v => setAQty(p => ({ ...p, [r.key]: v }))} />
                    </td>
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>A. Total</td>
                <td style={YC}>{formatCurrency(totA)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Section B: Rolled Coin ── */}
        <div className="card" ref={refB}>
          <SecHead id="B" title="Rolled Coin" total={totB} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Denomination</th>
                <th style={{ textAlign: 'right' }}>Amount $</th>
              </tr>
            </thead>
            <tbody>
              {SEC_B.map(r => (
                <tr key={r.key}>
                  <td>{r.label}</td>
                  <td style={{ textAlign: 'right' }}>
                    <NumInput val={bQty[r.key] || ''} onChange={v => setBQty(p => ({ ...p, [r.key]: v }))} />
                  </td>
                </tr>
              ))}
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>B. Total</td>
                <td style={YC}>{formatCurrency(totB)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Section C: Coins in Counting Machines (Sorter/Counter) ── */}
        <div className="card" ref={refC}>
          <SecHead id="C" title="Coins in Counting Machines (Sorter/Counter)" total={totC} />
          <div>
            <table className="dt" style={{ fontSize: 12 }}>
              <thead>
                <tr>
                  <th>Denom</th>
                  <th style={{ textAlign: 'right' }}>No. 1</th>
                  <th style={{ textAlign: 'right' }}>No. 2</th>
                  <th style={{ textAlign: 'right', color: 'var(--ts)', fontSize: 11 }}>Face $</th>
                  <th style={{ textAlign: 'right', background: '#fffde7' }}>Tot Count</th>
                  <th style={{ textAlign: 'right', background: '#fffde7' }}>Total $</th>
                </tr>
              </thead>
              <tbody>
                {SEC_C.map(r => {
                  const m          = cMach[r.key] ?? { m1: '', m2: '' }
                  const totalCount = (parseFloat(m.m1) || 0) + (parseFloat(m.m2) || 0)
                  const totalAmt   = totalCount * r.value
                  return (
                    <tr key={r.key}>
                      <td>{r.label}</td>
                      <td style={{ textAlign: 'right' }}>
                        <NumInput
                          val={m.m1}
                          onChange={v => setCMach(p => ({ ...p, [r.key]: { ...p[r.key] ?? { m1: '', m2: '' }, m1: v } }))}
                          width={50}
                        />
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <NumInput
                          val={m.m2}
                          onChange={v => setCMach(p => ({ ...p, [r.key]: { ...p[r.key] ?? { m1: '', m2: '' }, m2: v } }))}
                          width={50}
                        />
                      </td>
                      <td style={{ textAlign: 'right', color: 'var(--ts)', fontSize: 11 }}>
                        {formatCurrency(r.value)}
                      </td>
                      <td style={YC}>{totalCount > 0 ? totalCount : '—'}</td>
                      <td style={YC}>{totalAmt > 0 ? formatCurrency(totalAmt) : '—'}</td>
                    </tr>
                  )
                })}
                <tr style={{ background: 'var(--g0)' }}>
                  <td colSpan={5} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>C. Total</td>
                  <td style={YC}>{formatCurrency(totC)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          ROW 2 — Sections D · E  (two columns, matching Excel)
      ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.6fr', gap: 12, marginBottom: 12, alignItems: 'start' }}>

        {/* ── Section D: Bagged Coin ── */}
        <div className="card" ref={refD}>
          <SecHead id="D" title="Bagged Coin (Full for Bank)" total={totD} />
          <table className="dt" style={{ fontSize: 12 }}>
            <thead>
              <tr>
                <th>Type</th>
                <th style={{ textAlign: 'right' }}>No.</th>
                <th style={{ textAlign: 'right', background: '#fffde7' }}>Totals</th>
              </tr>
            </thead>
            <tbody>
              {SEC_D.map(r => {
                const total = (parseFloat(dBags[r.key]) || 0) * r.value
                return (
                  <tr key={r.key}>
                    <td>{r.label}</td>
                    <td style={{ textAlign: 'right' }}>
                      <NumInput val={dBags[r.key] || ''} onChange={v => setDBags(p => ({ ...p, [r.key]: v }))} />
                    </td>
                    <td style={YC}>{total > 0 ? formatCurrency(total) : '—'}</td>
                  </tr>
                )
              })}
              <tr style={{ background: 'var(--g0)' }}>
                <td colSpan={2} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>D. Total</td>
                <td style={YC}>{formatCurrency(totD)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* ── Section E: Unissued Changer Funds ── */}
        <div className="card" ref={refE}>
          <SecHead id="E" title="Unissued Changer Funds in Cashroom or Vault" total={totE} />
          {/* Two sets side by side */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--ow2)' }}>
            {/* Left set */}
            <div style={{ borderRight: '1px solid var(--ow2)' }}>
              <div style={{ padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', borderBottom: '1px solid var(--ow2)' }}>
                Set 1
              </div>
              <table className="dt" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>No.</th>
                    <th style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</th>
                    <th style={{ textAlign: 'right' }}>Amt</th>
                    <th style={{ textAlign: 'right', background: '#fffde7' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {eLeft.map((row, i) => {
                    const total = (parseFloat(row.qty) || 0) * (parseFloat(row.amount) || 0)
                    return (
                      <tr key={i}>
                        <td style={{ textAlign: 'right' }}>
                          <NumInput val={row.qty} onChange={v => setELeft(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))} width={52} />
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</td>
                        <td style={{ textAlign: 'right' }}>
                          <NumInput val={row.amount} onChange={v => setELeft(p => p.map((r, j) => j === i ? { ...r, amount: v } : r))} step="0.01" width={60} />
                        </td>
                        <td style={YC}>{total > 0 ? formatCurrency(total) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Right set */}
            <div>
              <div style={{ padding: '5px 10px', fontSize: 10, fontWeight: 600, color: 'var(--ts)', textTransform: 'uppercase', borderBottom: '1px solid var(--ow2)' }}>
                Set 2
              </div>
              <table className="dt" style={{ fontSize: 12 }}>
                <thead>
                  <tr>
                    <th style={{ textAlign: 'right' }}>No.</th>
                    <th style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</th>
                    <th style={{ textAlign: 'right' }}>Amt</th>
                    <th style={{ textAlign: 'right', background: '#fffde7' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {eRight.map((row, i) => {
                    const total = (parseFloat(row.qty) || 0) * (parseFloat(row.amount) || 0)
                    return (
                      <tr key={i}>
                        <td style={{ textAlign: 'right' }}>
                          <NumInput val={row.qty} onChange={v => setERight(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))} width={52} />
                        </td>
                        <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</td>
                        <td style={{ textAlign: 'right' }}>
                          <NumInput val={row.amount} onChange={v => setERight(p => p.map((r, j) => j === i ? { ...r, amount: v } : r))} step="0.01" width={60} />
                        </td>
                        <td style={YC}>{total > 0 ? formatCurrency(total) : '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
          {/* E. Total spans full width */}
          <table className="dt" style={{ fontSize: 12 }}>
            <tbody>
              <tr style={{ background: 'var(--g0)' }}>
                <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>E. Total</td>
                <td style={YC}>{formatCurrency(totE)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Sections F · G · H · I  (full width, stacked)
      ══════════════════════════════════════════════════════════════════════ */}

      {/* ── Section F ── */}
      <div className="card" ref={refF} style={{ marginBottom: 12 }}>
        <SecHead id="F" title="Returned but Uncounted Manual Change" total={totF} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'right', width: 90 }}>Qty</th>
              <th style={{ width: 60 }}></th>
              <th style={{ textAlign: 'right', width: 110 }}>Amount ($)</th>
              <th style={{ textAlign: 'right', background: '#fffde7', width: 120 }}>Total</th>
            </tr>
          </thead>
          <tbody>
            {fRows.map((row, i) => {
              const total = (parseFloat(row.qty) || 0) * (parseFloat(row.amount) || 0)
              return (
                <tr key={i}>
                  <td style={{ textAlign: 'right' }}>
                    <NumInput val={row.qty} onChange={v => setFRows(p => p.map((r, j) => j === i ? { ...r, qty: v } : r))} />
                  </td>
                  <td style={{ textAlign: 'center', color: 'var(--ts)', fontSize: 11 }}>ea. @</td>
                  <td style={{ textAlign: 'right' }}>
                    <NumInput val={row.amount} onChange={v => setFRows(p => p.map((r, j) => j === i ? { ...r, amount: v } : r))} step="0.01" width={100} />
                  </td>
                  <td style={YC}>{total > 0 ? formatCurrency(total) : '—'}</td>
                </tr>
              )
            })}
            <tr style={{ background: 'var(--g0)' }}>
              <td colSpan={3} style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>F. Total</td>
              <td style={YC}>{formatCurrency(totF)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Section G ── */}
      <div className="card" ref={refG} style={{ marginBottom: 12 }}>
        <SecHead id="G" title="Mutilated Currency, Foreign, and/or Bent Coin" total={totG} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Type</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Currency</td>
              <td style={{ textAlign: 'right' }}>
                <NumInput val={gCurr} onChange={setGCurr} step="0.01" width={120} />
              </td>
            </tr>
            <tr>
              <td>Coin</td>
              <td style={{ textAlign: 'right' }}>
                <NumInput val={gCoin} onChange={setGCoin} step="0.01" width={120} />
              </td>
            </tr>
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>G. Total</td>
              <td style={YC}>{formatCurrency(totG)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Section H ── */}
      <div className="card" ref={refH} style={{ marginBottom: 12 }}>
        <SecHead id="H" title="Changer Funds Outstanding (Per Form #1841 / #403-1)" total={totH} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Entry</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Changer Funds Outstanding</td>
              <td style={{ textAlign: 'right' }}>
                <NumInput val={hVal} onChange={setHVal} step="0.01" width={120} />
              </td>
            </tr>
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>H. Total</td>
              <td style={YC}>{formatCurrency(totH)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ── Section I ── */}
      <div className="card" ref={refI} style={{ marginBottom: 12 }}>
        <SecHead id="I" title="Net Unreimbursed Bill Changer Fund Shortage / (Overage)" total={Math.abs(totI)} />
        <table className="dt" style={{ fontSize: 12 }}>
          <thead>
            <tr>
              <th>Entry</th>
              <th style={{ textAlign: 'right', background: '#fffde7' }}>Amount ($)</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Shortage / (Overage) as of Yesterday</td>
              <td style={{ textAlign: 'right' }}>
                <NumInput val={iYest} onChange={setIYest} step="0.01" width={120} />
              </td>
            </tr>
            <tr>
              <td>Today's Shortage / (Overage)</td>
              <td style={{ textAlign: 'right' }}>
                <NumInput val={iToday} onChange={setIToday} step="0.01" width={120} />
              </td>
            </tr>
            <tr style={{ background: 'var(--g0)' }}>
              <td style={{ fontWeight: 700, fontSize: 11, color: 'var(--g8)' }}>I. Total</td>
              <td style={{ ...YC, color: totI < 0 ? 'var(--red)' : '#78590a' }}>{formatCurrency(totI)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════
          Summary & Submit
      ══════════════════════════════════════════════════════════════════════ */}
      <div className="card" style={{ border: `2px solid ${requiresNote ? 'var(--red)' : 'var(--g4)'}` }}>
        <div className="card-header" style={{ background: requiresNote ? 'var(--red-bg)' : 'var(--g0)' }}>
          <span className="card-title">Summary</span>
          <span className="card-sub">Cashroom Count Totals</span>
        </div>
        <div className="card-body">

          {/* Vertical section-by-section list */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 16 }}>
            <tbody>
              {([
                ['A', 'Currency',                                      totA],
                ['B', 'Rolled Coin',                                   totB],
                ['C', 'Coins in Counting Machines',                    totC],
                ['D', 'Bagged Coin (Full for Bank)',                   totD],
                ['E', 'Unissued Changer Funds',                        totE],
                ['F', 'Uncounted / Returned Changers',                 totF],
                ['G', 'Mutilated Currency, Foreign, and/or Bent Coin', totG],
              ] as [string, string, number][]).map(([sec, lbl, tot]) => (
                <tr key={sec} style={{ borderBottom: '1px solid var(--ow2)' }}>
                  <td style={{ padding: '7px 0', width: 24, color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>{sec}</td>
                  <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>{lbl}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                    {formatCurrency(tot)}
                  </td>
                </tr>
              ))}

              {/* Holdover deduction */}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--ts)', fontStyle: 'italic' }}>
                  Deduct Holdover (if any)
                </td>
                <td style={{ textAlign: 'right', padding: '7px 0' }}>
                  <NumInput val={holdover} onChange={setHoldover} step="0.01" width={110} />
                </td>
              </tr>

              {/* Total Cash */}
              <tr style={{ background: '#fffde7', borderBottom: '2px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: '#78590a' }}>Total Cash</td>
                <td style={{ ...YC, padding: '8px 0', fontSize: 15, fontFamily: 'DM Serif Display,serif' }}>
                  {formatCurrency(totalCash)}
                </td>
              </tr>

              {/* H */}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>H</td>
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>Changer Funds Outstanding</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                  {formatCurrency(totH)}
                </td>
              </tr>

              {/* I */}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>I</td>
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>Net Unreimbursed Bill Changer Shortage / (Overage)</td>
                <td style={{ textAlign: 'right', fontFamily: 'DM Serif Display,serif', fontSize: 14, padding: '7px 0' }}>
                  {formatCurrency(totI)}
                </td>
              </tr>

              {/* J */}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>J</td>
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>Replenishment in Transit</td>
                <td style={{ textAlign: 'right', padding: '7px 0' }}>
                  <NumInput val={replenishment} onChange={setReplenishment} step="0.01" width={110} />
                </td>
              </tr>

              {/* K */}
              <tr style={{ borderBottom: '1px solid var(--ow2)' }}>
                <td style={{ padding: '7px 0', color: 'var(--g7)', fontWeight: 700, fontSize: 13 }}>K</td>
                <td style={{ padding: '7px 8px', fontSize: 13, color: 'var(--td)' }}>Coin Purchase in Transit to / from Bank</td>
                <td style={{ textAlign: 'right', padding: '7px 0' }}>
                  <NumInput val={coinTransit} onChange={setCoinTransit} step="0.01" width={110} />
                </td>
              </tr>

              {/* Total Cashier's Fund TODAY */}
              <tr style={{ background: '#fffde7', borderBottom: '2px solid var(--ow2)' }}>
                <td />
                <td style={{ padding: '8px 8px', fontWeight: 700, fontSize: 13, color: '#78590a' }}>
                  Total Cashier's Fund – TODAY
                </td>
                <td style={{ ...YC, padding: '8px 0', fontSize: 15, fontFamily: 'DM Serif Display,serif' }}>
                  {formatCurrency(totalFund)}
                </td>
              </tr>
            </tbody>
          </table>

          {/* Imprest / Tolerance / Variance */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0' }}>
            <span style={{ color: 'var(--ts)' }}>Cashier's Fund Imprest Balance (this location)</span>
            <span style={{ color: 'var(--ts)', fontFamily: 'DM Serif Display,serif' }}>{formatCurrency(expectedCash)}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
            <span style={{ color: 'var(--ts)', fontSize: 12 }}>Tolerance Threshold</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: requiresNote ? 'var(--red)' : 'var(--g7)' }}>
              ±{tolerance.toFixed(1)}%&nbsp;
              <span style={{ fontWeight: 400, color: 'var(--ts)' }}>(±{formatCurrency(expectedCash * tolerance / 100)})</span>
            </span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderTop: '2px solid var(--ow2)', marginTop: 6 }}>
            <strong style={{ color: varColor }}>Variance – Short or (Over)</strong>
            <strong style={{ fontFamily: 'DM Serif Display,serif', fontSize: 18, color: varColor }}>
              {variance >= 0 ? '+' : ''}{formatCurrency(variance)}&nbsp;
              ({variancePct >= 0 ? '+' : ''}{variancePct.toFixed(2)}%)
            </strong>
          </div>

          {/* Variance exception alert */}
          {requiresNote && (
            <div style={{ marginTop: 14 }}>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '12px 16px', borderRadius: 8, marginBottom: 12,
                background: 'var(--red-bg)', border: '1px solid #fca5a5',
              }}>
                <span style={{ fontSize: 20 }}>🚨</span>
                <div>
                  <div style={{ fontWeight: 700, fontSize: 13, color: 'var(--red)', marginBottom: 3 }}>
                    Variance exceeds ±{tolerance.toFixed(1)}% threshold
                  </div>
                  <div style={{ fontSize: 12, color: 'var(--red)', lineHeight: 1.55 }}>
                    A written explanation is required before this submission can proceed.
                  </div>
                </div>
              </div>
              <div style={{
                display: 'flex', gap: 12, alignItems: 'flex-start',
                padding: '10px 14px', borderRadius: 8, marginBottom: 12,
                background: 'var(--amb-bg)', border: '1px solid #fcd34d',
              }}>
                <span style={{ fontSize: 18 }}>📋</span>
                <div style={{ fontSize: 12, color: '#92400e', lineHeight: 1.55 }}>
                  <strong>Compliance flag:</strong> This submission will be marked as a{' '}
                  <strong>variance exception</strong> in compliance reports, regardless of the controller's approval decision.
                </div>
              </div>
              <label className="f-lbl">
                Variance Explanation <span style={{ color: 'var(--red)' }}>*</span>
              </label>
              <textarea
                className="f-ta" rows={3}
                placeholder="Explain the cause of the variance (e.g. denomination counting error in Section A — recounted and confirmed)."
                value={varianceNote}
                onChange={e => setVarianceNote(e.target.value)}
              />
            </div>
          )}

          {submitError && <div className="login-error" style={{ marginTop: 8 }}>{submitError}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 18, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" onClick={handleSubmit} disabled={totalFund === 0 || submitting}>
              ✓ Submit for Approval
            </button>
            <button className="btn btn-outline" onClick={handleSaveDraft}>
              {editingStatus === 'pending_approval' ? '💾 Save Changes' : '💾 Save Draft'}
            </button>
            <button className="btn btn-outline" style={{ color: 'var(--red)', borderColor: '#fca5a5' }} onClick={handleDiscard}>
              🗑 Discard
            </button>
            <button className="btn btn-outline" onClick={() => onNavigate(ctx.from || 'op-start', ctx)}>
              ← Back
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
