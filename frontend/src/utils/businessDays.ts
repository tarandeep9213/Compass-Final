/**
 * Business-day helpers — mirror of backend/app/core/business_days.py.
 * Cashrooms don't operate Sat/Sun, so UI that's about "today" or that
 * defaults to a current date should use these instead of raw Date().
 */

/** True for Mon-Fri, false for Sat/Sun. */
export function isBusinessDay(d: Date): boolean {
  const dow = d.getDay() // 0=Sun, 1=Mon, ..., 6=Sat
  return dow !== 0 && dow !== 6
}

/**
 * Return the most recent business day as YYYY-MM-DD (today if today is Mon-Fri,
 * otherwise the previous Friday).
 */
export function mostRecentBusinessDateISO(): string {
  const d = new Date()
  while (!isBusinessDay(d)) {
    d.setDate(d.getDate() - 1)
  }
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
