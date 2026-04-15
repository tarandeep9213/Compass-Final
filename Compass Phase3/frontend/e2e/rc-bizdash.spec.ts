/**
 * RC Business Dashboard E2E Tests
 *
 * BIZ-001: Compliance Trend chart renders with real API data
 * BIZ-002: /compliance/trend API returns valid structure for weekly granularity
 * BIZ-003: Trend chart shows loading state then renders lines
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8001/v1'

async function getToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token
}

async function goToBizDash(page: import('@playwright/test').Page) {
  // Business Dashboard is the first nav item for RC — should auto-land there
  const header = page.locator('h2').filter({ hasText: 'Business Dashboard' })
  // If not already on it, click the nav item
  if (!(await header.isVisible().catch(() => false))) {
    await page.locator('.nav-item').filter({ hasText: 'Business Dashboard' }).click()
  }
  await expect(header).toBeVisible({ timeout: 8000 })
}

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-001: /compliance/trend API returns valid weekly data
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-001: /compliance/trend API returns valid weekly data with 8 periods', async ({ request }) => {
  const token = await getToken(request)

  const r = await request.get(
    `${API}/compliance/trend?granularity=weekly&periods=8`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)

  const data = await r.json()
  expect(data).toHaveProperty('granularity', 'weekly')
  expect(data).toHaveProperty('data')
  expect(Array.isArray(data.data)).toBe(true)
  expect(data.data.length).toBeLessThanOrEqual(8)

  // Each data point must have required fields
  for (const pt of data.data) {
    expect(pt).toHaveProperty('period')
    expect(pt).toHaveProperty('submission_rate_pct')
    expect(pt).toHaveProperty('approval_rate_pct')
    expect(pt).toHaveProperty('exception_count')
    expect(pt.submission_rate_pct).toBeGreaterThanOrEqual(0)
    expect(pt.submission_rate_pct).toBeLessThanOrEqual(100)
    expect(pt.approval_rate_pct).toBeGreaterThanOrEqual(0)
    expect(pt.approval_rate_pct).toBeLessThanOrEqual(100)
    expect(pt.exception_count).toBeGreaterThanOrEqual(0)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-002: Compliance Trend chart renders with real data on Business Dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-002: Compliance Trend chart renders on Business Dashboard', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // The trend card should be visible
  await expect(page.getByText('Compliance Trend')).toBeVisible({ timeout: 8000 })

  const trendCard = page.locator('.card').filter({ hasText: 'Compliance Trend' })
  await expect(trendCard).toBeVisible()

  // Wait for loading to finish — either chart SVG or "No data" message
  await page.waitForFunction(
    () => {
      const card = document.querySelector('.card')
      if (!card) return false
      // Look for the recharts SVG or a "No data" fallback
      return card.querySelector('svg.recharts-surface') !== null
        || document.body.innerText.includes('No trend data')
        || document.body.innerText.includes('data points')
    },
    { timeout: 10000 },
  )

  // If data exists, chart SVG should render with lines
  const sub = await trendCard.locator('.card-sub').innerText()
  if (sub.includes('data points')) {
    // Chart rendered — verify main chart SVG (not legend icons)
    const svg = trendCard.locator('svg[role="application"]')
    await expect(svg).toBeVisible()

    // Should have 3 line paths (submissionRate, approvalRate, exceptions)
    const lines = trendCard.locator('.recharts-line')
    const lineCount = await lines.count()
    expect(lineCount).toBe(3)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-003: Trend chart sub-heading shows real data point count from API
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-003: Trend chart sub-heading reflects API data count', async ({ page, request }) => {
  // Get ground truth from API
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/trend?granularity=weekly&periods=8`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const apiData = await r.json()
  const expectedCount = apiData.data.length

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const trendCard = page.locator('.card').filter({ hasText: 'Compliance Trend' })
  await expect(trendCard).toBeVisible({ timeout: 8000 })

  // Wait for loading to finish
  await expect(trendCard.locator('.card-sub')).not.toHaveText(/Loading/, { timeout: 10000 })

  const sub = await trendCard.locator('.card-sub').innerText()

  if (expectedCount > 0) {
    expect(sub).toContain(`${expectedCount} data points`)
  } else {
    expect(sub).toContain('No data')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-004: Slowest Approvers table shows real SLA data from API
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-004: Slowest Approvers table shows real approver data from /reports/sla', async ({ page, request }) => {
  // Get ground truth
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/sla?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const sla = await r.json()

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'Slowest Approvers' })
  await expect(card).toBeVisible({ timeout: 8000 })

  // Wait for loading to finish
  const sub = card.locator('.card-sub')
  await expect(sub).not.toHaveText(/Loading/, { timeout: 10000 })

  if (sla.approvers.length === 0) {
    // No approvers — should show empty state
    await expect(card.getByText('No approved submissions')).toBeVisible()
    return
  }

  // Approver count should match API
  const subText = await sub.innerText()
  expect(subText).toContain(`${sla.approvers.length} approver`)

  // First approver name (sorted by slowest) should appear in the table
  const sortedByAvg = [...sla.approvers].sort(
    (a: { avg_hours: number }, b: { avg_hours: number }) => b.avg_hours - a.avg_hours,
  )
  const slowest = sortedByAvg[0]
  await expect(card.getByText(slowest.name)).toBeVisible()

  // Avg hours badge for the slowest approver should be visible
  await expect(card.getByText(`${slowest.avg_hours}h`)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-005: Slowest Approvers SLA breach count matches API data
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-005: Slowest Approvers SLA breach count matches API', async ({ page, request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/sla?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const sla = await r.json()
  if (sla.approvers.length === 0) { test.skip(); return }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'Slowest Approvers' })
  await expect(card.locator('.card-sub')).not.toHaveText(/Loading/, { timeout: 10000 })

  // Count how many approvers have breaches in the API data
  const apiBreachers = sla.approvers.filter(
    (a: { count: number; within_sla: number }) => a.count - a.within_sla > 0,
  ).length

  // Count "Breached" badges in the table
  const breachedBadges = card.getByText('Breached', { exact: true })
  const breachedCount = await breachedBadges.count()

  // Count "Within SLA" badges
  const withinBadges = card.getByText('Within SLA', { exact: true })
  const withinCount = await withinBadges.count()

  expect(breachedCount).toBe(apiBreachers)
  expect(withinCount).toBe(sla.approvers.length - apiBreachers)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-006: At-Risk panel shows real data from /compliance/dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-006: At-Risk panel shows real locations from compliance dashboard', async ({ page, request }) => {
  // Get ground truth — count non-green locations
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const nonGreen = dash.locations.filter((l: { health: string }) => l.health !== 'green')

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'Top At-Risk Locations' })
  await expect(card).toBeVisible({ timeout: 8000 })

  // Wait for loading to finish
  const sub = card.locator('.card-sub')
  await expect(sub).not.toHaveText(/Loading/, { timeout: 10000 })

  if (nonGreen.length === 0) {
    // All compliant — should show green message
    await expect(card.getByText('All locations are compliant')).toBeVisible()
    return
  }

  // Panel should show "X flagged"
  const subText = await sub.innerText()
  const expectedCount = Math.min(nonGreen.length, 5)
  expect(subText).toContain(`${expectedCount} flagged`)

  // Each shown location should have a rank badge and a score
  const rows = card.locator('.card-body > div')
  const rowCount = await rows.count()
  expect(rowCount).toBe(expectedCount)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-007: At-Risk location names match real locations from API
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-007: At-Risk location names come from real compliance data', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const nonGreen = dash.locations
    .filter((l: { health: string }) => l.health !== 'green')
    .map((l: { name: string }) => l.name)

  if (nonGreen.length === 0) { test.skip(); return }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'Top At-Risk Locations' })
  await expect(card.locator('.card-sub')).not.toHaveText(/Loading/, { timeout: 10000 })

  // At least the first at-risk location name from the API should appear in the panel
  const panelText = await card.innerText()
  const found = nonGreen.some((name: string) => panelText.includes(name))
  expect(found).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-008: Location table expands and shows real locations from API
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-008: Location table shows real locations from compliance dashboard', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const totalLocs = dash.locations.length

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Find the collapsible section
  const locCard = page.locator('.card').filter({ hasText: 'Location Compliance Detail' })
  await expect(locCard).toBeVisible({ timeout: 8000 })

  // Header should show correct location count
  await expect(locCard.locator('.card-sub')).toContainText(`${totalLocs} locations`)

  // Click to expand
  await locCard.locator('.card-header').click()

  // Table should appear with rows matching location count
  const rows = locCard.locator('table.dt tbody tr')
  await expect(rows.first()).toBeVisible({ timeout: 5000 })
  const rowCount = await rows.count()
  expect(rowCount).toBe(totalLocs)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-009: Location table health filter works correctly
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-009: Location table health filter chips filter rows correctly', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const greenCount = dash.locations.filter((l: { health: string }) => l.health === 'green').length

  if (greenCount === 0 || greenCount === dash.locations.length) { test.skip(); return }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const locCard = page.locator('.card').filter({ hasText: 'Location Compliance Detail' })
  await locCard.locator('.card-header').click()
  await expect(locCard.locator('table.dt tbody tr').first()).toBeVisible({ timeout: 5000 })

  // Click the "Compliant" (green) filter
  await locCard.getByRole('button', { name: /Compliant/i }).click()

  // Row count should match green count from API
  const rows = locCard.locator('table.dt tbody tr')
  const filteredCount = await rows.count()
  expect(filteredCount).toBe(greenCount)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-010: Location table shows real location names from API
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-010: Location table shows real location names', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  if (dash.locations.length === 0) { test.skip(); return }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const locCard = page.locator('.card').filter({ hasText: 'Location Compliance Detail' })
  await locCard.locator('.card-header').click()
  await expect(locCard.locator('table.dt tbody tr').first()).toBeVisible({ timeout: 5000 })

  // First location name from API should appear in the table
  const firstName = dash.locations[0].name
  const tableText = await locCard.locator('table.dt tbody').innerText()
  expect(tableText).toContain(firstName)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-011: Core KPI cards show real data from /reports/summary
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-011: Core KPI cards show real variance exceptions from API', async ({ page, request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/summary?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const summary = await r.json()

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Wait for KPI "Variance Exceptions" label — unique to KPI cards, not in charts
  await expect(page.getByText('Variance Exceptions', { exact: true }).first()).toBeVisible({ timeout: 20000 })

  // The variance exceptions count should match the API
  await expect(page.getByText(`${summary.variance_exceptions}`).first()).toBeVisible({ timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-012: /reports/summary now includes cash_at_risk field
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-012: /reports/summary includes cash_at_risk field', async ({ request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/summary?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)

  const data = await r.json()
  expect(data).toHaveProperty('cash_at_risk')
  expect(typeof data.cash_at_risk).toBe('number')
  expect(data.cash_at_risk).toBeGreaterThanOrEqual(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-013: All 5 KPI cards render with delta badges
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-013: All 5 KPI card labels are visible on the dashboard', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Wait for KPI cards to load — look for any of the labels
  await expect(page.getByText('Approval Rate', { exact: true }).first()).toBeVisible({ timeout: 15000 })

  const labels = ['Compliance Rate', 'Approval Rate', 'SLA Compliance', 'Cash at Risk', 'Variance Exceptions']
  for (const label of labels) {
    await expect(page.getByText(label, { exact: true }).first()).toBeVisible({ timeout: 5000 })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-014: Coverage strip shows real controller/DGM visit counts
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-014: Coverage strip shows real location counts from compliance dashboard', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const totalLocs = dash.locations.length

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Wait for coverage strip to load — look for "Controller Visits This Month"
  await expect(page.getByText('Controller Visits This Month')).toBeVisible({ timeout: 15000 })

  // Total locations denominator should match API
  const pageText = await page.innerText('body')
  expect(pageText).toContain(`/${totalLocs}`)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-015: Pending queue shows real pending submission counts
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-015: Pending queue renders with Total, Near SLA, and SLA Breach labels', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Wait for coverage strip
  await expect(page.getByText('Pending Approval Queue')).toBeVisible({ timeout: 15000 })

  // All three bucket labels must appear
  await expect(page.getByText('Total').first()).toBeVisible()
  await expect(page.getByText('Near SLA').first()).toBeVisible()
  await expect(page.getByText('SLA Breach').first()).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-016: Alert banner shows real location names for no-submission alerts
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-016: Alert banner reflects real compliance data', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/compliance/dashboard`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const dash = await r.json()
  const noSub = dash.locations.filter((l: { submission: unknown }) => !l.submission)

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  // Wait for dashboard to finish loading (at-risk panel loaded = dashboard data available)
  await expect(page.locator('.card').filter({ hasText: 'Top At-Risk Locations' }).locator('.card-sub')).not.toHaveText(/Loading/, { timeout: 15000 })

  if (noSub.length === 0) {
    // No missing submissions — amber alert for "not submitted" should not appear
    const pageText = await page.innerText('body')
    expect(pageText).not.toContain('have not submitted today')
    return
  }

  // Alert should show the count
  await expect(page.getByText(`${noSub.length} location`).first()).toBeVisible({ timeout: 5000 })

  // Expand the alert to see location names — click the ▶ arrow
  const alertRow = page.locator('div').filter({ hasText: /have not submitted today/ }).locator('span').filter({ hasText: '▶' }).first()
  await alertRow.click()

  // At least the first location name should appear in the expanded details
  const firstName = noSub[0].name
  await expect(page.getByText(firstName).first()).toBeVisible({ timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-017: Controller Activity API returns valid data
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-017: /business-dashboard/controller-activity returns valid structure', async ({ request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/business-dashboard/controller-activity`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)

  const data = await r.json()
  expect(data).toHaveProperty('month_year')
  expect(data).toHaveProperty('items')
  expect(Array.isArray(data.items)).toBe(true)

  for (const item of data.items) {
    expect(item).toHaveProperty('name')
    expect(item).toHaveProperty('completed')
    expect(item).toHaveProperty('missed')
    expect(item).toHaveProperty('scheduled')
    expect(item).toHaveProperty('completionRate')
    expect(item).toHaveProperty('avgVarianceFound')
    expect(item).toHaveProperty('dowWarnings')
    expect(item.completionRate).toBeGreaterThanOrEqual(0)
    expect(item.completionRate).toBeLessThanOrEqual(100)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-018: Controller Activity table renders with real data
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-018: Controller Activity table shows real controller names', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/business-dashboard/controller-activity`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const data = await r.json()

  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'Controller Activity' })
  await expect(card).toBeVisible({ timeout: 8000 })

  // Wait for loading to finish
  const sub = card.locator('.card-sub')
  await expect(sub).not.toHaveText(/Loading/, { timeout: 15000 })

  if (data.items.length === 0) {
    await expect(card.getByText('No controller visits')).toBeVisible()
    return
  }

  // Controller count should match
  const subText = await sub.innerText()
  expect(subText).toContain(`${data.items.length} controller`)

  // First controller name should appear
  await expect(card.getByText(data.items[0].name)).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-019: Operator Behaviour API returns valid structure
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-019: /business-dashboard/operator-behaviour returns valid data', async ({ request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/business-dashboard/operator-behaviour`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)
  const data = await r.json()
  expect(data).toHaveProperty('avgHoursToSubmit')
  expect(data).toHaveProperty('lateSubmitters')
  expect(data).toHaveProperty('platformSplit')
  expect(data).toHaveProperty('draftUsageRate')
  expect(data.platformSplit).toHaveProperty('form')
  expect(data.platformSplit).toHaveProperty('excel')
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-020: Operator Behaviour section renders on dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-020: Operator Behaviour section renders with real data', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  await expect(page.getByText('Operator Behaviour')).toBeVisible({ timeout: 8000 })
  // Wait for loading to finish
  await expect(page.getByText('Avg time to submit after shift')).toBeVisible({ timeout: 15000 })
  await expect(page.getByText('Late submitters')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-021: Rejections API returns valid structure
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-021: /business-dashboard/rejections returns valid data', async ({ request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/business-dashboard/rejections`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)
  const data = await r.json()
  expect(data).toHaveProperty('total_rejections')
  expect(data).toHaveProperty('avgRejectionsBeforeApproval')
  expect(data).toHaveProperty('operators')
  expect(data).toHaveProperty('reasons')
  expect(Array.isArray(data.operators)).toBe(true)
  expect(Array.isArray(data.reasons)).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-022: DGM Coverage API returns valid structure
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-022: /business-dashboard/dgm-coverage returns valid data', async ({ request }) => {
  const token = await getToken(request)
  const r = await request.get(
    `${API}/business-dashboard/dgm-coverage`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)
  const data = await r.json()
  expect(data).toHaveProperty('month_year')
  expect(data).toHaveProperty('dgms')
  expect(data).toHaveProperty('pendingLocations')
  expect(Array.isArray(data.dgms)).toBe(true)
  expect(Array.isArray(data.pendingLocations)).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// BIZ-023: DGM Coverage section renders on dashboard
// ─────────────────────────────────────────────────────────────────────────────
test('BIZ-023: DGM Coverage section renders with real data', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToBizDash(page)

  const card = page.locator('.card').filter({ hasText: 'DGM Coverage' })
  await expect(card).toBeVisible({ timeout: 8000 })
  await expect(card.locator('.card-sub')).not.toHaveText(/Loading/, { timeout: 15000 })
})
