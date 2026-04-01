/** Fiscal year: Oct 1 – Sep 30 | P1=Oct … P12=Sep | Q1=Oct-Dec … Q4=Jul-Sep */

export interface FiscalPeriod {
  p: string   // e.g. 'P4'
  q: string   // e.g. 'Q2'
  fy: number  // e.g. 2026
  label: string // e.g. 'P4 / Q2 FY2026'
}

export function getFiscalPeriod(dateStr: string): FiscalPeriod {
  if (!dateStr) return { p: '', q: '', fy: 0, label: '' }
  const d = new Date(dateStr + 'T12:00:00')
  const m = d.getMonth() // 0=Jan … 11=Dec
  const fp = m >= 9 ? m - 8 : m + 4 // Oct(9)->1 … Sep(8)->12
  const p = 'P' + fp
  const q = fp <= 3 ? 'Q1' : fp <= 6 ? 'Q2' : fp <= 9 ? 'Q3' : 'Q4'
  const fy = m >= 9 ? d.getFullYear() + 1 : d.getFullYear()
  return { p, q, fy, label: `${p} / ${q} FY${fy}` }
}

export interface SectionAEntry {
  date: string
  sA: number
}

export interface PeriodGroup {
  p: string
  fy: number
  label: string
  rows: SectionAEntry[]
}

export function groupByFiscalPeriod(sectionAData: SectionAEntry[]): PeriodGroup[] {
  const groups: Record<string, PeriodGroup> = {}
  sectionAData.forEach(d => {
    const fp = getFiscalPeriod(d.date)
    const key = fp.p + '|' + fp.fy
    if (!groups[key]) groups[key] = { p: fp.p, fy: fp.fy, label: fp.p, rows: [] }
    groups[key].rows.push(d)
  })
  return Object.values(groups).sort((a, b) => (a.fy + a.p).localeCompare(b.fy + b.p))
}
