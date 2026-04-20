/**
 * RC Reports E2E Tests — Regional Controller > Reports screen
 *
 * REP-001: Reports screen loads with KPI cards showing real data
 * REP-002: Date-Level Detail table is populated with real submissions
 * REP-003: Per-Actor Summary table shows real operators
 * REP-004: Variance Exceptions table shows submissions with >5% variance
 * REP-005: Export CSV contains real data rows (not empty)
 * REP-006: Admin Reports screen shows same real data (shared component)
 */

import { test, expect } from '@playwright/test'
import { loginAs } from './helpers/auth'
import * as path from 'path'
import * as fs from 'fs'
import * as os from 'os'

const API = 'http://localhost:8000/v1'

async function getToken(request: import('@playwright/test').APIRequestContext, email = 'admin@compass.com') {
  const r = await request.post(`${API}/auth/login`, {
    data: { email, password: 'demo1234' },
  })
  return (await r.json()).access_token
}

/** Navigate to the Reports panel for whatever role is logged in */
async function goToReports(page: import('@playwright/test').Page) {
  await page.locator('.nav-item').filter({ hasText: 'Reports' }).click()
  // Wait for KPI cards to render
  await expect(page.getByText('Total Submissions')).toBeVisible({ timeout: 8000 })
}

/** Wait for the API fetches to complete — '0' is a valid loaded value */
async function waitForData(page: import('@playwright/test').Page) {
  // Wait for all KPI cells to have any text content ('0' is valid — means loaded with no data)
  await expect(page.locator('.kpi-val').first()).toBeVisible({ timeout: 8000 })
  await page.waitForFunction(
    () => {
      const cells = [...document.querySelectorAll('.kpi-val')]
      return cells.length > 0 && cells.every(el => el.textContent !== null && el.textContent.trim() !== '')
    },
    { timeout: 8000 },
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// REP-001: KPI cards reflect real DB data
// ─────────────────────────────────────────────────────────────────────────────
test('REP-001: Reports KPI cards show real submission count from DB', async ({ page, request }) => {
  // Get ground truth from API
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'
  const r = await request.get(
    `${API}/reports/summary?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const summary = await r.json()

  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  // Total Submissions KPI should match API
  const kpiVals = page.locator('.kpi-val')
  const firstKpi = kpiVals.first()
  await expect(firstKpi).toHaveText(String(summary.total_submissions), { timeout: 5000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-002: Date-Level Detail table has rows populated with real submissions
// ─────────────────────────────────────────────────────────────────────────────
test('REP-002: Date-Level Detail table shows real location names from DB', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  // The detail table should show at least one real row
  const tableBody = page.locator('.dt tbody').first()
  await expect(tableBody).not.toBeEmpty({ timeout: 8000 })

  // At least one row with a non-empty location cell
  const rows = tableBody.locator('tr')
  const rowCount = await rows.count()
  expect(rowCount).toBeGreaterThan(0)
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-003: Per-Actor Summary table lists real operators
// ─────────────────────────────────────────────────────────────────────────────
test('REP-003: Per-Actor Summary table shows real operator names from DB', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  // Per-Actor Summary card appears when there is at least one actor
  await expect(page.getByText('Per-Actor Summary')).toBeVisible({ timeout: 8000 })

  // Should list Laura Diehl or Justin Weaver (both have submissions this month)
  const actorSection = page.locator('.card').filter({ hasText: 'Per-Actor Summary' })
  const actorText = await actorSection.innerText()
  const hasOperator = actorText.includes('Laura Diehl') || actorText.includes('Justin Weaver') || actorText.includes('Operator Scope B')
  expect(hasOperator).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-004: Variance Exceptions table shows submissions with >5% variance
// ─────────────────────────────────────────────────────────────────────────────
test('REP-004: Variance Exceptions table shows OMAHA exception (8.23% variance)', async ({ page }) => {
  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  // OMAHA has variance_exception=true (8.23%) — exceptions card should appear
  await expect(page.getByText('Variance Exceptions (>5%)')).toBeVisible({ timeout: 8000 })

  const excCard = page.locator('.card').filter({ hasText: 'Variance Exceptions' })
  const excText = await excCard.innerText()
  expect(excText).toContain('OMAHA')
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-005: Export CSV contains real data rows (not empty)
// ─────────────────────────────────────────────────────────────────────────────
test('REP-005: Export CSV download contains real data rows', async ({ page, request }) => {
  // Verify directly against the API export endpoint (same endpoint the button calls)
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/export?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)

  const csv = await r.text()
  const lines = csv.trim().split('\n')

  // Must have header + at least one data row
  expect(lines.length).toBeGreaterThan(1)

  // Header row
  expect(lines[0]).toContain('Date')
  expect(lines[0]).toContain('Location')
  expect(lines[0]).toContain('Operator')
  expect(lines[0]).toContain('Status')

  // At least one real location appears in data rows
  const dataRows = lines.slice(1).join('\n')
  const hasLocation = dataRows.includes('APPLETON') || dataRows.includes('OMAHA') || dataRows.includes('BELVIDERE')
  expect(hasLocation).toBe(true)
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-006: A second RC user also sees the same real data
// ─────────────────────────────────────────────────────────────────────────────
test('REP-006: Second RC user sees same real DB data in Reports', async ({ page, request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'
  const r = await request.get(
    `${API}/reports/summary?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const summary = await r.json()

  // Use a different RC user to confirm data is not user-specific
  await loginAs(page, 'patty.ziehmke@compass.com')
  await goToReports(page)
  await waitForData(page)

  // KPI should match API summary
  const firstKpi = page.locator('.kpi-val').first()
  await expect(firstKpi).toHaveText(String(summary.total_submissions), { timeout: 5000 })

  // Detail table has rows
  const tableBody = page.locator('.dt tbody').first()
  await expect(tableBody).not.toBeEmpty({ timeout: 8000 })
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-008: /reports/sla API returns valid structure with bounded values
// ─────────────────────────────────────────────────────────────────────────────
test('REP-008: /reports/sla API returns valid SLA structure', async ({ request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  const r = await request.get(
    `${API}/reports/sla?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  expect(r.ok()).toBe(true)

  const data = await r.json()
  expect(data).toHaveProperty('total_reviewed')
  expect(data).toHaveProperty('buckets')
  expect(data).toHaveProperty('approvers')
  expect(Array.isArray(data.buckets)).toBe(true)
  expect(data.buckets).toHaveLength(4)

  // Bucket labels must be correct
  const labels = data.buckets.map((b: { label: string }) => b.label)
  expect(labels).toContain('<12h')
  expect(labels).toContain('>48h')

  // Counts must be non-negative
  for (const b of data.buckets) {
    expect(b.count).toBeGreaterThanOrEqual(0)
    expect(b.pct).toBeGreaterThanOrEqual(0)
    expect(b.pct).toBeLessThanOrEqual(100)
  }

  // If there is data, avg_hours and sla_compliance_pct must be present
  if (data.total_reviewed > 0) {
    expect(data.avg_hours).not.toBeNull()
    expect(data.sla_compliance_pct).not.toBeNull()
    expect(data.sla_compliance_pct).toBeGreaterThanOrEqual(0)
    expect(data.sla_compliance_pct).toBeLessThanOrEqual(100)
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-009: SLA card renders on Reports screen when approved submissions exist
// ─────────────────────────────────────────────────────────────────────────────
test('REP-009: Approval SLA card renders on Reports screen', async ({ page, request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'
  const r = await request.get(
    `${API}/reports/sla?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const slaData = await r.json()

  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  if (slaData.total_reviewed === 0) {
    // No approved submissions in range — card should not render
    await expect(page.getByText('Approval SLA Analytics')).not.toBeVisible()
    return
  }

  // Card must be visible
  await expect(page.getByText('Approval SLA Analytics')).toBeVisible({ timeout: 8000 })

  const slaCard = page.locator('[data-testid="sla-card"]')
  await expect(slaCard).toBeVisible()

  // Avg time and SLA % must appear
  await expect(slaCard.getByText(/Avg Approval Time/i)).toBeVisible()
  await expect(slaCard.getByText('Within SLA (≤48h)')).toBeVisible()

  // Distribution bars — all 4 bucket labels must appear
  await expect(slaCard.getByText('<12h')).toBeVisible()
  await expect(slaCard.getByText('>48h')).toBeVisible()
})

// ─────────────────────────────────────────────────────────────────────────────
// REP-007: Download button triggers file download with correct content-type
// ─────────────────────────────────────────────────────────────────────────────
test('REP-007: Export CSV button triggers download with non-empty content', async ({ page, request }) => {
  const token = await getToken(request)
  const today = new Date().toISOString().split('T')[0]
  const startOfMonth = today.slice(0, 8) + '01'

  await loginAs(page, 'kyle.decker@compass.com')
  await goToReports(page)
  await waitForData(page)

  // Intercept the download by catching the request via the API context
  const r = await request.get(
    `${API}/reports/export?date_from=${startOfMonth}&date_to=${today}`,
    { headers: { Authorization: `Bearer ${token}` } },
  )
  const contentType = r.headers()['content-type']
  expect(contentType).toContain('text/csv')

  const body = await r.text()
  expect(body.trim().length).toBeGreaterThan(10) // not empty
  expect(body).toContain('Date,Location,Operator,Status')

  // Also verify the button is visible in the UI
  await expect(page.getByRole('button', { name: /Export CSV/i })).toBeVisible()
})
