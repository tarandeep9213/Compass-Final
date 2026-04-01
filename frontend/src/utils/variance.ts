/** Variance color based on configurable tolerance (red = exceeds tolerance, amber = exceeds half) */
export function varColor(pct: number, tolerance: number): string {
  const amber = tolerance / 2
  return Math.abs(pct) > tolerance ? 'var(--red)'
       : Math.abs(pct) > amber     ? 'var(--amb)'
       : 'var(--g7)'
}

/** Variance highlight for KpiCard (red/amber/false) */
export function varHighlight(pct: number, tolerance: number): 'red' | 'amber' | false {
  const amber = tolerance / 2
  return Math.abs(pct) > tolerance ? 'red'
       : Math.abs(pct) > amber     ? 'amber'
       : false
}

/** Default tolerance used as fallback before config is fetched */
export const DEFAULT_TOLERANCE = 0.5
