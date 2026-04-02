/**
 * Variance color based on per-location exception flag (preferred) or global tolerance (fallback).
 * When varianceException is provided (from API), use it directly — it already accounts for per-location tolerance.
 * When not provided, fall back to comparing against the global tolerance.
 */
export function varColor(pct: number, tolerance: number, varianceException?: boolean): string {
  if (varianceException !== undefined) {
    return varianceException ? 'var(--red)' : 'var(--g7)'
  }
  const amber = tolerance / 2
  return Math.abs(pct) > tolerance ? 'var(--red)'
       : Math.abs(pct) > amber     ? 'var(--amb)'
       : 'var(--g7)'
}

/** Variance highlight for KpiCard */
export function varHighlight(pct: number, tolerance: number, varianceException?: boolean): 'red' | 'amber' | false {
  if (varianceException !== undefined) {
    return varianceException ? 'red' : false
  }
  const amber = tolerance / 2
  return Math.abs(pct) > tolerance ? 'red'
       : Math.abs(pct) > amber     ? 'amber'
       : false
}

/** Default tolerance used as fallback before config is fetched */
export const DEFAULT_TOLERANCE = 0.5
