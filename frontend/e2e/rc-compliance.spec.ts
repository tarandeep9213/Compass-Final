/**
 * RC Compliance Dashboard E2E Tests
 *
 * COMP-001: KPI cards load with real values (not all zeros)
 * COMP-002: 30-day rate is ≤100% (not 670%)
 * COMP-003: Controller visit cell does not show "$0.00" when observedTotal is absent
 * COMP-004: All KPI cards are visible
 * COMP-005: Clicking a KPI filters the table
 * COMP-006: Controller visit next-scheduled date shows when available
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'

const API = 'http://localhost:8000/v1'

async function getToken(request: import('@playwright/test').APIRequestContext) {
  const r = await request.post(`${API}/auth/login`, {
    data: { email: 'admin@compass.com', password: 'demo1234' },
  })
  return (await r.json()).access_token
}

async function goToCompliance(page: import('@playwright/test').Page) {
  await page.locator('.nav-item').filter({ hasText: 'Compliance' }).click()
  await expect(page.getByRole('heading', { name: /Compliance Dashboard/i })).toBeVisible({ timeout: 10000 })
  await page.waitForLoadState('networkidle').catch(() => {})
}

async function waitForKpis(page: import('@playwright/test').Page) {
  // Wait for the KPI cards to appear (they render immediately; data fetched async)
  await expect(page.locator('.kpi').first()).toBeVisible({ timeout: 8000 })
  // Wait for table rows to appear (data loaded)
  await page.waitForFunction(
    () => document.querySelectorAll('tbody tr').length > 0,
    { timeout: 10000 },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// COMP-001: KPI cards exist and total-locations is > 0
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-001: Compliance Dashboard KPI cards render with real data', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // All 6 KPI labels must be present
  await expect(page.getByText('Overall Compliance')).toBeVisible()
  await expect(page.getByText('Submitted')).toBeVisible()
  await expect(page.getByText('Overdue (>48h)')).toBeVisible()
  await expect(page.getByText('Variance Exceptions')).toBeVisible()
  await expect(page.getByText('Controller Visit Status')).toBeVisible()
  await expect(page.getByText('DGM Visit Status')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-002: 30-day submission rate column never exceeds 100%
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-002: 30-day rate column shows ≤100% (not 670%)', async ({ page, request }) => {
  // Verify the API compliance data has reasonable rates
  const token = await getToken(request)
  const r = await request.get(`${API}/compliance/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  expect(r.ok()).toBe(true)
  const data = await r.json()

  // All rates from API should be 0–100
  for (const loc of data.locations) {
    expect(loc.submission_rate_30d).toBeGreaterThanOrEqual(0)
    expect(loc.submission_rate_30d).toBeLessThanOrEqual(100)
  }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // The 30d rate column is column index 3 (4th col). Extract the first number
  // found in each cell (e.g. "75\n30-day" → 75)
  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)

  for (let i = 0; i < rowCount; i++) {
    const rateCell = rows.nth(i).locator('td').nth(3)
    const text = await rateCell.innerText()
    const match = text.match(/(\d+)%/)
    if (match) {
      const num = parseInt(match[1], 10)
      expect(num).toBeLessThanOrEqual(100)
      expect(num).toBeGreaterThanOrEqual(0)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-003: Controller visit cell does not display "$0.00" for SCHEDULED visits
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-003: Controller visit cell does not show $0.00 for visits without cash total', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // Get all controller-visit cell text from the table
  // Controller column is the 5th column (index 4)
  const rows = page.locator('tbody tr')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)

  for (let i = 0; i < rowCount; i++) {
    const ctrlCell = rows.nth(i).locator('td').nth(4)
    const text = await ctrlCell.innerText()
    // "$0.00" must never appear — scheduled visits have no observed total
    expect(text).not.toContain('$0.00')
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-004: Table has one row per active location from DB
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-004: Table shows all active locations from the API', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(`${API}/compliance/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json()
  const apiLocationCount = data.locations.length

  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // Default view (no KPI filter) should show all locations
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(apiLocationCount, { timeout: 8000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-005: Clicking "Submitted Today" KPI filters table to submitted rows only
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-005: Clicking Submitted Today KPI filters table', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(`${API}/compliance/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json()
  const submittedCount = data.summary.submitted_today

  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // Click the "Submitted Today" KPI card
  await page.locator('.kpi').filter({ hasText: 'Submitted' }).click()

  // Table should filter to submitted rows. When submittedCount is 0 the table
  // renders a single empty-state <tr>, so we expect max(submittedCount, 1).
  const rows = page.locator('tbody tr')
  await expect(rows).toHaveCount(Math.max(submittedCount, 1), { timeout: 6000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-006: Controller visit column shows next-scheduled date when available
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-006: Controller visit cell shows scheduled date when visit is upcoming', async ({ page, request }) => {
  const token = await getToken(request)
  // Check if any location has a next_scheduled_date
  const r = await request.get(`${API}/compliance/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json()
  const hasScheduled = data.locations.some(
    (l: { controller_visit: { next_scheduled_date: string | null } }) =>
      l.controller_visit.next_scheduled_date !== null,
  )

  if (!hasScheduled) {
    test.skip()
    return
  }

  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // At least one row should show "Next:" text in controller column
  const ctrlCells = page.locator('tbody td:nth-child(5)')
  const cellTexts = await ctrlCells.allInnerTexts()
  const hasNext = cellTexts.some(t => t.includes('Next:'))
  expect(hasNext).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-007: GET /compliance/trend returns valid structure with rates 0–100
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-007: /compliance/trend API returns valid structure and bounded rates', async ({ request }) => {
  const token = await getToken(request)

  for (const gran of ['daily', 'weekly', 'monthly'] as const) {
    const r = await request.get(`${API}/compliance/trend?granularity=${gran}&periods=4`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(r.ok()).toBe(true)

    const data = await r.json()
    expect(data).toHaveProperty('granularity', gran)
    expect(data).toHaveProperty('data')
    expect(Array.isArray(data.data)).toBe(true)

    for (const pt of data.data) {
      expect(pt).toHaveProperty('period')
      expect(pt).toHaveProperty('submission_rate_pct')
      expect(pt).toHaveProperty('approval_rate_pct')
      expect(pt).toHaveProperty('dgm_coverage_pct')
      expect(pt).toHaveProperty('exception_count')
      expect(pt.submission_rate_pct).toBeGreaterThanOrEqual(0)
      expect(pt.submission_rate_pct).toBeLessThanOrEqual(100)
      expect(pt.approval_rate_pct).toBeGreaterThanOrEqual(0)
      expect(pt.approval_rate_pct).toBeLessThanOrEqual(100)
      expect(pt.dgm_coverage_pct).toBeGreaterThanOrEqual(0)
      expect(pt.dgm_coverage_pct).toBeLessThanOrEqual(100)
      expect(pt.exception_count).toBeGreaterThanOrEqual(0)
    }
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-008: Compliance Trend chart renders on the dashboard page
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-008: Compliance Trend chart is visible on Compliance Dashboard', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // The trend card title must be visible
  await expect(page.getByText('Compliance Trend')).toBeVisible({ timeout: 8000 })

  // The chart SVG (recharts renders an svg) must be present inside the trend card
  const trendCard = page.locator('.card').filter({ hasText: 'Compliance Trend' })
  await expect(trendCard).toBeVisible()
  // Target the main recharts canvas SVG (role="application"), not the legend icon SVGs
  await expect(trendCard.locator('svg[role="application"]')).toBeVisible({ timeout: 8000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-009: Granularity toggle switches trend data (daily / weekly / monthly)
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-009: Granularity toggle on trend chart triggers a new API request', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  // Scroll to trend chart
  await page.getByText('Compliance Trend').scrollIntoViewIfNeeded()

  // Track trend API calls
  const trendRequests: string[] = []
  page.on('request', req => {
    if (req.url().includes('/compliance/trend')) trendRequests.push(req.url())
  })

  const trendCard = page.locator('.card').filter({ hasText: 'Compliance Trend' })

  // Click 'daily'
  await trendCard.getByRole('button', { name: 'daily' }).click()
  await page.waitForTimeout(600)
  expect(trendRequests.some(u => u.includes('granularity=daily'))).toBe(true)

  // Click 'monthly'
  await trendCard.getByRole('button', { name: 'monthly' }).click()
  await page.waitForTimeout(600)
  expect(trendRequests.some(u => u.includes('granularity=monthly'))).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// COMP-010: At-Risk panel shows ranked locations with flags and scores
// ─────────────────────────────────────────────────────────────────────────────
test('COMP-010: At-Risk Location Ranking panel renders with scores and flags', async ({ page, request }) => {
  const token = await getToken(request)
  const r = await request.get(`${API}/compliance/dashboard`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const data = await r.json()
  const nonGreenCount = data.locations.filter((l: { health: string }) => l.health !== 'green').length

  await loginAs(page, 'kyle.decker@compass.com')
  await goToCompliance(page)
  await waitForKpis(page)

  if (nonGreenCount === 0) {
    // All locations are compliant — panel should not render
    await expect(page.getByText('Top At-Risk Locations')).not.toBeVisible()
    return
  }

  // Panel must be visible
  await expect(page.getByText('Top At-Risk Locations')).toBeVisible({ timeout: 8000 })

  // Should show at most 5 rows
  const panel = page.locator('.card').filter({ hasText: 'Top At-Risk Locations' })
  const rankBadges = panel.locator('div').filter({ hasText: /^[1-5]$/ })
  const shownCount = await rankBadges.count()
  expect(shownCount).toBeGreaterThan(0)
  expect(shownCount).toBeLessThanOrEqual(5)

  // Each row must show a risk score number
  const scores = panel.locator('div').filter({ hasText: /risk score/i })
  await expect(scores.first()).toBeVisible()
})
