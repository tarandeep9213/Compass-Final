import { useState, useRef } from 'react'
import { read } from 'xlsx'
import { getLocation } from '../../mock/data'

interface Props {
  ctx: Record<string, string>
  onNavigate: (panel: string, ctx?: Record<string, string>) => void
}

const SECTION_LABELS: Record<string, string> = {
  A: 'Currency (Bills)',
  B: 'Rolled Coin',
  C: 'Coins in Counting Machines',
  D: 'Bagged Coin (Full for Bank)',
  E: 'Unissued Changer Funds',
  F: 'Returned Uncounted Funds',
  G: 'Mutilated / Foreign / Bent Coin',
  H: 'Changer Funds Outstanding',
  I: 'Net Unreimbursed Shortage / (Overage)',
}


export interface ExcelPrefillData {
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
}

function cv(ws: Record<string, { v?: unknown }>, addr: string): number {
  const cell = ws[addr]
  return typeof cell?.v === 'number' ? cell.v : 0
}

function parseSheet(fileBuffer: ArrayBuffer): ExcelPrefillData & { rows: { section: string; label: string; total: number }[] } {
  const wb = read(fileBuffer, { type: 'array' })
  const sheetName = wb.SheetNames.find(n => n.toLowerCase().includes('cashroom form')) ?? wb.SheetNames[0]
  const ws = wb.Sheets[sheetName] as Record<string, { v?: unknown }>
  if (!ws) throw new Error('No valid sheet found in this workbook.')

  // ── Section A: Currency (col B = dollar amount, rows 7–14) ──────────────
  const denomA: Record<string, number> = {
    ones:     cv(ws, 'B7'),
    twos:     cv(ws, 'B8'),
    fives:    cv(ws, 'B9'),
    tens:     cv(ws, 'B10'),
    twenties: cv(ws, 'B11'),
    fifties:  cv(ws, 'B12'),
    hundreds: cv(ws, 'B13'),
    other:    cv(ws, 'B14'),
  }

  // ── Section B: Rolled Coin (col E = dollar amount, rows 7–12) ───────────
  const denomB: Record<string, number> = {
    dollar:   cv(ws, 'E7'),
    halves:   cv(ws, 'E8'),
    quarters: cv(ws, 'E9'),
    dimes:    cv(ws, 'E10'),
    nickels:  cv(ws, 'E11'),
    pennies:  cv(ws, 'E12'),
  }

  // ── Section C: Coins in Counting Machines (col H=No.1, col I=No.2, rows 8–13) ──
  const denomC: Record<string, { m1: number; m2: number }> = {
    cDollar:   { m1: cv(ws,'H8'),  m2: cv(ws,'I8')  },
    cHalves:   { m1: cv(ws,'H9'),  m2: cv(ws,'I9')  },
    cQuarters: { m1: cv(ws,'H10'), m2: cv(ws,'I10') },
    cDimes:    { m1: cv(ws,'H11'), m2: cv(ws,'I11') },
    cNickels:  { m1: cv(ws,'H12'), m2: cv(ws,'I12') },
    cPennies:  { m1: cv(ws,'H13'), m2: cv(ws,'I13') },
  }

  // ── Section D: Bagged Coin (col B = bag count, rows 19–22) ─────────────
  const denomD: Record<string, number> = {
    dDollar:   cv(ws, 'B19'),
    dQuarters: cv(ws, 'B20'),
    dDimes:    cv(ws, 'B21'),
    dNickels:  cv(ws, 'B22'),
  }

  // ── Section E: Unissued Changer Funds (rows 19–23) ──────────────────────
  //   Left:  col E = qty, col G = amount per fund
  //   Right: col I = qty, col K = amount per fund
  const eRows = ['19','20','21','22','23']
  const denomELeft  = eRows
    .map(r => ({ qty: cv(ws,`E${r}`), amount: cv(ws,`G${r}`) }))
    .filter(r => r.qty > 0 || r.amount > 0)
  const denomERight = eRows
    .map(r => ({ qty: cv(ws,`I${r}`), amount: cv(ws,`K${r}`) }))
    .filter(r => r.qty > 0 || r.amount > 0)

  // ── Section F: Returned Uncounted Funds (col A = qty, col C = amount, rows 29–32) ──
  const denomFRows = ['29','30','31','32']
    .map(r => ({ qty: cv(ws,`A${r}`), amount: cv(ws,`C${r}`) }))
    .filter(r => r.qty > 0 || r.amount > 0)

  // ── Section G: Mutilated/Foreign/Bent ───────────────────────────────────
  const gCurrency = cv(ws, 'B38')
  const gCoin     = cv(ws, 'B39')

  // ── Section H: Changer Funds Outstanding ────────────────────────────────
  const hValue = cv(ws, 'B47')

  // ── Section I: Net Unreimbursed Shortage ────────────────────────────────
  const iYesterday = cv(ws, 'E51')
  const iToday     = cv(ws, 'E53')

  // ── Section totals (summary col I, rows 40–50) ──────────────────────────
  const s = {
    A: cv(ws,'I40'), B: cv(ws,'I41'), C: cv(ws,'I42'),
    D: cv(ws,'I43'), E: cv(ws,'I44'), F: cv(ws,'I45'),
    G: cv(ws,'I46'), H: cv(ws,'I49'), I: cv(ws,'I50'),
  }

  const nonZero = Object.values(s).filter(v => v !== 0).length
  if (nonZero < 1 && !denomA.ones && !denomB.dollar) {
    throw new Error('Could not read section totals. Please upload the correct "Final Cashroom Form" spreadsheet.')
  }

  const totalFund = cv(ws, 'I52') || Object.values(s).reduce((a, b) => a + b, 0)

  return {
    sections: s,
    totalFund,
    fileName: '',
    denomDetail: {
      A: denomA,
      B: denomB,
      C: denomC,
      D: denomD,
      E: { left: denomELeft, right: denomERight },
      F: denomFRows,
      G: { currency: gCurrency, coin: gCoin },
      H: { value: hValue },
      I: { yesterday: iYesterday, today: iToday },
    },
    rows: ['A','B','C','D','E','F','G','H','I'].map(sec => ({
      section: sec,
      label: SECTION_LABELS[sec],
      total: s[sec as keyof typeof s],
    })),
  }
}

type UploadState = 'idle' | 'dragging' | 'parsing' | 'error'

export default function OpExcel({ ctx, onNavigate }: Props) {
  const location = getLocation(ctx.locationId)
  const dateLabel = new Date(ctx.date + 'T12:00:00').toLocaleDateString('en-GB', {
    weekday: 'short', day: 'numeric', month: 'short',
  })

  const [state, setState] = useState<UploadState>('idle')
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  async function parseFile(file: File) {
    setFileName(file.name)
    setState('parsing')
    setParseError('')
    try {
      const buffer = await file.arrayBuffer()
      const result = parseSheet(buffer)

      const prefillData: ExcelPrefillData = {
        denomDetail: result.denomDetail,
        sections: result.sections,
        totalFund: result.totalFund,
        fileName: file.name,
      }
      sessionStorage.setItem(
        `excel_prefill_${ctx.locationId}_${ctx.date}`,
        JSON.stringify(prefillData)
      )
      onNavigate('op-form', { ...ctx, fromExcel: 'true' })
    } catch (err: unknown) {
      setParseError(err instanceof Error ? err.message : 'Failed to parse file.')
      setState('error')
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setState('idle')
    const file = e.dataTransfer.files[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setState('error'); setParseError('Invalid file type. Please upload an .xlsx or .xls file.'); return }
    parseFile(file)
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.name.match(/\.(xlsx|xls)$/i)) { setState('error'); setParseError('Invalid file type. Please upload an .xlsx or .xls file.'); return }
    parseFile(file)
  }

  return (
    <div className="fade-up">
      <div className="ph">
        <div>
          <h2>Excel Upload</h2>
          <p><strong>{location?.name}</strong> · {dateLabel}</p>
        </div>
        <div className="ph-right">
          <button className="btn btn-outline" onClick={() => onNavigate('op-method', ctx)}>← Change method</button>
        </div>
      </div>

      {/* Template notice */}
      <div className="alert-info" style={{ marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 16 }}>📄</span>
        <div style={{ fontSize: 13, flex: 1 }}>
          Upload your completed <strong>Daily Cashroom Count Worksheet</strong> (.xlsx or .xls).
          Sections A–I are parsed and the form will be pre-filled for review.
        </div>
        <a
          href="/cashroom-template.xlsx"
          download="Cashroom Count Worksheet.xlsx"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            fontSize: 12, fontWeight: 600, color: 'var(--g7)',
            background: 'var(--g0)', border: '1px solid var(--g3)',
            borderRadius: 7, padding: '6px 14px', textDecoration: 'none',
            whiteSpace: 'nowrap', flexShrink: 0,
          }}
        >
          ⬇ Sample Excel
        </a>
      </div>

      {/* Drop zone */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">Upload Spreadsheet</span>
        </div>
        <div className="card-body">
          <div
            onDragOver={e => { e.preventDefault(); setState('dragging') }}
            onDragLeave={() => setState(s => s === 'dragging' ? 'idle' : s)}
            onDrop={handleDrop}
            onClick={() => { if (state !== 'parsing') inputRef.current?.click() }}
            style={{
              border: `2px dashed ${state === 'dragging' ? 'var(--g4)' : state === 'error' ? 'var(--red)' : 'var(--ow2)'}`,
              borderRadius: 10, padding: '48px 24px', textAlign: 'center', cursor: state === 'parsing' ? 'default' : 'pointer',
              background: state === 'dragging' ? 'var(--g0)' : state === 'error' ? 'var(--red-bg)' : '#fff',
              transition: 'all 0.15s',
            }}
          >
            {state === 'parsing' ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>⏳</div>
                <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 6 }}>Parsing {fileName}…</div>
                <div style={{ fontSize: 12, color: 'var(--ts)' }}>Reading sections A–I and preparing form</div>
              </>
            ) : state === 'error' ? (
              <>
                <div style={{ fontSize: 36, marginBottom: 12 }}>❌</div>
                <div style={{ fontSize: 14, fontWeight: 600, color: 'var(--red)', marginBottom: 6 }}>
                  {parseError || 'Invalid file'}
                </div>
                <button className="btn btn-outline" style={{ marginTop: 14 }} onClick={e => { e.stopPropagation(); setState('idle'); setParseError('') }}>Try again</button>
              </>
            ) : (
              <>
                <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
                <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 6 }}>
                  {state === 'dragging' ? 'Drop to upload' : 'Drag & drop your spreadsheet here'}
                </div>
                <div style={{ fontSize: 12, color: 'var(--ts)', marginBottom: 14 }}>or click to browse — .xlsx / .xls accepted</div>
                <button className="btn btn-outline" onClick={e => { e.stopPropagation(); inputRef.current?.click() }}>Browse files</button>
              </>
            )}
          </div>
          <input ref={inputRef} type="file" accept=".xlsx,.xls" style={{ display: 'none' }} onChange={handleFileInput} />
        </div>
      </div>
    </div>
  )
}
