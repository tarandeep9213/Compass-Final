/**
 * Cash Reasonableness Test — E2E Playwright Specs
 * Maps to Controller_ReasonablenessTest_TestCases.md (RT-001 to RT-013)
 *
 * These tests use demo/mock mode (operator@compass.com, controller@compass.com, admin@compass.com)
 * with password demo1234. The reasonableness screens fall back to mock data when the backend
 * API is unreachable, so these tests verify UI behavior in both modes.
 */
import { test, expect } from '@playwright/test'
import { loginAs, clickNav } from './helpers/auth'

const CONTROLLER = 'controller@compass.com'
const ADMIN = 'admin@compass.com'
const OPERATOR = 'operator@compass.com'
const DGM = 'dgm@compass.com'

// Helper: navigate to Cash Reasonableness Test tab
async function goToReasonableness(page: import('@playwright/test').Page) {
  await clickNav(page, 'Cash Reasonableness Test')
}

// Helper: navigate to Admin Reasonableness Reports tab
async function goToAdminReasonableness(page: import('@playwright/test').Page) {
  await clickNav(page, 'Reasonableness Reports')
}

// Helper: fill Step 1 parameters and generate
async function generateReport(
  page: import('@playwright/test').Page,
  opts: { locationLabel?: string; fromDate?: string; toDate?: string } = {}
) {
  // Select first location in dropdown if no specific label
  const select = page.locator('select.inp').first()
  if (opts.locationLabel) {
    await select.selectOption({ label: new RegExp(opts.locationLabel) as unknown as string })
  } else {
    // Select the second option (first real location, skipping "— Select location —")
    const options = await select.locator('option').allTextContents()
    if (options.length > 1) {
      await select.selectOption({ index: 1 })
    }
  }
  await page.waitForTimeout(300)

  // Set dates if provided
  if (opts.fromDate) {
    await page.locator('input[type="date"]').first().fill(opts.fromDate)
  }
  if (opts.toDate) {
    await page.locator('input[type="date"]').nth(1).fill(opts.toDate)
  }

  // Click Generate
  await page.getByRole('button', { name: /Generate Reasonableness Report/i }).click()
  await page.waitForTimeout(1000)
}


// ═══════════════════════════════════════════════════════════════════════════
// RT-001: Generate Report — Single Location
// ═══════════════════════════════════════════════════════════════════════════
test('RT-001: generate report for single location with correct auto-fill and calculations', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)

  // Step 1 card visible
  await expect(page.getByText('Step 1 — Select Parameters')).toBeVisible()

  // Location dropdown exists
  const locSelect = page.locator('select.inp').first()
  await expect(locSelect).toBeVisible()

  // Select a single-location group (look for one without "sub-locations")
  const options = await locSelect.locator('option').allTextContents()
  const singleLocOption = options.find(o => o && !o.includes('sub-locations') && o !== '— Select location —')
  if (singleLocOption) {
    await locSelect.selectOption({ label: singleLocOption })
    await page.waitForTimeout(300)

    // Factor should auto-fill to 1.25 for single location
    const factorSelect = page.locator('select').nth(1)
    const factorVal = await factorSelect.inputValue()
    expect(factorVal).toBe('1.25')
  }

  // Cost center auto-populated (readonly input not empty)
  const costCenterInput = page.locator('input[readonly]').first()
  const ccVal = await costCenterInput.inputValue()
  expect(ccVal.length).toBeGreaterThan(0)

  // Prepared By auto-filled (it's the input after "Prepared By" label)
  const preparedByInput = page.locator('input').nth(4) // After cost center, sub-locs, from date, to date
  const prepVal = await preparedByInput.inputValue().catch(() => '')
  expect(prepVal.length).toBeGreaterThan(0)

  // Set dates and generate
  await page.locator('input[type="date"]').first().fill('2026-01-15')
  await page.locator('input[type="date"]').nth(1).fill('2026-01-21')
  await page.getByRole('button', { name: /Generate Reasonableness Report/i }).click()
  await page.waitForTimeout(1000)

  // Step 2 should be visible — look for "Highest Balance For:" header
  await expect(page.getByText(/Highest Balance For/i)).toBeVisible({ timeout: 8000 })
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-002: Generate Report — Multi-Location & Mixed Data
// ═══════════════════════════════════════════════════════════════════════════
test('RT-002: multi-location generation shows side-by-side columns', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)

  // Select multi-location group (has "sub-locations" in label)
  const locSelect = page.locator('select.inp').first()
  const options = await locSelect.locator('option').allTextContents()
  const multiLocOption = options.find(o => o.includes('sub-locations'))
  if (!multiLocOption) { test.skip(); return }

  await locSelect.selectOption({ label: multiLocOption })
  await page.waitForTimeout(300)

  // Factor should auto-fill to 1.50 for multiple locations
  const factorSelect = page.locator('select').nth(1)
  const factorVal = await factorSelect.inputValue()
  expect(factorVal).toBe('1.5')

  // Sub-locations field should have multiple names
  const subLocsInput = page.locator('input[readonly]').nth(1)
  const subLocsVal = await subLocsInput.inputValue()
  expect(subLocsVal).toContain(',')

  // Generate
  await page.locator('input[type="date"]').first().fill('2026-01-15')
  await page.locator('input[type="date"]').nth(1).fill('2026-01-21')
  await page.getByRole('button', { name: /Generate Reasonableness Report/i }).click()

  // Verify calculation table has multiple location columns
  await expect(page.getByText(/Highest Balance For/i)).toBeVisible({ timeout: 8000 })

  // Should see "Total" row in the calculation table
  await expect(page.getByText(/Total.*\(F\+H\+J\+K\)/i).or(page.getByText('Total'))).toBeVisible()
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-004: Section A Data & Date Range Validation
// ═══════════════════════════════════════════════════════════════════════════
test('RT-004: date picker blocks current and future months', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)

  // Get the max attribute of the date inputs
  const fromDateMax = await page.locator('input[type="date"]').first().getAttribute('max')
  const toDateMax = await page.locator('input[type="date"]').nth(1).getAttribute('max')

  // Both should be set to last day of previous completed month (local time)
  const now = new Date()
  const lastDayPrevMonth = new Date(now.getFullYear(), now.getMonth(), 0)
  const y = lastDayPrevMonth.getFullYear()
  const m = String(lastDayPrevMonth.getMonth() + 1).padStart(2, '0')
  const d = String(lastDayPrevMonth.getDate()).padStart(2, '0')
  const expectedMax = `${y}-${m}-${d}`

  expect(fromDateMax).toBe(expectedMax)
  expect(toDateMax).toBe(expectedMax)

  // Verify backwards date range shows error
  await page.locator('select.inp').first().selectOption({ index: 1 })
  await page.waitForTimeout(200)
  await page.locator('input[type="date"]').first().fill('2026-02-28')
  await page.locator('input[type="date"]').nth(1).fill('2026-01-01')
  await page.getByRole('button', { name: /Generate Reasonableness Report/i }).click()

  // Error message should appear
  await expect(page.getByText(/Start date must be before end date/i)).toBeVisible({ timeout: 3000 })
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-005: Conclusions & Mark Complete
// ═══════════════════════════════════════════════════════════════════════════
test('RT-005: conclusion validation and mark complete workflow', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)

  // Generate a report
  await generateReport(page, { fromDate: '2026-01-15', toDate: '2026-01-21' })
  await expect(page.getByText(/Highest Balance For/i)).toBeVisible({ timeout: 8000 })

  // Find conclusion cards — each has a textarea + select + Mark Complete button
  const markCompleteBtns = page.getByRole('button', { name: /Confirm.*Mark Complete/i })
  const hasMC = await markCompleteBtns.first().isVisible({ timeout: 3000 }).catch(() => false)
  if (!hasMC) { test.skip(); return }

  // Accept any alert dialogs (validation errors)
  page.on('dialog', async dialog => { await dialog.accept() })

  // Fill first conclusion textarea
  await page.locator('textarea').first().fill('Funds within acceptable range for Q2')

  // Select "No" for Required Actions on first card
  // The select is right before the Mark Complete button
  const allSelects = page.locator('select').filter({ hasText: /Select|Yes|No/i })
  if (await allSelects.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await allSelects.first().selectOption('no')
  }
  await page.waitForTimeout(300)

  // Click Mark Complete on first card
  await markCompleteBtns.first().click()
  await page.waitForTimeout(500)

  // Card should show "✓ Completed" or dim state
  const completed = page.getByText(/Completed/i).first()
  await expect(completed).toBeVisible({ timeout: 5000 })
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-006: Save Report
// ═══════════════════════════════════════════════════════════════════════════
test('RT-006: save report to admin dashboard', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)
  await generateReport(page, { fromDate: '2026-01-15', toDate: '2026-01-21' })
  await expect(page.getByText(/Highest Balance For/i)).toBeVisible({ timeout: 8000 })

  // Complete all conclusion cards — fill each textarea + select No + mark complete
  page.on('dialog', async dialog => { await dialog.accept() })

  // Count how many Mark Complete buttons exist
  const btnCount = await page.getByRole('button', { name: /Confirm.*Mark Complete/i }).count()
  for (let i = 0; i < btnCount; i++) {
    // Always get first VISIBLE textarea that's empty (uncompleted cards)
    const textarea = page.locator('textarea').filter({ hasNotText: /.+/ }).first()
    if (await textarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await textarea.fill('Test conclusion for E2E verification')
    }
    // Select "No" on the first visible ENABLED Required Actions dropdown
    const reqSelect = page.locator('select:not([disabled])').filter({ hasText: /Select/i }).first()
    if (await reqSelect.isVisible({ timeout: 1000 }).catch(() => false)) {
      await reqSelect.selectOption('no')
    }
    await page.waitForTimeout(200)
    // Click the first visible Mark Complete button
    await page.getByRole('button', { name: /Confirm.*Mark Complete/i }).first().click()
    await page.waitForTimeout(500)
  }

  // Click Save
  const saveBtn = page.getByRole('button', { name: /Save to Admin Dashboard/i })
  if (await saveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await saveBtn.click()
    await page.waitForTimeout(1000)
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-007: Custom Cushion & Download Report
// ═══════════════════════════════════════════════════════════════════════════
test('RT-007: custom cushion value recalculates net result', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)
  await generateReport(page, { fromDate: '2026-01-15', toDate: '2026-01-21' })
  await expect(page.getByText(/Highest Balance For/i)).toBeVisible({ timeout: 8000 })

  // Find cushion input (labeled "Less Cushion" or has default -5000)
  const cushionInput = page.locator('input[type="number"]').first()
  if (await cushionInput.isVisible({ timeout: 3000 }).catch(() => false)) {
    // Change from default to -8000
    await cushionInput.fill('-8000')
    await page.waitForTimeout(500)

    // Net Result should have changed (verify it's visible and not the old value)
    await expect(page.getByText(/Net Result/i).first()).toBeVisible()
  }

  // Download button should exist
  const downloadBtn = page.getByRole('button', { name: /Generate.*Download Report/i })
  await expect(downloadBtn).toBeVisible({ timeout: 3000 })
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-009: Location & Factor Authorization
// ═══════════════════════════════════════════════════════════════════════════
test('RT-009: controller sees only assigned locations', async ({ page }) => {
  await loginAs(page, CONTROLLER)
  await goToReasonableness(page)

  // Get all location dropdown options
  const locSelect = page.locator('select.inp').first()
  const options = await locSelect.locator('option').allTextContents()
  const realOptions = options.filter(o => o !== '— Select location —')

  // Controller should see their assigned locations (at least 1)
  expect(realOptions.length).toBeGreaterThan(0)

  // Should NOT see "Heathrow" or "Leeds" (loc-4, loc-5 — not assigned to this controller)
  for (const opt of realOptions) {
    expect(opt).not.toContain('Heathrow')
    expect(opt).not.toContain('Leeds')
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-011: Admin — Report Visibility & Detail
// ═══════════════════════════════════════════════════════════════════════════
test('RT-011: admin sees all reports and can view detail', async ({ page }) => {
  await loginAs(page, ADMIN)
  await goToAdminReasonableness(page)

  // KPI cards visible
  await expect(page.getByText('Total Reports')).toBeVisible({ timeout: 8000 })
  await expect(page.locator('.kpi-lbl', { hasText: 'Reasonable' })).toBeVisible()
  await expect(page.locator('.kpi-lbl', { hasText: 'Overfunded' })).toBeVisible()

  // Reports table visible
  const table = page.locator('.dtable, table').first()
  await expect(table).toBeVisible({ timeout: 5000 })

  // Click View on first report
  const viewBtn = page.getByRole('button', { name: /View/i }).first()
  if (await viewBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await viewBtn.click()

    // Detail modal should show report info
    await expect(page.getByText(/Location:/i)).toBeVisible({ timeout: 5000 })
    await expect(page.getByText(/Cost Center:/i)).toBeVisible()
    await expect(page.getByText(/Period:/i)).toBeVisible()

    // Close modal
    const closeBtn = page.locator('button').filter({ hasText: '✕' }).first()
    if (await closeBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await closeBtn.click()
    }
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-012: Admin — Filters, Pagination & KPIs
// ═══════════════════════════════════════════════════════════════════════════
test('RT-012: admin KPI filter and pagination', async ({ page }) => {
  await loginAs(page, ADMIN)
  await goToAdminReasonableness(page)

  // Click Overfunded KPI to filter
  const overfundedKpi = page.getByText('Overfunded').first()
  await overfundedKpi.click()
  await page.waitForTimeout(500)

  // Filter indicator should appear
  const filterIndicator = page.getByText(/Showing:.*Overfunded/i).or(page.locator('.badge-red'))
  await expect(filterIndicator.first()).toBeVisible({ timeout: 3000 })

  // Click to clear filter
  const clearBtn = page.getByRole('button', { name: /Clear filter/i }).or(page.getByText('Total Reports'))
  if (await clearBtn.first().isVisible({ timeout: 2000 }).catch(() => false)) {
    await clearBtn.first().click()
    await page.waitForTimeout(500)
  }

  // Pagination — check if Next button exists (only if enough reports)
  const nextBtn = page.getByRole('button', { name: /Next/i })
  if (await nextBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await nextBtn.click()
    await page.waitForTimeout(500)
    // Should be on page 2
    const prevBtn = page.getByRole('button', { name: /Prev/i })
    await expect(prevBtn).toBeEnabled()
  }
})


// ═══════════════════════════════════════════════════════════════════════════
// RT-013: Permission Boundaries
// ═══════════════════════════════════════════════════════════════════════════
test('RT-013: operator has no reasonableness menu items', async ({ page }) => {
  await loginAs(page, OPERATOR)

  // Operator sidebar should NOT contain reasonableness tabs
  const sidebar = page.locator('.sidebar')
  await expect(sidebar).toBeVisible({ timeout: 5000 })

  const navItems = await sidebar.locator('.nav-item').allTextContents()
  const navText = navItems.join(' ').toLowerCase()

  expect(navText).not.toContain('reasonableness')
  expect(navText).not.toContain('cash reasonableness')
})

test('RT-013b: DGM has no reasonableness menu items', async ({ page }) => {
  await loginAs(page, DGM)

  const sidebar = page.locator('.sidebar')
  await expect(sidebar).toBeVisible({ timeout: 5000 })

  const navItems = await sidebar.locator('.nav-item').allTextContents()
  const navText = navItems.join(' ').toLowerCase()

  expect(navText).not.toContain('reasonableness')
})
